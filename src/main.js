import './styles/tokens.css';
import './styles/main.css';

import { BlackHole } from './scene/BlackHole.js';
import { framingFactor } from './scene/camera.js';
import { ProjectOrbits } from './orbits/ProjectOrbits.js';
import { initScroll, playIntro } from './animations/scroll.js';

const root = document.documentElement;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isSmallScreen = window.matchMedia('(max-width: 720px)').matches;

function supportsWebGL() {
  try {
    const test = document.createElement('canvas');
    return Boolean(test.getContext('webgl2') || test.getContext('webgl'));
  } catch {
    return false;
  }
}

function createBlackHole() {
  const canvas = document.querySelector('#void');
  if (!canvas || !supportsWebGL()) return null;

  try {
    const blackHole = new BlackHole(canvas, {
      quality: isSmallScreen ? 0.6 : 0.85,
      animate: !reducedMotion,
    });
    blackHole.start();
    return blackHole;
  } catch (error) {
    console.warn('[Gravity] WebGL indisponible, affichage du fond statique.', error);
    return null;
  }
}

/** Les étoiles-projets sont lues dans la liste #projets : une seule source. */
function readProjects() {
  return [...document.querySelectorAll('.project[id]')].map((item) => ({
    title: item.querySelector('.project__title')?.textContent.trim() ?? '',
    meta: item.querySelector('.project__meta')?.textContent.trim() ?? '',
    href: `#${item.id}`,
  }));
}

const blackHole = createBlackHole();
root.classList.add(blackHole ? 'has-webgl' : 'no-webgl');

// Sans WebGL, les étoiles orbitent quand même autour du trou noir CSS.
const staticCamera = () => ({
  distance: 24 * framingFactor(window.innerWidth, window.innerHeight),
  tilt: 0.18,
  pointer: { x: 0, y: 0 },
  lensing: 1.35,
});

const orbitLayer = document.querySelector('.orbits');
const orbits = orbitLayer
  ? new ProjectOrbits(orbitLayer, readProjects(), {
      getCamera: blackHole ? () => blackHole.getCameraState() : staticCamera,
      reducedMotion,
    })
  : null;

playIntro(blackHole, { reducedMotion });
initScroll(blackHole, { reducedMotion });

const year = document.querySelector('[data-year]');
if (year) year.textContent = String(new Date().getFullYear());

// Rechargement à chaud de Vite : on libère le contexte WebGL proprement.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    orbits?.dispose();
    blackHole?.dispose();
  });
}
