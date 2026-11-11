'use strict';

/*
  Typo-tolerant product matching, used only when a normal search finds
  nothing (e.g. "lamb" or "candel" or "wal hanging").
*/

const words = text =>
  String(text || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

function distance(a, b) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 2) return 3;

  // Damerau-Levenshtein: swapping two letters ("candel") counts as ONE slip.
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);

  for (let j = 1; j <= b.length; j++) d[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;

      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);

      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }

  return d[a.length][b.length];
}

// Short words must be exact-ish, longer words may have 2 slips.
const allowed = len => (len <= 3 ? 0 : len <= 6 ? 1 : 2);

/* Best matching catalogue word for one typed word, or null. */
function closestWord(typed, vocabulary) {
  const max = allowed(typed.length);
  let best = null;

  for (const word of vocabulary) {
    // "can" should still find "candle": a word that starts with the typed word counts.
    if (typed.length >= 3 && word.startsWith(typed)) return { word, d: 0 };

    const d = distance(typed, word);

    if (d <= max && (!best || d < best.d)) best = { word, d };
  }

  return best;
}

/*
  products: [{ _id, name, keywords }]
  Returns { ids, suggestion } where every typed word matched something.
*/
function fuzzyMatch(products, query) {
  const typed = words(query).slice(0, 6);

  if (!typed.length) return { ids: [], suggestion: '' };

  const vocab = new Set();
  const perProduct = products.map(p => {
    const w = new Set([...words(p.name), ...(p.keywords || []).flatMap(words)]);
    w.forEach(x => vocab.add(x));
    return { id: p._id, w };
  });

  const fixed = typed.map(t => closestWord(t, vocab));

  if (fixed.some(f => !f)) return { ids: [], suggestion: '' };

  const ids = perProduct
    .filter(p => fixed.every(f => p.w.has(f.word) || [...p.w].some(x => x.startsWith(f.word))))
    .map(p => p.id);

  return { ids, suggestion: fixed.map(f => f.word).join(' ') };
}

module.exports = { fuzzyMatch, distance, words };
