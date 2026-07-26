/* Live docs search: loads search-index.json once, filters as you type. */
(function () {
  var input = document.getElementById("searchInput");
  var panel = document.getElementById("searchResults");
  if (!input || !panel) return;

  var index = null;
  var loading = false;

  function loadIndex() {
    if (index || loading) return;
    loading = true;
    fetch("./search-index.json")
      .then(function (r) { return r.json(); })
      .then(function (data) { index = data; run(); })
      .catch(function () { loading = false; });
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function highlight(text, terms) {
    var safe = escapeHtml(text);
    terms.forEach(function (t) {
      if (!t) return;
      safe = safe.replace(new RegExp("(" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi"), "<mark>$1</mark>");
    });
    return safe;
  }

  function snippetAround(text, term) {
    var i = text.toLowerCase().indexOf(term.toLowerCase());
    if (i < 0) return text.slice(0, 140);
    var start = Math.max(0, i - 60);
    return (start > 0 ? "…" : "") + text.slice(start, start + 160) + "…";
  }

  function run() {
    var q = input.value.trim();
    if (q.length < 2 || !index) {
      panel.hidden = true;
      panel.innerHTML = "";
      return;
    }
    var terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    var scored = [];
    for (var n = 0; n < index.length; n++) {
      var e = index[n];
      var title = e.title.toLowerCase();
      var page = e.page.toLowerCase();
      var text = e.text.toLowerCase();
      var score = 0;
      var allMatch = true;
      for (var i = 0; i < terms.length; i++) {
        var t = terms[i];
        var s = 0;
        if (title.indexOf(t) >= 0) s += 6;
        if (page.indexOf(t) >= 0) s += 3;
        if (text.indexOf(t) >= 0) s += 1;
        if (s === 0) { allMatch = false; break; }
        score += s;
      }
      if (allMatch) scored.push({ e: e, score: score });
    }
    scored.sort(function (a, b) { return b.score - a.score; });
    var top = scored.slice(0, 8);

    if (!top.length) {
      panel.innerHTML = '<div class="r-empty">No results for “' + escapeHtml(q) + '”.</div>';
      panel.hidden = false;
      return;
    }

    panel.innerHTML = top
      .map(function (r) {
        var e = r.e;
        return (
          '<a href="' + e.url + '">' +
          '<div class="r-page">' + escapeHtml(e.page) + "</div>" +
          '<div class="r-title">' + highlight(e.title, terms) + "</div>" +
          '<div class="r-snippet">' + highlight(snippetAround(e.text, terms[0]), terms) + "</div>" +
          "</a>"
        );
      })
      .join("");
    panel.hidden = false;
  }

  input.addEventListener("focus", loadIndex);
  input.addEventListener("input", function () { loadIndex(); run(); });
  input.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape") { panel.hidden = true; input.blur(); }
    if (ev.key === "Enter") {
      var first = panel.querySelector("a");
      if (first && !panel.hidden) window.location.href = first.getAttribute("href");
    }
  });
  document.addEventListener("click", function (ev) {
    if (!panel.contains(ev.target) && ev.target !== input) panel.hidden = true;
  });
})();
