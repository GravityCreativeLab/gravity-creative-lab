/**
 * Vidéos de projets : chargées seulement à l'approche de l'écran,
 * lues quand elles sont visibles, mises en pause sinon.
 *
 *   <video class="media__asset" data-src="/videos/projet.mp4" poster="/images/projet.jpg"
 *          muted loop playsinline preload="none"></video>
 *
 * Avec « réduire les animations », la vidéo n'est pas lue automatiquement :
 * l'image de couverture (poster) reste affichée.
 */
export function initMedia({ reducedMotion }) {
  const videos = document.querySelectorAll('video[data-src]');
  if (!videos.length) return;

  const observer = new IntersectionObserver((entries) => {
    for (const { target: video, isIntersecting } of entries) {
      if (isIntersecting) {
        if (!video.getAttribute('src')) video.src = video.dataset.src;
        if (!reducedMotion) video.play().catch(() => {});
      } else {
        video.pause();
      }
    }
  }, { rootMargin: '200px 0px' });

  videos.forEach((video) => observer.observe(video));
}
