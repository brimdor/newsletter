# Daily AI Newsletter

Automated consumer-focused AI newsletter generator.

## Outputs
- `site/index.html` — published single responsive page
- `data/daily/YYYY-MM-DD.json` — auditable daily data artifact

## Pipeline
- `scripts/collector.mjs` — source collection with per-source timeout/failure capture
- `scripts/ranker.mjs` — consumer relevance heuristics + scoring
- `scripts/deduper.mjs` — canonical URL and headline similarity dedupe
- `scripts/composer.mjs` — section assignment (`Top 5`, `More to Know`, `Releases & Updates`)
- `scripts/renderer.mjs` — HTML render
- `scripts/publisher.mjs` — write artifacts and optional git publish
- `scripts/run-daily.mjs` — orchestration + graceful failure recording

## Local reproducibility
Prereqs: Node.js 22+

```bash
npm run build       # generate artifacts locally without push
npm run validate    # validate JSON + required HTML sections
```

This writes:
- `site/index.html`
- `data/daily/<today in America/Chicago>.json`
- `artifacts/run-<date>.json`

## GitHub Actions schedule
Workflow: `.github/workflows/daily-newsletter.yml`

- UTC cron entries:
  - `0 12 * * *` (CST 6:00 AM)
  - `0 11 * * *` (CDT 6:00 AM)
- Local-hour guard ensures generation runs only when `TZ=America/Chicago` hour is `06`.
- Supports manual trigger via `workflow_dispatch`.

## Graceful failure behavior
- Source fetch failures are recorded in:
  - `sources[].status/error`
  - `failures[]`
- Pipeline continues publishing with available content when possible.
- Underfilled `Top 5` is recorded as recoverable failure metadata.
