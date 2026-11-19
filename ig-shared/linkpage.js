/* Shared logic for every studio's Instagram link-in-bio page.
   Each studio page sets window.LINKPAGE = { slug, studio, trialUrl } before loading this file. */
(function () {
  var cfg = window.LINKPAGE || {};
  var UTM = "utm_source=instagram&utm_medium=bio&utm_campaign=" + encodeURIComponent(cfg.slug || "studio");

  function tag(url, content) {
    var sep = url.indexOf("?") === -1 ? "?" : "&";
    return url + sep + UTM + "&utm_content=" + encodeURIComponent(content);
  }

  // Count taps per button as a Meta Pixel custom event ("BioLinkClick"), split by studio and button.
  function track(button) {
    try {
      if (typeof fbq === "function") fbq("trackCustom", "BioLinkClick", { studio: cfg.studio, button: button });
    } catch (e) { /* tracking must never block the tap */ }
  }

  var trial = document.getElementById("trial");
  if (trial && cfg.trialUrl) {
    trial.href = tag(cfg.trialUrl, "trial");
    trial.addEventListener("click", function () { track("trial"); });
  }

  // Promo button(s) from the one shared settings file.
  function today() {
    // Use the studio's local date so promos flip at local midnight.
    try {
      return new Intl.DateTimeFormat("en-CA", { timeZone: cfg.timeZone || "America/Phoenix" }).format(new Date());
    } catch (e) { return new Date().toISOString().slice(0, 10); }
  }

  fetch("/ig-shared/promos.json?v=" + Date.now(), { cache: "no-store" })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var d = today();
      var list = (data.promos || []).filter(function (p) {
        var forStudio = p.studios === "all" || (Array.isArray(p.studios) && p.studios.indexOf(cfg.slug) !== -1);
        return forStudio && p.url && p.label && (!p.start || p.start <= d) && (!p.end || d <= p.end);
      });
      var box = document.getElementById("promos");
      list.forEach(function (p, i) {
        var a = document.createElement("a");
        a.className = "link promo";
        a.textContent = p.label;
        a.href = tag(p.url, "promo-" + (i + 1));
        a.addEventListener("click", function () { track("promo: " + p.label); });
        box.appendChild(a);
      });
    })
    .catch(function () { /* no promos shown if the file can't load */ });
  // ---------- Event RSVP buttons ----------
  // Reads the Upcoming Events sheet (same one the lobby boards use). A button shows for an event when:
  //   - it's for this studio (or "All studios" / AZ only / CO only),
  //   - it has an "RSVP / sign-up link", the "Approved" column is filled, and "Hide" is empty,
  //   - today is within 14 days before the start date, up to the end date.
  // Up to 2 buttons, soonest first. Add ?preview to the page URL to ignore the 14-day window
  // (approval is still required) so you can check how an approved event will look.
  var EVENTS_CSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTm6O_W4mxxJJKt7GxrRqh1OK4ee2_-jxIAZjnNndYs1auFDiyydDPrOQte3Y3pKuEb1_ZdLyeew2BA/pub?gid=423535417&single=true&output=csv";
  var MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  var preview = /[?&]preview\b/.test(location.search);

  function norm(x) { return String(x || "").toLowerCase().replace(/^\s*f45\s*(training\s*)?/, "").replace(/&/g, "and").replace(/[^a-z0-9]/g, ""); }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function parseDate(raw) {
    var s = String(raw || "").trim(), m;
    if ((m = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/))) return m[1] + "-" + pad(+m[2]) + "-" + pad(+m[3]);
    if ((m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/))) return m[3] + "-" + pad(+m[1]) + "-" + pad(+m[2]);
    return null;
  }
  function addDays(isoDate, n) {
    var d = new Date(isoDate + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function parseCSV(text) {
    var rows = [], row = [], cell = "", q = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
      else if (c === '"') q = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
      else cell += c;
    }
    if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }
  function forThisStudio(where) {
    var tz = cfg.timeZone || "America/Phoenix";
    return String(where).split(/[,;\n]+/).some(function (part) {
      if (/^\s*all\b/i.test(part)) return true;
      if (/^\s*(az|arizona)\b/i.test(part)) return tz === "America/Phoenix";
      if (/^\s*(co|colorado)\b/i.test(part)) return tz === "America/Denver";
      return norm(part) === norm(cfg.slug);
    });
  }

  // Basic look for RSVP buttons on pages that don't style them yet
  if (!document.getElementById("rsvp-default-css")) {
    var st = document.createElement("style"); st.id = "rsvp-default-css";
    st.textContent = ".rsvp{display:flex;align-items:center;gap:12px;text-align:left}.rsvp-tile{display:flex;flex-direction:column;align-items:center;justify-content:center;background:#fff;color:#211551;min-width:44px;padding:4px 6px;font-weight:800;line-height:1}.rsvp-tile .m{font-size:10px;letter-spacing:.15em;text-transform:uppercase}.rsvp-tile .d{font-size:20px}";
    document.head.insertBefore(st, document.head.firstChild);
  }

  fetch(EVENTS_CSV, { cache: "no-store" })
    .then(function (r) { return r.text(); })
    .then(function (text) {
      var rows = parseCSV(text); if (!rows.length) return;
      var h = rows[0].map(function (x) { return String(x).toLowerCase().trim(); });
      function col(test) { for (var i = 0; i < h.length; i++) if (test(h[i])) return i; return -1; }
      var c = {
        studio: col(function (x) { return x.indexOf("studio") === 0; }),
        name: col(function (x) { return /\bname\b/.test(x) && x.indexOf("studio") < 0; }),
        start: col(function (x) { return x.indexOf("start date") > -1; }),
        end: col(function (x) { return x.indexOf("end date") > -1; }),
        link: col(function (x) { return x.indexOf("rsvp") > -1; }),
        ok: col(function (x) { return x === "approved"; }),
        hide: col(function (x) { return x === "hide"; }),
        postTo: col(function (x) { return x.indexOf("post to") === 0; })
      };
      if (c.link < 0 || c.ok < 0 || c.start < 0 || c.name < 0) return;
      var d = today(), list = [];
      rows.slice(1).forEach(function (v) {
        function g(i) { return i > -1 && v[i] != null ? String(v[i]).trim() : ""; }
        var url = g(c.link), start = parseDate(g(c.start));
        if (!url || !/^https?:\/\//i.test(url) || !start || !g(c.ok) || g(c.hide) || !g(c.name)) return;
        var end = parseDate(g(c.end)); if (!end || end < start) end = start;
        var target = g(c.postTo), where = target && !/^one\b/i.test(target) ? target : g(c.studio);
        if (!forThisStudio(where)) return;
        if (d > end) return;
        if (!preview && d < addDays(start, -14)) return;
        list.push({ name: g(c.name), url: url, start: start });
      });
      list.sort(function (a, b) { return a.start < b.start ? -1 : a.start > b.start ? 1 : 0; });
      var box = document.getElementById("rsvps") || document.getElementById("promos");
      if (!box) return;
      list.slice(0, 2).forEach(function (e, i) {
        var a = document.createElement("a");
        a.className = "link promo rsvp";
        var tile = document.createElement("span"); tile.className = "rsvp-tile";
        var m = document.createElement("span"); m.className = "m"; m.textContent = MON[+e.start.slice(5, 7) - 1];
        var dd = document.createElement("span"); dd.className = "d"; dd.textContent = String(+e.start.slice(8));
        tile.appendChild(m); tile.appendChild(dd);
        var t = document.createElement("span"); t.className = "rsvp-text"; t.textContent = "RSVP: " + e.name;
        a.appendChild(tile); a.appendChild(t);
        a.href = tag(e.url, "rsvp-" + (i + 1));
        a.target = "_blank"; a.rel = "noopener";
        a.addEventListener("click", function () { track("rsvp: " + e.name); });
        box.appendChild(a);
      });
    })
    .catch(function () { /* no RSVP buttons if the sheet can't load */ });
})();
