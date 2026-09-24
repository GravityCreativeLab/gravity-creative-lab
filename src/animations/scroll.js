import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Séquence d'ouverture : le trou noir s'allume (le disque s'embrase, la
 * caméra est attirée vers lui), puis le titre sort du flou comme de la
 * lumière qui se redresse en quittant le champ gravitationnel.
 */
export function playIntro(blackHole, { reducedMotion }) {
  const lines = gsap.utils.toArray('.hero__line');
  const secondary = gsap.utils.toArray('.hero__lede, .hero__hint');

  if (reducedMotion) {
    gsap.set([...lines, ...secondary], { autoAlpha: 1 });
    return;
  }

  if (blackHole) {
    gsap.to(blackHole.params, { ignition: 1, duration: 3.6, ease: 'power3.out' });
  }

  gsap.timeline({ defaults: { ease: 'expo.out' } })
    .fromTo(lines,
      { autoAlpha: 0, filter: 'blur(14px)', scaleX: 1.12, transformOrigin: '0% 50%' },
      { autoAlpha: 1, filter: 'blur(0px)', scaleX: 1, duration: 2.2, stagger: 0.14 },
      1.2)
    .fromTo(secondary,
      { autoAlpha: 0 },
      { autoAlpha: 1, duration: 1.4, stagger: 0.1 },
      2.3);
}

/**
 * Un seul voyage sur toute la page : plus on défile, plus la caméra
 * tombe vers l'horizon. Le hero et les étoiles-projets sont « aspirés »
 * en partant.
 */
export function initScroll(blackHole, { reducedMotion }) {
  if (reducedMotion) return;

  if (blackHole) {
    gsap.timeline({
      scrollTrigger: {
        trigger: '.page',
        start: 'top top',
        end: 'bottom bottom',
        scrub: 1.2,
      },
    })
      // Survol : on monte au-dessus du disque.
      .to(blackHole.params, { tilt: 0.42, distance: 17, ease: 'none', duration: 1 })
      // Chute : on redescend vers le plan du disque en s'approchant.
      .to(blackHole.params, { tilt: 0.14, distance: 11, glow: 2, ease: 'power2.in', duration: 1 });
  }

  const leaveHero = { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true };

  gsap.to('.hero__inner', {
    yPercent: -18,
    scale: 0.94,
    autoAlpha: 0,
    filter: 'blur(8px)',
    ease: 'none',
    scrollTrigger: leaveHero,
  });

  // autoAlpha passe la couche en visibility: hidden → plus cliquable.
  gsap.to('.orbits', {
    autoAlpha: 0,
    scale: 0.85,
    ease: 'none',
    scrollTrigger: { ...leaveHero, start: '30% top' },
  });
}
