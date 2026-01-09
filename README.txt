ATK NEXT: Trainable Navigator linking (stable Open-in-Navigator)

Drop-in files:
- web/cloud-tech-navigator/atk-navigator-bridge.js   (NEW)
- web/cloud-tech-navigator/atk-decision-ui.js        (UPDATED)

What you get:
- Decision panel now has a "Link Navigator" button.
- Click it, then click (in order):
    1) cloud/provider dropdown
    2) service search input
    3) the container that holds the service list
- Those CSS selectors are saved to localStorage ("atkNavBridgeSelectors").
- After that, "Open in Navigator" becomes reliable across your DOM changes.

HTML order (inside <body>, recommended):
  <script src="../generated/catalog.generated.js"></script>
  <script src="../generated/decision.generated.js"></script>
  <script src="../generated/capability-map.generated.js"></script>
  <script src="atk-navigator-bridge.js"></script>
  <script src="atk-decision-ui.js"></script>

If you ever need to reset linking:
  window.ATK_NAV_BRIDGE.clearLinking()
