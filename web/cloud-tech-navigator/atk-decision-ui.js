/* web/cloud-tech-navigator/atk-decision-ui.js
   ATK Decision Panel with TRAINABLE Navigator integration.

   Requires:
   - ../generated/decision.generated.js  (window.ATK_DECISION)
   - ../generated/capability-map.generated.js (window.ATK_CAP_MAP)

   Optional (recommended):
   - atk-navigator-bridge.js (window.ATK_NAV_BRIDGE)
     Adds "Link Navigator" button that learns CSS selectors and makes Open-in-Navigator reliable.
*/
(function () {
  function el(tag, attrs = {}, children = []) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "style") Object.assign(n.style, v);
      else if (k === "class") n.className = v;
      else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    }
    for (const c of children) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    return n;
  }

  function must(x, msg) { if (!x) throw new Error(msg); return x; }

  function getDecisionData() {
    return must(window.ATK_DECISION, "ATK_DECISION not loaded (missing ../generated/decision.generated.js)");
  }
  function getCapMap() {
    return must(window.ATK_CAP_MAP, "ATK_CAP_MAP not loaded (missing ../generated/capability-map.generated.js)");
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
    const capMap = getCapMap();
    const services = new Set();
    const gaps = [];
    const details = [];

    for (const cid of (capabilityIds || [])) {
      const row = capMap[cid];
      const mapped = row?.[cloud] || [];
      if (!mapped.length) gaps.push(cid);
      mapped.forEach(s => services.add(s));
      details.push({
        capability_id: cid,
        capability_name: row?.capability_name || "",
        domain: row?.domain || "",
        used_for: row?.used_for || "",
        services: mapped
      });
    }

    return {
      cloud,
      resolved_services: Array.from(services).sort((a, b) => a.localeCompare(b)),
      gaps,
      details
    };
  }

  function toMarkdown(state) {
    if (!state) return "";
    const { input, decision, resolution } = state;
    const lines = [];
    lines.push(`# ATK Decision`);
    lines.push(``);
    lines.push(`## Inputs`);
    lines.push(`- Cloud: **${input.cloud}**`);
    lines.push(`- Data classification: ${input.data_classification.length ? input.data_classification.join(", ") : "—"}`);
    lines.push(`- Internet exposed: ${input.internet_exposed ? "Yes" : "No"}`);
    lines.push(`- RTO minutes: ${Number.isFinite(input.rto_minutes) ? input.rto_minutes : "—"}`);
    lines.push(``);
    lines.push(`## Top patterns`);
    if (!decision.top_patterns.length) lines.push(`- (none)`);
    for (const p of decision.top_patterns) {
      lines.push(`- **${p.name}** \`(${p.pattern_id})\` (score ${p.score})`);
      if (p.used_for) lines.push(`  - ${p.used_for}`);
      if (p.reasons?.length) for (const r of p.reasons) lines.push(`  - Why: ${r}`);
    }
    lines.push(``);
    lines.push(`## Required capabilities (${decision.required_capabilities.length})`);
    for (const c of decision.required_capabilities) lines.push(`- \`${c}\``);
    lines.push(``);
    lines.push(`## Resolved services (${resolution.resolved_services.length})`);
    for (const s of resolution.resolved_services) lines.push(`- ${s}`);
    lines.push(``);
    lines.push(`## Gaps (${resolution.gaps.length})`);
    if (!resolution.gaps.length) lines.push(`- None ✅`);
    else for (const g of resolution.gaps) lines.push(`- \`${g}\``);
    return lines.join("\n");
  }

  function downloadJson(filename, obj) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function copyText(text) {
    if (!text) return;
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }

  async function openInNavigator(cloud, serviceName) {
    // Prefer bridge if available
    if (window.ATK_NAV_BRIDGE && typeof window.ATK_NAV_BRIDGE.openService === "function") {
      return await window.ATK_NAV_BRIDGE.openService({ cloud, serviceName });
    }
    // Otherwise emit event only (fallback)
    window.dispatchEvent(new CustomEvent("atk:openService", { detail: { cloud, serviceName } }));
    return { ok: false, mode: "event-only" };
  }

  function mount() {
    const state = { last: null };
    const dockTarget = document.getElementById("atkDecisionDock");

    const panel = el("div", { id: "atkDecisionPanel" });
    Object.assign(panel.style, {
      background: "rgba(10,12,18,0.96)",
      border: "1px solid rgba(255,255,255,0.15)",
      borderRadius: "10px",
      padding: "10px",
      fontFamily: "Arial, sans-serif",
      fontSize: "12px",
      display: "flex",
      flexDirection: "column",
      gap: "8px"
    });

    let isDocked = Boolean(dockTarget);
    function applyPlacement() {
      if (isDocked) {
        panel.style.position = "relative";
        panel.style.width = "100%";
        panel.style.maxHeight = "100%";
        panel.style.overflow = "hidden";
        panel.style.zIndex = "1";
        panel.style.right = "";
        panel.style.bottom = "";
      } else {
        panel.style.position = "fixed";
        panel.style.right = "10px";
        panel.style.bottom = "10px";
        panel.style.width = "580px";
        panel.style.maxHeight = "82vh";
        panel.style.overflow = "hidden";
        panel.style.zIndex = "9999";
      }
    }

    function toast(msg) {
      toastEl.textContent = msg;
      toastEl.style.opacity = "1";
      clearTimeout(toastEl._t);
      toastEl._t = setTimeout(() => { toastEl.style.opacity = "0"; }, 1300);
    }

    const toastEl = el("div", {
      style: {
        position: "fixed",
        right: "14px",
        bottom: "88px",
        background: "rgba(0,0,0,0.75)",
        color: "white",
        padding: "6px 10px",
        borderRadius: "8px",
        fontSize: "12px",
        opacity: "0",
        transition: "opacity 0.15s ease",
        zIndex: 10000
      }
    });

    const titleRow = el("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" } }, [
      el("div", { style: { fontWeight: "bold" } }, ["ATK Decision"]),
      el("div", { style: { display: "flex", gap: "6px", flexWrap: "wrap", justifyContent: "flex-end" } }, [
        el("button", { style: { cursor: "pointer" }, onclick: () => { isDocked = !isDocked; applyPlacement(); toast(isDocked ? "Docked" : "Floating"); } }, ["Dock"]),
        el("button", { style: { cursor: "pointer" }, onclick: () => {
          if (window.ATK_NAV_BRIDGE?.startLinking) {
            window.ATK_NAV_BRIDGE.startLinking();
            toast("Click: cloud select, search input, service list container");
          } else {
            toast("Bridge not loaded (add atk-navigator-bridge.js)");
          }
        } }, ["Link Navigator"]),
        el("button", { style: { cursor: "pointer" }, onclick: async () => { try { await copyText(toMarkdown(state.last)); toast("Copied report"); } catch { toast("Copy failed"); } } }, ["Copy"]),
        el("button", { style: { cursor: "pointer" }, onclick: () => { if (!state.last) return toast("Run first"); downloadJson("atk-decision.json", state.last); } }, ["Export JSON"]),
        el("button", { style: { cursor: "pointer" }, onclick: () => { panel.remove(); } }, ["✕"])
      ])
    ]);

    const cloudSel = el("select", { id: "atkCloud", style: { width: "100%" } }, [
      el("option", { value: "aws" }, ["aws"]),
      el("option", { value: "azure" }, ["azure"]),
      el("option", { value: "gcp" }, ["gcp"]),
      el("option", { value: "oci" }, ["oci"])
    ]);
    const classInp = el("input", { id: "atkClass", type: "text", value: "CJIS", style: { width: "100%" } });
    const exposedChk = el("input", { id: "atkExposed", type: "checkbox", checked: "checked" });
    const rtoInp = el("input", { id: "atkRto", type: "number", value: "30", style: { width: "110px" } });

    const controls = el("div", { style: { display: "grid", gap: "6px" } }, [
      el("div", {}, ["Cloud:"]),
      cloudSel,
      el("div", {}, ["Data classification (comma-separated):"]),
      classInp,
      el("div", { style: { display: "flex", gap: "10px", alignItems: "center" } }, [
        el("label", {}, [exposedChk, " Internet exposed"]),
        el("label", {}, ["RTO min: ", rtoInp])
      ])
    ]);

    const tabs = ["Patterns", "Capabilities", "Services", "Gaps"];
    let activeTab = "Patterns";

    const tabRow = el("div", { style: { display: "flex", gap: "6px", flexWrap: "wrap" } },
      tabs.map(t => el("button", {
        "data-tab": t,
        style: {
          cursor: "pointer",
          padding: "6px 10px",
          borderRadius: "999px",
          border: "1px solid rgba(255,255,255,0.15)",
          background: t === activeTab ? "rgba(255,255,255,0.08)" : "transparent",
          color: "rgba(255,255,255,0.85)"
        },
        onclick: () => setTab(t)
      }, [t]))
    );

    const svcSearch = el("input", { id: "atkSvcSearch", type: "text", placeholder: "Search services…", style: { width: "100%", display: "none" } });

    const body = el("div", {
      style: {
        flex: "1 1 auto",
        overflow: "auto",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "8px",
        padding: "8px",
        background: "rgba(255,255,255,0.04)"
      }
    });

    function setTab(t) {
      activeTab = t;
      for (const btn of tabRow.querySelectorAll("button[data-tab]")) {
        btn.style.background = (btn.getAttribute("data-tab") === t) ? "rgba(255,255,255,0.08)" : "transparent";
      }
      svcSearch.style.display = (t === "Services") ? "block" : "none";
      render();
    }

    function renderEmpty() {
      body.innerHTML = "";
      body.appendChild(el("div", { style: { color: "rgba(255,255,255,0.7)" } }, ["(Run to generate results)"]));
    }

    function render() {
      body.innerHTML = "";
      const last = state.last;
      if (!last) return renderEmpty();

      const { decision, resolution, input } = last;

      if (activeTab === "Patterns") {
        const list = el("div", { style: { display: "grid", gap: "8px" } });
        for (const p of decision.top_patterns) {
          list.appendChild(el("div", { style: { border: "1px solid rgba(255,255,255,0.10)", borderRadius: "8px", padding: "8px" } }, [
            el("div", { style: { fontWeight: "bold" } }, [`${p.name} (${p.pattern_id})`]),
            el("div", { style: { color: "rgba(255,255,255,0.75)", marginTop: "2px" } }, [`Score: ${p.score}`]),
            p.used_for ? el("div", { style: { marginTop: "4px", color: "rgba(255,255,255,0.85)" } }, [p.used_for]) : el("div"),
            (p.reasons && p.reasons.length)
              ? el("ul", { style: { margin: "6px 0 0 18px", padding: "0", color: "rgba(255,255,255,0.75)" } }, p.reasons.map(r => el("li", {}, [r])))
              : el("div", { style: { marginTop: "4px", color: "rgba(255,255,255,0.6)" } }, ["(No explicit reasons)"])
          ]));
        }
        body.appendChild(list);
        return;
      }

      if (activeTab === "Capabilities") {
        body.appendChild(el("div", { style: { fontWeight: "bold", marginBottom: "6px" } }, [`Required (${decision.required_capabilities.length})`]));
        body.appendChild(el("ul", { style: { margin: "0 0 10px 18px", padding: "0" } }, decision.required_capabilities.map(c => el("li", {}, [c]))));
        body.appendChild(el("div", { style: { fontWeight: "bold", marginBottom: "6px" } }, [`Preferred (${decision.preferred_capabilities.length})`]));
        body.appendChild(el("ul", { style: { margin: "0 0 0 18px", padding: "0" } }, decision.preferred_capabilities.map(c => el("li", {}, [c]))));
        return;
      }

      if (activeTab === "Services") {
        const q = (svcSearch.value || "").trim().toLowerCase();
        const filtered = q ? resolution.resolved_services.filter(s => s.toLowerCase().includes(q)) : resolution.resolved_services;

        body.appendChild(el("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", marginBottom: "6px" } }, [
          el("div", { style: { color: "rgba(255,255,255,0.75)" } }, [`Resolved services: ${filtered.length} (of ${resolution.resolved_services.length})`]),
          el("button", { style: { cursor: "pointer" }, onclick: async () => {
            if (!filtered.length) return toast("No service");
            const res = await openInNavigator(input.cloud, filtered[0]);
            toast(res?.ok ? "Opened + highlighted" : `Sent (${res?.mode || "unknown"})`);
          } }, ["Open first"])
        ]));

        const ul = el("ul", { style: { margin: "0 0 0 18px", padding: "0" } });
        for (const s of filtered) {
          ul.appendChild(el("li", { style: { marginBottom: "4px" } }, [
            el("span", {}, [s, " "]),
            el("button", { style: { cursor: "pointer", marginLeft: "6px" }, onclick: async () => {
              const res = await openInNavigator(input.cloud, s);
              toast(res?.ok ? "Opened + highlighted" : `Sent (${res?.mode || "unknown"})`);
            } }, ["Open in Navigator"])
          ]));
        }
        body.appendChild(ul);
        return;
      }

      if (activeTab === "Gaps") {
        if (!resolution.gaps.length) {
          body.appendChild(el("div", { style: { color: "rgba(170,255,170,0.95)" } }, ["No gaps ✅"]));
          return;
        }
        const capMap = getCapMap();
        body.appendChild(el("div", { style: { color: "rgba(255,200,120,0.95)", marginBottom: "6px" } }, [
          `Capabilities with no mapped services for this cloud: ${resolution.gaps.length}`
        ]));
        const ul = el("ul", { style: { margin: "0 0 0 18px", padding: "0" } });
        for (const cid of resolution.gaps) {
          const row = capMap[cid];
          ul.appendChild(el("li", {}, [row?.capability_name ? `${row.capability_name} (${cid})` : cid]));
        }
        body.appendChild(ul);
        return;
      }
    }

    svcSearch.addEventListener("input", () => { if (activeTab === "Services") render(); });

    const runBtn = el("button", {
      style: { width: "100%", padding: "8px", cursor: "pointer" },
      onclick: () => {
        try {
          const cloud = document.getElementById("atkCloud").value;
          const data_classification = String(document.getElementById("atkClass").value || "")
            .split(",").map(s => s.trim()).filter(Boolean);
          const internet_exposed = document.getElementById("atkExposed").checked;
          const rto_minutes = Number(document.getElementById("atkRto").value);

          const input = { cloud, data_classification, internet_exposed, rto_minutes };
          const decision = decide({ data_classification, internet_exposed, rto_minutes });
          const resolution = resolveServices(cloud, decision.required_capabilities);

          state.last = { input, decision, resolution };
          toast("Decision updated");
          render();
        } catch (e) {
          state.last = null;
          body.innerHTML = "";
          body.appendChild(el("div", { style: { color: "rgba(255,140,140,0.95)" } }, ["ERROR: " + (e?.message || e)]));
        }
      }
    }, ["Run"]);

    panel.appendChild(titleRow);
    panel.appendChild(controls);
    panel.appendChild(runBtn);
    panel.appendChild(tabRow);
    panel.appendChild(svcSearch);
    panel.appendChild(body);

    applyPlacement();
    if (dockTarget) dockTarget.appendChild(panel);
    else document.body.appendChild(panel);

    document.body.appendChild(toastEl);
    renderEmpty();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();
