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
