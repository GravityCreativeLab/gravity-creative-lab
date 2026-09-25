import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';

import { initTheme } from './modules/theme.js';
import { initMedia } from './modules/media.js';
import { initStages } from './modules/stage3d.js';
import { initReveal } from './modules/reveal.js';
import { GravityLens } from './modules/gravity-lens/GravityLens.js';

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

initTheme();
initMedia({ reducedMotion });
initStages({ reducedMotion });
initReveal({ reducedMotion });

// Tout élément portant l'attribut data-gravity-lens devient sensible à la gravité.
const lenses = reducedMotion ? [] : GravityLens.init();

const year = document.querySelector('[data-year]');
if (year) year.textContent = String(new Date().getFullYear());

// Rechargement à chaud de Vite : on libère les contextes WebGL proprement.
if (import.meta.hot) {
  import.meta.hot.dispose(() => lenses.forEach((lens) => lens.dispose()));
}
