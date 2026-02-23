import { localDisplay } from './lib/utils.mjs';

function escapeHtml(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtItemTime(iso, tz) {
  try {
    return new Date(iso).toLocaleString('en-US', { timeZone: tz });
  } catch {
    return iso;
  }
}

function renderItems(items, tz) {
  if (!items.length) return `<p class="empty">No items available for this section today.</p>`;

  return `
<ul class="items">
${items
  .map(
    (i) => `
  <li class="item">
    <a class="headline" href="${escapeHtml(i.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(i.headline)}</a>
    <div class="meta">${escapeHtml(i.source)} · ${escapeHtml(fmtItemTime(i.publishedAt, tz))}</div>
    <p class="why">${escapeHtml(i.whyItMatters || '')}</p>
  </li>`
  )
  .join('\n')}
</ul>`;
}

function renderSources(sources) {
  return `
<table class="sources">
  <thead>
    <tr><th>Source</th><th>Status</th><th>Fetched</th><th>Accepted</th><th>Error</th></tr>
  </thead>
  <tbody>
${sources
  .map(
    (s) => `
    <tr>
      <td>${escapeHtml(s.name)}</td>
      <td>${escapeHtml(s.status)}</td>
      <td>${Number(s.fetchedCount || 0)}</td>
      <td>${Number(s.acceptedCount || 0)}</td>
      <td class="err">${escapeHtml(s.error || '')}</td>
    </tr>`
  )
  .join('\n')}
  </tbody>
</table>`;
}

export function renderHtml(model) {
  const title = model.newsletterTitle || 'Daily Tech Newsletter';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light dark; }
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; margin: 0; padding: 24px; line-height: 1.45; }
    header { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
    h1 { margin: 0; font-size: 24px; }
    .sub { opacity: 0.8; font-size: 13px; margin-top: 6px; }
    .btn { border: 1px solid currentColor; background: transparent; padding: 6px 10px; border-radius: 10px; cursor: pointer; }
    h2 { margin-top: 28px; }
    .items { padding-left: 18px; }
    .item { margin: 14px 0; }
    .headline { font-weight: 650; text-decoration: none; }
    .headline:hover { text-decoration: underline; }
    .meta { opacity: 0.75; font-size: 12px; margin-top: 4px; }
    .why { margin: 8px 0 0; }
    .empty { opacity: 0.75; }
    .sources { border-collapse: collapse; width: 100%; margin-top: 10px; font-size: 13px; }
    .sources th, .sources td { border: 1px solid rgba(127,127,127,0.35); padding: 8px; vertical-align: top; }
    .sources th { text-align: left; }
    .err { opacity: 0.8; }
  </style>
</head>
<body>
  <a href="#content" class="skip">Skip to content</a>
  <header>
    <div>
      <h1>${escapeHtml(title)}</h1>
      <div class="sub">Generated ${escapeHtml(localDisplay(new Date(model.generatedAt), model.timezone))} (${escapeHtml(model.timezone)})</div>
    </div>
    <button id="theme-toggle" class="btn" type="button">Toggle theme</button>
  </header>

  <main id="content">
    <h2>Top 5</h2>
    ${renderItems(model.sections.top5, model.timezone)}

    <h2>More to Know</h2>
    ${renderItems(model.sections.moreToKnow, model.timezone)}

    <!-- Releases & Updates -->
    <h2>Releases &amp; Updates</h2>
    ${renderItems(model.sections.releasesAndUpdates, model.timezone)}

    <h2>Sources</h2>
    ${renderSources(model.sources)}
  </main>

  <script>
    (function () {
      const key = 'newsletter-theme';
      const btn = document.getElementById('theme-toggle');
      const apply = (t) => document.documentElement.dataset.theme = t;
      const current = localStorage.getItem(key);
      if (current) apply(current);
      btn.addEventListener('click', () => {
        const next = (document.documentElement.dataset.theme === 'dark') ? 'light' : 'dark';
        apply(next);
        localStorage.setItem(key, next);
      });
    })();
  </script>
</body>
</html>`;
}
