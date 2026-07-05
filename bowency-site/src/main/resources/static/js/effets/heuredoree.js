/* ============================================================================
   HEURE DORÉE — module overlay de fond pour le site Bowency
   ----------------------------------------------------------------------------
   Récit continu piloté par la progression de scroll p ∈ [0,1] :
     p 0.00 → 0.33  heure dorée  (voile chaud + disque solaire qui descend)
     p 0.33 → 0.66  crépuscule   (le voile s'éteint, le bokeh s'allume par vagues)
     p 0.66 → 1.00  pleine nuit  (bokeh dense qui respire + parallaxe lente)
   Tout est fonction continue de p : remonter la page rejoue le film à l'envers.

   Intégration : <script src="/js/effets/heuredoree.js" defer></script>
   - Injecte lui-même un <canvas> en premier enfant de <body> (fixe, z-index:0,
     pointer-events:none) : le contenu du site doit être en z-index ≥ 1.
   - Couleurs lues dynamiquement dans les variables CSS --bg / --acc / --halo
     de <html> ; mode clair si data-theme === "grandsoir".
   - Un MutationObserver suit data-theme : la palette est re-dérivée et la
     scène repeinte sans rechargement.
   - Aucune variable globale hormis window.__bwEffet (garde anti double-init).
   ========================================================================== */
(function(){
  "use strict";

  /* Garde : ne jamais initialiser deux fois (script inclus en double, etc.). */
  if (window.__bwEffet) return;
  window.__bwEffet = { nom: "heure-doree", version: 1 };

  /* ---------- Petits utilitaires couleur / maths -------------------------- */

  /* Analyse tolérante d'une couleur CSS : "#abc", "#aabbcc" ou "rgb(a,b,c)".
     Retourne [r,g,b] ou null si la valeur est illisible. */
  function lireCouleur(brut){
    if (!brut) return null;
    var s = String(brut).trim();
    if (s.charAt(0) === "#"){
      if (s.length === 4){ // forme courte #abc
        return [
          parseInt(s.charAt(1) + s.charAt(1), 16),
          parseInt(s.charAt(2) + s.charAt(2), 16),
          parseInt(s.charAt(3) + s.charAt(3), 16)
        ];
      }
      if (s.length >= 7){
        return [
          parseInt(s.slice(1,3), 16),
          parseInt(s.slice(3,5), 16),
          parseInt(s.slice(5,7), 16)
        ];
      }
      return null;
    }
    var m = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (m) return [ +m[1], +m[2], +m[3] ];
    return null;
  }
  function melange(a, b, t){ // interpolation RGB simple
    return [ a[0]+(b[0]-a[0])*t | 0, a[1]+(b[1]-a[1])*t | 0, a[2]+(b[2]-a[2])*t | 0 ];
  }
  function rgba(c, a){ return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")"; }
  function clamp01(x){ return x < 0 ? 0 : x > 1 ? 1 : x; }
  function lisse(a, b, x){ // smoothstep : transitions sans cassure
    x = clamp01((x - a) / (b - a));
    return x * x * (3 - 2 * x);
  }

  /* ---------- Générateur pseudo-aléatoire à graine fixe (mulberry32) ------ */
  /* Le bokeh est identique à chaque chargement : positions précalculées.    */
  function mulberry32(graine){
    return function(){
      graine |= 0; graine = (graine + 0x6D2B79F5) | 0;
      var t = Math.imul(graine ^ (graine >>> 15), 1 | graine);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- Précalcul du bokeh (aucune allocation ensuite) -------------- */
  var LUMIERES = (function(){
    var alea = mulberry32(20260705);
    var liste = [];
    var N = 32; // 25-35 disques : lumières de stade
    for (var i = 0; i < N; i++){
      var prof = alea();                              // 0 = lointain, 1 = proche
      var r = 0.010 + Math.pow(prof, 1.8) * 0.075;    // rayon en fraction de la hauteur
      var x = alea();
      if (prof > 0.62){                               // les gros disques vers les bords
        x = (x < 0.5) ? x * 0.36 : 1 - (1 - x) * 0.36;
      }
      var y = 0.06 + alea() * 0.86;
      var vague = i % 4;                              // 4 vagues d'allumage
      liste.push({
        x: x, y: y, r: r, prof: prof,
        t0: 0.315 + vague * 0.065 + alea() * 0.05,    // seuil d'allumage ∈ [0.315, 0.56]
        phase: alea() * Math.PI * 2,                  // déphasage de respiration
        vitScint: 7 + alea() * 8,                     // vitesse du scintillement d'allumage
        deriveX: (alea() - 0.5) * 2                   // sens de la dérive lente
      });
    }
    return liste;
  })();

  /* ---------- État du module (rempli dans init) ---------------------------- */
  var canvas = null, ctx = null;
  var largeur = 0, hauteur = 0, dpr = 1;
  var mouvementReduit = false;
  var pal = null;              // palette dérivée du thème courant
  var maxScroll = 1;           // dénominateur de la progression, jamais ~0
  var dernierP = -1;           // -1 force un redessin complet

  /* ---------- Palette : dérivée des variables CSS du thème courant --------- */
  /* Lue via getComputedStyle : le module ne code aucune couleur de thème en
     dur, seuls l'« or » de référence et l'« encre » profonde sont internes.  */
  function chargerPalette(){
    var racine = document.documentElement;
    var style  = getComputedStyle(racine);
    var fond   = lireCouleur(style.getPropertyValue("--bg"))   || [6, 11, 20];
    var accent = lireCouleur(style.getPropertyValue("--acc"))  || [61, 107, 255];
    var halo   = lireCouleur(style.getPropertyValue("--halo")) || accent;
    var clair  = racine.getAttribute("data-theme") === "grandsoir";
    var orDoux = [255, 178, 96]; // or de référence, toujours mélangé à l'accent
    pal = {
      clair: clair,
      fondStr: rgba(fond, 1),
      halo: halo,
      // couleur du couchant : accent teinté d'or (mode sombre)
      couchant: melange(accent, orDoux, 0.58),
      soleil:   melange(accent, orDoux, 0.72),
      // silhouette du stade en bas d'écran
      silhouette: clair ? melange(fond, [21,22,31], 0.22) : melange(fond, [0,0,0], 0.55),
      // mode clair : encre outremer pour voile / disques (multiply, jamais de blanc)
      encre: melange(accent, [16, 18, 44], 0.30)
    };
  }

  /* ---------- Grain photographique (tuile offscreen, régénérée ~8 fps) ----- */
  /* Sert aussi de dithering naturel contre les bandes dans les dégradés.     */
  var TUILE = 144;
  var canevasGrain = document.createElement("canvas");
  canevasGrain.width = TUILE; canevasGrain.height = TUILE;
  var ctxGrain = canevasGrain.getContext("2d");
  var pixelsGrain = ctxGrain.createImageData(TUILE, TUILE); // buffer réutilisé
  var motifGrain = null;
  function regenererGrain(){
    var d = pixelsGrain.data;
    for (var i = 0; i < d.length; i += 4){
      var v = (Math.random() * 255) | 0;      // bruit statique neutre
      d[i] = v; d[i+1] = v; d[i+2] = v; d[i+3] = 255;
    }
    ctxGrain.putImageData(pixelsGrain, 0, 0);
    motifGrain = ctx.createPattern(canevasGrain, "repeat");
  }

  /* ---------- Mesure de la page : hauteur défilable ------------------------ */
  /* Les images lazy allongent scrollHeight après coup : on recalcule via un
     ResizeObserver débouncé sur <body>. Si la page fait moins de ~2 écrans,
     on adoucit avec un plancher d'un écran : p reste fonctionnel (il n'atteint
     simplement pas 1) et on ne divise jamais par ~0.                          */
  function mesurerPage(){
    var reel = document.documentElement.scrollHeight - window.innerHeight;
    maxScroll = Math.max(reel, window.innerHeight);
    dernierP = -1; // la géométrie a changé : forcer un redessin
  }
  function progression(){
    return clamp01(window.scrollY / maxScroll);
  }

  /* ---------- Redimensionnement du canvas ---------------------------------- */
  function redimensionner(){
    dpr = Math.min(window.devicePixelRatio || 1, 2); // DPR plafonné à 2
    largeur = window.innerWidth;
    hauteur = window.innerHeight;
    canvas.width  = Math.round(largeur * dpr);
    canvas.height = Math.round(hauteur * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    mesurerPage();
  }

  /* ==========================================================================
     DESSIN — une passe complète, entièrement fonction de (p, temps)
     ======================================================================== */
  function dessiner(p, ts){
    var w = largeur, h = hauteur;
    var clair = pal.clair;

    /* --- 0. Fond uni du thème --------------------------------------------- */
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.fillStyle = pal.fondStr;
    ctx.fillRect(0, 0, w, h);

    /* --- 1. Voile « heure dorée » montant du bas --------------------------- */
    /* Intensité pleine en haut de page, extinction continue au crépuscule.   */
    var or_ = 1 - lisse(0.18, 0.52, p);
    if (or_ > 0.003){
      // Le voile monte depuis le bas ; sa portée se rétracte en s'éteignant.
      var portee = h * (0.34 + 0.30 * or_); // hauteur atteinte par la lueur
      var g = ctx.createLinearGradient(0, h, 0, h - portee * 1.9);
      if (clair){
        // Mode clair : voile outremer très pâle, en multiply sur le papier.
        ctx.globalCompositeOperation = "multiply";
        g.addColorStop(0,    rgba(pal.encre, 0.16 * or_));
        g.addColorStop(0.35, rgba(pal.encre, 0.10 * or_));
        g.addColorStop(0.7,  rgba(pal.encre, 0.035 * or_));
        g.addColorStop(1,    rgba(pal.encre, 0));
      } else {
        // Mode sombre : couchant additif accent + or.
        ctx.globalCompositeOperation = "lighter";
        g.addColorStop(0,    rgba(pal.couchant, 0.38 * or_));
        g.addColorStop(0.3,  rgba(pal.couchant, 0.22 * or_));
        g.addColorStop(0.62, rgba(pal.couchant, 0.075 * or_));
        g.addColorStop(0.85, rgba(pal.couchant, 0.02 * or_));
        g.addColorStop(1,    rgba(pal.couchant, 0));
      }
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }

    /* --- 2. Disque solaire flou, qui descend vers l'horizon ---------------- */
    /* Position continue : de 48 % de la hauteur vers 96 % (sous l'horizon).  */
    var descente = lisse(0.0, 0.5, p);
    var soleilA = (1 - lisse(0.30, 0.50, p)); // fondu à l'approche de l'horizon
    if (soleilA > 0.004){
      var sx = w * 0.68;
      var sy = h * (0.48 + 0.48 * descente);
      var sr = h * 0.17;
      var gs = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
      if (clair){
        ctx.globalCompositeOperation = "multiply";
        gs.addColorStop(0,    rgba(pal.encre, 0.20 * soleilA));
        gs.addColorStop(0.45, rgba(pal.encre, 0.11 * soleilA));
        gs.addColorStop(1,    rgba(pal.encre, 0));
      } else {
        ctx.globalCompositeOperation = "lighter";
        gs.addColorStop(0,    rgba(pal.soleil, 0.85 * soleilA));
        gs.addColorStop(0.28, rgba(pal.soleil, 0.45 * soleilA));
        gs.addColorStop(0.6,  rgba(pal.soleil, 0.12 * soleilA));
        gs.addColorStop(1,    rgba(pal.soleil, 0));
      }
      ctx.fillStyle = gs;
      ctx.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
    }

    /* --- 3. Silhouette d'horizon (tribunes) : le soleil se couche derrière  */
    ctx.globalCompositeOperation = "source-over";
    var gh = ctx.createLinearGradient(0, h * 0.80, 0, h);
    var aSil = clair ? 0.10 : 0.75;
    gh.addColorStop(0,    rgba(pal.silhouette, 0));
    gh.addColorStop(0.35, rgba(pal.silhouette, aSil * 0.55));
    gh.addColorStop(1,    rgba(pal.silhouette, aSil));
    ctx.fillStyle = gh;
    ctx.fillRect(0, h * 0.80, w, h * 0.20);

    /* --- 4. Bokeh : les lumières de stade ---------------------------------- */
    /* Chaque lumière a son seuil t0 : allumage par vagues, continu en p.     */
    var souffle = lisse(0.55, 0.80, p);        // la respiration ne vit qu'en pleine nuit
    var densite = lisse(0.30, 0.42, p);        // porte globale d'entrée du bokeh
    if (densite > 0.001){
      ctx.globalCompositeOperation = clair ? "multiply" : "lighter";
      for (var i = 0; i < LUMIERES.length; i++){
        var l = LUMIERES[i];
        var base = lisse(l.t0, l.t0 + 0.055, p);
        if (base <= 0.002) continue;

        // Scintillement d'allumage : uniquement dans la fenêtre juste après t0.
        var scint = 1;
        if (!mouvementReduit){
          var fen = (p - l.t0) / 0.10;
          if (fen > 0 && fen < 1){
            scint = 1 - (1 - fen) * 0.45 * (0.5 + 0.5 * Math.sin(ts * l.vitScint + l.phase));
          }
        }

        // Respiration nocturne : sinus déphasé par lumière, très lent.
        var resp = mouvementReduit ? 1 : 1 + souffle * 0.16 * Math.sin(ts * 0.45 + l.phase);

        // Parallaxe au scroll : les proches (gros) bougent plus que les loins.
        var py = l.y * h + (0.5 - p) * (14 + l.prof * 72);
        // Dérive spatiale très lente (figée si mouvement réduit).
        var px = l.x * w + (mouvementReduit ? 0 : Math.sin(ts * 0.06 + l.phase) * l.deriveX * (4 + l.prof * 14));

        var rayon = l.r * h * (0.9 + 0.2 * resp);
        var alpha;
        var gl = ctx.createRadialGradient(px, py, 0, px, py, rayon);
        if (clair){
          // Ombres de confettis en contre-jour : outremer/encre translucide.
          alpha = base * scint * (0.04 + l.prof * 0.045) * resp;
          gl.addColorStop(0,    rgba(pal.encre, alpha));
          gl.addColorStop(0.62, rgba(pal.encre, alpha * 0.82));
          gl.addColorStop(1,    rgba(pal.encre, 0));
        } else {
          // Bokeh lumineux additif dans la couleur halo du thème.
          alpha = base * scint * (0.10 + l.prof * 0.34) * resp;
          gl.addColorStop(0,    rgba(pal.halo, alpha));
          gl.addColorStop(0.55, rgba(pal.halo, alpha * 0.75));
          gl.addColorStop(1,    rgba(pal.halo, 0));
        }
        ctx.fillStyle = gl;
        ctx.fillRect(px - rayon, py - rayon, rayon * 2, rayon * 2);
      }
    }

    /* --- 5. Grain photographique (dither naturel contre les bandes) -------- */
    if (motifGrain){
      ctx.globalCompositeOperation = "overlay";
      ctx.globalAlpha = clair ? 0.05 : 0.028;
      ctx.fillStyle = motifGrain;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }
  }

  /* ==========================================================================
     BOUCLE — redessine seulement si le scroll a bougé de > 0.001,
     ou au tick d'animation (~30 fps max) quand des éléments vivent.
     En mouvement réduit : uniquement au scroll (état figé, sans scintillement).
     ======================================================================== */
  var dernierDessin = 0, dernierGrain = -1e9;
  function boucle(t){
    requestAnimationFrame(boucle);
    var p = progression();
    var scrollBouge = Math.abs(p - dernierP) > 0.001 || dernierP < 0;
    var tickAnim = !mouvementReduit && (t - dernierDessin >= 33); // ~30 fps suffit
    if (!scrollBouge && !tickAnim) return;

    // Grain régénéré à basse fréquence (~8 fps), figé en mouvement réduit.
    if (!mouvementReduit && t - dernierGrain >= 125){
      regenererGrain();
      dernierGrain = t;
    }
    dernierP = p;
    dernierDessin = t;
    dessiner(p, t / 1000);
  }

  /* ==========================================================================
     INITIALISATION
     ======================================================================== */
  function init(){
    /* --- Canvas injecté en premier enfant de <body> ------------------------ */
    canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.position = "fixed";
    canvas.style.inset = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.zIndex = "0";
    canvas.style.pointerEvents = "none";
    document.body.insertBefore(canvas, document.body.firstChild);
    ctx = canvas.getContext("2d", { alpha: false });

    /* --- Préférence d'animation réduite ------------------------------------ */
    var mediaMouvement = window.matchMedia("(prefers-reduced-motion: reduce)");
    mouvementReduit = mediaMouvement.matches;
    // addEventListener sur MediaQueryList : supporté partout où canvas 2d l'est,
    // avec repli sur addListener pour les navigateurs plus anciens.
    var surChangementMouvement = function(e){
      mouvementReduit = e.matches;
      dernierP = -1;
    };
    if (typeof mediaMouvement.addEventListener === "function"){
      mediaMouvement.addEventListener("change", surChangementMouvement);
    } else if (typeof mediaMouvement.addListener === "function"){
      mediaMouvement.addListener(surChangementMouvement);
    }

    /* --- Thème : palette initiale + suivi de data-theme -------------------- */
    chargerPalette();
    // Re-dérive la palette dès que data-theme change sur <html> : les
    // variables CSS --bg / --acc / --halo sont relues, la scène est repeinte.
    var observateurTheme = new MutationObserver(function(){
      chargerPalette();
      dernierP = -1; // repeint immédiatement dans la nouvelle palette
    });
    observateurTheme.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"]
    });

    /* --- Géométrie : resize fenêtre + hauteur de page (images lazy) -------- */
    window.addEventListener("resize", redimensionner);
    // ResizeObserver débouncé sur <body> : les images lazy et contenus
    // asynchrones allongent scrollHeight bien après le chargement.
    var minuterieMesure = 0;
    if (typeof ResizeObserver === "function"){
      var observateurTaille = new ResizeObserver(function(){
        clearTimeout(minuterieMesure);
        minuterieMesure = setTimeout(mesurerPage, 150);
      });
      observateurTaille.observe(document.body);
    } else {
      // Repli sans ResizeObserver : re-mesure ponctuelle après chargement complet.
      window.addEventListener("load", mesurerPage);
    }

    /* --- Démarrage ---------------------------------------------------------- */
    redimensionner();     // dimensionne le canvas et mesure la page
    regenererGrain();     // au moins une génération, même en mouvement réduit
    requestAnimationFrame(boucle);
  }

  /* Init sur DOMContentLoaded, ou immédiatement si le DOM est déjà prêt
     (cas d'un <script defer> : readyState vaut "interactive" ou "complete"). */
  if (document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
