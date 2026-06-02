const fs = require('node:fs');
const path = require('node:path');

const requiredColumns = [
  'COURSE CODE',
  'COURSE DESCRIPTION',
  'FACULTY ID',
  'FACULTY NAME',
  'EMAIL ID',
  'DEPARTMENT',
  'EXPERTISE1',
  'EXPERTISE2',
  'EXPERTISE3',
];

function parseArgs() {
  const csvPath = process.argv[2];
  const maxTeamsArg = process.argv.find((arg) => arg.startsWith('--maxTeams='));
  const maxTeams = Number(maxTeamsArg?.split('=')[1] || 3);

  if (!csvPath) {
    throw new Error('Usage: node scripts/importFacultyCsv.cjs "C:\\path\\faculty.csv" --maxTeams=3');
  }

  return {
    csvPath: path.resolve(csvPath),
    maxTeams: Number.isFinite(maxTeams) && maxTeams > 0 ? maxTeams : 3,
  };
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      row.push(cell.trim());
      cell = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1;
      row.push(cell.trim());
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  row.push(cell.trim());
  if (row.some((value) => value.length > 0)) rows.push(row);
  return rows;
}

function normalizeHeader(header) {
  return header.replace(/^\uFEFF/, '').trim().toUpperCase();
}

function toObjects(rows) {
  const headers = rows[0].map(normalizeHeader);
  const missing = requiredColumns.filter((column) => !headers.includes(column));

  if (missing.length > 0) {
    throw new Error(`Missing required CSV columns: ${missing.join(', ')}`);
  }

  return rows.slice(1).map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, row[index]?.trim() || ''])),
  );
}

function unique(values) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function buildFacultyDocuments(records, maxTeams) {
  const facultyById = new Map();

  for (const record of records) {
    const facultyId = record['FACULTY ID'];
    if (!facultyId) continue;

    const current = facultyById.get(facultyId) || {
      facultyId,
      facultyName: record['FACULTY NAME'],
      email: record['EMAIL ID'].toLowerCase(),
      department: record.DEPARTMENT,
      maxTeams,
      allocatedTeams: 0,
      expertise: [],
      courses: [],
    };

    current.facultyName = current.facultyName || record['FACULTY NAME'];
    current.email = current.email || record['EMAIL ID'].toLowerCase();
    current.department = current.department || record.DEPARTMENT;
    current.expertise = unique([
      ...current.expertise,
      record.EXPERTISE1,
      record.EXPERTISE2,
      record.EXPERTISE3,
    ]);

    if (record['COURSE CODE'] || record['COURSE DESCRIPTION']) {
      current.courses.push({
        courseCode: record['COURSE CODE'],
        courseDescription: record['COURSE DESCRIPTION'],
      });
    }

    facultyById.set(facultyId, current);
  }

  return [...facultyById.values()].map((faculty) => ({
    ...faculty,
    courses: faculty.courses.filter(
      (course, index, list) =>
        list.findIndex(
          (item) =>
            item.courseCode === course.courseCode &&
            item.courseDescription === course.courseDescription,
        ) === index,
    ),
  }));
}

function readEnv() {
  const envPath = path.resolve('.env');
  if (!fs.existsSync(envPath)) return {};

  return Object.fromEntries(
    fs
      .readFileSync(envPath, 'utf8')
      .split(/\r?\n/)
      .filter((line) => line.trim() && !line.trim().startsWith('#') && line.includes('='))
      .map((line) => {
        const separatorIndex = line.indexOf('=');
        return [line.slice(0, separatorIndex).trim(), line.slice(separatorIndex + 1).trim()];
      }),
  );
}

async function getFirestore() {
  const serviceAccountPath = path.resolve('serviceAccountKey.json');

  if (fs.existsSync(serviceAccountPath)) {
    const admin = require('../functions/node_modules/firebase-admin');
    const serviceAccount = require(serviceAccountPath);

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }

    const db = admin.firestore();
    return {
      mode: 'Admin SDK',
      upsert: (id, data) => db.collection('faculty').doc(id).set(data, { merge: true }),
    };
  }

  const env = readEnv();
  const projectId = env.VITE_FIREBASE_PROJECT_ID;
  const apiKey = env.VITE_FIREBASE_API_KEY;

  if (!projectId || !apiKey) {
    throw new Error('Missing VITE_FIREBASE_PROJECT_ID or VITE_FIREBASE_API_KEY in .env');
  }

  return {
    mode: 'Firestore REST API',
    upsert: (id, data) => upsertWithRest(projectId, apiKey, id, data),
  };
}

function toFirestoreValue(value) {
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(toFirestoreValue) } };
  }
  if (value && typeof value === 'object') {
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(value).map(([key, nestedValue]) => [key, toFirestoreValue(nestedValue)]),
        ),
      },
    };
  }
  if (typeof value === 'number') return { integerValue: String(value) };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (value == null) return { nullValue: null };
  return { stringValue: String(value) };
}

async function upsertWithRest(projectId, apiKey, id, data) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  const fields = Object.fromEntries(Object.entries(data).map(([key, value]) => [key, toFirestoreValue(value)]));
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/faculty/${encodeURIComponent(
    id,
  )}?key=${apiKey}`;

  try {
    const response = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Firestore REST upload failed (${response.status}): ${body}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  const { csvPath, maxTeams } = parseArgs();
  const csvText = fs.readFileSync(csvPath, 'utf8');
  const rows = parseCsv(csvText);
  const records = toObjects(rows);
  const faculty = buildFacultyDocuments(records, maxTeams);
  const firestore = await getFirestore();

  console.log(`Using ${firestore.mode}`);
  console.log(`Uploading ${faculty.length} faculty records...`);

  for (const item of faculty) {
    await firestore.upsert(item.facultyId, item);
    console.log(`Uploaded ${item.facultyId} - ${item.facultyName}`);
  }

  console.log('Faculty CSV import complete.');
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
