import { currentTheme } from './theme.js';

/**
 * Conteneurs 3D légers.
 *
 *   <div class="media__stage" data-stage></div>                      → objet de démonstration
 *   <div class="media__stage" data-stage data-model="/models/x.glb"></div> → modèle glTF
 *
 * Three.js n'est téléchargé que lorsqu'un conteneur approche de l'écran :
 * une page sans 3D ne charge jamais la bibliothèque. Le rendu s'arrête dès que
 * le conteneur sort de l'écran.
 */
export function initStages({ reducedMotion }) {
  const stages = document.querySelectorAll('[data-stage]');
  if (!stages.length) return;

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      observer.unobserve(entry.target);
      mountStage(entry.target, { reducedMotion }).catch((error) => {
        console.warn('[Stage3D] échec du chargement :', error);
        entry.target.classList.add('is-failed');
      });
    }
  }, { rootMargin: '300px 0px' });

  stages.forEach((stage) => observer.observe(stage));
}

const ink = () => (currentTheme() === 'light' ? 0x0a0a0a : 0xf4f2ee);

async function mountStage(el, { reducedMotion }) {
  const THREE = await import('three');

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  el.append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 7);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x404040, 1.4));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(3, 4, 5);
  scene.add(key);

  let object;
  let placeholderMaterial = null;

  if (el.dataset.model) {
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
    const gltf = await new GLTFLoader().loadAsync(el.dataset.model);
    object = fitToView(THREE, gltf.scene, 2.6);
  } else {
    // Objet de démonstration, à remplacer par un modèle via data-model.
    placeholderMaterial = new THREE.MeshStandardMaterial({ color: ink(), roughness: 0.3, metalness: 0.15 });
    object = new THREE.Mesh(new THREE.TorusKnotGeometry(1, 0.3, 256, 32), placeholderMaterial);
  }
  scene.add(object);

  const resize = () => {
    const { width, height } = el.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  };
  new ResizeObserver(resize).observe(el);
  resize();

  window.addEventListener('themechange', () => {
    if (placeholderMaterial) placeholderMaterial.color.setHex(ink());
    renderer.render(scene, camera);
  });

  if (reducedMotion) {
    renderer.render(scene, camera);
    return;
  }

  const clock = new THREE.Clock();
  const loop = () => {
    const dt = Math.min(clock.getDelta(), 0.1);
    object.rotation.y += dt * 0.25;
    object.rotation.x += dt * 0.08;
    renderer.render(scene, camera);
  };

  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) {
      clock.getDelta();
      renderer.setAnimationLoop(loop);
    } else {
      renderer.setAnimationLoop(null);
    }
  }).observe(el);
}

/** Centre le modèle et le met à l'échelle pour qu'il tienne dans le cadre. */
function fitToView(THREE, object, targetSize) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3()).length() || 1;
  const center = box.getCenter(new THREE.Vector3());
  const group = new THREE.Group();
  object.position.sub(center);
  group.add(object);
  group.scale.setScalar(targetSize / size);
  return group;
}
