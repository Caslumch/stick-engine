#include ./noise.glsl
#include ./displace.glsl

uniform float uPointSize;
uniform float uPixelRatio;

varying float vNoise;
varying float vDepth;

void main() {
  vec3 dir = normalize(position);

  float n;
  float r = orbDisplacement(dir, n);
  vNoise = n;

  vec3 displaced = dir * r;
  vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);

  // Pontos nas cristas do noise ficam maiores — dá relevo ao granulado.
  float sizeBoost = 1.0 + clamp(n, 0.0, 1.0) * 0.8 + uVolume * uAudioReactivity * 0.6;

  // Atenuação por perspectiva: pontos distantes encolhem.
  gl_PointSize = uPointSize * uPixelRatio * sizeBoost * (3.0 / -mvPosition.z);

  // Profundidade normalizada, usada no fragment para escurecer a face de trás.
  vDepth = clamp((displaced.z + 1.4) / 2.8, 0.0, 1.0);

  gl_Position = projectionMatrix * mvPosition;
}
