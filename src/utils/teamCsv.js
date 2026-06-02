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
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function normalizeHeader(header = '') {
  return header.replace(/^\uFEFF/, '').trim().toUpperCase().replace(/\s+/g, ' ');
}

function valueFrom(record, names) {
  const key = names.find((name) => record[name]);
  return key ? record[key].trim() : '';
}

function splitNames(value = '') {
  return value
    .split(/[;,|]/)
    .map((name) => name.trim())
    .filter(Boolean);
}

export function parseTeamsCsv(csvText) {
  const rows = parseCsv(csvText);
  if (rows.length < 2) {
    throw new Error('CSV must have a header row and at least one team row.');
  }

  const headers = rows[0].map(normalizeHeader);
  const records = rows.slice(1).map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, row[index]?.trim() || ''])),
  );

  const teams = records
    .map((record, index) => {
      const topic = valueFrom(record, ['TOPIC', 'TOPIC NAME', 'PROJECT TOPIC', 'PROJECT TITLE', 'TITLE']);
      const explicitLeader = valueFrom(record, ['TEAM LEADER', 'LEADER', 'LEADER NAME']);
      const studentColumns = [
        'STUDENT1',
        'STUDENT 1',
        'STUDENT NAME 1',
        'MEMBER1',
        'MEMBER 1',
        'MEMBER NAME 1',
        'STUDENT2',
        'STUDENT 2',
        'MEMBER2',
        'MEMBER 2',
        'STUDENT3',
        'STUDENT 3',
        'MEMBER3',
        'MEMBER 3',
        'STUDENT4',
        'STUDENT 4',
        'MEMBER4',
        'MEMBER 4',
        'STUDENT5',
        'STUDENT 5',
        'MEMBER5',
        'MEMBER 5',
      ]
        .map((column) => record[column])
        .filter(Boolean);
      const combinedStudents = splitNames(valueFrom(record, ['STUDENTS', 'STUDENT NAMES', 'MEMBERS', 'MEMBER NAMES']));
      const students = [...(explicitLeader ? [explicitLeader] : []), ...studentColumns, ...combinedStudents]
        .map((name) => name.trim())
        .filter(Boolean);
      const uniqueStudents = [...new Set(students)];
      const teamLeader = explicitLeader || uniqueStudents[0] || `Team ${index + 1}`;

      return {
        teamLeader,
        members: uniqueStudents.length > 0 ? uniqueStudents.slice(0, 5) : [teamLeader],
        topic,
      };
    })
    .filter((team) => team.topic);

  if (teams.length === 0) {
    throw new Error('No valid teams found. Include a topic column such as TOPIC, PROJECT TOPIC, or PROJECT TITLE.');
  }

  return teams;
}
