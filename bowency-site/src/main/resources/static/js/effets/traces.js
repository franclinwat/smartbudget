/* ==========================================================================
   BOWENCY — EFFET « TRACÉS DE JEU » (module overlay réutilisable)
   --------------------------------------------------------------------------
   À chaque section du site correspond une géométrie sportive (rond central,
   virage d'athlétisme, vélodrome, octogone, basket, podium) qui se dessine
   « à la craie lumineuse » au fil du défilement, se rétracte en remontant,
   et reste en filigrane (~12 % d'opacité) une fois la section passée.

   - Aucune dépendance, aucune variable globale (hors window.__bwEffet).
   - Couleurs lues dynamiquement sur :root : --bg / --acc / --halo.
   - Mode clair (stratégie « outremer ») si data-theme === "grandsoir".
   - S'attache aux sections réelles : main section (fallback body > section).
   - Recalcule tout quand la page s'allonge (images lazy) via ResizeObserver.
   ========================================================================== */
(() => {
'use strict';

// Garde-fou : ne jamais s'initialiser deux fois (inclusions multiples)
if (window.__bwEffet) { return; }

const TAU = Math.PI * 2;
const mouvementReduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ==========================================================================
   CANVAS — injecté en premier enfant de <body>, plein écran, derrière tout
   ========================================================================== */
let canvas = null;
let ctx = null;

function creerCanvas() {
  canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  // Fixe, plein écran, jamais interactif, sous le contenu (z-index 0)
  canvas.style.position = 'fixed';
  canvas.style.inset = '0';
  canvas.style.zIndex = '0';
  canvas.style.pointerEvents = 'none';
  document.body.insertBefore(canvas, document.body.firstChild);
  ctx = canvas.getContext('2d');
}

/* ==========================================================================
   THÈME — miroir JS des variables CSS de documentElement pour le canvas.
   Le mode clair (« grandsoir ») emploie la stratégie « outremer » :
   trait net couleur accent + ombre translucide, une seule passe.
   ========================================================================== */
const theme = { halo: '#8FE9FF', accent: '#3D6BFF', clair: false, ombre: 'rgba(61,107,255,0.28)', ombreTete: 'rgba(61,107,255,0.55)' };

/** Normalise une couleur CSS quelconque en composantes {r,g,b} via le canvas. */
function versRgb(couleur) {
  ctx.fillStyle = '#000';           // valeur de repli déterministe
  ctx.fillStyle = couleur;
  const c = ctx.fillStyle;          // le canvas normalise en #rrggbb (ou rgba)
  if (c.charAt(0) === '#') {
    return {
      r: parseInt(c.slice(1, 3), 16),
      g: parseInt(c.slice(3, 5), 16),
      b: parseInt(c.slice(5, 7), 16)
    };
  }
  const m = c.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  return m ? { r: +m[1], g: +m[2], b: +m[3] } : { r: 0, g: 0, b: 0 };
}

/** Relit --bg / --acc / --halo et le data-theme, puis met le thème à jour. */
function lireTheme() {
  const styles = getComputedStyle(document.documentElement);
  const acc  = (styles.getPropertyValue('--acc')  || '').trim() || '#3D6BFF';
  const halo = (styles.getPropertyValue('--halo') || '').trim() || acc;
  theme.accent = acc;
  theme.halo = halo;
  theme.clair = document.documentElement.dataset.theme === 'grandsoir';
  // Ombres translucides dérivées de l'accent (mode clair « outremer »)
  const { r, g, b } = versRgb(acc);
  theme.ombre     = 'rgba(' + r + ',' + g + ',' + b + ',0.28)';
  theme.ombreTete = 'rgba(' + r + ',' + g + ',' + b + ',0.55)';
}

/* ==========================================================================
   OUTILS GÉOMÉTRIQUES (identiques à la démo)
   ========================================================================== */

/** Échantillonne un arc d'ellipse en points réguliers (courbes lisses). */
function arc(cx, cy, rx, ry, a0, a1, rot) {
  rot = rot || 0;
  const pts = [];
  // Densité ~ 1 point tous les 5 px d'arc estimé, minimum 24 points
  const n = Math.max(24, Math.ceil((Math.abs(a1 - a0) * Math.max(rx, ry)) / 5));
  const cr = Math.cos(rot), sr = Math.sin(rot);
  for (let i = 0; i <= n; i++) {
    const a = a0 + (a1 - a0) * (i / n);
    const x = Math.cos(a) * rx, y = Math.sin(a) * ry;
    pts.push({ x: cx + x * cr - y * sr, y: cy + x * sr + y * cr });
  }
  return pts;
}

/** Segment droit (2 points suffisent : l'interpolation gère le partiel). */
function ligne(x0, y0, x1, y1) { return [{ x: x0, y: y0 }, { x: x1, y: y1 }]; }

/**
 * Prépare une polyligne : longueurs cumulées par point + longueur totale.
 * C'est le précalcul qui rend le tracé progressif quasi gratuit à dessiner.
 * `faible` = trait discret (diagonales d'octogone…), alpha réduit.
 */
function preparer(pts, faible) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  }
  return { pts, cum, total: cum[cum.length - 1], faible: !!faible };
}

/* ==========================================================================
   GÉOMÉTRIES DE TERRAIN — 6 compositions relatives au viewport, très
   larges et décentrées (aux 2/3, ou mordant un bord). Si le site compte
   plus de 6 sections, on boucle sur ces 6 géométries (modulo).
   ========================================================================== */
function construireGeometries(w, h) {
  const m = Math.min(w, h);
  const G = [];

  /* 1 — Rond central de football : grand cercle aux 2/3 droite, mordant
         le haut de l'écran, ligne médiane traversante, point central. */
  {
    const cx = 0.68 * w, cy = 0.40 * h, r = 0.60 * m;
    G.push([
      preparer(arc(cx, cy, r, r, -TAU / 4, -TAU / 4 + TAU)),            // rond central
      preparer(ligne(cx, -0.08 * h, cx, 1.08 * h)),                     // ligne médiane
      preparer(arc(cx, cy, 0.014 * m, 0.014 * m, 0, TAU))               // point central
    ]);
  }

  /* 2 — Virage de piste d'athlétisme : 6 arcs concentriques dont le
         centre est hors écran, en bas à gauche — la courbe mord le bord. */
  {
    const cx = 0.10 * w, cy = 1.22 * h;
    const a0 = -0.56 * Math.PI, a1 = -0.06 * Math.PI;   // balayage du virage
    const lignes = [];
    for (let i = 0; i < 6; i++) {
      const r = 0.72 * h + i * 0.062 * h;
      lignes.push(preparer(arc(cx, cy, r, r, a0, a1)));
    }
    G.push(lignes);
  }

  /* 3 — Vélodrome : deux courbes de virage relevé (arcs d'ellipse emboîtés,
         centre mordant le bord droit) + lignes de mesure radiales. */
  {
    const cx = 1.02 * w, cy = 0.55 * h;
    const rx1 = 0.58 * w, ry1 = 0.44 * h;   // courbe extérieure
    const rx2 = 0.40 * w, ry2 = 0.29 * h;   // courbe intérieure
    const a0 = 0.55 * Math.PI, a1 = 1.45 * Math.PI; // ouverture vers la gauche
    const lignes = [
      preparer(arc(cx, cy, rx1, ry1, a0, a1)),
      preparer(arc(cx, cy, rx2, ry2, a0, a1))
    ];
    // Lignes de mesure : petits segments radiaux entre les deux courbes
    for (const t of [0.62, 0.78, 0.95, 1.12, 1.28, 1.40]) {
      const a = t * Math.PI;
      lignes.push(preparer(ligne(
        cx + Math.cos(a) * rx2, cy + Math.sin(a) * ry2,
        cx + Math.cos(a) * rx1, cy + Math.sin(a) * ry1
      ), true));
    }
    G.push(lignes);
  }

  /* 4 — Octogone (MMA) : décentré au tiers gauche, légèrement pivoté,
         avec ses quatre grandes diagonales en traits discrets. */
  {
    const cx = 0.33 * w, cy = 0.54 * h, r = 0.56 * m, rot = Math.PI / 8.6;
    const sommets = [];
    for (let i = 0; i < 8; i++) {
      const a = rot + (i / 8) * TAU;
      sommets.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
    }
    const contour = sommets.concat([sommets[0]]); // fermeture du polygone
    const lignes = [preparer(contour)];
    for (let i = 0; i < 4; i++) {
      lignes.push(preparer(ligne(
        sommets[i].x, sommets[i].y, sommets[i + 4].x, sommets[i + 4].y
      ), true)); // diagonales discrètes
    }
    G.push(lignes);
  }

  /* 5 — Terrain de basket stylisé : ligne de fond mordant le bord droit,
         raquette, cercle de lancer franc, grand arc à trois points. */
  {
    const bx = 1.04 * w;                      // ligne de fond (hors écran à droite)
    const cy = 0.55 * h;                      // axe du panier
    const demiKey = 0.16 * h;                 // demi-largeur de la raquette
    const prof = 0.30 * w;                    // profondeur de la raquette
    const panierX = bx - 0.045 * w;           // position du panier sur l'axe
    G.push([
      preparer(ligne(bx, 0.06 * h, bx, 0.98 * h)),                       // ligne de fond
      preparer([                                                          // raquette (3 côtés)
        { x: bx, y: cy - demiKey },
        { x: bx - prof, y: cy - demiKey },
        { x: bx - prof, y: cy + demiKey },
        { x: bx, y: cy + demiKey }
      ]),
      preparer(arc(bx - prof, cy, demiKey * 0.82, demiKey * 0.82,        // cercle lancer franc
        TAU / 4, TAU / 4 + TAU)),
      preparer(arc(panierX, cy, 0.46 * m, 0.46 * m,                      // arc à 3 points
        0.56 * Math.PI, 1.44 * Math.PI))
    ]);
  }

  /* 6 — Podium stylisé : trois marches en perspective simple (face +
         dessus en parallélogramme), composition décalée aux 2/3 droite. */
  {
    const solY = 0.76 * h;                    // ligne de sol du podium
    const lw = 0.17 * w;                      // largeur d'une marche
    const x0 = 0.46 * w;                      // départ (décentré à droite)
    const px = -0.045 * w, py = -0.045 * h;   // fuite de perspective (haut-gauche)
    const marches = [
      { x: x0,          hM: 0.26 * h },       // 2e place
      { x: x0 + lw,     hM: 0.38 * h },       // 1re place
      { x: x0 + 2 * lw, hM: 0.18 * h }        // 3e place
    ];
    const lignes = [];
    for (const { x, hM } of marches) {
      const yH = solY - hM;
      // Face avant (rectangle fermé)
      lignes.push(preparer([
        { x, y: solY }, { x, y: yH }, { x: x + lw, y: yH },
        { x: x + lw, y: solY }, { x, y: solY }
      ]));
      // Dessus (parallélogramme fermé, perspective simple)
      lignes.push(preparer([
        { x, y: yH }, { x: x + px, y: yH + py },
        { x: x + lw + px, y: yH + py }, { x: x + lw, y: yH }, { x, y: yH }
      ], true));
    }
    G.push(lignes);
  }

  return G;
}

/* ==========================================================================
   ÉTAT & DIMENSIONNEMENT
   ========================================================================== */
let geometries = [];            // les 6 compositions, au format viewport courant
let sections = [];              // sections réelles du site (dans l'ordre du DOM)
let W = 0, H = 0, dpr = 1;
let doitRedessiner = true;      // redraw seulement quand nécessaire
let tetesActives = false;       // têtes lumineuses en cours → animation continue

/** Relit les sections réelles : main section, sinon body > section. */
function lireSections() {
  let liste = document.querySelectorAll('main section');
  if (!liste.length) { liste = document.querySelectorAll('body > section'); }
  sections = Array.from(liste);
}

function redimensionner() {
  W = window.innerWidth;
  H = window.innerHeight;
  dpr = Math.min(window.devicePixelRatio || 1, 2);   // DPR plafonné à 2
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  geometries = construireGeometries(W, H);           // recalcul propre
  doitRedessiner = true;
}

/* ---------- Bruit déterministe « craie » (léger, 2-3 % d'opacité) --------- */
function bruit(graine, t) {
  const s = Math.sin(graine * 127.13 + t * 2.1) * 43758.5453;
  return s - Math.floor(s);
}

/* ==========================================================================
   PROGRESSION AU SCROLL
   --------------------------------------------------------------------------
   p  : fraction dessinée de la géométrie — fonction PURE de la position de
        la section dans le viewport (getBoundingClientRect à chaque rendu),
        donc insensible aux changements de hauteur de page (images lazy) et
        parfaitement réversible quand on remonte.
   op : opacité de la géométrie — pleine tant que la section est lisible,
        estompée à ~12 % (résiduelle) quand la section est passée.
   ========================================================================== */
function etatSection(el) {
  const r = el.getBoundingClientRect();
  const p  = Math.min(1, Math.max(0, (H * 0.88 - r.top) / (H * 0.66)));
  const f  = Math.min(1, Math.max(0, (r.bottom - H * 0.12) / (H * 0.45)));
  const fl = f * f * (3 - 2 * f);                    // lissage (smoothstep)
  return { p, op: 0.12 + 0.88 * fl };
}

/** Décalage doux entre les lignes d'une même géométrie (tracé séquencé). */
function progressionLigne(p, i, n) {
  const fenetre = 0.72;                              // durée locale d'une ligne
  const depart = n > 1 ? (i / (n - 1)) * (1 - fenetre) : 0;
  return Math.min(1, Math.max(0, (p - depart) / fenetre));
}

/* ==========================================================================
   TRACÉ PARTIEL — reproduit un stroke-dashoffset sur canvas.
   Renvoie la position de l'extrémité courante (pour la tête lumineuse).
   ========================================================================== */
function tracerPartiel(l, L) {
  const { pts, cum } = l;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    if (cum[i] <= L) {
      ctx.lineTo(pts[i].x, pts[i].y);
    } else {
      const t = (L - cum[i - 1]) / (cum[i] - cum[i - 1]);
      const x = pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t;
      const y = pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t;
      ctx.lineTo(x, y);
      ctx.stroke();
      return { x, y };
    }
  }
  ctx.stroke();
  const fin = pts[pts.length - 1];
  return { x: fin.x, y: fin.y };
}

/* ==========================================================================
   RENDU — une géométrie par section réelle. Plus de sections que de
   géométries : on boucle (modulo 6) ; moins : seules les premières servent.
   ========================================================================== */
function dessiner(temps) {
  ctx.clearRect(0, 0, W, H);
  tetesActives = false;
  const clair = theme.clair;
  if (!geometries.length) { return; }

  for (let s = 0; s < sections.length; s++) {
    const lignes = geometries[s % geometries.length]; // boucle sur les 6 géométries
    let p, op;

    if (mouvementReduit) {
      // Accessibilité : tout est statique, discret, sans animation
      p = 1; op = 0.16;
    } else {
      ({ p, op } = etatSection(sections[s]));
    }
    if (p <= 0 || op <= 0.01) continue;

    const tetes = [];   // extrémités en cours de tracé (têtes lumineuses)

    /* --- Deux passes : halo doux dessous, trait net dessus ---------------- */
    for (let passe = 0; passe < 2; passe++) {
      if (clair && passe === 0) continue;   // mode clair : une seule passe (ombre intégrée)

      if (clair) {
        // Papier clair (« grandsoir ») : trait outremer net + ombre translucide
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = theme.accent;
        ctx.lineWidth = 1.6;
        ctx.shadowColor = theme.ombre;
        ctx.shadowBlur = 7;
      } else if (passe === 0) {
        // Passe floue : halo lumineux additif sous le trait
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = theme.halo;
        ctx.lineWidth = 3.6;
        ctx.shadowColor = theme.halo;
        ctx.shadowBlur = 14;
      } else {
        // Passe nette : le marquage « à la craie lumineuse »
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = theme.halo;
        ctx.lineWidth = 1.7;
        ctx.shadowBlur = 0;
      }
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (let i = 0; i < lignes.length; i++) {
        const l = lignes[i];
        const q = mouvementReduit ? 1 : progressionLigne(p, i, lignes.length);
        if (q <= 0) continue;

        // Micro-vibration « craie » : 2-3 % de bruit d'opacité, organique
        const vib = mouvementReduit ? 1 : 0.97 + 0.03 * bruit(s * 31 + i * 7, temps * 0.001);
        let a = op * vib * (l.faible ? 0.38 : 1);
        a *= clair ? 0.9 : (passe === 0 ? 0.20 : 0.85);
        ctx.globalAlpha = a;

        const bout = tracerPartiel(l, l.total * q);
        // Tête à collecter une seule fois (dernière passe), si ligne en cours
        if (passe === 1 && q > 0 && q < 1 && op > 0.5) tetes.push(bout);
      }
    }

    /* --- Têtes de traçage lumineuses (pistolet de marquage) --------------- */
    if (!mouvementReduit && tetes.length) {
      tetesActives = true;
      const pulsation = 1 + 0.25 * Math.sin(temps * 0.006);
      for (const t of tetes) {
        if (clair) {
          ctx.globalCompositeOperation = 'source-over';
          ctx.shadowColor = theme.ombreTete;
          ctx.shadowBlur = 12 * pulsation;
          ctx.fillStyle = theme.accent;
          ctx.globalAlpha = 0.95;
          ctx.beginPath();
          ctx.arc(t.x, t.y, 2.4, 0, TAU);
          ctx.fill();
        } else {
          ctx.globalCompositeOperation = 'lighter';
          // Halo externe
          ctx.shadowColor = theme.halo;
          ctx.shadowBlur = 18 * pulsation;
          ctx.fillStyle = theme.halo;
          ctx.globalAlpha = 0.55;
          ctx.beginPath();
          ctx.arc(t.x, t.y, 3.4 * pulsation, 0, TAU);
          ctx.fill();
          // Cœur brillant
          ctx.shadowBlur = 6;
          ctx.fillStyle = '#FFFFFF';
          ctx.globalAlpha = 0.95;
          ctx.beginPath();
          ctx.arc(t.x, t.y, 1.5, 0, TAU);
          ctx.fill();
        }
      }
    }
  }

  // Restaure un état neutre
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  ctx.globalCompositeOperation = 'source-over';
}

/* ==========================================================================
   BOUCLE rAF — ne redessine que si le scroll a bougé, si le thème ou la
   mise en page ont changé, ou si des têtes lumineuses sont animées.
   ========================================================================== */
function boucle(temps) {
  if (doitRedessiner || tetesActives) {
    doitRedessiner = false;
    dessiner(temps);
  }
  requestAnimationFrame(boucle);
}

/* ==========================================================================
   ÉVÉNEMENTS & OBSERVATEURS
   ========================================================================== */
function installerEvenements() {
  // Scroll : simple invalidation (les positions sont relues au rendu)
  window.addEventListener('scroll', () => { doitRedessiner = true; }, { passive: true });

  // Redimensionnement de la fenêtre : reconstruction des géométries
  window.addEventListener('resize', redimensionner);

  // Hauteur de page dynamique (images lazy, contenus injectés) :
  // ResizeObserver sur <body>, débouncé ~150 ms, pour relire sections
  // et invalider le rendu quand la page s'allonge ou se contracte.
  if ('ResizeObserver' in window) {
    let minuterie = 0;
    const observateurTaille = new ResizeObserver(() => {
      clearTimeout(minuterie);
      minuterie = setTimeout(() => {
        lireSections();          // de nouvelles sections ont pu apparaître
        doitRedessiner = true;   // les rects seront relus au prochain rendu
      }, 150);
    });
    observateurTaille.observe(document.body);
  }

  // Changement de thème : MutationObserver sur data-theme de <html>,
  // relecture des variables CSS puis redessin aux nouvelles couleurs.
  const observateurTheme = new MutationObserver(() => {
    lireTheme();
    doitRedessiner = true;
  });
  observateurTheme.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme']
  });
}

/* ==========================================================================
   DÉMARRAGE — sur DOMContentLoaded, ou immédiat si le DOM est déjà prêt
   (cas d'un chargement avec l'attribut defer).
   ========================================================================== */
function initialiser() {
  creerCanvas();
  lireTheme();
  lireSections();
  redimensionner();
  installerEvenements();
  requestAnimationFrame(boucle);
  // Marqueur discret : évite une double initialisation, sans rien exposer d'autre
  window.__bwEffet = { nom: 'traces' };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialiser);
} else {
  initialiser();
}

})();
