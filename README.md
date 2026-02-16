# Daily AI Newsletter Valid Site Links

## Run

```bash
npm start
```

Open `http://localhost:3000`.

## API contract (on-demand detail model)

- `GET /api/newsletter/items`
  - Returns list of newsletter items with `sourceTitle`, `sourceUrl`, and `sourceContentStatus`.
- `GET /api/newsletter/items/:id/source`
  - Returns:

```json
{
  "itemId": "string",
  "sourceTitle": "string",
  "sourceUrl": "https://...",
  "content": "string",
  "contentType": "text/markdown",
  "status": "ready|unavailable"
}
```

## Notes

- Placeholder hosts (`example.com`, `localhost`) are treated as invalid and never returned as working source links.
- Source content is HTML-escaped before rendering in the overlay.
- Fallback messaging is returned when full source content is unavailable.

## CI/Showcase validation

- GitHub Actions workflow: `.github/workflows/showcase-validation.yml`
- Local parity command: `npm run showcase:check` (requires app running at `http://127.0.0.1:3000`)
- Workflow validates:
  - test suite pass
  - local site artifact availability (`/local-site-artifact.json`)
  - overlay shell present in UI
  - source URL/title/content contract for newsletter items
