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
})();
