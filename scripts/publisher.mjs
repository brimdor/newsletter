import fs from 'node:fs/promises';
import { execSync } from 'node:child_process';

export async function writeArtifacts({ date, json, html }) {
  await fs.mkdir('data/daily', { recursive: true });
  await fs.mkdir('site', { recursive: true });
  const jsonPath = `data/daily/${date}.json`;
  const htmlPath = 'site/index.html';
  const rootHtmlPath = 'index.html';
  await fs.writeFile(jsonPath, JSON.stringify(json, null, 2));
  await fs.writeFile(htmlPath, html);
  await fs.writeFile(rootHtmlPath, html);
  return { jsonPath, htmlPath, rootHtmlPath };
}

export function maybeCommitAndPush({ date, noPush = false }) {
  const hasChanges = execSync('git status --porcelain').toString().trim().length > 0;
  if (!hasChanges) return { committed: false, pushed: false, reason: 'no_changes' };
  if (noPush) return { committed: false, pushed: false, reason: 'no_push_mode' };
  execSync('git add index.html site/index.html data/daily/*.json README.md .github/workflows/daily-newsletter.yml scripts package.json', { stdio: 'inherit' });
  execSync(`git commit -m "daily newsletter: ${date}"`, { stdio: 'inherit' });
  execSync('git push origin HEAD', { stdio: 'inherit' });
  return { committed: true, pushed: true };
}
