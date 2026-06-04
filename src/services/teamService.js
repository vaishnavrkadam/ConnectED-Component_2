import {
  collection,
  doc,
  getDocs,
  increment,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { keywordSimilarity } from '../ml/keywordSimilarity';
import { detectTopicCategory } from '../utils/categories';

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

async function rankedAvailableFaculty(topic) {
  const snapshot = await getDocs(query(collection(db, 'faculty'), orderBy('facultyName')));
  const faculty = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));

  return keywordSimilarity(topic, faculty).filter((item) => Number(item.allocatedTeams || 0) < Number(item.maxTeams || 0));
}

export async function submitTeam({ teamLeader, members, topic }) {
  const trimmedTopic = topic.trim();
  const teamRef = doc(teamsRef);
  const candidates = await rankedAvailableFaculty(trimmedTopic);
  let allocationStatus = 'PENDING';
  const teamData = {
    teamId: crypto.randomUUID(),
    teamLeader: teamLeader.trim(),
    members: members.map((member) => member.trim()).filter(Boolean),
    topic: trimmedTopic,
    category: detectTopicCategory(trimmedTopic),
    timestamp: serverTimestamp(),
    status: 'SUBMITTED',
    allocatedFaculty: null,
    similarityScore: null,
  };

  await runTransaction(db, async (transaction) => {
    let selected = null;

    for (const candidate of candidates) {
      const facultyRef = doc(db, 'faculty', candidate.id);
      const facultySnapshot = await transaction.get(facultyRef);
      const faculty = facultySnapshot.data();

      if (facultySnapshot.exists() && Number(faculty.allocatedTeams || 0) < Number(faculty.maxTeams || 0)) {
        selected = {
          ...candidate,
          ...faculty,
          id: candidate.id,
          ref: facultyRef,
        };
        break;
      }
    }

    if (selected) {
      allocationStatus = 'AUTO_ALLOCATED';
      transaction.set(teamRef, {
        ...teamData,
        status: 'AUTO_ALLOCATED',
        allocatedFaculty: {
          id: selected.id,
          facultyId: selected.facultyId,
          facultyName: selected.facultyName,
          email: selected.email,
        },
        similarityScore: selected.previewScore,
        updatedAt: serverTimestamp(),
      });
      transaction.update(selected.ref, {
        allocatedTeams: increment(1),
        updatedAt: serverTimestamp(),
      });
      transaction.delete(doc(db, 'pending_allocations', teamRef.id));
      return;
    }

    transaction.set(teamRef, {
      ...teamData,
      status: 'PENDING',
      updatedAt: serverTimestamp(),
    });
    transaction.set(doc(db, 'pending_allocations', teamRef.id), {
      teamId: teamData.teamId,
      topic: trimmedTopic,
      reason: candidates.length === 0 ? 'No faculty has available allocation slots.' : 'No available faculty could be confirmed.',
      timestamp: serverTimestamp(),
    });
  });

  return { id: teamRef.id, status: allocationStatus };
}

export async function manuallyAssignTeam(teamId, faculty, similarityScore = 1) {
  const teamRef = doc(db, 'teams', teamId);

  return runTransaction(db, async (transaction) => {
    const teamSnapshot = await transaction.get(teamRef);
    const currentFacultyId = teamSnapshot.data()?.allocatedFaculty?.id;

    if (currentFacultyId && currentFacultyId !== faculty.id) {
      transaction.update(doc(db, 'faculty', currentFacultyId), {
        allocatedTeams: increment(-1),
        updatedAt: serverTimestamp(),
      });
    }

    if (currentFacultyId !== faculty.id) {
      transaction.update(doc(db, 'faculty', faculty.id), {
        allocatedTeams: increment(1),
        updatedAt: serverTimestamp(),
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
  });
}

export async function deleteTeam(team) {
  const teamId = typeof team === 'string' ? team : team.id;
  const teamRef = doc(db, 'teams', teamId);

  return runTransaction(db, async (transaction) => {
    const teamSnapshot = typeof team === 'string' ? await transaction.get(teamRef) : null;
    const deletedTeam = teamSnapshot?.data() || team;
    const facultyId = deletedTeam?.allocatedFaculty?.id;

    if (facultyId) {
      const facultyRef = doc(db, 'faculty', facultyId);
      const facultySnapshot = await transaction.get(facultyRef);

      if (facultySnapshot.exists()) {
        const nextAllocation = Math.max(Number(facultySnapshot.data()?.allocatedTeams || 0) - 1, 0);

        transaction.update(facultyRef, {
          allocatedTeams: nextAllocation,
          updatedAt: serverTimestamp(),
        });
      }
    }

    transaction.delete(teamRef);
    transaction.delete(doc(db, 'pending_allocations', teamId));
  });
}
