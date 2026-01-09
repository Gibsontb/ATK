/* web/cloud-tech-navigator/atk-navigator-bridge.js
   ATK Navigator Bridge: stable integration between Decision panel and Navigator UI.

   Purpose:
   - Provide a precise, user-trainable way to "open/highlight service in navigator"
     without hardcoding your DOM structure.

   How it works:
   - Stores CSS selectors in localStorage under key: "atkNavBridgeSelectors"
   - You can train selectors by calling:
       window.ATK_NAV_BRIDGE.startLinking()
     then clicking:
       1) cloud/provider <select>
       2) service search <input>
       3) a service row/link/button in the list

   - Once trained, Decision panel calls:
       window.ATK_NAV_BRIDGE.openService({cloud, serviceName})

   Notes:
   - If selectors are missing, it falls back to best-effort heuristics (won't crash).
*/
(function () {
  const LS_KEY = "atkNavBridgeSelectors";
  const norm = (s) => String(s || "").trim().toLowerCase();

  function cssPath(el) {
    if (!el || !el.nodeType || el.nodeType !== 1) return null;
    // Build a reasonably-stable selector: tag#id or tag.class1.class2 with nth-child fallback
    if (el.id) return `#${CSS.escape(el.id)}`;
    const parts = [];
    let cur = el;
    for (let depth = 0; cur && cur.nodeType === 1 && depth < 5; depth++) {
      let part = cur.tagName.toLowerCase();
      const cls = (cur.className && typeof cur.className === "string")
        ? cur.className.split(/\s+/).filter(Boolean).slice(0, 3)
        : [];
      if (cls.length) part += "." + cls.map(c => CSS.escape(c)).join(".");
      // add nth-child if needed
      const parent = cur.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(x => x.tagName === cur.tagName);
        if (siblings.length > 1) {
          const idx = Array.from(parent.children).indexOf(cur) + 1;
          part += `:nth-child(${idx})`;
        }
      }
      parts.unshift(part);
      cur = cur.parentElement;
      if (cur && cur.id) { parts.unshift(`#${CSS.escape(cur.id)}`); break; }
    }
    return parts.join(" > ");
  }

  function loadSelectors() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveSelectors(obj) {
    localStorage.setItem(LS_KEY, JSON.stringify(obj, null, 2));
  }

  function toast(msg) {
    let el = document.getElementById("atkNavBridgeToast");
    if (!el) {
      el = document.createElement("div");
      el.id = "atkNavBridgeToast";
      Object.assign(el.style, {
        position: "fixed",
        left: "14px",
        bottom: "14px",
        background: "rgba(0,0,0,0.8)",
        color: "white",
        padding: "8px 10px",
        borderRadius: "10px",
        fontFamily: "Arial, sans-serif",
        fontSize: "12px",
        zIndex: 10001,
        opacity: "0",
        transition: "opacity 0.15s ease"
      });
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = "1";
    clearTimeout(el._t);
    el._t = setTimeout(() => (el.style.opacity = "0"), 1500);
  }

  function setInputValue(input, value) {
    if (!input) return;
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "Enter" }));
  }

  function setSelectValue(sel, value) {
    if (!sel) return false;
    const v = norm(value);
    const opts = Array.from(sel.options || []);
    const byValue = opts.find(o => norm(o.value) === v);
    const byText = opts.find(o => norm(o.textContent) === v);
    const chosen = byValue || byText;
    if (!chosen) return false;
    sel.value = chosen.value;
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function highlightFlash(node) {
    if (!node) return;
    const prev = node.style.boxShadow;
    const prevBg = node.style.backgroundColor;
    node.style.boxShadow = "0 0 0 2px rgba(120,220,255,0.9), 0 0 18px rgba(120,220,255,0.55)";
    node.style.backgroundColor = "rgba(120,220,255,0.10)";
    node.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => {
      node.style.boxShadow = prev || "";
      node.style.backgroundColor = prevBg || "";
    }, 1600);
  }

  function findServiceNodeByText(serviceName, container) {
    const target = norm(serviceName);
    if (!target) return null;
    const root = container || document;
    const candidates = Array.from(root.querySelectorAll("a,button,li,div,span"))
      .filter(n => n && n.textContent && n.textContent.length < 160);
    for (const n of candidates) if (norm(n.textContent) === target) return n;
    for (const n of candidates) if (norm(n.textContent).includes(target)) return n;
    return null;
  }

  async function openService({ cloud, serviceName }) {
    const sel = loadSelectors();
    let cloudEl = null, searchEl = null, listContainer = null;

    if (sel?.cloudSelect) cloudEl = document.querySelector(sel.cloudSelect);
    if (sel?.serviceSearch) searchEl = document.querySelector(sel.serviceSearch);
    if (sel?.serviceListContainer) listContainer = document.querySelector(sel.serviceListContainer);

    // Fallback heuristics if not trained
    if (!cloudEl) {
      const wants = new Set(["aws","azure","gcp","oci"]);
      const sels = Array.from(document.querySelectorAll("select"));
      cloudEl = sels.find(s => Array.from(s.options||[]).map(o=>norm(o.value||o.textContent)).filter(v=>wants.has(v)).length >= 3) || null;
    }
    if (!searchEl) {
      const inputs = Array.from(document.querySelectorAll("input[type='search'], input[type='text']"));
      searchEl = inputs.find(i => /search|filter|service/.test(norm(i.placeholder))) || null;
    }

    setSelectValue(cloudEl, cloud);
    if (searchEl) setInputValue(searchEl, serviceName);

    await new Promise(r => setTimeout(r, 160));

    const node = findServiceNodeByText(serviceName, listContainer);
    if (node) {
      const clickable = (node.tagName === "A" || node.tagName === "BUTTON") ? node : node.querySelector("a,button");
      if (clickable) { try { clickable.click(); } catch (_) {} }
      highlightFlash(node);
      return { ok: true, mode: sel ? "trained" : "heuristic" };
    }
    return { ok: false, mode: sel ? "trained" : "heuristic" };
  }

  function startLinking() {
    const steps = [
      { key: "cloudSelect", label: "Click the CLOUD/PROVIDER dropdown (<select>)" },
      { key: "serviceSearch", label: "Click the SERVICE SEARCH input" },
      { key: "serviceListContainer", label: "Click the CONTAINER that holds your service list (panel/div)" }
    ];
    let idx = 0;
    const collected = {};

    toast("Linking started. " + steps[idx].label);

    function onClick(e) {
      e.preventDefault();
      e.stopPropagation();
      const el = e.target;
      const selector = cssPath(el);
      collected[steps[idx].key] = selector;
      idx++;

      if (idx >= steps.length) {
        document.removeEventListener("click", onClick, true);
        saveSelectors(collected);
        toast("Linked ✅ Saved selectors to localStorage.");
        return;
      }
      toast("Captured. Next: " + steps[idx].label);
    }

    document.addEventListener("click", onClick, true);
  }

  function clearLinking() {
    localStorage.removeItem(LS_KEY);
    toast("Cleared saved selectors.");
  }

  window.ATK_NAV_BRIDGE = {
    openService,
    startLinking,
    clearLinking,
    getSelectors: loadSelectors
  };
})();
