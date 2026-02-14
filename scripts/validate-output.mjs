import fs from 'node:fs';
import { localDateString, TZ } from './lib/utils.mjs';

const date = localDateString(new Date(), TZ);
const jsonPath = `data/daily/${date}.json`;
const htmlPath = 'site/index.html';

const errors = [];
if (!fs.existsSync(jsonPath)) errors.push(`Missing ${jsonPath}`);
if (!fs.existsSync(htmlPath)) errors.push(`Missing ${htmlPath}`);

if (!errors.length) {
  const json = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const required = ['date', 'generatedAt', 'timezone', 'newsletterTitle', 'sections', 'sources'];
  for (const f of required) if (!(f in json)) errors.push(`Missing field ${f}`);
  const html = fs.readFileSync(htmlPath, 'utf8');
  ['Top 5', 'More to Know', 'Releases & Updates', 'Sources'].forEach((s) => {
    if (!html.includes(s)) errors.push(`HTML missing section ${s}`);
  });
}

if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, jsonPath, htmlPath }, null, 2));
