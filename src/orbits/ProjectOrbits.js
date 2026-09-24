import { gsap } from 'gsap';
import { cameraBasis, projectPoint, impactParameter, dot } from '../scene/camera.js';

// Paramètre d'impact critique d'un trou noir de Schwarzschild (≈ 3√3/2 Rs) :
// une étoile vue derrière ce rayon est avalée par l'ombre.
const SHADOW_IMPACT = 2.6;
const SLOW_SPEED = 0.12; // vitesse relative des orbites pendant un survol

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/**
 * Système gravitationnel des étoiles-projets.
 *
 * Chaque projet devient un lien HTML positionné en 3D sur une orbite
 * képlérienne autour de la singularité, puis projeté avec la même caméra
 * que le shader. À l'ouverture, les étoiles sont « capturées » : elles
 * arrivent de loin en spirale avant de se stabiliser.
 *
 * Les éléments HTML gardent l'accessibilité simple (vrais liens), mais la
 * couche est masquée aux lecteurs d'écran : la liste #projets reste la
 * version accessible et la source unique des données.
 */
export class ProjectOrbits {
  constructor(container, projects, { getCamera, reducedMotion = false }) {
    this.container = container;
    this.getCamera = getCamera;
    this.reducedMotion = reducedMotion;

    this.time = 0;
    this.baseSpeed = reducedMotion ? 0 : 1;
    this.speed = this.baseSpeed;
    this.targetSpeed = this.baseSpeed;
    this.capture = reducedMotion ? 1 : 0;
    this.active = null;
    this.lastPointerType = 'mouse';

    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.stars = projects.map((project, i) => this.createStar(project, i, projects.length));

    this.tick = this.tick.bind(this);
    this.onResize = this.onResize.bind(this);
    this.onDocumentPointerDown = this.onDocumentPointerDown.bind(this);

    window.addEventListener('resize', this.onResize);
    document.addEventListener('pointerdown', this.onDocumentPointerDown);
    gsap.ticker.add(this.tick);

    if (!reducedMotion) {
      gsap.to(this, { capture: 1, duration: 5, ease: 'power3.out', delay: 0.8 });
    }
  }

  createStar(project, index, count) {
    const el = document.createElement('a');
    el.className = 'star';
    el.href = project.href;
    el.tabIndex = -1;

    const core = document.createElement('span');
    core.className = 'star__core';

    const label = document.createElement('span');
    label.className = 'star__label';
    const title = document.createElement('span');
    title.className = 'star__title';
    title.textContent = project.title;
    const meta = document.createElement('span');
    meta.className = 'star__meta';
    meta.textContent = project.meta;
    label.append(title, meta);

    el.append(core, label);
    this.container.append(el);

    // Orbites réparties de façon déterministe (même ciel à chaque visite).
    const radius = 10.2 + (index % 3) * 1.3 + ((index * 0.37) % 0.6);
    const star = {
      el,
      radius,
      phase: (index / count) * Math.PI * 2,
      inclination: (((index * 0.618) % 1) - 0.5) * 0.7,
      node: index * 2.4,
      omega: 6.5 / Math.pow(radius, 1.5), // 3e loi de Kepler
    };

    el.addEventListener('pointerdown', (e) => { this.lastPointerType = e.pointerType; });
    el.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'touch') this.activate(star);
    });
    el.addEventListener('pointerleave', (e) => {
      if (e.pointerType !== 'touch') this.deactivate(star);
    });
    el.addEventListener('click', (e) => {
      // Au toucher : premier tap = afficher le nom, second tap = ouvrir.
      if (this.lastPointerType === 'touch' && this.active !== star) {
        e.preventDefault();
        this.activate(star);
      }
    });

    return star;
  }

  activate(star) {
    if (this.active && this.active !== star) this.active.el.classList.remove('is-active');
    this.active = star;
    star.el.classList.add('is-active');
    this.targetSpeed = this.baseSpeed * SLOW_SPEED;
  }

  deactivate(star) {
    if (this.active !== star) return;
    star.el.classList.remove('is-active');
    this.active = null;
    this.targetSpeed = this.baseSpeed;
  }

  onDocumentPointerDown(e) {
    if (this.active && !this.active.el.contains(e.target)) this.deactivate(this.active);
  }

  onResize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
  }

  orbitPosition(star) {
    const pull = 1 - this.capture;
    const r = star.radius * (1 + pull * 2.2);         // arrivée depuis le lointain
    const theta = star.phase + star.omega * this.time - pull * 2.5; // en spirale

    // Orbite dans son propre plan, incliné puis tourné autour de la singularité.
    const x0 = Math.cos(theta) * r;
    const z0 = Math.sin(theta) * r;
    const ci = Math.cos(star.inclination);
    const si = Math.sin(star.inclination);
    const y1 = -z0 * si;
    const z1 = z0 * ci;
    const cn = Math.cos(star.node);
    const sn = Math.sin(star.node);
    return [x0 * cn + z1 * sn, y1, -x0 * sn + z1 * cn];
  }

  tick(_time, deltaMS) {
    const dt = Math.min(deltaMS / 1000, 0.1);
    this.speed += (this.targetSpeed - this.speed) * (1 - Math.exp(-dt * 5));
    this.time += dt * this.speed;

    const cam = this.getCamera();
    const basis = cameraBasis(cam);
    const shadow = SHADOW_IMPACT * cam.lensing;
    const appear = Math.min(1, this.capture * 1.5);

    for (const star of this.stars) {
      const { el } = star;
      const p = this.orbitPosition(star);
      const proj = projectPoint(p, basis, this.width, this.height);

      if (!proj) {
        el.style.opacity = '0';
        el.style.pointerEvents = 'none';
        continue;
      }

      // Derrière la singularité et dans l'ombre : l'étoile disparaît.
      const behind = dot(p, basis.forward) > 0;
      const occluded = behind ? 1 - smoothstep(shadow, shadow + 1.5, impactParameter(p, basis.ro)) : 0;
      const opacity = (1 - occluded) * appear;
      const scale = clamp(cam.distance / proj.z, 0.6, 1.5);

      el.style.transform = `translate3d(${proj.x.toFixed(1)}px, ${proj.y.toFixed(1)}px, 0)`;
      el.style.opacity = opacity.toFixed(3);
      el.style.setProperty('--s', scale.toFixed(3));
      el.style.zIndex = star === this.active ? '1000' : String(Math.round(500 - proj.z * 5));
      el.style.pointerEvents = opacity > 0.3 ? 'auto' : 'none';
      el.classList.toggle('is-flipped', proj.x > this.width - 280);
    }
  }

  dispose() {
    gsap.ticker.remove(this.tick);
    window.removeEventListener('resize', this.onResize);
    document.removeEventListener('pointerdown', this.onDocumentPointerDown);
    this.stars.forEach((s) => s.el.remove());
  }
}
