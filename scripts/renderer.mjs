import { escapeHtml, localDisplay } from './lib/utils.mjs';

function renderItems(items) {
  if (!items.length) return '<p class="empty" role="status">No items available for this section today.</p>';
  return `<ul class="cards">${items
    .map(
      (i) => `<li class="card"><a class="card-link" href="${escapeHtml(i.url)}" target="_blank" rel="noopener"><h3>${escapeHtml(i.headline)}</h3></a><p class="meta"><span class="source">${escapeHtml(i.source)}</span><span aria-hidden="true"> · </span><time datetime="${escapeHtml(i.publishedAt)}">${escapeHtml(new Date(i.publishedAt).toLocaleString())}</time></p><p>${escapeHtml(i.whyItMatters)}</p></li>`
    )
    .join('')}</ul>`;
}

export function renderHtml(model) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Daily AI Newsletter</title>
  <style>
    :root{
      --bg:#f5f7fb;
      --surface:#ffffff;
      --text:#111827;
      --muted:#4b5563;
      --line:#e5e7eb;
      --line-strong:#cbd5e1;
      --accent:#1d4ed8;
      --accent-soft:#dbeafe;
      --radius:14px;
      --space-1:.5rem;
      --space-2:.75rem;
      --space-3:1rem;
      --space-4:1.25rem;
      --space-5:1.75rem;
    }
    *{box-sizing:border-box}
    html,body{margin:0;padding:0}
    body{
      font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
      background:var(--bg);
      color:var(--text);
      line-height:1.55;
      font-size:16px;
    }
    .skip-link{
      position:absolute;
      left:-9999px;
      top:0;
      background:#111;
      color:#fff;
      padding:var(--space-2) var(--space-3);
      border-radius:0 0 10px 0;
      z-index:100;
    }
    .skip-link:focus{left:0;outline:3px solid var(--accent-soft)}
    main{max-width:960px;margin:0 auto;padding:var(--space-4)}
    header{
      background:var(--surface);
      border:1px solid var(--line);
      border-radius:var(--radius);
      padding:var(--space-4);
      margin-bottom:var(--space-4);
    }
    h1{
      margin:0 0 var(--space-1);
      line-height:1.2;
      font-size:clamp(1.55rem,4vw,2rem);
      letter-spacing:-0.01em;
    }
    .stamp{margin:0;color:var(--muted);font-size:.95rem}
    section{
      margin:var(--space-5) 0;
      scroll-margin-top:1rem;
    }
    h2{
      margin:0 0 var(--space-3);
      line-height:1.25;
      font-size:clamp(1.2rem,2.6vw,1.45rem);
      letter-spacing:-0.01em;
    }
    .cards{
      list-style:none;
      margin:0;
      padding:0;
      display:grid;
      gap:var(--space-3);
    }
    .card{
      background:var(--surface);
      padding:var(--space-3);
      border:1px solid var(--line);
      border-radius:var(--radius);
      box-shadow:0 1px 2px rgba(17,24,39,.03);
    }
    .card-link{
      color:inherit;
      text-decoration:none;
    }
    .card-link h3{
      margin:.1rem 0 .55rem;
      font-size:1.05rem;
      line-height:1.35;
      text-wrap:balance;
    }
    .card-link:hover h3,
    .card-link:focus-visible h3{
      color:var(--accent);
      text-decoration:underline;
      text-underline-offset:2px;
    }
    .meta{
      margin:0 0 var(--space-2);
      color:var(--muted);
      font-size:.88rem;
    }
    .source{font-weight:600}
    .empty{color:var(--muted);font-style:italic;margin:0}
    .sources-wrap{
      background:var(--surface);
      border:1px solid var(--line);
      border-radius:var(--radius);
      overflow:auto;
    }
    table{width:100%;border-collapse:collapse;min-width:560px}
    th,td{padding:.65rem .7rem;border-bottom:1px solid var(--line);text-align:left;font-size:.92rem;vertical-align:top}
    th{background:#f8fafc;font-weight:600}
    tr:last-child td{border-bottom:0}
    a{color:var(--accent)}
    a:focus-visible{
      outline:3px solid var(--accent-soft);
      outline-offset:2px;
      border-radius:6px;
    }
    @media (min-width:760px){
      main{padding:var(--space-5)}
      .cards{grid-template-columns:repeat(2,minmax(0,1fr))}
    }
  </style>
</head>
<body>
  <a href="#content" class="skip-link">Skip to content</a>
  <main id="content">
    <header>
      <h1>Daily AI Newsletter</h1>
      <p class="stamp">Generated <time datetime="${escapeHtml(model.generatedAt)}">${escapeHtml(localDisplay(new Date(model.generatedAt), model.timezone))}</time> (${escapeHtml(model.timezone)})</p>
    </header>

    <section aria-labelledby="top5-heading">
      <h2 id="top5-heading">Top 5</h2>
      ${renderItems(model.sections.top5)}
    </section>

    <section aria-labelledby="more-heading">
      <h2 id="more-heading">More to Know</h2>
      ${renderItems(model.sections.moreToKnow)}
    </section>

    <section aria-labelledby="releases-heading">
      <h2 id="releases-heading">Releases & Updates</h2>
      ${renderItems(model.sections.releasesAndUpdates)}
    </section>

    <section aria-labelledby="sources-heading">
      <h2 id="sources-heading">Sources</h2>
      <div class="sources-wrap">
        <table>
          <thead>
            <tr><th>Source</th><th>Status</th><th>Fetched</th><th>Accepted</th><th>Error</th></tr>
          </thead>
          <tbody>
            ${model.sources
              .map(
                (s) => `<tr><td><a href="${escapeHtml(s.url)}">${escapeHtml(s.name)}</a></td><td>${escapeHtml(s.status)}</td><td>${s.fetchedCount}</td><td>${s.acceptedCount}</td><td>${escapeHtml(s.error || '')}</td></tr>`
              )
              .join('')}
          </tbody>
        </table>
      </div>
    </section>
  </main>
</body>
</html>`;
}
