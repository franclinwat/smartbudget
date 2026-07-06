# CLAUDE.md — Site officiel BOWENCY (passation de session)

## Contexte

Site officiel de **Bowency** (ex Vivendi Sports) — cabinet de **conseil stratégique
& AMO** pour l'infrastructure sportive/culturelle et la livraison de grands
événements (Paris, 34 av. des Champs-Élysées ; dirigeant : Robins Tchale-Watchou).
Slogan : « Make it real. » Positionnement aligné sur le vrai site www.bowency.com
(proposition de valeur à 2 piliers, expertises Infrastructures & Events Management,
engagements ODD, implantation panafricaine).

Ce module `bowency-site/` est un projet **Spring Boot 3.5 autonome** (Java 17,
Maven) — aucun lien avec l'application smartbudget à la racine du repo.

## Architecture : le « composeur » (admin)

`/admin` (mot de passe : property `bowency.admin.password`, défaut `bowency2026`,
prod via env `BOWENCY_ADMIN_PASSWORD`) est un composeur à 3 axes indépendants,
avec **aperçu iframe en direct** et publication en un clic (`POST /admin/publier`).
Les visiteurs ne voient QUE la combinaison publiée ; l'aperçu passe par les
paramètres `apercuModele/apercuEffet/apercuTheme` réservés à la session admin.

1. **Modèles** (`LayoutService`, persisté `data/active-layout`) :
   - `immersif` → `templates/index.html` + `static/css/site.css` — **Modèle 1, FINI :
     ne pas retoucher sa mise en page**
   - `minimal` → `index-minimal.html` + `site-minimal.css` (Minimal suisse)
   - `bento` → `index-bento.html` + `site-bento.css` (Bento dynamique)
2. **Effets d'ambiance** (`EffetService`, `data/active-effet`) : `aucun | fil |
   projecteurs | traces | heuredoree` → overlays canvas `static/js/effets/*.js`
   auto-injectés derrière le contenu (canvas z-index:0, contenu z-index:1),
   couleurs lues dans les variables CSS du thème actif, stratégie dédiée au thème
   clair `grandsoir`. Démos autonomes : `/effets.html`, `/effet-*.html`.
3. **Thèmes** (`ThemeService`, `data/active-theme`) : `nocturne | grandsoir |
   ocre | emeraude | amethyste`. Palettes de l'immersif en tête de `site.css` ;
   palettes partagées Minimal/Bento dans `tokens.css`.

Le contenu est UNIQUE pour les 3 modèles (bundles i18n). Formulaire de contact →
fichiers dans `data/contact-messages/`, consultables sur /admin.

## Lancer / déployer

```bash
mvnw.cmd spring-boot:run          # local : http://localhost:8080 (ou --server.port=8090)
mvnw.cmd -q clean package -DskipTests
# Déploiement preview client (Hetzner, service systemd "bowency", port 8081) :
scp target/bowency-site-0.1.0-SNAPSHOT.jar root@167.233.59.229:/opt/bowency/app.jar
ssh root@167.233.59.229 'chown bowency:bowency /opt/bowency/app.jar && systemctl restart bowency'
# Site : http://167.233.59.229:8081 — Admin : /admin (mot de passe dans l'unit systemd)
# ATTENTION : nginx (:80) et l'app kora (:8080) du projet Fap Fap Online tournent
# sur le même serveur — NE PAS Y TOUCHER.
```

## Conventions & pièges connus

- Tous les textes via les bundles i18n — **toujours modifier les 3 fichiers
  ensemble** (`messages.properties` = FR défaut, `_fr`, `_en`) ;
  `spring.messages.fallback-to-system-locale=false` obligatoire.
- Theming exclusivement par variables CSS `:root[data-theme=...]` (site.css pour
  l'immersif, tokens.css pour minimal/bento) — jamais de couleurs en dur par thème.
- `prefers-reduced-motion` : chaque effet/animation doit avoir son fallback statique.
- Sur écran large, l'immersif centre ses sections (max-width 1100 + margin-inline
  auto) et aligne nav/stats/footer/story-panel sur la même colonne via
  `max(clamp(...), calc((100% - 1100px)/2))` — préserver ce mécanisme.
- Polices auto-hébergées `static/fonts/` (Hanken Grotesk, Bricolage Grotesque).
- Images : ODD officielles ONU FR dans `img/odd/` (Minimal), icônes illustrées
  Gemini dans `img/odd-bento/` (Bento), photos éditoriales `exp-*.jpg`,
  `implantation.jpg`, `leader.jpg` (vraie photo client). ≤ ~400 Ko/image.
- Le client valide chaque étape visuellement : montrer des captures avant de pousser.
- Git : le travail vit sur la branche `claude/cross-device-project-sync-m1fk1d`.
- Templates Thymeleaf mis en cache : redémarrer après modification d'un template
  (les fichiers statiques peuvent se copier dans `target/classes/static/` à chaud).

## EN COURS — Modèle 4 « Immersif animé » (personnages)

Démo de validation en ligne : `/personnages-preview.html`. Le cycliste (homme
noir) a été généré sur le Gemini du client en 3 styles (cartoon flat, silhouette,
semi-réaliste) × 4 phases de pédalage, détouré du fond vert → `img/sprites/`.
**Attente : le client choisit le style (1/2/3) et la technique (A flipbook 4
dessins ~8 i/s / B dessin unique glissé).** Ensuite :
1. Générer sur son Gemini (gemini.google.com, planches 4 cases fond vert chroma
   #00FF00, personnage strictement identique entre cases) : la **footballeuse
   (femme blanche)** qui dribble et le **rugbyman (homme métis clair)** qui court
   puis plonge — dans le style retenu. Découpe + chroma key : script
   `process-sprites.ps1` (slice 4 + key vert + despill).
2. Créer le **Modèle 4** = copie de l'Immersif (template `index-anime.html` à
   partir d'index.html + un JS de traversées) avec les 3 personnages déclenchés
   au scroll : footballeuse sous « Deux expertises complémentaires », cycliste
   sur « Le terrain, en action », rugbyman qui plonge en fin de Leadership.
3. L'ajouter à `LayoutService` + au composeur admin (« Modèle 4 — Immersif
   animé »), compatible 5 thèmes + effets d'ambiance.

## En attente / prochaines étapes

1. **Logo officiel** : le client doit fournir le fichier (actuellement wordmark
   texte animé, agrandi, dans les 3 modèles).
2. **Logo Fécacyclisme** introuvable en ligne → reste en texte dans le bandeau
   partenaires ; à intégrer si le client fournit le fichier.
3. Choix client : le workflow = l'admin compose (modèle + effet + thème), publie,
   montre au client, puis personnalisation fine de la combinaison retenue.
4. À terme : envoi e-mail réel du formulaire de contact (SMTP), HTTPS + domaine
   (nginx + Let's Encrypt sur le serveur existant), remplacer le mot de passe
   admin par défaut en prod (déjà fait sur le serveur via l'unit systemd).
5. Sélection des 8 ODD (3, 4, 5, 8, 9, 11, 13, 17) à confirmer avec le client
   (seul l'ODD 3 est visible sur le site officiel).
