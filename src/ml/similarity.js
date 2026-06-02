import * as use from '@tensorflow-models/universal-sentence-encoder';
import '@tensorflow/tfjs';

let modelPromise;

export function loadSentenceModel() {
  if (!modelPromise) {
    modelPromise = use.load();
  }
  return modelPromise;
}

export function cosineSimilarity(vectorA, vectorB) {
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

export async function previewFacultySimilarity(topic, faculty) {
  const model = await loadSentenceModel();
  const facultyTexts = faculty.map((item) => item.expertise.join(', '));
  const embeddings = await model.embed([topic, ...facultyTexts]);
  const vectors = await embeddings.array();
  embeddings.dispose();

  const topicVector = vectors[0];
  return faculty
    .map((item, index) => ({
      ...item,
      previewScore: cosineSimilarity(topicVector, vectors[index + 1]),
    }))
    .sort((a, b) => b.previewScore - a.previewScore);
}
