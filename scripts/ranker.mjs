import { normalizeText } from './lib/utils.mjs';

const POSITIVE = [
  'consumer', 'users', 'iphone', 'android', 'home', 'student', 'teacher', 'creator', 'privacy', 'safety', 'assistant', 'search', 'shopping', 'video', 'photo', 'chatbot', 'voice', 'translation', 'accessibility'
];
const ENTERPRISE_ONLY = ['b2b', 'enterprise', 'saas', 'datacenter', 'cio', 'fortune 500', 'sales enablement'];
const AI_HINT = ['ai', 'artificial intelligence', 'llm', 'model', 'chatgpt', 'gemini', 'copilot', 'claude'];

export function rank(candidates, failures) {
  const now = Date.now();

  return candidates
    .map((item) => {
      const text = normalizeText(`${item.headline} ${item.description}`);
      const isAi = AI_HINT.some((k) => text.includes(k));
      if (!isAi) return null;

      const enterpriseHits = ENTERPRISE_ONLY.filter((k) => text.includes(k)).length;
      const consumerHits = POSITIVE.filter((k) => text.includes(k)).length;
      const recencyHours = Math.max(1, (now - new Date(item.publishedAt).getTime()) / 36e5);
      const recencyScore = Math.max(0, 20 - Math.log2(recencyHours) * 3);

      const score = Math.round(
        consumerHits * 8 +
          recencyScore +
          item.credibility * 20 +
          (item.typeHint === 'release' ? 5 : 0) -
          enterpriseHits * 10
      );

      if (consumerHits === 0 && enterpriseHits > 0) return null;

      const why = consumerHits > 0
        ? `This could affect everyday users through ${consumerHits > 1 ? 'multiple' : 'a'} consumer-facing changes in AI tools.`
        : 'This is AI news with likely practical impact for everyday users.';

      return { ...item, score, whyItMatters: why, tags: ['ai', 'consumer', item.typeHint === 'release' ? 'release' : 'news'] };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);
}
