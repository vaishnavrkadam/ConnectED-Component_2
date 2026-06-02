# AI-Assisted Mentor Allocation System

A full-stack college project mentor allocation system built with React 19, Vite, Material UI v7, Firestore, Cloud Functions, and TensorFlow.js Universal Sentence Encoder.

## What It Does

- Opens directly without Firebase Authentication for a simple project-demo flow.
- Lets team leaders submit leader name, four members, and a project topic.
- Stores team submissions in Firestore with `serverTimestamp()` for first-come-first-serve ordering.
- Runs mentor allocation in Firebase Cloud Functions, keeping the AI matching logic off the frontend.
- Embeds faculty expertise and project topics with Universal Sentence Encoder.
- Allocates the available faculty member with the highest cosine similarity above `0.45`.
- Sends unmatched or over-capacity requests to `pending_allocations`.
- Provides an admin dashboard for faculty CRUD, pending teams, manual overrides, analytics, and workload charts.
- Supports dark and light themes, loading states, snackbar notifications, tables, search, and filters.

## Firestore Collections

### `faculty`

```js
{
  facultyId: "FAC-001",
  facultyName: "Dr. Example",
  expertise: ["Artificial Intelligence", "NLP", "Data Mining"],
  maxTeams: 4,
  allocatedTeams: 0,
  email: "faculty@example.edu"
}
```

### `teams`

```js
{
  teamId: "uuid",
  teamLeader: "Student Name",
  members: ["A", "B", "C", "D"],
  topic: "AI-based campus chatbot",
  category: "AI",
  timestamp: serverTimestamp(),
  status: "SUBMITTED | AUTO_ALLOCATED | MANUALLY_ALLOCATED | PENDING",
  allocatedFaculty: { id, facultyId, facultyName, email },
  similarityScore: 0.78
}
```

### `pending_allocations`

```js
{
  teamId: "uuid",
  topic: "Project topic",
  reason: "No relevant expertise exceeded threshold.",
  timestamp: serverTimestamp()
}
```

## Architecture

```text
src/
  components/      App shell
  pages/           Student submission and admin dashboard
  services/        Firestore CRUD and team submission APIs
  hooks/           Realtime Firestore subscription hook
  ml/              TensorFlow.js similarity preview utility
  context/         Theme provider
  firebase/        Firebase client configuration
  utils/           Topic category detection

functions/
  index.js         Cloud Functions allocation engine
```

## Setup

1. Install dependencies:

```bash
npm install
cd functions && npm install
```

2. Copy `.env.example` to `.env` and fill in your Firebase web app values.

3. Update `.firebaserc` with your Firebase project ID.

4. Enable Firebase services:

- Firestore Database.
- Firebase Hosting.
- Cloud Functions.

5. Deploy Firestore rules. The current rules are open for project-demo use, so anyone with the app can read and write data. Add Authentication back before using this with real student/faculty data.

## Local Development

Run the frontend:

```bash
npm run dev
```

Run Firebase emulators after installing Firebase CLI:

```bash
npm install -g firebase-tools
firebase emulators:start
```

## Deployment

Build and deploy:

```bash
npm run build
firebase deploy
```

Deploy only functions:

```bash
firebase deploy --only functions
```

Deploy only hosting and Firestore rules:

```bash
firebase deploy --only hosting,firestore
```

## Allocation Workflow

1. Student submits a team document.
2. Cloud Function `allocateMentorOnTeamCreate` triggers on `teams/{teamDocId}` creation.
3. Function reads faculty in Firestore and filters out full workloads.
4. Universal Sentence Encoder creates embeddings for the topic and faculty expertise.
5. Cosine similarity ranks faculty.
6. The highest available match above `SIMILARITY_THRESHOLD` is allocated.
7. If no match is suitable or capacity is exhausted, the team is marked `PENDING`.

## Notes

- Cloud Functions are configured for `asia-south1`. Change the region in `functions/index.js` if your Firebase project uses another preferred region.
- Universal Sentence Encoder can increase cold starts. This project uses pure TensorFlow.js in Functions for install/deploy portability. For heavier production loads, cache faculty embeddings or switch the function runtime to `@tensorflow/tfjs-node` where native binaries are supported.
- Manual assignment updates team status and a function keeps faculty allocation counts synchronized.
