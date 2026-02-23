set -euo pipefail

# 1) package.json (add deps)
cat > package.json <<'EOF'
{
  "name": "proj-20260216-001-newsletter-overlay",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "node src/server.js",
    "test": "node --test",
    "showcase:check": "node qa/showcase-visual-check.mjs"
  },
  "dependencies": {
    "nostr-tools": "^2.23.0",
    "ws": "^8.17.0"
  }
}
EOF

# 2) scripts/collector.mjs (Nostr relays, general tech including AI)
cat > scripts/collector.mjs <<'EOF'
import { canonicalUrl, normalizeText } from './lib/utils.mjs';

import WebSocket from 'ws';
import { SimplePool, useWebSocketImplementation } from 'nostr-tools/pool';
import * as nip19 from 'nostr-tools/nip19';
import * as nip27 from 'nostr-tools/nip27';

useWebSocketImplementation(WebSocket);

const DEFAULT_SOURCES = [
  { name: 'relay.mostr.pub', url: 'wss://relay.mostr.pub', type: 'nostr', credibility: 0.65 },
  { name: 'purplepag.es', url: 'wss://purplepag.es', type: 'nostr', credibility: 0.65 },
  { name: 'relay.nostr.band', url: 'wss://relay.nostr.band', type: 'nostr', credibility: 0.70 },
  { name: 'relay.snort.social', url: 'wss://relay.snort.social', type: 'nostr', credibility: 0.65 },
  { name: 'nos.lol', url: 'wss://nos.lol', type: 'nostr', credibility: 0.65 }
];

// Prefer link-posts to keep “news” signal high.
const REQUIRE_EXTERNAL_LINK = (process.env.NOSTR_REQUIRE_EXTERNAL_LINK ?? 'true') !== 'false';
const HOURS_BACK = Number(process.env.NOSTR_HOURS_BACK || 48);
const LIMIT_PER_RELAY = Number(process.env.NOSTR_LIMIT_PER_RELAY || 800);

// Broad tech filter (AI included). Tune freely.
const TECH_HINT = [
  // AI
  'ai', 'artificial intelligence', 'llm', 'model', 'chatgpt', 'gemini', 'copilot', 'claude',
  'openai', 'anthropic', 'mistral', 'llama', 'sora', 'stable diffusion',
  // Security
  'security', 'vulnerability', 'cve', 'exploit', 'patch', 'breach', 'rce',
  // Platforms & vendors
  'apple', 'microsoft', 'google', 'meta', 'amazon', 'open source',
  'linux', 'kernel', 'windows', 'android', 'ios', 'iphone', 'macos',
  // Dev / OSS / infra
  'github', 'git', 'docker', 'kubernetes', 'container', 'helm',
  'rust', 'python', 'javascript', 'typescript', 'node', 'go', 'java',
  // Cloud / Web
  'aws', 'azure', 'gcp', 'cloudflare', 'browser', 'chrome', 'firefox', 'safari',
  // Hardware
  'gpu', 'nvidia', 'amd', 'intel', 'chip', 'cpu', 'arm', 'snapdragon'
];

function hasAnyHint(text) {
  const t = normalizeText(text);
  return TECH_HINT.some((k) => t.includes(k));
}

function isLikelyReply(evt) {
  // NIP-10 replies/threads usually include 'e' tags.
  return (evt.tags || []).some((t) => Array.isArray(t) && t[0] === 'e');
}

function getHashtags(evt) {
  return (evt.tags || [])
    .filter((t) => Array.isArray(t) && t[0] === 't' && typeof t[1] === 'string')
    .map((t) => String(t[1]).toLowerCase());
}

function extractHttpUrls(content) {
  const urls = [];
  try {
    for (const block of nip27.parse(content || '')) {
      if (
        (block.type === 'url' || block.type === 'image' || block.type === 'video' || block.type === 'audio') &&
        typeof block.url === 'string' &&
        /^https?:\/\//i.test(block.url)
      ) {
        urls.push(block.url);
      }
    }
  } catch {
    // fall back to regex
  }

  const matches = String(content || '').match(/https?:\/\/\S+/gi) || [];
  for (const m of matches) urls.push(m);

  const cleaned = urls
    .map((u) => u.replace(/[)\],.]+$/, '').trim())
    .filter((u) => /^https?:\/\//i.test(u));

  return [...new Set(cleaned)];
}

function pickBestExternalUrl(urls) {
  const nonMedia = urls.filter((u) => !/\.(png|jpe?g|gif|webp|mp4|mov|mp3|wav)(\?|#|$)/i.test(u));
  return (nonMedia[0] || urls[0] || '').trim();
}

function guessHeadline(content) {
  const firstLine = String(content || '')
    .split('\n')
    .map((s) => s.trim())
    .find(Boolean) || '';
  const withoutUrls = firstLine.replace(/https?:\/\/\S+/gi, '').trim();
  const s = withoutUrls || String(content || '').replace(/https?:\/\/\S+/gi, '').trim();
  if (!s) return 'Nostr note';
  return s.length > 140 ? `${s.slice(0, 137).trimEnd()}…` : s;
}

function typeHintFromText(headline, content) {
  const h = `${headline} ${content}`;
  if (/(release|launch|rollout|update|availability|announc|beta|rc\b|v\d+\.\d+)/i.test(h)) return 'release';
  if (/(cve-\d{4}-\d{4,}|0day|zero[- ]day|exploit|patch tuesday|rce)/i.test(h)) return 'release';
  return 'news';
}

function eventToCandidate(evt, relayUrl, src) {
  const urls = extractHttpUrls(evt.content);
  const external = pickBestExternalUrl(urls);
  const hasExternalLink = Boolean(external);

  const nevent = nip19.neventEncode({ id: evt.id, relays: [relayUrl] });
  const fallbackUrl = `https://nostr.com/${nevent}`;

  const url = external ? canonicalUrl(external) : fallbackUrl;
  const headline = guessHeadline(evt.content);

  return {
    headline,
    source: src.name,
    sourceUrl: src.url,
    url,
    publishedAt: new Date(evt.created_at * 1000).toISOString(),
    description: normalizeText(evt.content).slice(0, 800),
    credibility: src.credibility,
    typeHint: typeHintFromText(headline, evt.content),
    hashtags: getHashtags(evt),
    hasExternalLink
  };
}

export async function collect({ sources = DEFAULT_SOURCES, failures }) {
  const pool = new SimplePool({ enablePing: true, enableReconnect: false });
  const candidates = [];
  const sourceStats = [];

  const since = Math.floor(Date.now() / 1000) - HOURS_BACK * 60 * 60;

  for (const src of sources) {
    try {
      const events = await pool.querySync(
        [src.url],
        { kinds: [1], since, limit: LIMIT_PER_RELAY },
        { maxWait: 9000 }
      );

      const fetchedCount = Array.isArray(events) ? events.length : 0;

      const accepted = (events || [])
        .filter((e) => e && e.kind === 1 && typeof e.content === 'string')
        .filter((e) => e.content.trim().length >= 60)
        .filter((e) => !isLikelyReply(e))
        .filter((e) => hasAnyHint(e.content) || getHashtags(e).length > 0)
        .map((e) => eventToCandidate(e, src.url, src))
        .filter((c) => (REQUIRE_EXTERNAL_LINK ? c.hasExternalLink : true));

      candidates.push(...accepted);

      sourceStats.push({
        name: src.name,
        url: src.url,
        type: src.type,
        status: 'ok',
        fetchedCount,
        acceptedCount: accepted.length
      });
    } catch (err) {
      failures.push({
        stage: 'collect',
        source: src.name,
        message: String(err?.message || err),
        recoverable: true
      });

      sourceStats.push({
        name: src.name,
        url: src.url,
        type: src.type,
        status: 'failed',
        fetchedCount: 0,
        acceptedCount: 0,
        error: String(err?.message || err)
      });
    }
  }

  try {
    pool.close(sources.map((s) => s.url));
  } catch {
    // ignore
  }

  return { candidates, sourceStats };
}
EOF

# 3) scripts/ranker.mjs (general tech; drop old items; AI included)
cat > scripts/ranker.mjs <<'EOF'
import { normalizeText } from './lib/utils.mjs';

const MAX_ITEM_AGE_DAYS = Number(process.env.MAX_ITEM_AGE_DAYS || 7);

const POSITIVE = [
  'consumer', 'users', 'iphone', 'android', 'home', 'student', 'teacher', 'creator',
  'privacy', 'safety', 'assistant', 'search', 'shopping', 'video', 'photo', 'voice',
  'translation', 'accessibility', 'browser', 'password', 'update', 'patch'
];

const ENTERPRISE_ONLY = ['b2b', 'enterprise', 'saas', 'datacenter', 'cio', 'fortune 500', 'sales enablement'];

// Broad tech signal (AI included).
const TECH_HINT = [
  'ai', 'artificial intelligence', 'llm', 'model', 'chatgpt', 'gemini', 'copilot', 'claude',
  'openai', 'anthropic', 'mistral', 'llama', 'sora', 'stable diffusion',
  'security', 'vulnerability', 'cve', 'exploit', 'patch', 'breach', 'rce',
  'apple', 'microsoft', 'google', 'meta', 'amazon',
  'linux', 'kernel', 'windows', 'android', 'ios', 'iphone', 'macos',
  'open source', 'github', 'git', 'docker', 'kubernetes', 'container', 'helm',
  'rust', 'python', 'javascript', 'typescript', 'node', 'go', 'java',
  'aws', 'azure', 'gcp', 'cloudflare', 'browser', 'chrome', 'firefox', 'safari',
  'gpu', 'nvidia', 'amd', 'intel', 'chip', 'cpu', 'arm'
];

function topicTags(text) {
  const tags = [];
  const t = text;

  if (/(ai|artificial intelligence|llm|chatgpt|openai|anthropic|gemini|copilot|claude|mistral|llama|sora)/i.test(t)) tags.push('ai');
  if (/(security|vulnerability|cve-\d{4}-\d{4,}|exploit|breach|patch|rce|0day|zero[- ]day)/i.test(t)) tags.push('security');
  if (/(linux|kernel|ubuntu|debian|fedora|arch|systemd)/i.test(t)) tags.push('linux');
  if (/(windows|microsoft|powershell|wsl)/i.test(t)) tags.push('windows');
  if (/(android|ios|iphone|pixel|samsung|mobile)/i.test(t)) tags.push('mobile');
  if (/(gpu|nvidia|amd|intel|cpu|chip|arm|snapdragon)/i.test(t)) tags.push('hardware');
  if (/(docker|kubernetes|k8s|helm|container|aws|azure|gcp|cloudflare)/i.test(t)) tags.push('cloud');
  if (/(rust|python|javascript|typescript|node|go|java|c\+\+|compiler|sdk|api)/i.test(t)) tags.push('dev');
  if (/(browser|chrome|firefox|safari|web|http|tls)/i.test(t)) tags.push('web');
  if (/(apple|google|microsoft|meta|amazon)/i.test(t)) tags.push('vendors');

  return tags.length ? tags : ['tech'];
}

function whyItMatters(tags, consumerHits, enterpriseHits) {
  if (tags.includes('security')) return 'Security-related update; may affect patch urgency, privacy, or account safety.';
  if (tags.includes('ai')) return 'AI-related update; may change consumer tools, capabilities, or safety expectations.';
  if (consumerHits > 0) return 'Likely consumer impact (devices, apps, privacy, or day-to-day usage).';
  if (enterpriseHits > 0) return 'May matter indirectly; platform shifts can roll down into consumer products.';
  return 'General tech update worth tracking for ecosystem and product changes.';
}

export function rank(candidates, failures) {
  const now = Date.now();

  return candidates
    .map((item) => {
      const publishedMs = new Date(item.publishedAt).getTime();
      if (!Number.isFinite(publishedMs)) return null;

      const ageDays = (now - publishedMs) / 864e5;
      if (ageDays > MAX_ITEM_AGE_DAYS) return null;

      const text = normalizeText(`${item.headline} ${item.description} ${(item.hashtags || []).join(' ')}`);
      const techish = TECH_HINT.some((k) => text.includes(k));
      const hasTags = Array.isArray(item.hashtags) && item.hashtags.length > 0;
      if (!techish && !hasTags) return null;

      const enterpriseHits = ENTERPRISE_ONLY.filter((k) => text.includes(k)).length;
      const consumerHits = POSITIVE.filter((k) => text.includes(k)).length;

      const recencyHours = Math.max(1, (now - publishedMs) / 36e5);
      const recencyScore = Math.max(-10, 30 - Math.log2(recencyHours + 1) * 7);

      const tags = topicTags(`${item.headline} ${item.description}`);
      const topicScore = tags.includes('tech') ? 2 : tags.length * 3;

      const externalBoost = item.hasExternalLink ? 6 : -4;

      const score = Math.round(
        consumerHits * 5 +
          recencyScore +
          (Number(item.credibility || 0) * 10) +
          (item.typeHint === 'release' ? 8 : 0) +
          topicScore +
          externalBoost -
          enterpriseHits * 6
      );

      return {
        ...item,
        score,
        whyItMatters: whyItMatters(tags, consumerHits, enterpriseHits),
        tags: [...new Set(['tech', ...tags, item.typeHint === 'release' ? 'release' : 'news'])]
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);
}
EOF

# 4) scripts/run-daily.mjs (title)
cat > scripts/run-daily.mjs <<'EOF'
import fs from 'node:fs/promises';

import { collect } from './collector.mjs';
import { rank } from './ranker.mjs';
import { dedupe } from './deduper.mjs';
import { compose } from './composer.mjs';
import { renderHtml } from './renderer.mjs';
import { isoNow, localDateString, TZ } from './lib/utils.mjs';
import { maybeCommitAndPush, writeArtifacts } from './publisher.mjs';

const noPush = process.argv.includes('--no-push');
const failures = [];

const NEWSLETTER_TITLE = process.env.NEWSLETTER_TITLE || 'Daily Tech Newsletter';

async function main() {
  const date = localDateString(new Date(), TZ);
  const generatedAt = isoNow();

  const { candidates, sourceStats } = await collect({ failures });

  let ranked = [];
  try {
    ranked = rank(candidates, failures);
  } catch (err) {
    failures.push({ stage: 'rank', message: String(err.message || err), recoverable: false });
  }

  const { kept, dropped } = dedupe(ranked);
  const sections = compose(kept);

  for (const stat of sourceStats) {
    stat.acceptedCount = kept.filter((i) => i.source === stat.name).length;
  }

  if (sections.top5.length < 5) {
    failures.push({ stage: 'compose', message: `Top 5 underfilled: ${sections.top5.length}/5`, recoverable: true });
  }

  const data = {
    date,
    generatedAt,
    timezone: TZ,
    newsletterTitle: NEWSLETTER_TITLE,
    run: {
      workflow: process.env.GITHUB_WORKFLOW || 'daily-newsletter',
      runId: process.env.GITHUB_RUN_ID || 'local',
      commitSha: process.env.GITHUB_SHA || 'local'
    },
    summary: {
      top5Count: sections.top5.length,
      moreToKnowCount: sections.moreToKnow.length,
      releasesCount: sections.releasesAndUpdates.length,
      totalSelected: sections.top5.length + sections.moreToKnow.length + sections.releasesAndUpdates.length,
      totalCandidates: candidates.length,
      dedupDropped: dropped
    },
    sections,
    sources: sourceStats,
    failures
  };

  const html = renderHtml(data);
  const paths = await writeArtifacts({ date, json: data, html });

  const publish = maybeCommitAndPush({ date, noPush });

  await fs.mkdir('artifacts', { recursive: true });
  const runLog = { date, generatedAt, noPush, publish, outputs: paths, summary: data.summary, failures };
  const runLogPath = `artifacts/run-${date}.json`;

  await fs.writeFile(runLogPath, JSON.stringify(runLog, null, 2));
  console.log(JSON.stringify({ ok: true, ...paths, runLogPath }, null, 2));
}

main().catch(async (err) => {
  const fatal = { stage: 'render', message: String(err.message || err), recoverable: false, stack: err.stack };
  await fs.mkdir('artifacts', { recursive: true });
  await fs.writeFile(`artifacts/fatal-${Date.now()}.json`, JSON.stringify(fatal, null, 2));
  console.error(err);
  process.exit(1);
});
EOF

# 5) scripts/renderer.mjs (clean HTML; no README markdown leakage)
cat > scripts/renderer.mjs <<'EOF'
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
EOF

# 6) .github/workflows/daily-newsletter.yml (npm install)
mkdir -p .github/workflows
cat > .github/workflows/daily-newsletter.yml <<'EOF'
name: daily-newsletter

on:
  schedule:
    - cron: '0 12 * * *' # 6 AM CST
    - cron: '0 11 * * *' # 6 AM CDT
  workflow_dispatch:

permissions:
  contents: write

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '22'

      - name: Local hour guard (America/Chicago)
        id: guard
        run: |
          HOUR=$(TZ=America/Chicago date +%H)
          echo "hour=$HOUR" >> $GITHUB_OUTPUT
          if [ "$HOUR" != "06" ]; then
            echo "Not local 6 AM, skipping."
            exit 0
          fi

      - name: Install dependencies
        if: steps.guard.outputs.hour == '06'
        run: npm install --no-audit --no-fund

      - name: Generate newsletter
        if: steps.guard.outputs.hour == '06'
        run: node scripts/run-daily.mjs --no-push

      - name: Validate outputs
        if: steps.guard.outputs.hour == '06'
        run: node scripts/validate-output.mjs

      - name: Commit and push artifacts
        if: steps.guard.outputs.hour == '06'
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add index.html site/index.html data/daily/*.json artifacts/*.json package.json scripts .github/workflows/daily-newsletter.yml || true
          if git diff --cached --quiet; then
            echo "No changes to commit"
            exit 0
          fi
          DATE=$(TZ=America/Chicago date +%F)
          git commit -m "daily newsletter: ${DATE}"
          git push
EOF

# install + quick check
npm install --no-audit --no-fund
node scripts/run-daily.mjs --no-push
node scripts/validate-output.mjs

echo "OK. Next:"
echo "  git status"
echo "  git commit -am \"Switch sources to Nostr; broaden to general tech\" && git push"
