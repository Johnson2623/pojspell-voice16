export const TONES = [1, 2, 3, 4, 5, 7, 8];
export const SPEEDS = [3, 4, 5, 7, 10];
export const unique = values => [...new Set(values)];
export const isBeginner = row => !['eng', 'ang', 'ong'].includes(row.final)
  && (row.vowel.normalize('NFD').match(/[aeiou]/gi) || []).length <= 1;
// Offer only combinations with a matching human recording.
export function selectPart(rows, current, kind, value) {
  let candidates = rows.filter(row => row.onset === (kind === 'onset' ? value : current.onset));
  if (kind !== 'onset') candidates = candidates.filter(row => row.final === (kind === 'final' ? value : current.final));
  return candidates.find(row => row.tone === (kind === 'tone' ? Number(value) : current.tone)) || candidates[0] || current;
}
export function shuffled(rows, random = Math.random) {
  const result = [...rows];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function nextExample(rows, current, random = Math.random) {
  const candidates = rows.filter(row => row !== current);
  return candidates[Math.floor(random() * candidates.length)] || current;
}
export function matchedEnding(row, letter) {
  return [4, 8].includes(row.tone) && row.final.includes(letter);
}
