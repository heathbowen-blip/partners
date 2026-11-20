/* Studio Marketing Hub — renders one studio's hub from /hub/hub.json. Each studio page sets window.HUB = { slug: "belmar" }. */
(function () {
  var slug = (window.HUB || {}).slug;
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var card = function (it, primary) {
    return '<a class="card' + (primary ? ' primary' : '') + '" href="' + esc(it.url) + '" target="_blank" rel="noopener">' +
      '<div><b>' + esc(it.label) + '</b>' + (it.sub ? '<span class="s">' + esc(it.sub) + '</span>' : '') + '</div>' +
      '<span class="arr" aria-hidden="true">&rarr;</span></a>';
  };
  var today = function (tz) {
    try { return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
    catch (e) { return new Date().toISOString().slice(0, 10); }
  };
  fetch("/hub/hub.json", { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (cfg) {
    var st = cfg.studios[slug];
    if (!st) throw new Error("unknown studio");
    var fill = function (u) { return u.replace("{upload}", st.upload).replace("{studioName}", encodeURIComponent(st.eventsName || st.name)); };
    document.getElementById("tools").innerHTML = cfg.tools.map(function (t, i) {
      return card({ label: t.label, sub: t.sub, url: fill(t.url) }, i === 0);
    }).join("");
    var d = today(st.timeZone);
    var live = (cfg.items || []).filter(function (it) {
      var who = it.studios === "all" || (it.studios || []).indexOf(slug) > -1;
      return who && (!it.start || it.start <= d) && (!it.end || d <= it.end);
    });
    document.getElementById("items").innerHTML = live.length ? live.map(function (it) { return card(it); }).join("")
      : '<p class="empty">Nothing new right now. New promos and materials show up here when they launch.</p>';
    document.getElementById("links").innerHTML = st.ig ? card({ label: "Studio link in bio", sub: "The page on our Instagram bio. Share it with anyone.", url: st.ig }) : "";
  }).catch(function () {
    document.getElementById("tools").innerHTML = '<p class="err">Couldn\'t load the hub. Check your connection and refresh.</p>';
  });
})();
