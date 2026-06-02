import { domainKeywords, tokenize } from '../ml/keywordSimilarity.js';

const categoryLabels = {
  ai: 'AI / ML',
  data: 'Data Science',
  algorithms: 'Algorithms / Software',
  iot: 'IoT / Embedded',
  web: 'Web / App',
  cloud: 'Cloud',
  cybersecurity: 'Cybersecurity',
  robotics: 'Robotics',
  mechanical: 'Mechanical',
  materials: 'Materials',
  thermal: 'Thermal / Fluids',
  aerospace: 'Aerospace',
  civil: 'Civil',
  communication: 'Communication',
  electronics: 'Electronics / VLSI',
  electrical: 'Electrical / Power',
  control: 'Control / Automation',
  biomedical: 'Biomedical',
  biotechnology: 'Biotechnology',
  chemistry: 'Chemistry',
  physics: 'Physics',
  mathematics: 'Mathematics',
  environmental: 'Environmental',
  management: 'Management',
};

export function detectTopicCategory(topic = '') {
  const tokens = new Set(tokenize(topic));
  const rankedDomains = Object.entries(domainKeywords)
    .map(([domain, keywords]) => ({
      domain,
      score: keywords.filter((keyword) => tokens.has(keyword)).length,
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  return categoryLabels[rankedDomains[0]?.domain] || 'General';
}

export const topicCategories = Object.values(categoryLabels);
