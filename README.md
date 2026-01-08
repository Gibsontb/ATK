# ATK (Architecture Toolkit) – Cloud Decision Logic Kit

ATK is a data-driven Cloud Decision Logic Kit.

- **Source of truth:** `data/master/master-matrix.json` (quarterly-updated master cross-reference)
- **Build outputs (browser + inventories):** `web/generated/*` and `generated/*`
- **UI:** `web/cloud-tech-navigator/` (consumes generated catalog)

## Quick start
```bash
npm run validate
npm run build
```
Then open `web/index.html`.
