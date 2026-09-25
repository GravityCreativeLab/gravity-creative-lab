import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Révélation des médias de la galerie : l'image se découvre de bas en haut,
 * une seule fois, quand elle entre dans l'écran. C'est le seul mouvement
 * automatique de la page, volontairement discret : la lentille du titre
 * reste le moment fort.
 */
export function initReveal({ reducedMotion }) {
  if (reducedMotion) return;

  const media = gsap.utils.toArray('.work .media');
  if (!media.length) return;

  gsap.set(media, { clipPath: 'inset(100% 0% 0% 0%)' });

  ScrollTrigger.batch(media, {
    start: 'top 88%',
    once: true,
    onEnter: (batch) => gsap.to(batch, {
      clipPath: 'inset(0% 0% 0% 0%)',
      duration: 1.2,
      ease: 'expo.out',
      stagger: 0.12,
    }),
  });
}
