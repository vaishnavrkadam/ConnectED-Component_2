import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase/config';

const facultyRef = collection(db, 'faculty');

export function facultyQuery() {
  return query(facultyRef, orderBy('facultyName'));
}

export async function getFaculty() {
  const snapshot = await getDocs(facultyQuery());
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function saveFaculty(payload, id) {
  const data = {
    facultyId: payload.facultyId.trim(),
    facultyName: payload.facultyName.trim(),
    expertise: payload.expertise.map((item) => item.trim()).filter(Boolean),
    maxTeams: Number(payload.maxTeams),
    allocatedTeams: Number(payload.allocatedTeams || 0),
    email: payload.email.trim().toLowerCase(),
    updatedAt: serverTimestamp(),
  };

  if (id) {
    await updateDoc(doc(db, 'faculty', id), data);
    return id;
  }

  const created = await addDoc(facultyRef, { ...data, createdAt: serverTimestamp() });
  return created.id;
}

export function deleteFaculty(id) {
  return deleteDoc(doc(db, 'faculty', id));
}
