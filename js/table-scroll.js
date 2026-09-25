(function () {
  'use strict';

  var bar = null;
  var track = null;
  var active = null;
  var syncing = false;

  function ensureBar() {
    if (bar) return;
    bar = document.createElement('div');
    bar.className = 'floating-table-scrollbar';
    bar.setAttribute('aria-label', 'Rolagem horizontal da tabela');
    bar.setAttribute('role', 'region');
    bar.hidden = true;
    track = document.createElement('div');
    track.className = 'floating-table-scrollbar-track';
    bar.appendChild(track);
    document.body.appendChild(bar);

    bar.addEventListener('scroll', function () {
      if (!active || syncing) return;
      syncing = true;
      active.scrollLeft = bar.scrollLeft;
      syncing = false;
    }, { passive: true });
  }

  function candidates() {
    return Array.prototype.filter.call(document.querySelectorAll('.table-scroll'), function (el) {
      if (!el.offsetParent) return false;
      var style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      return el.scrollWidth > el.clientWidth + 3;
    });
  }

  function pickActive() {
    if (window.innerWidth <= 720) return null;
    var list = candidates();
    var viewportH = window.innerHeight || document.documentElement.clientHeight;
    var best = null;
    var bestScore = -Infinity;

    list.forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.bottom <= 0 || r.top >= viewportH) return;
      var visible = Math.min(r.bottom, viewportH) - Math.max(r.top, 0);
      if (visible > bestScore) {
        best = el;
        bestScore = visible;
      }
    });
    return best;
  }

  function bindActive(next) {
    if (active === next) return;
    if (active) active.removeEventListener('scroll', syncFromTable);
    active = next;
    if (active) active.addEventListener('scroll', syncFromTable, { passive: true });
  }

  function syncFromTable() {
    if (!active || !bar || syncing) return;
    syncing = true;
    bar.scrollLeft = active.scrollLeft;
    syncing = false;
  }

  function update() {
    ensureBar();
    var next = pickActive();
    bindActive(next);

    if (!active) {
      bar.hidden = true;
      return;
    }

    var r = active.getBoundingClientRect();
    var left = Math.max(8, r.left);
    var right = Math.min(window.innerWidth - 8, r.right);
    var width = Math.max(0, right - left);
    if (width < 120) {
      bar.hidden = true;
      return;
    }

    bar.style.left = left + 'px';
    bar.style.width = width + 'px';
    track.style.width = active.scrollWidth + 'px';
    bar.hidden = false;
    syncFromTable();
  }

  var queued = false;
  function requestUpdate() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () {
      queued = false;
      update();
    });
  }

  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', requestUpdate, { passive: true });
  window.addEventListener('load', requestUpdate);
  document.addEventListener('click', function () { setTimeout(requestUpdate, 0); });

  if ('MutationObserver' in window) {
    new MutationObserver(requestUpdate).observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['hidden', 'class', 'style']
    });
  }

  requestUpdate();
})();
