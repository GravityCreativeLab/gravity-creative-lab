import { defineConfig } from 'vite';

export default defineConfig({
  // Chemins relatifs : le build fonctionne aussi bien à la racine d'un domaine
  // que dans un sous-dossier (GitHub Pages, par exemple).
  base: './',
  server: {
    host: true, // accessible depuis un téléphone sur le même réseau
    open: true,
  },
  build: {
    target: 'es2020',
    sourcemap: true,
  },
});
