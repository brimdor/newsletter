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
