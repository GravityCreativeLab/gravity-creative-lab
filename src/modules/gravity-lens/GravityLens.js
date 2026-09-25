import { gsap } from 'gsap';
import { motion } from './motion.js';
import vertexSource from './lens.vert.glsl?raw';
import fragmentSource from './lens.frag.glsl?raw';

/**
 * Réglages par défaut. Chaque instance peut les surcharger :
 *   new GravityLens(el, { scrollForFull: 2000 })
 * ou en HTML : data-gravity-lens='{"radiusScale": 1.8}'
 */
const DEFAULTS = {
  scrollForFull: 2800,    // vitesse de défilement (px/s) qui donne la distorsion maximale
  pointerForFull: 3500,   // vitesse du pointeur (px/s) qui donne sa contribution maximale
  pointerInfluence: 0.25, // part de la distorsion due au seul mouvement du pointeur
  radiusScale: 1.5,       // rayon d'influence, en multiple de la taille du texte
  stiffness: 120,         // raideur du ressort de retour
  damping: 14,            // amortissement (plus bas = plus de rebond)
  maxPixelRatio: 2,
};

/**
 * Lentille gravitationnelle sur un élément texte (titre, lien…).
 *
 * Le texte reste du vrai HTML : lisible par les lecteurs d'écran, sélectionnable,
 * indexable. Il est simplement rendu invisible (text-fill-color) et redessiné
 * au pixel près dans un canvas WebGL superposé, qui applique la distorsion.
 * Sans WebGL, ou avec « réduire les animations », le texte HTML reste affiché.
 */
export class GravityLens {
  static init(selector = '[data-gravity-lens]') {
    return [...document.querySelectorAll(selector)]
      .map((el) => new GravityLens(el, readOptions(el)))
      .filter((lens) => lens.ok);
  }

  constructor(el, options = {}) {
    this.el = el;
    this.settings = { ...DEFAULTS, ...options };
    this.strength = 0;
    this.velocity = 0;
    this.direction = 1;
    this.mouse = null;
    this.visible = true;
    this.ready = false;

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'gravity-lens__canvas';
    this.canvas.setAttribute('aria-hidden', 'true');

    const gl = this.canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false });
    this.ok = Boolean(gl) && this.setupGL(gl);
    if (!this.ok) return;

    this.textCanvas = document.createElement('canvas');
    this.ctx = this.textCanvas.getContext('2d');

    this.wrapWords();
    el.classList.add('gravity-lens');
    el.append(this.canvas);

    this.tick = this.tick.bind(this);
    this.scheduleRebuild = this.scheduleRebuild.bind(this);
    this.updateColor = this.updateColor.bind(this);

    this.resizeObserver = new ResizeObserver(this.scheduleRebuild);
    this.resizeObserver.observe(el);
    this.intersectionObserver = new IntersectionObserver(([entry]) => {
      this.visible = entry.isIntersecting;
    }, { rootMargin: '120px' });
    this.intersectionObserver.observe(el);
    window.addEventListener('themechange', this.updateColor);

    // On attend les polices : sinon le canvas dessinerait la police de secours.
    document.fonts.ready.then(() => {
      this.rebuild();
      this.ready = true;
      el.classList.add('is-lensed');
    });

    gsap.ticker.add(this.tick);
  }

  // --- WebGL -----------------------------------------------------------------

  setupGL(gl) {
    const program = gl.createProgram();
    for (const [type, source] of [[gl.VERTEX_SHADER, vertexSource], [gl.FRAGMENT_SHADER, fragmentSource]]) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.warn('[GravityLens] shader :', gl.getShaderInfoLog(shader));
        return false;
      }
      gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn('[GravityLens] programme :', gl.getProgramInfoLog(program));
      return false;
    }
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'aPosition');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);

    this.uniforms = {};
    for (const name of ['uText', 'uSize', 'uMouse', 'uStrength', 'uRadius', 'uDirection', 'uColor']) {
      this.uniforms[name] = gl.getUniformLocation(program, name);
    }
    gl.uniform1i(this.uniforms.uText, 0);
    gl.clearColor(0, 0, 0, 0);

    this.gl = gl;
    this.program = program;
    this.buffer = buffer;
    return true;
  }

  // --- Texte → texture ---------------------------------------------------------

  /** Chaque mot devient un <span> : on connaît ainsi sa position exacte après mise en page. */
  wrapWords() {
    const walker = document.createTreeWalker(this.el, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    for (const node of nodes) {
      const fragment = document.createDocumentFragment();
      for (const part of node.textContent.split(/(\s+)/)) {
        if (!part) continue;
        if (/^\s+$/.test(part)) {
          fragment.append(part);
        } else {
          const span = document.createElement('span');
          span.className = 'gravity-lens__word';
          span.textContent = part;
          fragment.append(span);
        }
      }
      node.replaceWith(fragment);
    }
    this.words = [...this.el.querySelectorAll('.gravity-lens__word')];
  }

  scheduleRebuild() {
    if (this.rebuildFrame) return;
    this.rebuildFrame = requestAnimationFrame(() => {
      this.rebuildFrame = null;
      if (this.ready) this.rebuild();
    });
  }

  /** Redessine le texte dans la texture, en recopiant la mise en page du HTML. */
  rebuild() {
    const { el, canvas, textCanvas, ctx, gl } = this;
    const rect = el.getBoundingClientRect();
    const fontSize = parseFloat(getComputedStyle(el).fontSize);

    this.radius = fontSize * this.settings.radiusScale;
    this.pad = Math.round(this.radius * 0.6); // marge : le texte peut être aspiré hors de sa boîte
    const width = rect.width + this.pad * 2;
    const height = rect.height + this.pad * 2;
    const ratio = Math.min(window.devicePixelRatio || 1, this.settings.maxPixelRatio);

    Object.assign(canvas.style, {
      left: `${-this.pad}px`,
      top: `${-this.pad}px`,
      width: `${width}px`,
      height: `${height}px`,
    });
    canvas.width = textCanvas.width = Math.round(width * ratio);
    canvas.height = textCanvas.height = Math.round(height * ratio);

    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#fff';

    for (const word of this.words) {
      const box = word.getBoundingClientRect();
      if (!box.width) continue;
      const style = getComputedStyle(word);
      ctx.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      if ('letterSpacing' in ctx) {
        ctx.letterSpacing = style.letterSpacing === 'normal' ? '0px' : style.letterSpacing;
      }
      const text = word.textContent;
      const metrics = ctx.measureText(text);
      const ascent = metrics.fontBoundingBoxAscent ?? parseFloat(style.fontSize) * 0.8;
      // Le canvas et le navigateur n'ont pas toujours exactement la même
      // chasse : on recale chaque mot sur la largeur mesurée dans le HTML.
      const scaleX = metrics.width > 0 ? box.width / metrics.width : 1;

      ctx.save();
      ctx.translate(box.left - rect.left + this.pad, box.top - rect.top + this.pad);
      ctx.scale(scaleX, 1);
      ctx.fillText(text, 0, ascent);
      ctx.restore();
    }

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textCanvas);

    this.size = [width, height];
    this.updateColor();
  }

  /** La couleur vient du CSS (`color`), donc elle suit le thème clair ou sombre. */
  updateColor() {
    const match = getComputedStyle(this.el).color.match(/[\d.]+/g);
    this.color = match ? match.slice(0, 3).map((v) => Number(v) / 255) : [1, 1, 1];
    if (this.size) this.render();
  }

  // --- Animation ----------------------------------------------------------------

  tick(_time, deltaMS) {
    if (!this.ready || !this.visible) return;
    const s = this.settings;
    const dt = Math.min(deltaMS / 1000, 1 / 30);

    // Cible : surtout la vitesse de défilement, un peu celle du pointeur.
    const fromScroll = Math.min(Math.abs(motion.scrollVelocity) / s.scrollForFull, 1);
    const fromPointer = Math.min(motion.pointerSpeed / s.pointerForFull, 1) * s.pointerInfluence;
    const target = Math.min(1, fromScroll + fromPointer);

    // Ressort légèrement sous-amorti : retour fluide, avec une ondulation à peine visible.
    const acceleration = s.stiffness * (target - this.strength) - s.damping * this.velocity;
    this.velocity += acceleration * dt;
    this.strength += this.velocity * dt;
    this.direction += (motion.scrollDirection - this.direction) * (1 - Math.exp(-dt * 6));

    const box = this.canvas.getBoundingClientRect();
    const mx = motion.x - box.left;
    const my = motion.y - box.top;
    if (!this.mouse) {
      this.mouse = [mx, my];
    } else {
      const k = 1 - Math.exp(-dt * 14);
      this.mouse[0] += (mx - this.mouse[0]) * k;
      this.mouse[1] += (my - this.mouse[1]) * k;
    }

    const moving = Math.abs(this.strength) > 0.0005 || Math.abs(this.velocity) > 0.0005;
    if (moving) {
      this.render();
    } else if (this.strength !== 0) {
      // Retour exact à la forme d'origine, puis plus aucun rendu tant que rien ne bouge.
      this.strength = 0;
      this.velocity = 0;
      this.render();
    }
  }

  render() {
    const { gl, uniforms } = this;
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(uniforms.uSize, this.size[0], this.size[1]);
    gl.uniform2f(uniforms.uMouse, ...(this.mouse ?? [this.size[0] / 2, this.size[1] / 2]));
    gl.uniform1f(uniforms.uStrength, this.strength);
    gl.uniform1f(uniforms.uRadius, this.radius);
    gl.uniform1f(uniforms.uDirection, this.direction);
    gl.uniform3f(uniforms.uColor, ...this.color);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  dispose() {
    gsap.ticker.remove(this.tick);
    this.resizeObserver?.disconnect();
    this.intersectionObserver?.disconnect();
    window.removeEventListener('themechange', this.updateColor);
    this.canvas.remove();
    this.el.classList.remove('gravity-lens', 'is-lensed');
    this.gl?.getExtension('WEBGL_lose_context')?.loseContext();
  }
}

function readOptions(el) {
  const raw = el.dataset.gravityLens;
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    console.warn('[GravityLens] options JSON invalides :', raw);
    return {};
  }
}
