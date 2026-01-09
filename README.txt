ATK FIX DROP-IN (build.mjs path fix + decision UI mapping)

Overwrite into repo root:
- scripts/build.mjs
- web/cloud-tech-navigator/atk-decision-ui.js

Then run:
  npm run build

In web/cloud-tech-navigator/cloud-tech-navigator.html ensure these script tags (INSIDE <body>) in this order:
  <script src="../generated/catalog.generated.js"></script>
  <script src="../generated/decision.generated.js"></script>
  <script src="../generated/capability-map.generated.js"></script>
  <script src="atk-decision-ui.js"></script>
