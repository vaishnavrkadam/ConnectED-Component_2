import {
  addDoc,
  collection,
  doc,
  increment,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/config';
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

  return created.id;
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
