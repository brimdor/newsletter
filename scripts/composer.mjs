export function compose(items) {
  const releases = items.filter((i) => i.typeHint === 'release').slice(0, 6);
  const nonRelease = items.filter((i) => i.typeHint !== 'release');

  const top5 = [];
  for (const i of items) {
    if (top5.length >= 5) break;
    top5.push(i);
  }

  const selectedIds = new Set(top5.map((x) => x.id));
  const moreToKnow = nonRelease.filter((x) => !selectedIds.has(x.id)).slice(0, 10);
  for (const r of releases) selectedIds.add(r.id);

  return { top5, moreToKnow, releasesAndUpdates: releases };
}
