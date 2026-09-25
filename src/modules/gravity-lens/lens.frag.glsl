// ---------------------------------------------------------------------------
// Lentille gravitationnelle appliquée à du texte
//
// Le texte est rendu une fois dans une texture. À chaque image, chaque pixel
// va chercher sa couleur un peu plus loin du curseur : la matière semble donc
// aspirée vers lui. Autour du curseur, l'espace est aussi légèrement tordu
// (rotation) et étiré dans le sens du défilement, ce qui donne une courbure
// organique plutôt qu'un simple effet de loupe.
//
// Tout est en pixels CSS, axe Y vers le bas.
// ---------------------------------------------------------------------------

precision highp float;

varying vec2 vUv;

uniform sampler2D uText;
uniform vec2  uSize;      // taille du cadre (px)
uniform vec2  uMouse;     // position du curseur dans le cadre (px)
uniform float uStrength;  // 0 = repos ; ~1 = défilement rapide (peut déborder, c'est le ressort)
uniform float uRadius;    // rayon d'influence (px)
uniform float uDirection; // sens du défilement, lissé entre -1 et 1
uniform vec3  uColor;     // couleur de l'encre

void main() {
  vec2 p = vUv * uSize;
  vec2 d = p - uMouse;

  // Influence gaussienne : forte sous le curseur, nulle au loin.
  float falloff = exp(-dot(d, d) / (uRadius * uRadius));
  float s = uStrength * falloff;

  // Courbure : l'espace tourne légèrement autour du curseur.
  float angle = s * 0.3 * uDirection;
  float c = cos(angle);
  float sn = sin(angle);
  vec2 bent = mat2(c, -sn, sn, c) * d;

  // Attraction : on échantillonne plus loin du curseur, donc le texte
  // glisse vers lui. Étirement : décalage vertical dans le sens du défilement.
  vec2 q = uMouse + bent * (1.0 + s * 0.6) + vec2(0.0, uDirection * s * uRadius * 0.2);

  float alpha = texture2D(uText, q / uSize).a;
  gl_FragColor = vec4(uColor * alpha, alpha); // alpha prémultiplié
}
