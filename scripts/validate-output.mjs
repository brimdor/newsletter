import fs from 'node:fs';
import { localDateString, TZ } from './lib/utils.mjs';

const date = localDateString(new Date(), TZ);
const jsonPath = `data/daily/${date}.json`;
const htmlPath = 'site/index.html';
const rootHtmlPath = 'index.html';

const errors = [];
if (!fs.existsSync(jsonPath)) errors.push(`Missing ${jsonPath}`);
if (!fs.existsSync(htmlPath)) errors.push(`Missing ${htmlPath}`);
if (!fs.existsSync(rootHtmlPath)) errors.push(`Missing ${rootHtmlPath}`);

if (!errors.length) {
  const json = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const required = ['date', 'generatedAt', 'timezone', 'newsletterTitle', 'sections', 'sources'];
  for (const f of required) if (!(f in json)) errors.push(`Missing field ${f}`);
  const html = fs.readFileSync(htmlPath, 'utf8');
  const rootHtml = fs.readFileSync(rootHtmlPath, 'utf8');
  ['Top 5', 'More to Know', 'Releases & Updates', 'Sources'].forEach((s) => {
    if (!html.includes(s)) errors.push(`HTML missing section ${s}`);
  });
  ['## Outputs', '## Pipeline', '# Daily AI Newsletter'].forEach((needle) => {
    if (html.includes(needle)) errors.push(`HTML appears to include README markdown: ${needle}`);
  });
  if (!html.includes('theme-toggle')) errors.push('HTML missing theme toggle control');
  if (rootHtml !== html) errors.push('Root index.html does not match site/index.html');
}

if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, jsonPath, htmlPath, rootHtmlPath }, null, 2));
