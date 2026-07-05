# Images du site Bowency — guide de remplacement

Le site est conçu pour des **photos plein écran quasi réelles**. Les fichiers actuels
dans `src/main/resources/static/img/` sont des illustrations provisoires : remplacez
chaque fichier par votre image (même nom de fichier) et les effets restent identiques.

> Formats acceptés : remplacez `xxx.svg` par `xxx.jpg` ou `xxx.webp`, puis mettez à
> jour l'extension correspondante dans `templates/index.html` (attribut `src`).
> Poids conseillé : ≤ 400 Ko par image (compressez sur squoosh.app).

## Prompts Gemini prêts à copier (gemini.google.com → génération d'image)

Pour chaque image, copiez le prompt tel quel. Ajoutez à la fin :
« photorealistic, cinematic lighting, ultra detailed, 8k, no text, no logo, no watermark ».

| Fichier cible | Usage | Prompt Gemini |
|---|---|---|
| `hero-stadium.jpg` | Fond du héro (plein écran) | Vue grand angle d'un stade de football africain plein la nuit, faisceaux de projecteurs traversant une légère brume, pelouse éclairée vue depuis les tribunes hautes, ambiance électrique, tons bleu nuit profond, format paysage 16:10 |
| `real-tour.jpg` | Scène Tour de l'Espoir | Peloton de cyclistes professionnels en échappée sur une route du Cameroun au coucher du soleil, collines verdoyantes, lumière dorée rasante, poussière en suspension, prise de vue basse dynamique, mouvement flou léger sur les roues, format paysage |
| `real-ares.jpg` | Scène ARES FC | Octogone de MMA vide sous un unique projecteur dramatique dans une arène sombre à Dakar, fumée légère, reflets dorés sur la cage, tension avant le combat, format paysage |
| `real-can.jpg` | Scène CAN 2023 | Trophée de football doré soulevé sous une pluie de confettis dorés dans un stade la nuit, mains de joueurs en contre-jour, explosion de joie, lumières de stade en arrière-plan, format paysage |
| `real-accra.jpg` | Scène Jeux Africains | Sprinteurs athlètes africains en pleine course sur une piste d'athlétisme au lever du soleil à Accra, lignes de couloir en perspective, muscles tendus, gouttes de sueur, lumière orange dorée, format paysage |
| `band-crowd.jpg` | Fond de la scène Vision | Foule immense en liesse dans un stade la nuit, milliers de téléphones et flambeaux levés, vagues de lumière bleue et magenta sur la foule, vue panoramique large, format très large 21:9 |
| `leader.jpg` | Portrait Leadership | Portrait en studio d'un dirigeant charismatique de profil trois-quarts, éclairage de contour bleu électrique sur fond bleu nuit, costume élégant, regard déterminé, style éditorial magazine, format portrait 5:6 |

## Remplacer une image (30 secondes)

1. Déposez la nouvelle image dans `bowency-site/src/main/resources/static/img/`
   avec le nom du tableau ci-dessus.
2. Si l'extension change (`.svg` → `.jpg`), remplacez-la dans `templates/index.html`.
3. Relancez l'application (`./mvnw spring-boot:run`). C'est tout.

## Vos propres photos d'événements

Les photos réelles (Tour de l'Espoir, ARES, CAN…) sont encore meilleures que la
génération IA : envoyez les fichiers originaux dans la conversation Claude et ils
seront intégrés à votre place. N'utilisez que des photos dont Bowency détient les droits.
