import * as use from '@tensorflow-models/universal-sentence-encoder';
import '@tensorflow/tfjs';
import admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { onDocumentCreated, onDocumentDeleted, onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { logger } from 'firebase-functions';

admin.initializeApp();
const db = admin.firestore();

const SIMILARITY_THRESHOLD = Number(process.env.SIMILARITY_THRESHOLD || 0.45);
let modelPromise;

function getModel() {
  if (!modelPromise) modelPromise = use.load();
  return modelPromise;
}

function cosineSimilarity(vectorA, vectorB) {
  let dot = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;
  for (let index = 0; index < vectorA.length; index += 1) {
    dot += vectorA[index] * vectorB[index];
    magnitudeA += vectorA[index] ** 2;
    magnitudeB += vectorB[index] ** 2;
  }
  if (!magnitudeA || !magnitudeB) return 0;
  return dot / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
}

async function rankFacultyBySimilarity(topic, facultyDocs) {
  const availableFaculty = facultyDocs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((faculty) => Number(faculty.allocatedTeams || 0) < Number(faculty.maxTeams || 0));

  if (availableFaculty.length === 0) return [];

  const expertiseTexts = availableFaculty.map((faculty) => (faculty.expertise || []).join(', '));
  const model = await getModel();
  const embeddings = await model.embed([topic, ...expertiseTexts]);
  const vectors = await embeddings.array();
  embeddings.dispose();

  const topicVector = vectors[0];
  return availableFaculty
    .map((faculty, index) => ({
      faculty,
      similarityScore: cosineSimilarity(topicVector, vectors[index + 1]),
    }))
    .sort((a, b) => b.similarityScore - a.similarityScore);
}

async function markPending(transaction, teamRef, team, reason) {
  transaction.update(teamRef, {
    status: 'PENDING',
    allocatedFaculty: null,
    similarityScore: null,
    updatedAt: FieldValue.serverTimestamp(),
  });

  const pendingRef = db.collection('pending_allocations').doc(teamRef.id);
  transaction.set(
    pendingRef,
    {
      teamId: team.teamId || teamRef.id,
      topic: team.topic,
      reason,
      timestamp: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

async function decrementFacultyAllocation(transaction, facultyId) {
  if (!facultyId) return;

  const facultyRef = db.collection('faculty').doc(facultyId);
  const facultySnapshot = await transaction.get(facultyRef);
  if (!facultySnapshot.exists) return;

  const faculty = facultySnapshot.data();
  transaction.update(facultyRef, {
    allocatedTeams: Math.max(Number(faculty.allocatedTeams || 0) - 1, 0),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export const allocateMentorOnTeamCreate = onDocumentCreated(
  {
    document: 'teams/{teamDocId}',
    region: 'asia-south1',
    memory: '1GiB',
    timeoutSeconds: 300,
  },
  async (event) => {
    const teamRef = event.data.ref;
    const team = event.data.data();

    if (!team?.topic || team.allocatedFaculty) return;

    const facultySnapshot = await db.collection('faculty').get();
    const rankedFaculty = await rankFacultyBySimilarity(team.topic, facultySnapshot.docs);
    const eligibleFaculty = rankedFaculty.filter((item) => item.similarityScore >= SIMILARITY_THRESHOLD);

    await db.runTransaction(async (transaction) => {
      const freshTeam = await transaction.get(teamRef);
      if (!freshTeam.exists || freshTeam.data().allocatedFaculty) return;

      if (eligibleFaculty.length === 0) {
        await markPending(
          transaction,
          teamRef,
          team,
          rankedFaculty.length === 0 ? 'No faculty has available allocation slots.' : 'No relevant expertise exceeded threshold.',
        );
        return;
      }

      let selected = null;
      for (const candidate of eligibleFaculty) {
        const facultyRef = db.collection('faculty').doc(candidate.faculty.id);
        const facultyDoc = await transaction.get(facultyRef);
        const faculty = facultyDoc.data();
        if (facultyDoc.exists && Number(faculty.allocatedTeams || 0) < Number(faculty.maxTeams || 0)) {
          selected = { ...candidate, facultyRef, faculty };
          break;
        }
      }

      if (!selected) {
        await markPending(transaction, teamRef, team, 'All relevant faculty are at maximum allocation.');
        return;
      }

      transaction.update(selected.facultyRef, {
        allocatedTeams: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.update(teamRef, {
        status: 'AUTO_ALLOCATED',
        allocatedFaculty: {
          id: selected.facultyRef.id,
          facultyId: selected.faculty.facultyId,
          facultyName: selected.faculty.facultyName,
          email: selected.faculty.email,
        },
        similarityScore: Number(selected.similarityScore.toFixed(4)),
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.delete(db.collection('pending_allocations').doc(teamRef.id));
    });

    logger.info('Allocation complete', { teamId: team.teamId || teamRef.id });
  },
);

export const syncManualAllocationCounts = onDocumentUpdated(
  {
    document: 'teams/{teamDocId}',
    region: 'asia-south1',
  },
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();
    const beforeFaculty = before.allocatedFaculty?.id;
    const afterFaculty = after.allocatedFaculty?.id;

    if (beforeFaculty === afterFaculty) return;

    await db.runTransaction(async (transaction) => {
      if (beforeFaculty) {
        await decrementFacultyAllocation(transaction, beforeFaculty);
      }

      if (afterFaculty) {
        transaction.update(db.collection('faculty').doc(afterFaculty), {
          allocatedTeams: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      transaction.delete(db.collection('pending_allocations').doc(event.params.teamDocId));
    });
  },
);

export const syncDeletedTeamAllocationCounts = onDocumentDeleted(
  {
    document: 'teams/{teamDocId}',
    region: 'asia-south1',
  },
  async (event) => {
    const deletedTeam = event.data?.data();
    const facultyId = deletedTeam?.allocatedFaculty?.id;

    await db.runTransaction(async (transaction) => {
      await decrementFacultyAllocation(transaction, facultyId);
      transaction.delete(db.collection('pending_allocations').doc(event.params.teamDocId));
    });

    logger.info('Deleted team allocation count synced', {
      teamDocId: event.params.teamDocId,
      facultyId: facultyId || null,
    });
  },
);
