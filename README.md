# gravity-creative-lab

Site de Gravity Creative Lab : une galerie épurée (noir absolu ou blanc pur) dont le grand titre réagit à la gravité, c'est-à-dire à la position de la souris et à la vitesse de défilement.

## Démarrer

```bash
npm install
npm run dev      # serveur de développement (http://localhost:5173)
npm run build    # build de production dans dist/
npm run preview  # prévisualiser le build
```

Node.js 18 ou plus récent est requis.

## Architecture

```
index.html                         Page d'accueil (hero, galerie, studio, contact)
public/favicon.svg
src/
  main.js                          Point d'entrée : initialise chaque module
  modules/
    gravity-lens/
      GravityLens.js               Texte HTML redessiné en WebGL, déformé près du curseur
      motion.js                    Capteur partagé : pointeur, vitesse de défilement
      lens.vert.glsl
      lens.frag.glsl               La distorsion (attraction, courbure, étirement)
    theme.js                       Bascule fond noir / fond blanc
    media.js                       Vidéos chargées et lues seulement à l'écran
    stage3d.js                     Conteneurs 3D légers (Three.js chargé à la demande)
    reveal.js                      Révélation discrète des médias de la galerie
  styles/
    tokens.css                     Couleurs des deux thèmes, typographie, grille
    base.css                       Réinitialisation, éléments de base
    layout.css                     Sections et grille éditoriale 12 colonnes
    components.css                 En-tête, lentille, cartes projet, médias
```

## La lentille gravitationnelle

Ajoutez `data-gravity-lens` sur n'importe quel élément texte (déjà en place sur le titre du hero et sur « Démarrer un projet »). Le texte reste du vrai HTML, lisible et sélectionnable ; un canvas WebGL superposé en affiche une version déformée.

- Plus on fait défiler vite, plus le texte proche du curseur est aspiré, courbé et étiré vers lui.
- Dès que le mouvement s'arrête, un ressort le ramène à sa forme d'origine, avec un amorti fluide.
- Au repos, aucun calcul n'est fait.

Réglages par défaut dans `DEFAULTS` (`GravityLens.js`), ou par élément :

```html
<h1 data-gravity-lens='{"scrollForFull": 2000, "radiusScale": 1.8}'>…</h1>
```

| Réglage            | Rôle                                                      | Défaut |
|--------------------|-----------------------------------------------------------|--------|
| `scrollForFull`    | Vitesse de défilement (px/s) pour la distorsion maximale  | 2800   |
| `pointerInfluence` | Part de distorsion due au seul mouvement de la souris     | 0.25   |
| `radiusScale`      | Rayon d'influence, en multiple de la taille du texte      | 1.5    |
| `stiffness`        | Raideur du ressort de retour                              | 120    |
| `damping`          | Amortissement (plus bas = plus de rebond)                 | 14     |

## Ajouter un projet à la galerie

Chaque projet est un `<article class="work">` placé sur la grille avec `--span` (largeur, sur 12 colonnes) et `--start` (colonne de départ). Le média réserve sa place avec `--ratio`. Les trois types de médias (image, vidéo, 3D) sont décrits en commentaire dans `index.html`.

## Typographie

- **Titre :** Bodoni Moda (Google Fonts), figée sur sa taille optique d'affichage.
- **Texte :** Instrument Sans (Google Fonts).
- **Alternative sans-sérif monumentale :** Anton (Google Fonts). Remplacez la police dans le lien Google Fonts de `index.html` et dans `--font-display` (`tokens.css`).

## Accessibilité et performance

- `prefers-reduced-motion` : ni distorsion, ni révélation, ni lecture automatique des vidéos.
- Sans WebGL : le titre HTML s'affiche normalement.
- Three.js n'est téléchargé que si un conteneur 3D approche de l'écran.
- Les lentilles, vidéos et scènes 3D hors de l'écran ne consomment rien.
