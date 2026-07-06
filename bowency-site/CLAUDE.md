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

## EN COURS — Modèle 4 « Immersif animé » (personnages) — REPRENDRE ICI

**Décisions client actées** : styles retenus = **1 cartoon flat** et **3
semi-réaliste** (silhouette abandonnée). Le flipbook 4 dessins a été jugé
« images collées » → la technique retenue est la **VIDÉO IA transparente** :
vidéo générée sur fond vert (Veo via le Gemini web du client, ou Sora), détourée
en **WebM VP9 canal alpha**, jouée en boucle dans un `<video muted loop
playsinline>` qui traverse l'écran. La démo `/personnages-preview.html` a déjà la
technique « C · Vidéo IA » branchée sur `/video/cycliste-<style>.webm` avec repli
flipbook automatique si le fichier manque.

### Étape immédiate : produire les 2 vidéos du cycliste
1. Le client colle ces prompts dans gemini.google.com (l'un après l'autre) et
   TÉLÉCHARGE chaque vidéo (l'automatisation du navigateur était en panne —
   frappe corrompue ; réessayer via l'extension Chrome est possible mais ne pas
   s'acharner, le manuel marche très bien) :

   PROMPT VIDÉO 1 (cartoon) :
   « Crée une vidéo : un cycliste de dessin animé (homme noir, maillot bleu et
   noir, casque bleu, lunettes, vélo de course bleu, style cartoon flat moderne
   aux contours nets) pédale SUR PLACE, vu de profil complet orienté vers la
   droite, comme sur un home-trainer invisible. Cadrage fixe et stable,
   personnage entier avec de la marge autour, les deux roues entièrement
   visibles et qui tournent, les jambes pédalent en boucle régulière et fluide.
   FOND VERT CHROMA UNI #00FF00 sur toute l'image, aucune ombre au sol, aucun
   texte, aucun logo. Mouvement en boucle parfaite. »

   PROMPT VIDÉO 2 (semi-réaliste) :
   « Crée une vidéo : un cycliste en illustration semi-réaliste façon bande
   dessinée moderne (homme noir, traits d'encre fins, couleurs riches, maillot
   bleu, casque) pédale SUR PLACE, vu de profil complet orienté vers la droite.
   Cadrage fixe et stable, personnage entier avec de la marge autour, les deux
   roues entièrement visibles et qui tournent, jambes en boucle fluide. FOND
   VERT CHROMA UNI #00FF00 sur toute l'image, aucune ombre, aucun texte.
   Mouvement en boucle parfaite. »

2. Traiter chaque mp4 téléchargé (ffmpeg requis — sur le PC bureau il est
   installé via winget Gyan.FFmpeg ; sinon `winget install Gyan.FFmpeg`) :
   `powershell -File outils/process-video.ps1 -Source <chemin.mp4> -Nom cycliste-cartoon`
   `powershell -File outils/process-video.ps1 -Source <chemin.mp4> -Nom cycliste-realiste`
   → produit `static/video/<nom>.webm` (alpha) + `<nom>.png` (poster).
3. Rebuild + déployer, valider le rendu sur /personnages-preview.html
   (technique C), ajuster tolérance chromakey dans le script si frange verte.

### Ensuite (après validation du rendu vidéo par le client)
4. Générer de la même façon les vidéos des 2 autres personnages (styles retenus) :
   **footballeuse (femme blanche)** qui dribble sur place, **rugbyman (homme
   métis clair)** qui court sur place ballon en main (le plongeon final sera
   déclenché en fin de traversée : 2e vidéo courte « plongeon » ou rotation/chute
   scriptée en CSS à l'arrivée).
5. Créer le **Modèle 4** = copie de l'Immersif (`index-anime.html` copié
   d'index.html + JS de traversées vidéo) : footballeuse sous « Deux expertises
   complémentaires », cycliste sur « Le terrain, en action », rugbyman qui plonge
   en fin de Leadership. Traversées déclenchées à l'entrée de section
   (IntersectionObserver), rejouables, prefers-reduced-motion → personnage
   statique (poster PNG).
6. Ajouter `anime` à `LayoutService` + puce « Modèle 4 — Immersif animé » dans le
   composeur admin ; compatible 5 thèmes + effets d'ambiance.

### Outils dans `outils/`
- `process-video.ps1` : mp4 fond vert → WebM VP9 alpha + poster PNG (chromakey
  0x00FF00 tol .30 + despill).
- `process-sprites.ps1` : planche 4 cases → 4 PNG détourés (chroma key + despill).
- `align-sprites.ps1` : recale 4 phases (bbox → échelle commune → ancrage
  bas-centre) — c'était le correctif du « tressautement ».

### Accès serveur depuis un autre ordinateur
La clé SSH `bowency_deploy` n'existe que sur le PC bureau (`~/.ssh/`). Depuis un
autre poste : demander au client le mot de passe root (167.233.59.229) et
installer une nouvelle clé (voir procédure : ssh-keygen + ajout à
authorized_keys), OU copier la paire de clés depuis le PC bureau. Le service
s'appelle `bowency`, JAR dans `/opt/bowency/app.jar` (voir « Lancer / déployer »).

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
