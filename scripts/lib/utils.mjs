import crypto from 'node:crypto';

export const TZ = 'America/Chicago';

export function isoNow() {
  return new Date().toISOString();
}

export function localDateString(date = new Date(), tz = TZ) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function localDisplay(date = new Date(), tz = TZ) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    dateStyle: 'full',
    timeStyle: 'short'
  }).format(date);
}

export function stableId(input) {
  return crypto.createHash('sha256').update(input).digest('hex').slice(0, 12);
}

export function canonicalUrl(raw = '') {
  try {
    const u = new URL(raw);
    u.hash = '';
    const drop = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'ref', 'fbclid', 'gclid'];
    drop.forEach((k) => u.searchParams.delete(k));
    if ((u.protocol === 'https:' && u.port === '443') || (u.protocol === 'http:' && u.port === '80')) u.port = '';
    u.pathname = u.pathname.replace(/\/$/, '') || '/';
    return u.toString();
  } catch {
    return raw;
  }
}

export function normalizeText(s = '') {
  return s.toLowerCase().replace(/<[^>]+>/g, ' ').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

export function jaccard(a = '', b = '') {
  const A = new Set(normalizeText(a).split(' ').filter(Boolean));
  const B = new Set(normalizeText(b).split(' ').filter(Boolean));
  if (!A.size || !B.size) return 0;
  const inter = [...A].filter((x) => B.has(x)).length;
  const union = new Set([...A, ...B]).size;
  return inter / union;
}

export function escapeHtml(s = '') {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
