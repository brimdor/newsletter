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
    newsletterTitle: 'Daily AI Newsletter',
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
  const runLog = {
    date,
    generatedAt,
    noPush,
    publish,
    outputs: paths,
    summary: data.summary,
    failures
  };
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
