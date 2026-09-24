/**
 * Modèle de caméra partagé.
 *
 * Le shader et le système d'étoiles-projets doivent voir le monde exactement
 * de la même façon, sinon les étoiles « glissent » par rapport au trou noir.
 * Ces constantes DOIVENT rester identiques à celles de blackhole.frag.glsl.
 */
export const FOCAL = 1.6;          // rd = normalize(forward * FOCAL + uv.x * right + uv.y * up)
export const POINTER_TILT = 0.04;  // influence verticale du pointeur sur l'inclinaison
export const POINTER_YAW = 0.08;   // influence horizontale du pointeur sur le lacet

// --- Petits utilitaires vectoriels (tableaux [x, y, z]) ---
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const length = (a) => Math.hypot(a[0], a[1], a[2]);
export const normalize = (a) => {
  const l = length(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/**
 * Sur un écran étroit (mobile en portrait), on recule la caméra pour que
 * le disque tienne en largeur.
 */
export function framingFactor(width, height) {
  return Math.max(1, 1.5 / (width / height));
}

/** Repère de la caméra, calculé comme dans le shader. */
export function cameraBasis({ distance, tilt, pointer }) {
  const t = tilt + pointer.y * POINTER_TILT;
  const yaw = pointer.x * POINTER_YAW;
  const ro = [
    Math.sin(yaw) * Math.cos(t) * distance,
    Math.sin(t) * distance,
    -Math.cos(yaw) * Math.cos(t) * distance,
  ];
  const forward = normalize([-ro[0], -ro[1], -ro[2]]);
  const right = normalize(cross([0, 1, 0], forward));
  const up = cross(forward, right);
  return { ro, forward, right, up };
}

/**
 * Projette un point 3D en pixels CSS. Retourne null s'il est derrière la caméra.
 * Même convention que le shader : uv = (fragCoord - 0.5 * res) / res.y
 */
export function projectPoint(point, basis, width, height) {
  const rel = sub(point, basis.ro);
  const z = dot(rel, basis.forward);
  if (z <= 0.5) return null;
  const ux = (FOCAL * dot(rel, basis.right)) / z;
  const uy = (FOCAL * dot(rel, basis.up)) / z;
  return { x: width / 2 + ux * height, y: height / 2 - uy * height, z };
}

/** Distance entre la singularité et la ligne de visée caméra → point. */
export function impactParameter(point, ro) {
  const dir = normalize(sub(point, ro));
  return length(cross(ro, dir));
}
