# CLAUDE.md — Site officiel BOWENCY (passation de session)

## Contexte

Site officiel de **Bowency** (ex Vivendi Sports) — agence de sport, événementiel
& entertainment basée à Paris (34 av. des Champs-Élysées), dirigée par Robins
Tchale-Watchou. Slogan : « Make it real. »

Ce module `bowency-site/` est un projet **Spring Boot 3.5 autonome** (Java 17,
Maven, aucun lien avec l'application smartbudget à la racine du repo — ne pas
mélanger les deux).

## État du projet (fait et validé par le client)

- One-page **bilingue FR/EN** (français par défaut, `?lang=en` pour l'anglais,
  cookie `BOWENCY_LANG`).
- **2 thèmes commutables par les administrateurs** :
  - `nocturne` — « Nocturne Électrique » : nuit de stade, bleu volt, italiques 900
  - `grandsoir` — « Générique du Grand Soir » : papier perle, outremer, capitales monumentales
  Le thème actif est choisi sur `/admin` (mot de passe : property
  `bowency.admin.password`, défaut `bowency2026` — À CHANGER en prod via
  `BOWENCY_ADMIN_PASSWORD`), persisté dans `data/active-theme`.
- **Design v3 immersif** validé : scènes plein écran avec image de fond et texte
  superposé ; réalisations en « scrollytelling » (l'image occupe l'écran, puis
  glisse/s'estompe au défilement pendant que le panneau d'infos prend le dessus —
  variable CSS `--p` pilotée par `static/js/site.js`).
- Sections : hero, marquee villes, vision (Make it real sur foule), savoir-faire,
  4 réalisations (Tour de l'Espoir 2018, ARES FC 2019, CAN 2023, Jeux Africains
  Accra 2024), partenaires (COCAN, Canal+, ABEO, UCI U23, Fécacyclisme,
  MMA Factory, ARES FC, IBO, Francophonie Kinshasa), stats, leadership, contact.
- Contenus factuels sourcés (presse, communiqués, registres) — voir historique git.

## Lancer le site

```bash
./mvnw spring-boot:run        # Windows : mvnw.cmd spring-boot:run
# Site  : http://localhost:8080
# Admin : http://localhost:8080/admin  (bowency2026)
```

## Prochaines étapes demandées par le client

1. **Remplacer les illustrations provisoires par des images quasi réelles**
   (générées avec Gemini ou vraies photos d'événements). Les images du client
   sont dans `C:\Users\franc\Pictures\Saved Pictures`. Suivre `IMAGES.md`
   (mapping fichier→scène + prompts Gemini). Déposer dans
   `src/main/resources/static/img/` en gardant les noms (`hero-stadium`,
   `real-tour`, `real-ares`, `real-can`, `real-accra`, `band-crowd`, `leader`) ;
   si l'extension change (svg→jpg/webp), mettre à jour les `src` dans
   `templates/index.html`. Compresser (≤ ~400 Ko/image).
2. **Logo officiel** : le client doit fournir le fichier ; l'intégrer dans la nav
   à la place du wordmark texte, sans dénaturer l'original.
3. Le client précisera ses activités futures et collaborations pour enrichir les
   textes (`messages*.properties` — 3 fichiers : défaut=FR, `_fr`, `_en` ;
   `spring.messages.fallback-to-system-locale=false` est nécessaire, ne pas retirer).
4. À terme : formulaire de contact fonctionnel, hébergement public + domaine
   (préparer Dockerfile si demandé).

## Conventions & pièges connus

- Tous les textes passent par les bundles i18n — ne jamais coder en dur dans le HTML.
- Toujours modifier les 3 fichiers messages ensemble (FR défaut + _fr + _en).
- CSS : tout le theming passe par les tokens `:root[data-theme=...]` en tête de
  `static/css/site.css` — ne pas styler en dur par thème ailleurs que via ces tokens
  et les sélecteurs `[data-theme=...]`.
- `prefers-reduced-motion` : chaque nouvel effet doit avoir son fallback statique.
- Le client valide chaque étape visuellement : montrer des captures avant de pousser.
- Git : brancher depuis `claude/cross-device-project-sync-m1fk1d` (le travail vit là).
