import * as THREE from 'three';
import vertexShader from './shaders/blackhole.vert.glsl?raw';
import fragmentShader from './shaders/blackhole.frag.glsl?raw';
import { framingFactor } from './camera.js';

/**
 * Trou noir rendu en plein écran dans un <canvas>.
 *
 * `params` est l'interface publique pour l'animation : GSAP (ou autre)
 * modifie directement ces valeurs, elles sont recopiées dans les uniforms
 * à chaque image.
 *
 *   distance : distance de la caméra (plus petit = plus proche)
 *   tilt     : inclinaison au-dessus du disque, en radians
 *   glow     : intensité lumineuse du disque
 *   lensing  : force de la distorsion gravitationnelle (1 = physique « sage »)
 *   spin     : vitesse de rotation du disque
 *   ignition : 0 → 1 à l'ouverture ; le disque s'allume, la caméra approche
 */
export class BlackHole {
  constructor(canvas, { quality = 1, animate = true } = {}) {
    this.canvas = canvas;
    this.quality = quality;
    this.animate = animate;

    this.params = {
      distance: 24,
      tilt: 0.18,
      glow: 1.5,
      lensing: 1.35,
      spin: 1,
      ignition: animate ? 0 : 1,
    };

    this.rotation = 0;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setClearColor(0x000000, 1);

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.uniforms = {
      uTime: { value: 0 },
      uRotation: { value: 0 },
      uResolution: { value: new THREE.Vector2() },
      uDistance: { value: this.params.distance },
      uTilt: { value: this.params.tilt },
      uGlow: { value: this.params.glow },
      uLensing: { value: this.params.lensing },
      uPointer: { value: new THREE.Vector2() },
    };

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: this.uniforms,
      depthTest: false,
      depthWrite: false,
    });

    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    this.scene.add(this.mesh);

    this.clock = new THREE.Clock();
    this.pointerTarget = new THREE.Vector2();

    this.resize = this.resize.bind(this);
    this.tick = this.tick.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onVisibilityChange = this.onVisibilityChange.bind(this);

    window.addEventListener('resize', this.resize);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    if (animate) {
      window.addEventListener('pointermove', this.onPointerMove, { passive: true });
    }

    this.resize();
  }

  start() {
    if (this.animate) {
      this.clock.start();
      this.renderer.setAnimationLoop(this.tick);
    } else {
      this.render();
    }
  }

  stop() {
    this.renderer.setAnimationLoop(null);
  }

  /** Distance réelle de la caméra : cadrage écran + approche d'ouverture. */
  effectiveDistance() {
    const { distance, ignition } = this.params;
    const framing = framingFactor(window.innerWidth, window.innerHeight);
    return distance * framing * (1 + (1 - ignition) * 0.45);
  }

  /** État caméra lu par le système d'orbites (voir camera.js). */
  getCameraState() {
    return {
      distance: this.effectiveDistance(),
      tilt: this.params.tilt,
      pointer: this.uniforms.uPointer.value,
      lensing: this.params.lensing,
    };
  }

  resize() {
    // Le shader est coûteux : on rend en résolution réduite, le navigateur
    // agrandit le canvas en CSS. `quality` règle ce compromis.
    const pixelRatio = Math.min(window.devicePixelRatio, 1.5) * this.quality;
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.getDrawingBufferSize(this.uniforms.uResolution.value);
    if (!this.animate) this.render();
  }

  onPointerMove(event) {
    this.pointerTarget.set(
      (event.clientX / window.innerWidth) * 2 - 1,
      -((event.clientY / window.innerHeight) * 2 - 1),
    );
  }

  onVisibilityChange() {
    if (!this.animate) return;
    if (document.hidden) {
      this.stop();
    } else {
      this.clock.getDelta(); // évite un saut de temps au retour sur l'onglet
      this.renderer.setAnimationLoop(this.tick);
    }
  }

  tick() {
    const delta = Math.min(this.clock.getDelta(), 0.1);
    const { spin, ignition } = this.params;

    // La phase de rotation est intégrée ici : changer `spin` en cours
    // d'animation accélère le disque sans à-coup.
    this.rotation += delta * spin * (1 + (1 - ignition) * 2.5);

    this.uniforms.uTime.value += delta;
    this.uniforms.uPointer.value.lerp(this.pointerTarget, 1 - Math.exp(-delta * 3));
    this.render();
  }

  render() {
    const { tilt, glow, lensing, ignition } = this.params;
    this.uniforms.uRotation.value = this.rotation;
    this.uniforms.uDistance.value = this.effectiveDistance();
    this.uniforms.uTilt.value = tilt;
    this.uniforms.uGlow.value = glow * (0.1 + 0.9 * ignition);
    this.uniforms.uLensing.value = lensing;
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.stop();
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('pointermove', this.onPointerMove);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.renderer.dispose();
  }
}
