/* Certification Compass — rendering and interaction (no build step, no dependencies).
   All selections live in the URL hash, so a copied link reproduces the same view:
   #tab=path&cur=be&cl=2&tgt=sa&tl=4&ccy=AED&have=saa,cka&free=1&cat=AI&dom=fin&q=k8s */
(function () {
  "use strict";

  var DEFAULTS = { tab: "path", cur: "be", curLv: 2, tgt: "sa", tgtLv: 4, freeOnly: false, q: "", cat: "All", dom: "gov", money: "AED", held: [], walletOpen: false, wq: "" };
  var ROLE_KEYS = ROLES.map(function (r) { return r.k; });
  var CERT_IDS = CERTS.map(function (c) { return c.id; });
  var state;

  /* ---------- state <-> URL hash ---------- */
  function readHash() {
    var s = JSON.parse(JSON.stringify(DEFAULTS));
    var p;
    try { p = new URLSearchParams(location.hash.replace(/^#/, "")); } catch (e) { p = new URLSearchParams(""); }
    if (p.get("tab")) s.tab = p.get("tab");
    if (p.get("cur")) s.cur = p.get("cur");
    if (p.get("tgt")) s.tgt = p.get("tgt");
    if (p.get("cl")) s.curLv = clampLv(p.get("cl"));
    if (p.get("tl")) s.tgtLv = clampLv(p.get("tl"));
    if (p.get("free")) s.freeOnly = p.get("free") === "1";
    if (p.get("cat") && CATS.indexOf(p.get("cat")) > -1) s.cat = p.get("cat");
    if (p.get("dom")) s.dom = p.get("dom");
    if (p.get("q")) s.q = p.get("q");
    if (p.get("ccy") === "USD" || p.get("ccy") === "AED") s.money = p.get("ccy");
    if (p.has("have")) {
      s.held = cleanHeld((p.get("have") || "").split(","));
    } else {
      try { s.held = cleanHeld(JSON.parse(localStorage.getItem("cc-held") || "[]")); } catch (e) {}
    }
    if (ROLE_KEYS.indexOf(s.cur) < 0) s.cur = DEFAULTS.cur;
    if (ROLE_KEYS.indexOf(s.tgt) < 0) s.tgt = DEFAULTS.tgt;
    if (["path", "all", "uae", "free"].indexOf(s.tab) < 0) s.tab = "path";
    if (!DOMS.some(function (d) { return d.k === s.dom; })) s.dom = "gov";
    return s;
  }
  function cleanHeld(list) {
    if (!Array.isArray(list)) return [];
    var out = [];
    list.forEach(function (id) { id = String(id).trim(); if (CERT_IDS.indexOf(id) > -1 && out.indexOf(id) < 0) out.push(id); });
    return out;
  }
  function clampLv(v) { var n = parseInt(v, 10); return isNaN(n) ? 0 : Math.max(0, Math.min(LEVELS.length - 1, n)); }
  function hashString() {
    var p = new URLSearchParams();
    p.set("tab", state.tab); p.set("cur", state.cur); p.set("cl", state.curLv); p.set("tgt", state.tgt); p.set("tl", state.tgtLv);
    p.set("ccy", state.money);
    if (state.held.length) p.set("have", state.held.join(","));
    if (state.freeOnly) p.set("free", "1");
    if (state.cat !== "All") p.set("cat", state.cat);
    if (state.dom !== "gov") p.set("dom", state.dom);
    if (state.q) p.set("q", state.q);
    return "#" + p.toString().replace(/%2C/gi, ",");
  }
  function writeHash() {
    var h = hashString();
    if (location.hash !== h) history.replaceState(null, "", h);
    try { localStorage.setItem("cc-held", JSON.stringify(state.held)); } catch (e) {}
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  }
  function isHeld(id) { return state.held.indexOf(id) > -1; }
  function deco(c, extra) { return decorate(c, extra, state.money, isHeld(c.id)); }
  function money(usd, aed) { return state.money === "AED" ? "AED " + fmt(aed) : "$" + fmt(Math.round(usd)); }

  /* ---------- derive view model ---------- */
  function compute() {
    var st = state;
    var isFreeOk = function (c) { return !st.freeOnly || c.usd === 0; };

    var groups = [[], [], [], []];
    var samePath = st.cur === st.tgt && st.curLv === st.tgtLv;
    CERTS.forEach(function (c) {
      if (!isFreeOk(c)) return;
      var a = tierFor(c, st.cur, st.curLv);
      var b = samePath ? { t: -1, note: "" } : tierFor(c, st.tgt, st.tgtLv);
      if (a.t < 0 && b.t < 0) return;
      var t, note;
      if (b.t > a.t) { t = b.t; note = b.note || (a.t >= 1 ? "" : "For your next move: " + roleLabel(st.tgt).split(" (")[0]); }
      else { t = a.t; note = a.note; if (!samePath && b.t === a.t && t >= 2) note = note || "Useful now and for your next move"; }
      var idx = t === 3 ? 0 : (t === 2 ? 1 : (t === 1 ? 2 : 3));
      groups[idx].push({ c: c, note: note });
    });
    groups.forEach(function (g) { g.sort(function (x, y) { return byRating(x.c, y.c); }); });

    var buckets = TIER.map(function (T, i) {
      var items = groups[i].map(function (o) { return deco(o.c, { note: o.note, accent: T.bg }); });
      return { label: T.label, desc: T.desc, count: items.length + (items.length === 1 ? " cert" : " certs"), items: items, empty: items.length === 0, emptyText: T.empty,
        chipStyle: "font: 600 14px/1 'IBM Plex Mono', monospace; letter-spacing:.04em; text-transform:uppercase; padding:8px 12px; border-radius:6px; background:" + T.bg + "; color:" + T.fg };
    });

    var todo = groups[0].concat(groups[1]).filter(function (o) { return !isHeld(o.c.id); });
    var spend = todo.reduce(function (s, o) { return s + (o.c.usd || 0); }, 0);
    var spendAed = todo.reduce(function (s, o) { return s + (aedOf(o.c) || 0); }, 0);
    var steps = todo.slice().sort(function (x, y) { return (x.c.lv[0] - y.c.lv[0]) || byRating(x.c, y.c); }).slice(0, 6)
      .map(function (o, i) {
        return { num: "0" + (i + 1), n: o.c.n, cost: costLabel(o.c, st.money), when: o.c.lv[0] <= st.curLv ? "now" : ("at " + LEVELS[o.c.lv[0]].short) };
      });

    var view = { title: "", intro: "", items: [], count: "" };
    var domObj = DOMS[0];
    DOMS.forEach(function (d) { if (d.k === st.dom) domObj = d; });
    if (st.tab === "all") {
      var q = (st.q || "").toLowerCase().trim();
      var list = CERTS.filter(function (c) {
        if (!isFreeOk(c)) return false;
        if (st.cat !== "All" && c.cat !== st.cat) return false;
        if (q && (c.n + " " + c.p + " " + c.code).toLowerCase().indexOf(q) < 0) return false;
        return true;
      }).sort(byRating);
      view = { title: "Every certification, rated", intro: "The full catalogue — paid and free — sorted by UAE-market rating. Each card shows the roles it matters most for.", items: list.map(function (c) { return deco(c); }), count: list.length + " of " + CERTS.length + " shown" };
    } else if (st.tab === "uae") {
      var dl = CERTS.filter(function (c) { return c.dom.indexOf(st.dom) > -1 && isFreeOk(c); }).sort(byRating);
      view = { title: "UAE sector tracks", intro: "Certifications that map to UAE regulators, sectors and data-residency rules. Pick a sector to see the regulation behind it and the credentials employers in that sector ask for.", items: dl.map(function (c) { return deco(c); }), count: dl.length + " certifications for this sector" };
    } else if (st.tab === "free") {
      var fl = CERTS.filter(function (c) { return c.usd === 0; }).sort(byRating);
      view = { title: "Free first", intro: "Credentials and certificate-bearing courses that cost nothing. Start here before paying for any exam — several (ISC2 CC, Oracle OCI Foundations, Neo4j) are full certifications, not just course badges.", items: fl.map(function (c) { return deco(c); }), count: fl.length + " free options" };
    }

    return {
      buckets: buckets, steps: steps, view: view, dom: domObj,
      budget: { main: money(spend, spendAed), label: st.held.length ? "Remaining Must + Should budget" : "Must + Should budget" },
      advice: {
        roleTitle: "For " + roleLabel(st.tgt).split(" (")[0].toLowerCase() + "s",
        role: ROLE_ADVICE[st.tgt] + (st.cur !== st.tgt ? " Moving from " + roleLabel(st.cur).split(" (")[0].toLowerCase() + ": " + ROLE_ADVICE[st.cur].split(". ")[0].replace(/\.$/, "") + "." : ""),
        levelTitle: "At " + LEVELS[st.tgtLv].name + " level",
        level: LEVEL_ADVICE[st.tgtLv]
      }
    };
  }

  /* ---------- templates ---------- */
  var MONO = "'IBM Plex Mono', monospace";
  var DISPLAY = "'Bricolage Grotesque', sans-serif";
  var GRID = "display:grid; grid-template-columns:repeat(auto-fill, minmax(min(290px, 100%), 1fr)); gap:14px";
  var SELECT = "width:100%; min-width:0; max-width:100%; min-height:44px; padding:0 12px; font-size:16px; border:1px solid #A8B5B1; border-radius:8px; background:#FFFFFF; color:#14201F; text-overflow:ellipsis";
  var KICKER = "font:600 12px/1 " + MONO + "; letter-spacing:.08em; text-transform:uppercase";
  var X_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var CHECK = function (size, w) { return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L19 7"/></svg>'; };

  function cardHTML(c, showRoles) {
    var tags = c.tags.map(function (g) { return '<span style="' + esc(g.style) + '">' + esc(g.t) + "</span>"; }).join("");
    return '<article style="' + esc(c.cardStyle) + '">' +
      '<div style="display:flex; justify-content:space-between; gap:10px; align-items:flex-start">' +
        '<div style="display:flex; flex-direction:column; gap:3px; min-width:0">' +
          '<span style="font:500 12px/1.3 ' + MONO + '; color:#4A5653">' + esc(c.p) + " · " + esc(c.code) + "</span>" +
          '<h3 style="margin:0; font:600 16px/1.3 \'IBM Plex Sans\', sans-serif; color:#14201F">' + esc(c.n) + "</h3>" +
        "</div>" +
        '<div style="text-align:right; flex-shrink:0; max-width:46%; display:flex; flex-direction:column; gap:2px">' +
          '<span style="font:600 15px ' + MONO + '; white-space:nowrap">' + esc(c.costLabel) + "</span>" +
          (c.hasSub ? '<span style="font:400 11px/1.35 ' + MONO + '; color:#4A5653">' + esc(c.sub) + "</span>" : "") +
        "</div>" +
      "</div>" +
      '<div style="display:flex; align-items:center; gap:10px">' +
        '<div role="img" aria-label="Rated ' + esc(c.rText) + '" style="flex:1; height:6px; background:#E3E8E6; border-radius:3px; overflow:hidden"><div style="' + esc(c.barStyle) + '"></div></div>' +
        '<span style="font:600 13px ' + MONO + '">' + esc(c.rText) + "</span>" +
      "</div>" +
      '<p style="margin:0; font-size:14px; line-height:1.5">' + esc(c.why) + "</p>" +
      '<p style="margin:0; font-size:13px; line-height:1.5; color:#3F4A47"><span style="font:600 11px ' + MONO + '; color:#8A5A00; letter-spacing:.06em">UAE </span>' + esc(c.uae) + "</p>" +
      (c.hasNote ? '<p style="margin:0; font:500 12px/1.4 ' + MONO + '; color:#0B5A53">' + esc(c.note) + "</p>" : "") +
      (showRoles ? '<p style="margin:0; font-size:12px; line-height:1.45; color:#4A5653">' + esc(c.rolesText) + "</p>" : "") +
      '<div style="display:flex; flex-wrap:wrap; gap:6px; align-items:center; margin-top:auto; padding-top:4px">' +
        '<button type="button" data-hold="' + esc(c.id) + '" aria-pressed="' + c.held + '" aria-label="' + esc((c.held ? "Remove from your certifications: " : "I have this: ") + c.n) + '" style="' + esc(c.holdStyle) + '">' + esc(c.holdLabel) + "</button>" +
        tags +
        '<a href="' + esc(c.url) + '" target="_blank" rel="noopener" style="margin-left:auto; font-size:14px; font-weight:600; min-height:44px; display:inline-flex; align-items:center; white-space:nowrap">Exam page ↗</a>' +
      "</div>" +
    "</article>";
  }

  function levelButtons(kind) {
    return LEVELS.map(function (l, i) {
      var on = kind === "cur" ? state.curLv === i : state.tgtLv === i;
      return '<button type="button" data-' + kind + '-lv="' + i + '" aria-pressed="' + on + '" style="' + esc(btnStyle(on, kind)) + '">' +
        '<span style="font-weight:600">' + esc(l.short) + '</span><span style="font:400 11px ' + MONO + '; opacity:.8">' + esc(l.yrs) + "</span></button>";
    }).join("");
  }
  function roleOptions(sel) {
    return ROLES.map(function (o) { return '<option value="' + o.k + '"' + (o.k === sel ? " selected" : "") + ">" + esc(o.label) + "</option>"; }).join("");
  }

  function pathHTML(v) {
    var nHeld = state.held.length;
    var h = '<section aria-labelledby="pathHead" style="display:flex; flex-direction:column; gap:28px">';
    h += '<div class="cc-panel" style="background:#FFFFFF; border:1px solid #D5DCD9; border-radius:16px; padding:24px; display:flex; flex-direction:column; gap:22px">' +
      '<h2 id="pathHead" class="cc-h2" style="margin:0; font:600 24px/1.2 ' + DISPLAY + '">Your path</h2>' +
      '<div style="display:flex; flex-wrap:wrap; gap:24px">' +
        '<div style="flex:1 1 460px; min-width:0; display:flex; flex-direction:column; gap:12px">' +
          '<span style="' + KICKER + '; color:#0B5A53">Where you are</span>' +
          '<label for="curRole" style="font-size:14px; font-weight:500">Current role</label>' +
          '<select id="curRole" style="' + SELECT + '">' + roleOptions(state.cur) + "</select>" +
          '<span style="font-size:14px; font-weight:500">Current level</span>' +
          '<div role="group" aria-label="Current level" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(min(104px, 100%), 1fr)); gap:6px">' + levelButtons("cur") + "</div>" +
        "</div>" +
        '<div style="flex:1 1 460px; min-width:0; display:flex; flex-direction:column; gap:12px">' +
          '<span style="' + KICKER + '; color:#8A5A00">Where you want to go</span>' +
          '<label for="tgtRole" style="font-size:14px; font-weight:500">Target role</label>' +
          '<select id="tgtRole" style="' + SELECT + '">' + roleOptions(state.tgt) + "</select>" +
          '<span style="font-size:14px; font-weight:500">Target level</span>' +
          '<div role="group" aria-label="Target level" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(min(104px, 100%), 1fr)); gap:6px">' + levelButtons("tgt") + "</div>" +
        "</div>" +
      "</div>" +
      '<div style="display:flex; flex-wrap:wrap; gap:16px; align-items:center; justify-content:space-between; border-top:1px solid #E3E8E6; padding-top:18px">' +
        '<div style="display:flex; align-items:center; gap:10px; min-height:44px">' +
          '<input id="freeOnlyPath" data-free type="checkbox"' + (state.freeOnly ? " checked" : "") + ' style="width:20px; height:20px; accent-color:#0B5A53">' +
          '<label for="freeOnlyPath" style="font-size:15px">Show free options only</label>' +
        "</div>" +
        '<button type="button" data-wallet="toggle" aria-expanded="' + state.walletOpen + '" style="min-height:44px; padding:0 14px; border-radius:8px; border:1px solid #0B5A53; background:#FFFFFF; color:#0B5A53; font-size:14px; font-weight:600; cursor:pointer">' +
          (nHeld ? "Certifications I hold (" + nHeld + ")" : "Add certifications I hold") + "</button>" +
        '<div style="display:flex; flex-wrap:wrap; gap:8px 20px; align-items:baseline">' +
          '<span style="font-size:14px; color:#4A5653">' + esc(v.budget.label) + "</span>" +
          '<span style="font:600 22px ' + MONO + '">' + esc(v.budget.main) + "</span>" +
        "</div>" +
      "</div>" +
    "</div>";

    h += '<div style="display:flex; flex-wrap:wrap; gap:16px">' +
      '<div style="flex:1 1 360px; min-width:0; background:#E3EEEB; border-radius:12px; padding:18px 20px; display:flex; flex-direction:column; gap:6px">' +
        '<span style="' + KICKER + '; color:#0B5A53">' + esc(v.advice.roleTitle) + "</span>" +
        '<p style="margin:0; font-size:15px; line-height:1.55">' + esc(v.advice.role) + "</p></div>" +
      '<div style="flex:1 1 360px; min-width:0; background:#F6EBD3; border-radius:12px; padding:18px 20px; display:flex; flex-direction:column; gap:6px">' +
        '<span style="' + KICKER + '; color:#6E4700">' + esc(v.advice.levelTitle) + "</span>" +
        '<p style="margin:0; font-size:15px; line-height:1.55">' + esc(v.advice.level) + "</p></div>" +
    "</div>";

    if (v.steps.length) {
      h += '<div style="display:flex; flex-direction:column; gap:14px">' +
        '<h2 style="margin:0; font:600 20px/1.2 ' + DISPLAY + '">Suggested order</h2>' +
        '<ol style="margin:0; padding:0; list-style:none; display:grid; grid-template-columns:repeat(auto-fill, minmax(min(150px, 100%), 1fr)); gap:12px">' +
        v.steps.map(function (s) {
          return '<li style="background:#FFFFFF; border:1px solid #D5DCD9; border-radius:12px; padding:14px 16px; display:flex; flex-direction:column; gap:6px">' +
            '<span style="font:800 22px/1 ' + DISPLAY + '; color:#0B5A53">' + s.num + "</span>" +
            '<span style="font-weight:600; font-size:15px; line-height:1.3">' + esc(s.n) + "</span>" +
            '<span style="font:500 12px ' + MONO + '; color:#4A5653">' + esc(s.cost) + " · " + esc(s.when) + "</span></li>";
        }).join("") + "</ol></div>";
    }

    h += v.buckets.map(function (b) {
      return '<section style="display:flex; flex-direction:column; gap:14px">' +
        '<div style="display:flex; flex-wrap:wrap; align-items:center; gap:12px">' +
          '<h2 style="margin:0; ' + esc(b.chipStyle) + '">' + esc(b.label) + "</h2>" +
          '<span style="font:500 13px ' + MONO + '; color:#4A5653">' + esc(b.count) + "</span>" +
          '<span style="font-size:14px; color:#4A5653">' + esc(b.desc) + "</span>" +
        "</div>" +
        (b.empty ? '<p style="margin:0; padding:16px 18px; border:1px dashed #A8B5B1; border-radius:12px; font-size:14px; color:#4A5653; line-height:1.5">' + esc(b.emptyText) + "</p>" : "") +
        '<div style="' + GRID + '">' + b.items.map(function (c) { return cardHTML(c, false); }).join("") + "</div>" +
      "</section>";
    }).join("");

    return h + "</section>";
  }

  function chipsHTML(list, attr, label) {
    return '<div role="group" aria-label="' + label + '" class="cc-scroll" style="display:flex; flex-wrap:wrap; gap:6px">' +
      list.map(function (k) { return '<button type="button" data-' + attr + '="' + esc(k.k) + '" aria-pressed="' + k.on + '" style="' + esc(chipStyle(k.on)) + '">' + esc(k.label) + "</button>"; }).join("") +
      "</div>";
  }

  function gridHTML(v) {
    var h = '<section style="display:flex; flex-direction:column; gap:22px">' +
      '<div style="display:flex; flex-direction:column; gap:8px">' +
        '<h2 class="cc-h2" style="margin:0; font:600 28px/1.15 ' + DISPLAY + '">' + esc(v.view.title) + "</h2>" +
        '<p style="margin:0; font-size:16px; line-height:1.55; color:#3F4A47; max-width:820px">' + esc(v.view.intro) + "</p>" +
      "</div>";

    if (state.tab === "all") {
      h += '<div class="cc-panel" style="background:#FFFFFF; border:1px solid #D5DCD9; border-radius:16px; padding:18px; display:flex; flex-direction:column; gap:14px">' +
        '<div style="display:flex; flex-wrap:wrap; gap:16px; align-items:flex-end">' +
          '<div style="flex:1 1 320px; min-width:0; display:flex; flex-direction:column; gap:6px">' +
            '<label for="q" style="font-size:14px; font-weight:500">Search name, provider or exam code</label>' +
            '<input id="q" type="search" value="' + esc(state.q) + '" placeholder="e.g. Kubernetes, ISACA, AZ-305" autocomplete="off" style="width:100%; min-width:0; min-height:44px; padding:0 12px; font-size:16px; border:1px solid #A8B5B1; border-radius:8px">' +
          "</div>" +
          '<div style="display:flex; align-items:center; gap:10px; min-height:44px">' +
            '<input id="freeOnlyAll" data-free type="checkbox"' + (state.freeOnly ? " checked" : "") + ' style="width:20px; height:20px; accent-color:#0B5A53">' +
            '<label for="freeOnlyAll" style="font-size:15px">Free only</label>' +
          "</div>" +
        "</div>" +
        chipsHTML(CATS.map(function (k) { return { k: k, label: k, on: state.cat === k }; }), "cat", "Category") +
      "</div>";
    }

    if (state.tab === "uae") {
      h += '<div style="display:flex; flex-direction:column; gap:16px">' +
        chipsHTML(DOMS.map(function (d) { return { k: d.k, label: d.label, on: state.dom === d.k }; }), "dom", "Sector") +
        '<div class="cc-panel" style="background:#102A28; color:#E9F0EE; border-radius:16px; padding:22px 24px; display:flex; flex-direction:column; gap:12px">' +
          '<h3 style="margin:0; font:600 22px/1.2 ' + DISPLAY + '; color:#FFFFFF">' + esc(v.dom.label) + "</h3>" +
          '<p style="margin:0; font-size:15px; line-height:1.6; max-width:900px">' + esc(v.dom.text) + "</p>" +
          '<div style="display:flex; flex-wrap:wrap; gap:8px">' + v.dom.regs.map(function (r) {
            return '<span style="font:500 12px/1.2 ' + MONO + '; color:#102A28; background:#E0A033; padding:6px 10px; border-radius:4px">' + esc(r) + "</span>";
          }).join("") + "</div>" +
        "</div></div>";
    }

    h += '<div id="results">' + resultsHTML(v) + "</div>";
    return h + "</section>";
  }

  function resultsHTML(v) {
    return '<p aria-live="polite" style="margin:0 0 14px; font:500 13px ' + MONO + '; color:#4A5653">' + esc(v.view.count) + "</p>" +
      '<div style="' + GRID + '">' + v.view.items.map(function (c) { return cardHTML(c, true); }).join("") + "</div>";
  }

  /* ---------- wallet (floating avatar) ---------- */
  function walletPanelHTML() {
    var heldCerts = CERTS.filter(function (c) { return isHeld(c.id); });
    var n = heldCerts.length;
    var usd = heldCerts.reduce(function (s, c) { return s + (c.usd || 0); }, 0);
    var aed = heldCerts.reduce(function (s, c) { return s + (aedOf(c) || 0); }, 0);
    var h = '<div style="display:flex; align-items:flex-start; justify-content:space-between; gap:12px">' +
      '<div style="display:flex; flex-direction:column; gap:4px; min-width:0">' +
        '<h2 id="walletHead" style="margin:0; font:600 20px/1.2 ' + DISPLAY + '">Your certifications</h2>' +
        '<span style="font:500 12px/1.4 ' + MONO + '; color:#4A5653">' +
          (n ? n + (n === 1 ? " certification" : " certifications") + " · " + money(usd, aed) + " of exams passed" : "None added yet · included in your share link") + "</span>" +
      "</div>" +
      '<button type="button" data-wallet="close" aria-label="Close" style="flex-shrink:0; width:44px; height:44px; border-radius:8px; border:1px solid #D5DCD9; background:#FFFFFF; color:#14201F; cursor:pointer; display:flex; align-items:center; justify-content:center">' + X_ICON + "</button>" +
    "</div>";

    if (!n) {
      h += '<p style="margin:0; font-size:14px; line-height:1.5; color:#3F4A47">Mark what you already hold. Earned certs are ticked on your path and left out of your remaining budget and suggested order.</p>';
    } else {
      h += '<ul style="margin:0; padding:0; list-style:none; display:flex; flex-direction:column">' + heldCerts.map(function (c) {
        return '<li style="display:flex; align-items:center; gap:10px; padding:6px 0; border-bottom:1px solid #E3E8E6">' +
          '<span aria-hidden="true" style="flex-shrink:0; width:28px; height:28px; border-radius:50%; background:#E0A033; color:#102A28; display:flex; align-items:center; justify-content:center">' + CHECK(14, 3) + "</span>" +
          '<span style="flex:1; min-width:0; display:flex; flex-direction:column; gap:2px"><span style="font-weight:600; font-size:14px; line-height:1.3">' + esc(c.n) + '</span><span style="font:400 12px ' + MONO + '; color:#4A5653">' + esc(c.p) + " · " + esc(c.code) + "</span></span>" +
          '<button type="button" data-hold="' + esc(c.id) + '" aria-label="' + esc("Remove " + c.n) + '" style="flex-shrink:0; width:44px; height:44px; border-radius:8px; border:0; background:transparent; color:#4A5653; cursor:pointer; display:flex; align-items:center; justify-content:center">' + X_ICON + "</button>" +
        "</li>";
      }).join("") + "</ul>";
    }

    h += '<div style="display:flex; flex-direction:column; gap:6px">' +
      '<label for="wq" style="font-size:14px; font-weight:500">Add a certification you hold</label>' +
      '<input id="wq" type="search" value="' + esc(state.wq) + '" placeholder="Search e.g. SAA, CKA, PMP" autocomplete="off" style="width:100%; min-width:0; min-height:44px; padding:0 12px; font-size:16px; border:1px solid #A8B5B1; border-radius:8px">' +
    "</div>" +
    '<div id="walletMatches">' + walletMatchesHTML() + "</div>";
    return h;
  }
  function walletMatchesHTML() {
    var wq = (state.wq || "").toLowerCase().trim();
    var pool = CERTS.filter(function (c) { return !isHeld(c.id) && c.usd !== null; });
    var matches = wq ? pool.filter(function (c) { return (c.n + " " + c.p + " " + c.code).toLowerCase().indexOf(wq) > -1; }) : pool.slice().sort(byRating);
    if (!matches.length) return '<p style="margin:0; font-size:14px; color:#4A5653">No match — try the exam code or provider.</p>';
    return '<div style="display:flex; flex-direction:column; gap:6px">' +
      '<span style="font:600 11px/1 ' + MONO + '; letter-spacing:.08em; text-transform:uppercase; color:#4A5653">' + (wq ? "Matches" : "Popular — tap to add") + "</span>" +
      matches.slice(0, 6).map(function (c) {
        return '<button type="button" data-hold="' + esc(c.id) + '" style="min-height:44px; padding:6px 12px; border-radius:8px; border:1px solid #D5DCD9; background:#F7F9F8; color:#14201F; cursor:pointer; display:flex; align-items:center; gap:10px; text-align:left">' +
          '<span aria-hidden="true" style="font:600 18px/1 ' + MONO + '; color:#0B5A53">+</span>' +
          '<span style="display:flex; flex-direction:column; gap:2px; min-width:0"><span style="font-size:14px; font-weight:600; line-height:1.3">' + esc(c.n) + '</span><span style="font:400 11px ' + MONO + '; color:#4A5653">' + esc(c.p) + " · " + esc(c.code) + "</span></span></button>";
      }).join("") + "</div>";
  }
  function renderWallet() {
    var n = state.held.length;
    var panel = document.getElementById("walletPanel");
    panel.hidden = !state.walletOpen;
    if (state.walletOpen) panel.innerHTML = walletPanelHTML();
    document.getElementById("walletHint").hidden = n > 0 || state.walletOpen;
    var btn = document.getElementById("avatarBtn");
    btn.setAttribute("aria-expanded", String(state.walletOpen));
    btn.setAttribute("aria-label", "Your certifications: " + n + " held. " + (state.walletOpen ? "Close" : "Open") + " panel");
    document.getElementById("walletCount").textContent = n;
    var held = CERTS.filter(function (c) { return isHeld(c.id); }).slice(-3);
    document.getElementById("walletBadges").innerHTML = held.map(function (c, i) {
      return '<span aria-hidden="true" style="' + esc(badgeStyle(i)) + '">' + CHECK(12, 3.5) + "</span>";
    }).join("");
  }

  /* ---------- render ---------- */
  var app, tabsEl, moneyEl;
  function render() {
    var v = compute();
    tabsEl.innerHTML = [["path", "My path"], ["all", "Browse all"], ["uae", "UAE sector tracks"], ["free", "Free first"]].map(function (t) {
      var on = state.tab === t[0];
      var style = "min-height:48px; padding:0 16px; white-space:nowrap; flex-shrink:0; background:transparent; border:0; border-bottom:3px solid " + (on ? "#E0A033" : "transparent") + "; font-size:15px; font-weight:" + (on ? "600" : "500") + "; color:" + (on ? "#102A28" : "#3F4A47") + "; cursor:pointer";
      return '<button type="button" data-tab="' + t[0] + '" aria-pressed="' + on + '" style="' + style + '">' + t[1] + "</button>";
    }).join("");
    moneyEl.innerHTML = ["AED", "USD"].map(function (k) {
      return '<button type="button" data-money="' + k + '" aria-pressed="' + (state.money === k) + '" style="' + esc(moneyStyle(state.money === k)) + '">' + k + "</button>";
    }).join("");

    var active = document.activeElement;
    var activeId = active && active.id;
    var activeSel = active && (active.getAttribute("data-hold") || active.getAttribute("data-tab") || active.getAttribute("data-money"));
    var caret = active && typeof active.selectionStart === "number" ? active.selectionStart : null;

    app.innerHTML = state.tab === "path" ? pathHTML(v) : gridHTML(v);
    renderWallet();

    var el = activeId ? document.getElementById(activeId) : null;
    if (!el && activeSel) el = document.querySelector('[data-hold="' + activeSel + '"],[data-tab="' + activeSel + '"],[data-money="' + activeSel + '"]');
    if (el) { el.focus({ preventScroll: true }); if (caret != null && el.setSelectionRange) { try { el.setSelectionRange(caret, caret); } catch (e) {} } }
    writeHash();
  }

  function set(patch, opts) {
    Object.assign(state, patch);
    if (opts && opts.only === "results") { var r = document.getElementById("results"); if (r) r.innerHTML = resultsHTML(compute()); writeHash(); }
    else if (opts && opts.only === "walletMatches") { var m = document.getElementById("walletMatches"); if (m) m.innerHTML = walletMatchesHTML(); }
    else render();
    if (opts && opts.scrollTop) window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function toggleHeld(id) {
    var h = state.held.slice(); var i = h.indexOf(id);
    if (i > -1) h.splice(i, 1); else h.push(id);
    set({ held: h });
  }

  function copyLink(btn) {
    var url = location.origin + location.pathname + hashString();
    var done = function (ok) {
      var label = btn.querySelector("[data-label]");
      label.textContent = ok ? "Copied" : "Copy failed";
      setTimeout(function () { label.textContent = "Copy link"; }, 1800);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(function () { done(true); }, function () { done(false); });
    else { try { var t = document.createElement("textarea"); t.value = url; document.body.appendChild(t); t.select(); var ok = document.execCommand("copy"); t.remove(); done(ok); } catch (e) { done(false); } }
  }

  document.addEventListener("DOMContentLoaded", function () {
    state = readHash();
    app = document.getElementById("app");
    tabsEl = document.getElementById("tabs");
    moneyEl = document.getElementById("money");

    document.body.addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (!b) return;
      var d = b.dataset;
      if (d.tab) { set({ tab: d.tab }, { scrollTop: true }); return; }
      if (d.money) { set({ money: d.money }); return; }
      if (d.hold) { toggleHeld(d.hold); return; }
      if (d.curLv != null) { var i = +d.curLv; var p = { curLv: i }; if (state.tgtLv < i) p.tgtLv = i; set(p); return; }
      if (d.tgtLv != null) { set({ tgtLv: +d.tgtLv }); return; }
      if (d.cat) { set({ cat: d.cat }); return; }
      if (d.dom) { set({ dom: d.dom }); return; }
      if (d.wallet === "toggle") { set({ walletOpen: !state.walletOpen }); if (state.walletOpen) focusWallet(); return; }
      if (d.wallet === "close") { set({ walletOpen: false }); document.getElementById("avatarBtn").focus(); return; }
      if (d.share != null) { copyLink(b); return; }
    });
    document.body.addEventListener("change", function (e) {
      var t = e.target;
      if (t.id === "curRole") set({ cur: t.value });
      else if (t.id === "tgtRole") set({ tgt: t.value });
      else if (t.hasAttribute("data-free")) set({ freeOnly: t.checked });
    });
    document.body.addEventListener("input", function (e) {
      if (e.target.id === "q") set({ q: e.target.value }, { only: "results" });
      if (e.target.id === "wq") set({ wq: e.target.value }, { only: "walletMatches" });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && state.walletOpen) { set({ walletOpen: false }); document.getElementById("avatarBtn").focus(); }
    });
    window.addEventListener("hashchange", function () {
      var keepOpen = state.walletOpen;
      state = readHash(); state.walletOpen = keepOpen; render();
    });

    render();
  });

  function focusWallet() { var w = document.getElementById("wq"); if (w) w.focus({ preventScroll: true }); }
})();
