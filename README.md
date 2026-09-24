# gravity-creative-lab

Portfolio de Gravity Creative Lab : un trou noir rendu en temps réel (Three.js + shader GLSL) et un récit au défilement piloté par GSAP ScrollTrigger.

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
index.html                     Structure de la page, contenu, polices
public/favicon.svg
src/
  main.js                      Point d'entrée : détection WebGL, init scène + animations
  scene/
    BlackHole.js               Renderer Three.js, uniforms, boucle de rendu, resize
    camera.js                  Modèle de caméra partagé shader ↔ étoiles (à garder synchronisé)
    shaders/
      blackhole.vert.glsl      Quad plein écran
      blackhole.frag.glsl      Lancer de rayons : courbure, disque d'accrétion, Doppler, étoiles
  orbits/
    ProjectOrbits.js           Étoiles-projets en orbite képlérienne, survol = ralentissement + nom
  animations/
    scroll.js                  Intro du titre + voyage caméra lié au défilement (GSAP)
  styles/
    tokens.css                 Couleurs, typographie, espacements
    main.css                   Mise en page et composants
```

## Piloter le trou noir

`BlackHole.params` est l'interface d'animation. GSAP (ou n'importe quel code) peut modifier :

| Paramètre  | Rôle                                         | Valeur de départ |
|------------|----------------------------------------------|------------------|
| `distance` | Distance de la caméra (plus petit = plus près) | `24`             |
| `tilt`     | Inclinaison au-dessus du disque (radians)     | `0.18`           |
| `glow`     | Intensité du disque d'accrétion               | `1.5`            |
| `lensing`  | Force de la distorsion gravitationnelle       | `1.35`           |
| `spin`     | Vitesse de rotation du disque                 | `1`              |
| `ignition` | Allumage à l'ouverture (0 → 1, animé par GSAP) | `0`              |

Exemple : `gsap.to(blackHole.params, { distance: 12, duration: 2 })`.

## Étoiles-projets

Chaque `<li class="project" id="...">` de la section Projets devient une étoile en orbite autour du trou noir. Pour ajouter un projet, ajoutez simplement un élément à la liste : titre (`.project__title`) et ligne de description (`.project__meta`) s'affichent au survol, et un clic mène à l'élément correspondant.

Réglages dans `src/orbits/ProjectOrbits.js` : rayons des orbites (`radius`), inclinaisons, vitesse (`omega`, 3e loi de Kepler) et ralentissement au survol (`SLOW_SPEED`).

## Performance et accessibilité

- Le shader est rendu en résolution réduite (`quality` : 0.85 sur ordinateur, 0.6 sur mobile), à ajuster dans `src/main.js`.
- La boucle de rendu se met en pause quand l'onglet est masqué.
- `prefers-reduced-motion` : image fixe, pas d'animation au défilement.
- Sans WebGL : fond statique en CSS, les étoiles orbitent quand même.
- Au toucher : un premier tap affiche le nom du projet, un second l'ouvre.
- La couche d'étoiles est masquée aux lecteurs d'écran ; la liste des projets reste la version accessible.
