// web/cloud-tech-navigator/atk-decision-ui.js
(function () {
  function el(tag, attrs = {}, children = []) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "style") Object.assign(n.style, v);
      else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    }
    for (const c of children) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    return n;
  }

  function getDecisionData() {
    if (!window.ATK_DECISION) throw new Error("ATK_DECISION not loaded (missing decision.generated.js)");
    return window.ATK_DECISION;
  }

  function matchWhen(when, input) {
    if (!when) return true;

    if (when.internet_exposed_is !== undefined) {
      if (Boolean(input.internet_exposed) !== Boolean(when.internet_exposed_is)) return false;
    }
    if (when.rto_minutes_lte !== undefined) {
      const rto = Number(input.rto_minutes);
      if (!Number.isFinite(rto) || rto > Number(when.rto_minutes_lte)) return false;
    }
    if (when.data_classification_any_of) {
      const set = new Set((input.data_classification || []).map(String));
      if (!when.data_classification_any_of.some(x => set.has(String(x)))) return false;
    }
    return true;
  }

  function decide(input) {
    const d = getDecisionData();
    const knownCaps = new Set((d.capabilities.capabilities || []).map(c => c.capability_id));

    const requiredCaps = new Set();
    const preferredCaps = new Set();
    const preferredPatterns = new Map();

    for (const r of (d.rules.rules || [])) {
      if (!matchWhen(r.when, input)) continue;

      for (const c of (r.require_capabilities || [])) if (knownCaps.has(c)) requiredCaps.add(c);
      for (const c of (r.prefer_capabilities || [])) if (knownCaps.has(c)) preferredCaps.add(c);

      for (const pid of (r.prefer_patterns || [])) {
        const cur = preferredPatterns.get(pid) || { boost: 0, reasons: [] };
        cur.boost += Number(r.weight || 0);
        cur.reasons.push(r.reason || r.rule_id);
        preferredPatterns.set(pid, cur);
      }
    }

    function scorePattern(p) {
      let score = 0;
      for (const c of (p.requires_capabilities || [])) {
        if (requiredCaps.has(c)) score += 20;
        else if (preferredCaps.has(c)) score += 10;
        else score -= 5;
      }
      for (const c of (p.nice_to_have_capabilities || [])) {
        if (preferredCaps.has(c)) score += 3;
      }
      score += preferredPatterns.get(p.pattern_id)?.boost || 0;
      return score;
    }

    const scored = (d.patterns.patterns || [])
      .map(p => ({
        pattern_id: p.pattern_id,
        name: p.name,
        used_for: p.used_for,
        score: scorePattern(p),
        reasons: preferredPatterns.get(p.pattern_id)?.reasons || []
      }))
      .sort((a, b) => b.score - a.score);

    return {
      input,
      required_capabilities: [...requiredCaps],
      preferred_capabilities: [...preferredCaps],
      top_patterns: scored.slice(0, 5)
    };
  }

  function resolveServices(cloud, capabilityIds) {
    // Uses the master catalog already bundled into the UI build
    const master = window.ATK_CATALOG; // set by catalog.generated.js
    if (!master) throw new Error("ATK_CATALOG not loaded (missing catalog.generated.js)");

    // We don’t have row-level master-matrix in the browser here; we resolve via CDK provider service categories:
    // Strategy: find service names whose mapped category domain matches a capability’s domain by heuristic.
    // Better: If your catalog.generated.js includes a capability->services map, swap to that.
    //
    // For now, show provider services grouped by provider category as “implementation inventory”.
    const provider = (window.CDK?.providers || {})[cloud];
    if (!provider) throw new Error(`Provider not found: ${cloud}`);

    // Minimal “resolution”: just return provider inventory; true capability->service mapping is done in CLI.
    // If you want exact mapping, we’ll generate a browser mapping file next.
    const all = [];
    for (const [cat, arr] of Object.entries(provider.serviceCategories || {})) {
      for (const s of arr || []) all.push(s.name);
    }
    all.sort((a, b) => a.localeCompare(b));
    return all;
  }

  function mount() {
    // Add a small panel without disturbing existing layout
    const host = document.body;

    const panel = el("div", {
      id: "atkDecisionPanel",
      style: {
        position: "fixed",
        right: "10px",
        bottom: "10px",
        width: "380px",
        maxHeight: "70vh",
        overflow: "auto",
        background: "rgba(20,20,20,0.95)",
        border: "1px solid rgba(255,255,255,0.15)",
        borderRadius: "10px",
        padding: "10px",
        zIndex: 9999,
        fontFamily: "Arial, sans-serif",
        fontSize: "12px"
      }
    });

    const title = el("div", { style: { fontWeight: "bold", marginBottom: "6px" } }, [
      "ATK Decision (Quick Panel)"
    ]);

    const cloudSel = el("select", { id: "atkCloud" }, [
      el("option", { value: "aws" }, ["aws"]),
      el("option", { value: "azure" }, ["azure"]),
      el("option", { value: "gcp" }, ["gcp"]),
      el("option", { value: "oci" }, ["oci"])
    ]);

    const classInp = el("input", {
      id: "atkClass",
      type: "text",
      value: "CJIS",
      style: { width: "100%" }
    });

    const exposedChk = el("input", { id: "atkExposed", type: "checkbox", checked: "checked" });
    const rtoInp = el("input", { id: "atkRto", type: "number", value: "30", style: { width: "90px" } });

    const out = el("pre", {
      id: "atkOut",
      style: {
        whiteSpace: "pre-wrap",
        background: "rgba(255,255,255,0.06)",
        padding: "8px",
        borderRadius: "8px",
        marginTop: "8px"
      }
    }, ["(Run a decision…)"]);

    const runBtn = el("button", {
      style: {
        width: "100%",
        marginTop: "8px",
        padding: "8px",
        cursor: "pointer"
      },
      onclick: () => {
        try {
          const cloud = document.getElementById("atkCloud").value;
          const data_classification = String(document.getElementById("atkClass").value || "")
            .split(",").map(s => s.trim()).filter(Boolean);
          const internet_exposed = document.getElementById("atkExposed").checked;
          const rto_minutes = Number(document.getElementById("atkRto").value);

          const decision = decide({ data_classification, internet_exposed, rto_minutes });
          const inv = resolveServices(cloud, decision.required_capabilities);

          out.textContent = JSON.stringify({
            input: { cloud, data_classification, internet_exposed, rto_minutes },
            decision,
            services_inventory_for_cloud: inv.slice(0, 50), // cap display
            note: "This panel currently shows provider inventory. Next step: generate exact capability->service mapping for browser."
          }, null, 2);
        } catch (e) {
          out.textContent = "ERROR: " + (e?.message || e);
        }
      }
    }, ["Run Decision"]);

    panel.appendChild(title);
    panel.appendChild(el("div", {}, [
      "Cloud: ", cloudSel
    ]));
    panel.appendChild(el("div", { style: { marginTop: "6px" } }, [
      "Data classification (comma-separated):"
    ]));
    panel.appendChild(classInp);
    panel.appendChild(el("div", { style: { marginTop: "6px", display: "flex", gap: "10px", alignItems: "center" } }, [
      el("label", {}, [exposedChk, " Internet exposed"]),
      el("label", {}, ["RTO min: ", rtoInp])
    ]));
    panel.appendChild(runBtn);
    panel.appendChild(out);

    host.appendChild(panel);
  }

  // Mount after DOM
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
