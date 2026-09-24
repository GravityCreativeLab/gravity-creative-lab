// Un simple quad plein écran : tout le rendu se fait dans le fragment shader.
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
