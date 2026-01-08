# ATK – Cloud Decision Logic Kit

ATK is a data-driven cloud decision logic kit.

## What’s in this repo
- `/data/master/master-matrix.json` – **Source of truth** for provider service catalogs (category-aligned)
- `/scripts/build.mjs` – generates browser-ready catalog JS for the existing navigator UI
- `/web/` – the static navigator UI

## Quarterly updates
Edit the master matrix and re-run:
- `npm run validate`
- `npm run build`
- `npm run package`

## Note on the uploaded PDF
The PDF is included as a reference source, but this initial ingest is derived from the existing provider lists in the base navigator ZIP.
