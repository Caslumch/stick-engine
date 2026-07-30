uniform vec3 uPrimary;
uniform vec3 uSecondary;
uniform float uGlow;
uniform float uOpacity;

varying float vNoise;
varying float vDepth;

void main() {
  // Cada ponto é um disco com falloff suave — sem isso vira um quadrado.
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  if (d > 0.5) discard;

  float falloff = 1.0 - smoothstep(0.0, 0.5, d);
  falloff = pow(falloff, 2.0);

  float mixFactor = clamp(vNoise * 0.5 + 0.5, 0.0, 1.0);
  vec3 color = mix(uSecondary, uPrimary, mixFactor) * uGlow;

  // Face de trás mais apagada: dá volume sem depth-test (o material é aditivo).
  float depthFade = mix(0.25, 1.0, vDepth);

  gl_FragColor = vec4(color * depthFade, falloff * depthFade * uOpacity);
}
