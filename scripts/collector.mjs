import { canonicalUrl, normalizeText } from './lib/utils.mjs';

const DEFAULT_SOURCES = [
  { name: 'OpenAI', url: 'https://openai.com/news/rss.xml', type: 'rss', credibility: 0.95 },
  { name: 'Google AI Blog', url: 'https://blog.google/technology/ai/rss/', type: 'rss', credibility: 0.9 },
  { name: 'MIT Technology Review AI', url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed', type: 'rss', credibility: 0.85 },
  { name: 'The Verge AI', url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', type: 'rss', credibility: 0.75 }
];

function stripCdata(s = '') {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
}

function firstTag(block, tag) {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return m ? stripCdata(m[1]).trim() : '';
}

function parseItems(xml = '') {
  const out = [];
  const itemBlocks = [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].map((m) => m[0]);
  const entryBlocks = [...xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)].map((m) => m[0]);
  for (const block of [...itemBlocks, ...entryBlocks]) {
    const title = firstTag(block, 'title');
    const description = firstTag(block, 'description') || firstTag(block, 'summary') || firstTag(block, 'content');
    const pubDate = firstTag(block, 'pubDate') || firstTag(block, 'published') || firstTag(block, 'updated');
    let link = firstTag(block, 'link');
    if (!link) {
      const m = block.match(/<link[^>]*href=["']([^"']+)["'][^>]*>/i);
      link = m ? m[1] : '';
    }
    if (!title || !link) continue;
    out.push({ title, description, url: canonicalUrl(link), publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString() });
  }
  return out;
}

async function fetchWithTimeout(url, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { 'user-agent': 'daily-ai-newsletter-bot/1.0' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

export async function collect({ sources = DEFAULT_SOURCES, failures }) {
  const candidates = [];
  const sourceStats = [];

  for (const src of sources) {
    try {
      const xml = await fetchWithTimeout(src.url);
      const items = parseItems(xml)
        .filter((x) => x.url && x.title)
        .map((x) => ({
          headline: x.title.replace(/\s+/g, ' ').trim(),
          source: src.name,
          sourceUrl: src.url,
          url: x.url,
          publishedAt: x.publishedAt,
          description: normalizeText(x.description).slice(0, 800),
          credibility: src.credibility,
          typeHint: /(release|launch|rollout|update|availability|announc)/i.test(x.title) ? 'release' : 'news'
        }));

      candidates.push(...items);
      sourceStats.push({ name: src.name, url: src.url, type: src.type, status: 'ok', fetchedCount: items.length, acceptedCount: 0 });
    } catch (err) {
      failures.push({ stage: 'collect', source: src.name, message: String(err.message || err), recoverable: true });
      sourceStats.push({ name: src.name, url: src.url, type: src.type, status: 'failed', fetchedCount: 0, acceptedCount: 0, error: String(err.message || err) });
    }
  }

  return { candidates, sourceStats };
}
