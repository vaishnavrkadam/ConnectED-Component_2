import {
  addDoc,
  collection,
  doc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { detectTopicCategory } from '../utils/categories';
import { keywordSimilarity } from '../ml/keywordSimilarity';

const teamsRef = collection(db, 'teams');
const pendingRef = collection(db, 'pending_allocations');

export function recentTeamsQuery() {
  return query(teamsRef, orderBy('timestamp', 'desc'), limit(20));
}

export function allTeamsQuery() {
  return query(teamsRef, orderBy('timestamp', 'asc'));
}

export function pendingAllocationsQuery() {
  return query(pendingRef, orderBy('timestamp', 'asc'));
}

export async function submitTeam({ teamLeader, members, topic }) {
  const created = await addDoc(teamsRef, {
    teamId: crypto.randomUUID(),
    teamLeader: teamLeader.trim(),
    members: members.map((member) => member.trim()).filter(Boolean),
    topic: topic.trim(),
    category: detectTopicCategory(topic),
    timestamp: serverTimestamp(),
    status: 'SUBMITTED',
    allocatedFaculty: null,
    similarityScore: null,
  });

  await allocateTeamByExpertise(created.id, topic.trim());
  return created.id;
}

export async function allocateTeamByExpertise(teamDocId, topic) {
  const facultySnapshot = await getDocs(query(collection(db, 'faculty'), orderBy('facultyName')));
  const faculty = facultySnapshot.docs
    .map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }))
    .filter((item) => Number(item.allocatedTeams || 0) < Number(item.maxTeams || 0));

  if (faculty.length === 0) {
    await markTeamPending(teamDocId, topic, 'No faculty has available allocation slots.');
    return null;
  }

  const rankedFaculty = keywordSimilarity(topic, faculty);

  const selectedFaculty = rankedFaculty[0];
  if (!selectedFaculty) {
    await markTeamPending(teamDocId, topic, 'No faculty expertise data is available.');
    return null;
  }

  if (selectedFaculty.previewScore <= 0) {
    await markTeamPending(teamDocId, topic, 'No faculty expertise matched this topic.');
    return null;
  }

  await runTransaction(db, async (transaction) => {
    const teamRef = doc(db, 'teams', teamDocId);
    const facultyRef = doc(db, 'faculty', selectedFaculty.id);
    const teamSnapshot = await transaction.get(teamRef);
    const facultySnapshot = await transaction.get(facultyRef);

    if (!teamSnapshot.exists()) throw new Error('Team submission was not found.');
    if (!facultySnapshot.exists()) throw new Error('Selected faculty was not found.');

    const facultyData = facultySnapshot.data();
    if (Number(facultyData.allocatedTeams || 0) >= Number(facultyData.maxTeams || 0)) {
      throw new Error(`${facultyData.facultyName} has reached the maximum team limit. Submit again to retry allocation.`);
    }

    transaction.update(facultyRef, {
      allocatedTeams: increment(1),
      updatedAt: serverTimestamp(),
    });
    transaction.update(teamRef, {
      status: 'AUTO_ALLOCATED',
      allocatedFaculty: {
        id: selectedFaculty.id,
        facultyId: facultyData.facultyId,
        facultyName: facultyData.facultyName,
        email: facultyData.email,
      },
      similarityScore: Number(Math.min(selectedFaculty.previewScore || 0, 1).toFixed(4)),
      matchDebug: selectedFaculty.matchDebug || null,
      updatedAt: serverTimestamp(),
    });
    transaction.delete(doc(db, 'pending_allocations', teamDocId));
  });

  return selectedFaculty;
}

async function markTeamPending(teamDocId, topic, reason) {
  await updateDoc(doc(db, 'teams', teamDocId), {
    status: 'PENDING',
    allocatedFaculty: null,
    similarityScore: null,
    updatedAt: serverTimestamp(),
  });

  await setDoc(
    doc(db, 'pending_allocations', teamDocId),
    {
      teamId: teamDocId,
      topic,
      reason,
      timestamp: serverTimestamp(),
    },
    { merge: true },
  );
}

export function manuallyAssignTeam(teamId, faculty, similarityScore = 1) {
  return runTransaction(db, async (transaction) => {
    const teamRef = doc(db, 'teams', teamId);
    const facultyRef = doc(db, 'faculty', faculty.id);
    const teamSnapshot = await transaction.get(teamRef);
    const previousFacultyId = teamSnapshot.data()?.allocatedFaculty?.id;

    if (previousFacultyId && previousFacultyId !== faculty.id) {
      transaction.update(doc(db, 'faculty', previousFacultyId), {
        allocatedTeams: increment(-1),
      });
    }

    if (previousFacultyId !== faculty.id) {
      transaction.update(facultyRef, {
        allocatedTeams: increment(1),
      });
    }

    transaction.update(teamRef, {
      allocatedFaculty: {
        id: faculty.id,
        facultyId: faculty.facultyId,
        facultyName: faculty.facultyName,
        email: faculty.email,
      },
      similarityScore,
      status: 'MANUALLY_ALLOCATED',
      updatedAt: serverTimestamp(),
    });
    transaction.delete(doc(db, 'pending_allocations', teamId));
  });
}
