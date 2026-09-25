// Quad plein cadre. vUv est exprimé avec l'axe Y vers le bas,
// comme les coordonnées CSS, pour simplifier les calculs en pixels.
attribute vec2 aPosition;
varying vec2 vUv;

void main() {
  vUv = vec2(aPosition.x * 0.5 + 0.5, 0.5 - aPosition.y * 0.5);
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
