/**
 * Thème noir absolu / blanc pur.
 *
 * Le thème initial est appliqué par un petit script dans <head> (pas de flash).
 * Ce module gère le bouton et prévient les autres modules via l'événement
 * `themechange`, pour que les canvas (lentille, 3D) changent d'encre aussi.
 */
const STORAGE_KEY = 'gcl-theme';

export function currentTheme() {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

export function initTheme() {
  const button = document.querySelector('[data-theme-toggle]');
  if (!button) return;

  const sync = () => {
    const isLight = currentTheme() === 'light';
    button.setAttribute('aria-pressed', String(isLight));
    button.textContent = isLight ? 'Fond noir' : 'Fond blanc';
  };

  button.addEventListener('click', () => {
    const next = currentTheme() === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* stockage indisponible : le choix vaut pour cette visite */
    }
    sync();
    window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: next } }));
  });

  sync();
}
