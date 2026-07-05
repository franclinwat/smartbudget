// BOWENCY — interactions du one-page immersif
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Révélations au scroll
  var revealed = document.querySelectorAll('.reveal');
  if (reduced || !('IntersectionObserver' in window)) {
    revealed.forEach(function (el) { el.classList.add('on'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('on');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    revealed.forEach(function (el) { io.observe(el); });
  }

  // Compteurs des statistiques
  var counters = document.querySelectorAll('.count');
  function animate(el) {
    var target = parseInt(el.dataset.count, 10) || 0;
    if (reduced) { el.textContent = target; return; }
    var start = null;
    var duration = 1200;
    function step(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / duration, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  if ('IntersectionObserver' in window) {
    var cio = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          animate(entry.target);
          cio.unobserve(entry.target);
        }
      });
    }, { threshold: 0.4 });
    counters.forEach(function (el) { cio.observe(el); });
  } else {
    counters.forEach(animate);
  }

  // Progression des scènes ([data-story]) : --p évolue de 0 à 1 pendant
  // que la scène traverse l'écran ; le CSS orchestre les effets
  // (image qui glisse/s'estompe, panneau d'infos qui prend le dessus).
  var stories = Array.prototype.slice.call(document.querySelectorAll('[data-story]'));
  if (!reduced && stories.length) {
    var ticking = false;
    function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }
    function updateStories() {
      var vh = window.innerHeight;
      stories.forEach(function (s) {
        var r = s.getBoundingClientRect();
        if (r.bottom < -100 || r.top > vh + 100) return;
        var travel = Math.max(r.height - vh, vh * 0.6);
        var p = clamp01(-r.top / travel);
        s.style.setProperty('--p', p.toFixed(3));
      });
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(updateStories); }
    }, { passive: true });
    window.addEventListener('resize', updateStories);
    updateStories();
  }
})();
