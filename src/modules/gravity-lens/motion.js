import { gsap } from 'gsap';

/**
 * Capteur de mouvement partagé par toutes les lentilles de la page.
 *
 * Il mesure, une fois par image :
 *   - la position du pointeur (coordonnées viewport) ;
 *   - la vitesse de défilement (px/s, lissée, signée) ;
 *   - la vitesse du pointeur (px/s, lissée).
 *
 * Le lissage exponentiel évite les à-coups : la molette et le trackpad
 * envoient des événements irréguliers, souvent zéro pixel sur certaines images.
 */
export const motion = {
  x: window.innerWidth / 2,
  y: window.innerHeight / 2,
  scrollVelocity: 0,
  scrollDirection: 1,
  pointerSpeed: 0,
};

const SMOOTHING = 0.1; // constante de temps du lissage, en secondes

let lastScrollY = window.scrollY;
let lastX = motion.x;
let lastY = motion.y;

function setPointer(x, y) {
  motion.x = x;
  motion.y = y;
}

window.addEventListener('pointermove', (e) => setPointer(e.clientX, e.clientY), { passive: true });
window.addEventListener('touchstart', (e) => {
  const t = e.touches[0];
  if (t) setPointer(t.clientX, t.clientY);
}, { passive: true });
window.addEventListener('touchmove', (e) => {
  const t = e.touches[0];
  if (t) setPointer(t.clientX, t.clientY);
}, { passive: true });

gsap.ticker.add((_time, deltaMS) => {
  const dt = Math.max(deltaMS / 1000, 1 / 240);
  const k = 1 - Math.exp(-dt / SMOOTHING);

  const scrollY = window.scrollY;
  const v = (scrollY - lastScrollY) / dt;
  lastScrollY = scrollY;
  motion.scrollVelocity += (v - motion.scrollVelocity) * k;
  if (Math.abs(v) > 40) motion.scrollDirection = Math.sign(v);

  const speed = Math.hypot(motion.x - lastX, motion.y - lastY) / dt;
  lastX = motion.x;
  lastY = motion.y;
  motion.pointerSpeed += (speed - motion.pointerSpeed) * k;
});
