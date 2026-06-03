import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
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

export function manuallyAssignTeam(teamId, faculty, similarityScore = 1) {
  return updateDoc(doc(db, 'teams', teamId), {
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
}

export function deleteTeam(teamId) {
  return deleteDoc(doc(db, 'teams', teamId));
}
