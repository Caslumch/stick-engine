#include ./noise.glsl
#include ./displace.glsl

varying vec3 vNormal;
varying vec3 vViewDir;
varying float vNoise;

void main() {
  vec3 dir = normalize(position);

  float n;
  float r = orbDisplacement(dir, n);
  vNoise = n;

  vec3 displaced = dir * r;

  // Normal recalculada por diferenças finitas: sem isso o glow fresnel
  // ignora as ondulações e a esfera parece lisa mesmo deformada.
  vec3 up = mix(vec3(0.0, 1.0, 0.0), vec3(1.0, 0.0, 0.0), step(0.99, abs(dir.y)));
  vec3 tangent = normalize(cross(dir, up));
  vec3 bitangent = normalize(cross(dir, tangent));
  float eps = 0.035;

  float nA, nB;
  vec3 pA = normalize(dir + tangent * eps);
  vec3 pB = normalize(dir + bitangent * eps);
  vec3 dA = pA * orbDisplacement(pA, nA);
  vec3 dB = pB * orbDisplacement(pB, nB);

  vec3 normal = normalize(cross(dA - displaced, dB - displaced));
  // cross() acima aponta para dentro em metade da esfera; realinha com a direção radial.
  normal *= sign(dot(normal, dir));

  vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vViewDir = normalize(-mvPosition.xyz);

  gl_Position = projectionMatrix * mvPosition;
}
