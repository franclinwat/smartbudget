// BOWENCY — interactions du one-page
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

  // Parallaxe des images ([data-plx] : facteur de coulissement)
  var plxEls = Array.prototype.slice.call(document.querySelectorAll('[data-plx]'));
  if (!reduced && plxEls.length) {
    var ticking = false;
    function updateParallax() {
      var vh = window.innerHeight;
      plxEls.forEach(function (img) {
        var box = (img.closest('.media') || img.parentElement).getBoundingClientRect();
        if (box.bottom < -80 || box.top > vh + 80) return;
        var factor = parseFloat(img.dataset.plx) || 0.15;
        var offset = (box.top + box.height / 2 - vh / 2) * -factor;
        img.style.setProperty('--plx', offset.toFixed(1) + 'px');
      });
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(updateParallax); }
    }, { passive: true });
    window.addEventListener('resize', updateParallax);
    updateParallax();
  }
})();
