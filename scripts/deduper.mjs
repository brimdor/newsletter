import { canonicalUrl, jaccard, stableId } from './lib/utils.mjs';

export function dedupe(items) {
  const seenUrl = new Map();
  const kept = [];
  let dropped = 0;

  for (const item of items) {
    const cu = canonicalUrl(item.url);
    const existingByUrl = seenUrl.get(cu);
    if (existingByUrl) {
      dropped += 1;
      if (item.score > existingByUrl.score) {
        const idx = kept.findIndex((k) => k.url === existingByUrl.url);
        if (idx >= 0) kept[idx] = { ...item, id: stableId(cu || item.headline) };
        seenUrl.set(cu, item);
      }
      continue;
    }

    const nearDup = kept.find((k) => jaccard(k.headline, item.headline) >= 0.75);
    if (nearDup) {
      dropped += 1;
      if (item.score > nearDup.score) {
        const idx = kept.findIndex((k) => k.id === nearDup.id);
        kept[idx] = { ...item, id: stableId(cu || item.headline) };
      }
      continue;
    }

    const shaped = { ...item, url: cu, id: stableId(cu || item.headline) };
    kept.push(shaped);
    seenUrl.set(cu, shaped);
  }

  return { kept, dropped };
}
