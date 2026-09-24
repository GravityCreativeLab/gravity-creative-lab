// ---------------------------------------------------------------------------
// Trou noir de Schwarzschild — lancer de rayons en espace-écran
//
// Chaque pixel envoie un rayon lumineux depuis la caméra. À chaque pas, le
// rayon est courbé vers la singularité (géodésique approchée d'un photon :
// a = -1.5 · M · h² · r / |r|⁵). M = uLensing règle la force de la courbure :
// l'horizon (M), la sphère de photons (1.5 M) et le bord du disque suivent.
//
// Constantes caméra (FOCAL, influence du pointeur) : à garder synchronisées
// avec src/scene/camera.js.
// ---------------------------------------------------------------------------

uniform float uTime;      // secondes écoulées (scintillement des étoiles)
uniform float uRotation;  // phase de rotation du disque, intégrée côté JS
uniform vec2  uResolution;
uniform float uDistance;  // distance caméra → singularité
uniform float uTilt;      // inclinaison au-dessus du disque (rad)
uniform float uGlow;      // intensité lumineuse du disque
uniform float uLensing;   // force de la distorsion gravitationnelle
uniform vec2  uPointer;   // pointeur lissé, dans [-1, 1]

#define MAX_STEPS 240

const float FOCAL    = 1.6;
const float DISK_OUT = 10.0;

// --- Bruit ------------------------------------------------------------------

float hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}

float noise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash13(i + vec3(0, 0, 0)), hash13(i + vec3(1, 0, 0)), f.x),
        mix(hash13(i + vec3(0, 1, 0)), hash13(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(hash13(i + vec3(0, 0, 1)), hash13(i + vec3(1, 0, 1)), f.x),
        mix(hash13(i + vec3(0, 1, 1)), hash13(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}

float fbm(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return v;
}

// --- Fond : étoiles lointaines + poussière -----------------------------------

vec3 starfield(vec3 dir) {
  vec3 col = vec3(0.0);

  for (int layer = 0; layer < 3; layer++) {
    float scale = 90.0 + float(layer) * 110.0;
    vec3 p  = dir * scale;
    vec3 id = floor(p);
    vec3 f  = fract(p) - 0.5;
    float h = hash13(id + float(layer) * 17.0);

    if (h > 0.991) {
      float d = length(f);
      float intensity = (h - 0.991) / 0.009;
      float twinkle = 0.75 + 0.25 * sin(uTime * 1.7 + h * 400.0);
      float star = pow(max(0.0, 1.0 - d * 2.2), 10.0) * intensity * twinkle;
      vec3 tint = mix(vec3(1.0, 0.86, 0.72), vec3(0.72, 0.8, 1.0), hash13(id * 1.7));
      col += tint * star * 1.4;
    }
  }

  float dust = fbm(dir * 2.6 + 4.0);
  col += vec3(0.022, 0.016, 0.034) * smoothstep(0.45, 0.85, dust);
  return col;
}

// --- Disque d'accrétion -----------------------------------------------------

vec3 diskEmission(vec3 hit, vec3 rayDir, float diskIn, out float density) {
  float r = length(hit.xz);
  float t = (r - diskIn) / (DISK_OUT - diskIn); // 0 au bord interne, 1 à l'externe

  // Rotation différentielle (képlérienne) : l'intérieur tourne bien plus vite.
  // Le signe est cohérent avec la vitesse utilisée pour le Doppler.
  float a = atan(hit.z, hit.x) - uRotation * 2.4 / pow(r / diskIn * 2.6, 1.5);

  // Coordonnées polaires sans couture : le bruit varie vite en rayon et
  // lentement en angle, ce qui étire la matière en filaments orbitaux.
  vec3 polar = vec3(r * 2.2, cos(a) * 2.2, sin(a) * 2.2);
  float n = fbm(polar);
  float streaks = fbm(vec3(r * 7.0, cos(a) * 1.2, sin(a) * 1.2) + 7.3);
  float bands = 0.75 + 0.25 * sin(r * 4.0 + n * 8.0);

  density = smoothstep(0.0, 0.06, t) * smoothstep(1.0, 0.45, t)
          * (0.45 + 0.8 * n) * (0.6 + 0.6 * streaks) * bands;

  // Température : blanc chaud au centre, braise vers l'extérieur.
  vec3 hot  = vec3(1.0, 0.94, 0.84);
  vec3 warm = vec3(1.0, 0.56, 0.22);
  vec3 cool = vec3(0.5, 0.16, 0.07);
  vec3 col = mix(hot, warm, smoothstep(0.0, 0.4, t));
  col = mix(col, cool, smoothstep(0.4, 1.0, t));

  // Effet Doppler relativiste : le côté qui vient vers nous est plus
  // lumineux et décalé vers le bleu.
  vec3 velocity = normalize(vec3(-hit.z, 0.0, hit.x));
  float approach = dot(velocity, -rayDir);
  col *= pow(1.0 + 0.6 * approach, 3.0);
  col = mix(col, col * vec3(0.75, 0.86, 1.25), clamp(approach, 0.0, 1.0) * 0.5);

  col *= 4.2 * pow(diskIn / r, 1.5);
  return col * uGlow;
}

// --- Rendu ------------------------------------------------------------------

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;

  float horizon      = uLensing;
  float photonSphere = 1.5 * uLensing;
  float diskIn       = 2.3 * uLensing;

  // Caméra en orbite, légèrement influencée par le pointeur.
  float tilt = uTilt + uPointer.y * 0.04;
  float yaw  = uPointer.x * 0.08;
  vec3 ro = vec3(sin(yaw) * cos(tilt), sin(tilt), -cos(yaw) * cos(tilt)) * uDistance;

  vec3 forward = normalize(-ro);
  vec3 right   = normalize(cross(vec3(0.0, 1.0, 0.0), forward));
  vec3 up      = cross(forward, right);
  vec3 rd      = normalize(forward * FOCAL + uv.x * right + uv.y * up);

  vec3 pos = ro;
  vec3 dir = rd;
  vec3 h   = cross(pos, dir);
  float h2 = dot(h, h); // moment angulaire, conservé le long de la géodésique

  vec3 col = vec3(0.0);
  vec3 ringGlow = vec3(0.0); // n'est ajoutée que si le rayon s'échappe
  float transmittance = 1.0;
  bool captured = false;

  for (int i = 0; i < MAX_STEPS; i++) {
    float r  = length(pos);
    float dt = clamp(0.1 * (r - horizon * 0.5), 0.025, 4.0); // pas adaptatif

    vec3 prev = pos;
    dir += -1.5 * uLensing * h2 * pos / pow(r, 5.0) * dt;
    pos += dir * dt;

    // Anneau de photons : la lumière qui frôle la sphère de photons s'y
    // accumule, dessinant le liseré brillant autour de l'ombre. Les rayons
    // finalement capturés n'y contribuent pas : l'ombre reste noire.
    float ring = exp(-pow((r - photonSphere) * 5.0 / uLensing, 2.0));
    ringGlow += transmittance * vec3(1.0, 0.82, 0.6) * ring * dt * 0.18 * uGlow;

    // Halo volumétrique au-dessus et au-dessous du disque.
    float rr = length(pos.xz);
    float halo = exp(-abs(pos.y) * 3.0)
               * smoothstep(diskIn * 0.8, diskIn * 1.3, rr)
               * exp(-max(rr - diskIn, 0.0) * 0.3);
    col += transmittance * vec3(1.0, 0.6, 0.3) * halo * dt * 0.035 * uGlow;

    // Traversée du plan du disque ?
    if (prev.y * pos.y < 0.0) {
      vec3 hit = mix(prev, pos, prev.y / (prev.y - pos.y));
      float hr = length(hit.xz);
      if (hr > diskIn && hr < DISK_OUT) {
        float density;
        vec3 emission = diskEmission(hit, normalize(dir), diskIn, density);
        float alpha = clamp(density * 1.1, 0.0, 0.95);
        col += transmittance * emission * alpha;
        transmittance *= 1.0 - alpha;
      }
    }

    float nr = length(pos);
    if (nr < horizon) { captured = true; break; }
    if (nr > uDistance * 1.5 + 10.0 && dot(pos, dir) > 0.0) break;
    if (transmittance < 0.02) break;
  }

  if (!captured) {
    col += ringGlow;
    col += transmittance * starfield(normalize(dir));
  }

  // Tonemapping exponentiel, gamma, vignette.
  col = vec3(1.0) - exp(-col * 1.5);
  col = pow(col, vec3(0.4545));
  col *= 1.0 - 0.3 * dot(uv, uv);

  gl_FragColor = vec4(col, 1.0);
}
