/* ============================================================================
   Bowency — Effet de fond « Projecteurs de stade » (module overlay autonome)
   ----------------------------------------------------------------------------
   Deux faisceaux volumétriques de poursuite, ancrés hors écran aux coins
   supérieurs, suivent la section en cours de lecture (ressort amorti +
   oscillation subtile). Flaque de lumière au point de convergence, poussières
   confinées aux cônes, sprite de cône précalculé par thème.

   - Aucune dépendance, aucun HTML requis : le <canvas> est injecté par JS.
   - Couleurs lues dynamiquement dans les variables CSS du thème :
       --bg, --acc (repli : --accent), --halo
   - Mode clair si <html data-theme="grandsoir"> : voile multiplié
     (mix-blend-mode:multiply posé en JS) + cônes effacés (destination-out).
   - MutationObserver sur data-theme : re-génère le sprite aux nouvelles
     couleurs sans rechargement.
   - DPR plafonné à 2, resize propre, prefers-reduced-motion respecté
     (faisceaux statiques au centre, rendu unique).

   Seule trace globale éventuelle : window.__bwEffet (API {refresh, destroy}).
   ============================================================================ */
(function () {
  'use strict';

  /* Garde anti double-init (script inclus deux fois par erreur) */
  if (window.__bwEffet) { return; }

  /* ==========================================================================
     1. OUTILS COULEUR — lecture des variables CSS + parsing tolérant
     ========================================================================== */

  /** Lit une variable CSS sur :root, avec chaîne de repli. */
  function cssVar(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name);
    v = (v || '').trim();
    return v || fallback || '';
  }

  /** Parse '#rgb', '#rrggbb' ou 'rgb(a)(r,g,b[,a])' → [r,g,b]. null si échec. */
  function parseColor(str) {
    if (!str) { return null; }
    str = str.trim();
    if (str.charAt(0) === '#') {
      if (str.length === 4) {                       // #rgb → #rrggbb
        return [
          parseInt(str.charAt(1) + str.charAt(1), 16),
          parseInt(str.charAt(2) + str.charAt(2), 16),
          parseInt(str.charAt(3) + str.charAt(3), 16)
        ];
      }
      if (str.length >= 7) {
        return [
          parseInt(str.slice(1, 3), 16),
          parseInt(str.slice(3, 5), 16),
          parseInt(str.slice(5, 7), 16)
        ];
      }
      return null;
    }
    var m = str.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (m) { return [+m[1], +m[2], +m[3]]; }
    return null;
  }

  /** Chaîne rgba() à partir d'un triplet [r,g,b] et d'une opacité. */
  function rgba(rgb, a) {
    return 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + a + ')';
  }

  /* ==========================================================================
     2. ÉTAT DU MODULE
     ========================================================================== */
  var canvas, ctx;
  var W = 0, H = 0, DPR = 1;                 // dimensions CSS + pixel ratio (≤ 2)
  var rafId = 0;                             // handle rAF (pour destroy)
  var observer = null;                       // MutationObserver sur data-theme

  /* Couleurs courantes (mises à jour à chaque changement de thème) */
  var light = false;                         // vrai si data-theme === 'grandsoir'
  var bgRgb     = [6, 11, 20];               // --bg   (repli : nocturne)
  var accentRgb = [61, 107, 255];            // --acc  (repli : nocturne)
  var haloRgb   = [143, 233, 255];           // --halo (repli : nocturne)

  var mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var reduced  = mqReduce.matches;
  var dirty    = true;                       // force un rendu (mode « reduced »)

  /* Cible des faisceaux : point visé + ressort amorti (jamais de saut sec) */
  var target = { x: 0, y: 0, vx: 0, vy: 0 }; // position interpolée
  var goal   = { x: 0, y: 0 };               // position idéale (section visible)

  /* ==========================================================================
     3. SECTIONS CIBLÉES — <main> > section, repli : sections directes du body
     ========================================================================== */
  var sections = [];

  function cacheSections() {
    sections = [];
    var nodes = document.querySelectorAll('main section');
    if (!nodes.length) { nodes = document.querySelectorAll('body > section'); }
    var sy = window.scrollY || window.pageYOffset;
    for (var i = 0; i < nodes.length; i++) {
      var r = nodes[i].getBoundingClientRect();
      sections.push({ top: r.top + sy, bottom: r.bottom + sy, index: i });
    }
  }

  /* ==========================================================================
     4. SPRITE DE CÔNE — construit UNE FOIS par thème.
        Cône vertical (source en haut, s'évasant vers le bas) peint bande par
        bande : dégradé longitudinal (intensité décroissante) x profil
        transversal en cos² (cœur brillant, bords fondus). Zéro bord dur,
        et un simple drawImage transformé par frame → coût minimal.
     ========================================================================== */
  var SPR_W = 512, SPR_H = 1024, SPR_H0 = 14, SPR_H1 = 244; // demi-largeurs haut/bas
  var sprite = document.createElement('canvas');
  sprite.width = SPR_W; sprite.height = SPR_H;

  function buildSprite(rgb) {
    var sc = sprite.getContext('2d');
    sc.clearRect(0, 0, SPR_W, SPR_H);
    var cx = SPR_W / 2, step = 4;
    for (var y = 0; y < SPR_H; y += step) {
      var t    = y / SPR_H;                          // 0 = source, 1 = extrémité
      var half = SPR_H0 + (SPR_H1 - SPR_H0) * t;     // demi-largeur du cône ici
      var amp  = Math.pow(1 - t, 1.25);              // atténuation longitudinale
      var g = sc.createLinearGradient(cx - half, 0, cx + half, 0);
      for (var k = 0; k <= 10; k++) {                // profil transversal en cos²
        var x = k / 10;
        var lat = Math.pow(Math.sin(Math.PI * x), 2);
        g.addColorStop(x, rgba(rgb, (amp * lat).toFixed(4)));
      }
      sc.fillStyle = g;
      sc.fillRect(cx - half, y, half * 2, step + 1); // +1 : recouvrement anti-bande
    }
  }

  /* ==========================================================================
     5. THÈME — lecture des variables CSS + reconstruction du sprite
     ========================================================================== */
  function applyTheme() {
    light = document.documentElement.getAttribute('data-theme') === 'grandsoir';

    bgRgb     = parseColor(cssVar('--bg'))                    || bgRgb;
    accentRgb = parseColor(cssVar('--acc', cssVar('--accent'))) || accentRgb;
    haloRgb   = parseColor(cssVar('--halo'))                  || accentRgb;

    /* En thème clair, le canvas assombrit le papier par multiplication :
       le voile dessiné se « multiplie » avec le fond, les cônes (effacés)
       laissent le papier intact → ombres inversées. Posé via style JS. */
    canvas.style.mixBlendMode = light ? 'multiply' : '';

    /* Sprite : couleur halo en sombre ; blanc (pur canal alpha) en clair,
       car il ne sert alors que de gomme (destination-out). */
    buildSprite(light ? [255, 255, 255] : haloRgb);
    dirty = true;
  }

  /* ==========================================================================
     6. FAISCEAUX — deux poursuites ancrées HORS écran (toiture du stade)
     ========================================================================== */
  function makeBeam(side, phase) {
    return {
      side: side,            // -1 = haut-gauche, +1 = haut-droite
      phase: phase,          // déphasage de l'oscillation
      src: { x: 0, y: 0 }
    };
  }
  var beams = [makeBeam(-1, 0), makeBeam(1, 2.4)];

  function placeSources() {
    for (var i = 0; i < beams.length; i++) {
      var b = beams[i];
      b.src.x = b.side < 0 ? -W * 0.10 : W * 1.10;   // bien au-delà des bords
      b.src.y = -H * 0.14;                           // au-dessus du viewport
    }
  }

  /* Géométrie d'un faisceau vers le point visé (avec oscillation subtile) */
  function beamGeometry(b, now) {
    var osc = 0;
    if (!reduced) {
      // ±0.8° à ~0.1 Hz, déphasé entre les deux poursuites → rendu vivant
      osc = Math.sin(now * 0.000628 + b.phase) * (0.8 * Math.PI / 180);
    }
    var dx = target.x - b.src.x, dy = target.y - b.src.y;
    var ang = Math.atan2(dy, dx) + osc;
    var dist = Math.sqrt(dx * dx + dy * dy);
    var len  = dist * 1.45;                          // le cône dépasse la cible
    var endHalf = len * 0.115 + 26;                  // ouverture ~6.5°
    return {
      ang: ang, len: len,
      ux: Math.cos(ang), uy: Math.sin(ang),          // axe du cône
      px: -Math.sin(ang), py: Math.cos(ang),         // perpendiculaire
      srcHalf: endHalf * (SPR_H0 / SPR_H1),
      endHalf: endHalf,
      sx: endHalf / SPR_H1, sy: len / SPR_H
    };
  }

  /* Dessine le sprite de cône transformé (translation + rotation + échelle) */
  function drawCone(b, g, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(b.src.x, b.src.y);
    ctx.rotate(g.ang - Math.PI / 2);                 // le sprite pointe vers le bas
    ctx.scale(g.sx, g.sy);
    ctx.drawImage(sprite, -SPR_W / 2, 0);
    ctx.restore();
  }

  /* Liserés accent sur les bords des cônes (thème clair uniquement) */
  function drawEdges(b, g) {
    var ex = b.src.x + g.ux * g.len, ey = b.src.y + g.uy * g.len;
    var grad = ctx.createLinearGradient(b.src.x, b.src.y, ex, ey);
    grad.addColorStop(0,    rgba(accentRgb, 0.34));
    grad.addColorStop(0.72, rgba(accentRgb, 0.12));
    grad.addColorStop(1,    rgba(accentRgb, 0));
    ctx.strokeStyle = grad;
    ctx.lineWidth = 1.1;
    for (var s = -1; s <= 1; s += 2) {
      ctx.beginPath();
      ctx.moveTo(b.src.x + g.px * g.srcHalf * s, b.src.y + g.py * g.srcHalf * s);
      ctx.lineTo(ex + g.px * g.endHalf * s, ey + g.py * g.endHalf * s);
      ctx.stroke();
    }
  }

  /* Flaque de lumière elliptique au point de convergence des faisceaux */
  function drawPool(dark) {
    ctx.save();
    ctx.translate(target.x, target.y);
    ctx.scale(1, 0.42);                              // ellipse écrasée (sol éclairé)
    var R = Math.min(W, H) * 0.34;
    var g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
    if (dark) {
      g.addColorStop(0,    rgba(haloRgb, 0.20));
      g.addColorStop(0.45, rgba(haloRgb, 0.09));
      g.addColorStop(1,    rgba(haloRgb, 0));
    } else {
      g.addColorStop(0,   rgba(accentRgb, 0.06));    // légère teinte accent
      g.addColorStop(0.6, rgba(accentRgb, 0.025));
      g.addColorStop(1,   rgba(accentRgb, 0));
    }
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /* ==========================================================================
     7. POUSSIÈRES — 18 particules paramétrées DANS les cônes.
        Position = source + axe·t + perpendiculaire·s·largeur(t)
        → elles ne peuvent, par construction, jamais sortir du cône.
     ========================================================================== */
  var dust = [];
  (function initDust() {
    for (var i = 0; i < 18; i++) {
      dust.push({
        beam: i % 2,
        t:    0.30 + Math.random() * 0.55,           // fraction le long de l'axe
        s:    (Math.random() * 2 - 1) * 0.8,         // fraction latérale (-1..1)
        v:    0.000012 + Math.random() * 0.000020,   // dérive lente le long du cône
        wig:  Math.random() * Math.PI * 2,           // phase de l'ondulation latérale
        size: 0.8 + Math.random() * 1.4
      });
    }
  })();

  function drawDust(geoms, now, dark) {
    for (var i = 0; i < dust.length; i++) {
      var d = dust[i], b = beams[d.beam], g = geoms[d.beam];
      d.t += d.v * 16;                               // dérive douce vers le bas du cône
      if (d.t > 0.92) { d.t = 0.28; }                // recyclage discret en haut
      var lat = d.s + Math.sin(now * 0.0004 + d.wig) * 0.10;
      var half = (g.srcHalf + (g.endHalf - g.srcHalf) * d.t) * 0.72;
      var x = b.src.x + g.ux * g.len * d.t + g.px * half * lat;
      var y = b.src.y + g.uy * g.len * d.t + g.py * half * lat;
      // fondu aux deux extrémités du trajet + opacité faible
      var a = Math.sin(Math.PI * ((d.t - 0.25) / 0.7)) * (dark ? 0.22 : 0.13);
      if (a <= 0) { continue; }
      ctx.fillStyle = rgba(dark ? haloRgb : accentRgb, a.toFixed(3));
      ctx.beginPath();
      ctx.arc(x, y, d.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /* ==========================================================================
     8. CIBLE DE LECTURE — vise le centre de la section la plus proche du
        milieu du viewport (ligne de lecture)
     ========================================================================== */
  function updateGoal() {
    var sy = window.scrollY || window.pageYOffset;
    var mid = sy + H * 0.5;
    var best = null, bestD = Infinity;
    for (var i = 0; i < sections.length; i++) {
      var c = (sections[i].top + sections[i].bottom) / 2;
      var d = Math.abs(c - mid);
      if (d < bestD) { bestD = d; best = sections[i]; }
    }
    if (!best) { goal.x = W / 2; goal.y = H / 2; return; }
    var cy = (best.top + best.bottom) / 2 - sy;      // centre en coordonnées viewport
    goal.y = Math.max(H * 0.28, Math.min(H * 0.78, cy));            // zone lisible
    goal.x = W * 0.5 + (best.index % 2 === 0 ? 1 : -1) * W * 0.045; // balancement G/D
  }

  /* Ressort amorti : les poursuites PIVOTENT en douceur, jamais de saut */
  function springStep() {
    var k = 0.016, damp = 0.86;
    target.vx = (target.vx + (goal.x - target.x) * k) * damp;
    target.vy = (target.vy + (goal.y - target.y) * k) * damp;
    target.x += target.vx;
    target.y += target.vy;
  }

  /* ==========================================================================
     9. RENDU
     ========================================================================== */
  function render(now) {
    ctx.clearRect(0, 0, W, H);
    var dark = !light;
    var geoms = [beamGeometry(beams[0], now), beamGeometry(beams[1], now)];

    if (dark) {
      /* --- Mode sombre : lumière additive (composite 'lighter') --- */
      ctx.globalCompositeOperation = 'lighter';
      drawCone(beams[0], geoms[0], 0.30);            // ~7-10 % d'opacité au cœur
      drawCone(beams[1], geoms[1], 0.30);
      drawPool(true);
      if (!reduced) { drawDust(geoms, now, true); }
      ctx.globalCompositeOperation = 'source-over';
    } else {
      /* --- Mode clair « grandsoir » : ombres portées inversées ---
         1) voile gris-bleu léger sur TOUT l'écran (canvas en
            mix-blend-mode:multiply → assombrit doucement le papier) ;
         2) cônes EFFACÉS (destination-out) avec le même sprite
            → le papier reste clair à l'intérieur, bords fondus ;
         3) liserés accent + flaque teintée + poussières.            */
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(88, 98, 134, 0.17)';     // voile gris-bleu
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'destination-out';
      drawCone(beams[0], geoms[0], 1);
      drawCone(beams[1], geoms[1], 1);
      // la flaque « perce » aussi légèrement le voile autour de la cible
      ctx.save();
      ctx.translate(target.x, target.y);
      ctx.scale(1, 0.42);
      var R = Math.min(W, H) * 0.36;
      var pg = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
      pg.addColorStop(0, 'rgba(0,0,0,0.85)');
      pg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = pg;
      ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.globalCompositeOperation = 'source-over';
      drawEdges(beams[0], geoms[0]);
      drawEdges(beams[1], geoms[1]);
      drawPool(false);
      if (!reduced) { drawDust(geoms, now, false); }
    }
  }

  /* ==========================================================================
     10. BOUCLE — rAF permanent, calculs légers (2 cônes + 18 points).
         En mode « reduced motion » : rendu uniquement quand dirty.
     ========================================================================== */
  function frame(now) {
    if (reduced) {
      if (dirty) {
        target.x = W / 2; target.y = H / 2;          // faisceaux statiques au centre
        target.vx = target.vy = 0;
        render(now);
        dirty = false;
      }
    } else {
      updateGoal();
      springStep();
      render(now);                                   // l'oscillation bouge → redraw
    }
    rafId = requestAnimationFrame(frame);
  }

  /* ==========================================================================
     11. RESIZE
     ========================================================================== */
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2); // DPR plafonné à 2
    W = window.innerWidth; H = window.innerHeight;
    canvas.width  = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    placeSources();
    cacheSections();
    if (target.x === 0 && target.y === 0) {          // premier passage : pas de vol plané
      updateGoal(); target.x = goal.x; target.y = goal.y;
    }
    dirty = true;
  }

  function onReduceChange(e) { reduced = e.matches; dirty = true; }
  function onLoad()          { cacheSections(); dirty = true; }

  /* ==========================================================================
     12. INITIALISATION / DESTRUCTION
     ========================================================================== */
  function init() {
    /* Canvas injecté en PREMIER enfant de <body> : fixe, plein écran,
       derrière le contenu, transparent aux interactions. */
    canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.position      = 'fixed';
    canvas.style.inset         = '0';
    canvas.style.width         = '100vw';
    canvas.style.height        = '100vh';
    canvas.style.zIndex        = '0';
    canvas.style.pointerEvents = 'none';
    canvas.style.display       = 'block';
    document.body.insertBefore(canvas, document.body.firstChild);
    ctx = canvas.getContext('2d');

    /* Couleurs initiales + sprite */
    applyTheme();

    /* Changement de thème sans rechargement : on observe data-theme sur <html>
       et on ré-applique couleurs / sprite / blend-mode. */
    observer = new MutationObserver(applyTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });

    /* Préférence d'animation réduite (avec repli ancien Safari) */
    if (mqReduce.addEventListener) { mqReduce.addEventListener('change', onReduceChange); }
    else if (mqReduce.addListener) { mqReduce.addListener(onReduceChange); }

    window.addEventListener('resize', resize);
    window.addEventListener('load', onLoad);         // re-mesure après images/fontes

    resize();
    rafId = requestAnimationFrame(frame);
  }

  /* Démontage complet (utile pour tests / navigation SPA) */
  function destroy() {
    cancelAnimationFrame(rafId);
    if (observer) { observer.disconnect(); observer = null; }
    if (mqReduce.removeEventListener) { mqReduce.removeEventListener('change', onReduceChange); }
    else if (mqReduce.removeListener) { mqReduce.removeListener(onReduceChange); }
    window.removeEventListener('resize', resize);
    window.removeEventListener('load', onLoad);
    if (canvas && canvas.parentNode) { canvas.parentNode.removeChild(canvas); }
    canvas = null; ctx = null;
    delete window.__bwEffet;
  }

  /* API minimale (seule trace globale autorisée) :
     - refresh() : re-mesure les sections (contenu injecté dynamiquement)
     - destroy() : retire l'effet proprement                              */
  window.__bwEffet = {
    refresh: function () { cacheSections(); dirty = true; },
    destroy: destroy
  };

  /* Init sur DOMContentLoaded, ou immédiatement si le DOM est déjà prêt
     (script chargé avec defer ou en fin de body). */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
