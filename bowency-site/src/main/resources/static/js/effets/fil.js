/* ==========================================================================
   BOWENCY — EFFET « FIL DE LUMIÈRE » (module overlay autonome)
   --------------------------------------------------------------------------
   Un canvas fixe, injecté derrière le contenu du site, sur lequel une courbe
   Catmull-Rom aléatoire (serpentin gauche/droite) se dessine au fil du
   défilement, avec une « ampoule » lumineuse pulsante à sa pointe.

   - Aucune dépendance, aucune variable globale (hors window.__bwEffet,
     exposé uniquement pour permettre un éventuel nettoyage).
   - Les couleurs sont lues DYNAMIQUEMENT dans les variables CSS du document :
       --bg    fond de page (sert au micro-reflet de l'ampoule en thème clair)
       --acc   couleur d'accent (corps du fil)
       --halo  couleur du halo (lueur, cœur du filament)
   - Thème clair : détecté quand <html data-theme="grandsoir"> → rendu
     « encre dense + halo translucide » en composite normal. Sinon : rendu
     lumineux additif (composite 'lighter').
   - Un MutationObserver suit l'attribut data-theme de <html> pour re-lire
     les couleurs et redessiner si le thème change sans rechargement.
   ========================================================================== */
(function () {
  'use strict';

  /* Garde-fou : si le module est chargé deux fois, on détruit l'ancienne
     instance avant d'en créer une nouvelle. */
  if (window.__bwEffet && typeof window.__bwEffet.destroy === 'function') {
    window.__bwEffet.destroy();
  }

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* --- État ------------------------------------------------------------- */
  var canvas = null;           // le <canvas> injecté
  var ctx = null;              // contexte 2D
  var dpr = 1;                 // devicePixelRatio appliqué (plafonné à 2)
  var vw = 0, vh = 0;          // taille du viewport (px CSS)
  var docH = 0;                // hauteur totale du document
  var genDocH = 0;             // hauteur du document au moment de la génération des points
  var ctrlNorm = [];           // points de contrôle NORMALISÉS {fx: 0..1 largeur, fy: 0..1 hauteur doc}
  var pts = [];                // ~600 points échantillonnés {x, y} en px document
  var cum = [];                // longueurs cumulées le long du fil (cum[i] = distance 0→i)
  var totalLen = 0;            // longueur totale du fil
  var lastScroll = -1;         // dernier scrollY dessiné (évite les redraws inutiles)
  var lastPulse = -1;          // dernière valeur (quantifiée) de pulse dessinée
  var needsRedraw = true;      // forçage de redraw (thème, resize, …)
  var rafId = 0;               // id requestAnimationFrame (pour l'annulation)
  var destroyed = false;       // vrai après destroy()

  /* Couleurs courantes, re-lues depuis le CSS à l'init et à chaque
     changement de thème. */
  var theme = { mode: 'dark', bg: '#060B14', acc: '#3D6BFF', halo: '#8FE9FF' };

  /* ==========================================================================
     COULEURS — lecture dynamique des variables CSS
     ========================================================================== */

  /* Normalise une valeur hex CSS (#abc ou #aabbcc, avec espaces éventuels)
     en hex 6 chiffres. Retourne le fallback si la variable est vide/invalide. */
  function normalizeHex(raw, fallback) {
    var v = (raw || '').trim();
    if (/^#[0-9a-fA-F]{3}$/.test(v)) {
      // #abc → #aabbcc
      return '#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
    }
    if (/^#[0-9a-fA-F]{6}$/.test(v)) return v;
    return fallback;
  }

  /* Re-lit --bg / --acc / --halo et le mode (clair si data-theme="grandsoir"). */
  function readTheme() {
    var root = document.documentElement;
    var cs = getComputedStyle(root);
    theme.bg = normalizeHex(cs.getPropertyValue('--bg'), theme.bg);
    theme.acc = normalizeHex(cs.getPropertyValue('--acc'), theme.acc);
    theme.halo = normalizeHex(cs.getPropertyValue('--halo'), theme.halo);
    theme.mode = root.getAttribute('data-theme') === 'grandsoir' ? 'light' : 'dark';
  }

  /* Conversion hex 6 chiffres → chaîne rgba(r,g,b,a). */
  function rgba(hex, a) {
    var r = parseInt(hex.slice(1, 3), 16),
        g = parseInt(hex.slice(3, 5), 16),
        b = parseInt(hex.slice(5, 7), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  /* ==========================================================================
     1) GÉNÉRATION DE LA COURBE
     Points de contrôle : x oscille en serpentin entre 15 % et 85 % de la
     largeur (alternance gauche/droite pour éviter les paquets), espacés
     verticalement de 25 à 35 vh, du haut (y=0) au bas du document.
     Stockés NORMALISÉS pour être remis à l'échelle au resize sans changer
     la « personnalité » de la courbe.
     ========================================================================== */
  function generateControlPoints() {
    ctrlNorm = [];
    genDocH = docH;
    var side = Math.random() < 0.5 ? 1 : -1; // côté de départ aléatoire
    var y = 0;
    while (true) {
      // Alternance douce : chaque point vit dans sa moitié, avec du jeu.
      // side=-1 → fx dans [0.15, 0.50] ; side=+1 → fx dans [0.50, 0.85]
      var fx = (side < 0)
        ? 0.15 + Math.random() * 0.35
        : 0.50 + Math.random() * 0.35;
      ctrlNorm.push({ fx: fx, fy: Math.min(y / docH, 1) });
      if (y >= docH) break;
      y += vh * (0.25 + Math.random() * 0.10); // espacement 25–35 vh
      if (y > docH) y = docH;                  // dernier point exactement en bas
      side = -side;
    }
  }

  /* Interpolation Catmull-Rom (forme uniforme standard : suffisante ici car
     les points sont régulièrement espacés verticalement → pas de boucle
     parasite). */
  function catmullRom(p0, p1, p2, p3, t) {
    var t2 = t * t, t3 = t2 * t;
    return {
      x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t +
           (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
           (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
      y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t +
           (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
           (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
    };
  }

  /* Échantillonnage : ~600 points + longueurs cumulées → on peut tracer un
     pourcentage EXACT de la longueur du fil. */
  function samplePath() {
    // Points de contrôle en pixels document
    var cp = ctrlNorm.map(function (c) {
      return { x: c.fx * vw, y: c.fy * docH };
    });
    // Duplication des extrémités pour que la spline passe par le 1er et le dernier point
    var ext = [cp[0]].concat(cp, [cp[cp.length - 1]]);

    var SAMPLES = 600;
    var segs = ext.length - 3;                     // nombre de segments Catmull-Rom
    var perSeg = Math.max(2, Math.ceil(SAMPLES / segs));

    pts = [];
    for (var s = 0; s < segs; s++) {
      for (var i = 0; i < perSeg; i++) {
        pts.push(catmullRom(ext[s], ext[s + 1], ext[s + 2], ext[s + 3], i / perSeg));
      }
    }
    pts.push({ x: cp[cp.length - 1].x, y: cp[cp.length - 1].y }); // point final exact

    // Longueurs cumulées le long du fil
    cum = [0];
    totalLen = 0;
    for (var k = 1; k < pts.length; k++) {
      var dx = pts[k].x - pts[k - 1].x,
          dy = pts[k].y - pts[k - 1].y;
      totalLen += Math.sqrt(dx * dx + dy * dy);
      cum.push(totalLen);
    }
  }

  /* Position exacte de la pointe à une longueur donnée : recherche binaire
     dans les longueurs cumulées + interpolation linéaire. */
  function pointAtLength(len) {
    if (len <= 0) return { i: 0, x: pts[0].x, y: pts[0].y };
    if (len >= totalLen) {
      var last = pts.length - 1;
      return { i: last, x: pts[last].x, y: pts[last].y };
    }
    var lo = 0, hi = cum.length - 1;
    while (lo < hi) {
      var mid = (lo + hi) >> 1;
      if (cum[mid] < len) lo = mid + 1; else hi = mid;
    }
    var i = lo;                                   // premier index dont cum >= len
    var segLen = cum[i] - cum[i - 1] || 1;
    var t = (len - cum[i - 1]) / segLen;
    return {
      i: i - 1,
      x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t,
      y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t
    };
  }

  /* ==========================================================================
     2) DIMENSIONNEMENT / RESIZE
     Le canvas couvre le viewport (position:fixed) ; on dessine en coordonnées
     document en translatant de -scrollY. Au resize (ou quand la hauteur du
     document change : images lazy, contenu injecté…) on re-mesure et on remet
     la courbe à l'échelle à partir des points normalisés. Si la hauteur a
     beaucoup changé depuis la génération, on régénère les points de contrôle
     pour conserver un espacement harmonieux (25–35 vh).
     ========================================================================== */
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2); // 2 max : suffisant et économe
    vw = window.innerWidth;
    vh = window.innerHeight;
    docH = Math.max(document.documentElement.scrollHeight, vh);

    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(vh * dpr);
    canvas.style.width = vw + 'px';
    canvas.style.height = vh + 'px';

    // Première fois : génération ; ensuite : régénération seulement si la
    // hauteur du document a varié de plus de 25 % (sinon simple rescale,
    // ce qui préserve la forme déjà vue par le visiteur).
    if (!ctrlNorm.length || Math.abs(docH - genDocH) / genDocH > 0.25) {
      generateControlPoints();
    }
    samplePath();                                  // ré-échantillonner aux nouvelles mesures
    lastScroll = -1;                               // forcer le redraw
    needsRedraw = true;
  }

  /* ==========================================================================
     3) RENDU
     ========================================================================== */

  /* Trace la portion [0 → tip] du fil comme un seul chemin. */
  function buildTracedPath(tip) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (var k = 1; k <= tip.i; k++) ctx.lineTo(pts[k].x, pts[k].y);
    ctx.lineTo(tip.x, tip.y);
  }

  /* Rendu ADDITIF (thèmes sombres) : plusieurs passes au shadowBlur croissant,
     composite 'lighter' → les lueurs s'additionnent comme de la vraie lumière. */
  function drawDark(tip, pulse) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Passe 1 — nappe large et diffuse (le fil « éclaire » la page)
    buildTracedPath(tip);
    ctx.shadowColor = theme.halo;
    ctx.shadowBlur = 28;
    ctx.strokeStyle = rgba(theme.acc, 0.22);
    ctx.lineWidth = 5;
    ctx.stroke();

    // Passe 2 — corps lumineux
    buildTracedPath(tip);
    ctx.shadowBlur = 12;
    ctx.strokeStyle = rgba(theme.acc, 0.55);
    ctx.lineWidth = 3;
    ctx.stroke();

    // Passe 3 — cœur du filament, presque blanc
    buildTracedPath(tip);
    ctx.shadowBlur = 4;
    ctx.strokeStyle = rgba(theme.halo, 0.95);
    ctx.lineWidth = 1.6;
    ctx.stroke();

    ctx.shadowBlur = 0;

    /* L'AMPOULE — pointe du fil : halo radial large qui pulse légèrement,
       puis noyau éclatant. */
    var R = vh * 0.28 * pulse;                    // rayon du halo (~28 % du viewport)
    var g = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, R);
    g.addColorStop(0,    rgba(theme.halo, 0.50));
    g.addColorStop(0.18, rgba(theme.halo, 0.22));
    g.addColorStop(0.45, rgba(theme.acc, 0.08));
    g.addColorStop(1,    rgba(theme.acc, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, R, 0, Math.PI * 2);
    ctx.fill();

    // Noyau : deux disques (halo serré + point blanc)
    ctx.shadowColor = theme.halo;
    ctx.shadowBlur = 22;
    ctx.fillStyle = rgba(theme.halo, 0.9);
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, 4.2 * pulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 6;
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  /* Rendu CLAIR (grandsoir) : une lumière blanche serait invisible sur papier
     clair. Stratégie inverse : trait outremer DENSE (l'encre remplace la
     lumière), halos translucides en composite normal — l'effet devient un
     « fil d'encre électrique » sur papier. */
  function drawLight(tip, pulse) {
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Passe 1 — aura très diffuse autour du trait (teinte le papier)
    buildTracedPath(tip);
    ctx.strokeStyle = rgba(theme.acc, 0.07);
    ctx.lineWidth = 22;
    ctx.stroke();

    // Passe 2 — halo rapproché
    buildTracedPath(tip);
    ctx.strokeStyle = rgba(theme.acc, 0.14);
    ctx.lineWidth = 9;
    ctx.stroke();

    // Passe 3 — le fil lui-même : accent saturé, net
    buildTracedPath(tip);
    ctx.strokeStyle = theme.acc;
    ctx.lineWidth = 2.6;
    ctx.stroke();

    /* L'AMPOULE version papier : halo translucide + disque d'encre dense */
    var R = vh * 0.20 * pulse;
    var g = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, R);
    g.addColorStop(0,    rgba(theme.acc, 0.28));
    g.addColorStop(0.35, rgba(theme.acc, 0.10));
    g.addColorStop(1,    rgba(theme.acc, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, R, 0, Math.PI * 2);
    ctx.fill();

    // Disque dense (l'« ampoule » devient une perle d'encre)
    ctx.fillStyle = theme.acc;
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, 5 * pulse, 0, Math.PI * 2);
    ctx.fill();

    // Micro-reflet couleur papier (--bg) au centre : garde la sensation lumineuse
    ctx.fillStyle = rgba(theme.bg, 0.85);
    ctx.beginPath();
    ctx.arc(tip.x - 1, tip.y - 1, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }

  function draw(scrollY, pulse) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, vw, vh);
    ctx.translate(0, -scrollY);                   // coordonnées document → viewport

    /* Progression : 0 en haut de page, 1 tout en bas.
       Cas limite : document plus court que le viewport → fil complet. */
    var maxScroll = docH - vh;
    var progress = maxScroll > 0 ? Math.min(Math.max(scrollY / maxScroll, 0), 1) : 1;
    if (reducedMotion) progress = 1;              // accessibilité : fil complet, statique

    if (progress <= 0) return;                    // scroll 0 : rien à tracer (le fil naît)

    var tip = pointAtLength(progress * totalLen);

    if (theme.mode === 'light') drawLight(tip, pulse);
    else                        drawDark(tip, pulse);
  }

  /* ==========================================================================
     4) BOUCLE — requestAnimationFrame.
     On ne redessine que si le scroll OU la pulse ont changé.
     En reduced-motion la pulse est figée → redraw uniquement au scroll/resize.
     ========================================================================== */
  function loop(now) {
    if (destroyed) return;

    // Pulse de l'ampoule : ±1,5 % d'amplitude, période 2 s
    var pulse = reducedMotion ? 1 : 1 + 0.015 * Math.sin(now * Math.PI / 1000);
    // Quantifiée pour éviter des redraws pour des variations invisibles
    var pulseQ = Math.round(pulse * 400);

    var sy = window.scrollY || window.pageYOffset || 0;

    if (needsRedraw || sy !== lastScroll || pulseQ !== lastPulse) {
      draw(sy, pulse);
      lastScroll = sy;
      lastPulse = pulseQ;
      needsRedraw = false;
    }
    rafId = requestAnimationFrame(loop);
  }

  /* ==========================================================================
     5) INITIALISATION / OBSERVATEURS / NETTOYAGE
     ========================================================================== */

  var resizeTimer = null;      // debounce du resize fenêtre
  var bodyTimer = null;        // debounce du ResizeObserver sur <body>
  var themeObserver = null;    // MutationObserver sur data-theme
  var bodyObserver = null;     // ResizeObserver sur document.body

  function onWindowResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 120);
  }

  function init() {
    // --- Canvas : premier enfant de <body>, fixe, derrière tout, inerte ---
    canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.position = 'fixed';
    canvas.style.inset = '0';
    canvas.style.zIndex = '0';
    canvas.style.pointerEvents = 'none';
    document.body.insertBefore(canvas, document.body.firstChild);
    ctx = canvas.getContext('2d');

    // --- Couleurs initiales + première mesure/génération ---
    readTheme();
    resize();

    // --- Resize fenêtre : re-mesure + remise à l'échelle (debounce léger) ---
    window.addEventListener('resize', onWindowResize);

    // --- Thème : suivre data-theme sur <html> pour re-lire les couleurs ---
    themeObserver = new MutationObserver(function () {
      readTheme();
      lastScroll = -1;         // invalider le cache de scroll
      needsRedraw = true;      // redessiner avec les nouvelles couleurs
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });

    // --- Hauteur du document : les images lazy / contenus injectés peuvent
    //     l'allonger après coup. On observe <body> (débouncé) et on re-mesure
    //     seulement si la hauteur totale a réellement changé. ---
    if (typeof ResizeObserver !== 'undefined') {
      bodyObserver = new ResizeObserver(function () {
        clearTimeout(bodyTimer);
        bodyTimer = setTimeout(function () {
          var h = Math.max(document.documentElement.scrollHeight, vh);
          if (h !== docH) resize();
        }, 200);
      });
      bodyObserver.observe(document.body);
    }

    // --- Démarrage de la boucle ---
    rafId = requestAnimationFrame(loop);
  }

  /* Nettoyage complet : retire le canvas, stoppe la boucle et les observateurs.
     Exposé via window.__bwEffet.destroy() — seule surface publique du module. */
  function destroy() {
    destroyed = true;
    cancelAnimationFrame(rafId);
    clearTimeout(resizeTimer);
    clearTimeout(bodyTimer);
    window.removeEventListener('resize', onWindowResize);
    if (themeObserver) { themeObserver.disconnect(); themeObserver = null; }
    if (bodyObserver) { bodyObserver.disconnect(); bodyObserver = null; }
    if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
    canvas = null;
    ctx = null;
    if (window.__bwEffet && window.__bwEffet.destroy === destroy) {
      delete window.__bwEffet;
    }
  }

  window.__bwEffet = { destroy: destroy };

  // Init sur DOMContentLoaded, ou immédiatement si le DOM est déjà prêt
  // (le script est chargé avec defer : readyState vaut au moins 'interactive').
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
