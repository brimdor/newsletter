import { escapeHtml, localDisplay } from './lib/utils.mjs';

function renderItems(items) {
  if (!items.length) return '<p class="empty">No items available for this section today.</p>';
  return `<ul class="cards">${items
    .map(
      (i) => `<li class="card"><a href="${escapeHtml(i.url)}" target="_blank" rel="noopener"><h3>${escapeHtml(i.headline)}</h3></a><p class="meta">${escapeHtml(i.source)} · ${escapeHtml(new Date(i.publishedAt).toLocaleString())}</p><p>${escapeHtml(i.whyItMatters)}</p></li>`
    )
    .join('')}</ul>`;
}

export function renderHtml(model) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Daily AI Newsletter</title><style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;margin:0;background:#f7f8fa;color:#111}
  main{max-width:900px;margin:0 auto;padding:16px}
  h1{font-size:1.8rem;margin-bottom:.25rem} .stamp{color:#555;margin-top:0}
  .cards{list-style:none;padding:0;display:grid;gap:12px}.card{background:#fff;padding:12px;border-radius:10px;border:1px solid #e5e7eb}
  .card h3{margin:.1rem 0 .4rem;font-size:1.05rem}.meta{font-size:.86rem;color:#666}.empty{color:#666;font-style:italic}
  @media (min-width:800px){.cards{grid-template-columns:1fr 1fr}}
  table{width:100%;border-collapse:collapse;background:#fff;border-radius:10px;overflow:hidden}th,td{padding:8px;border:1px solid #e5e7eb;text-align:left;font-size:.9rem}
  </style></head><body><main>
  <header><h1>Daily AI Newsletter</h1><p class="stamp">Generated ${escapeHtml(localDisplay(new Date(model.generatedAt), model.timezone))} (${escapeHtml(model.timezone)})</p></header>
  <section><h2>Top 5</h2>${renderItems(model.sections.top5)}</section>
  <section><h2>More to Know</h2>${renderItems(model.sections.moreToKnow)}</section>
  <section><h2>Releases & Updates</h2>${renderItems(model.sections.releasesAndUpdates)}</section>
  <section><h2>Sources</h2><table><thead><tr><th>Source</th><th>Status</th><th>Fetched</th><th>Accepted</th><th>Error</th></tr></thead><tbody>
  ${model.sources.map((s) => `<tr><td><a href="${escapeHtml(s.url)}">${escapeHtml(s.name)}</a></td><td>${escapeHtml(s.status)}</td><td>${s.fetchedCount}</td><td>${s.acceptedCount}</td><td>${escapeHtml(s.error || '')}</td></tr>`).join('')}
  </tbody></table></section>
  </main></body></html>`;
}
