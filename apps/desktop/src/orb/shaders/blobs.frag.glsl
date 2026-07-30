#include ./noise.glsl

uniform float uTime;
uniform float uNoiseAmp;
uniform float uNoiseFreq;
uniform float uNoiseSpeed;
uniform float uRadius;
uniform float uBreathAmp;
uniform float uBreathPeriod;
uniform float uAudioReactivity;
uniform float uVolume;
uniform float uPitch;
uniform float uEnergy;
uniform float uGlow;
uniform float uOpacity;
uniform vec3 uPrimary;
uniform vec3 uSecondary;
uniform vec2 uAspect;

varying vec2 vUv;

// Smooth minimum: funde dois campos de distância sem criar quina na junção.
// É o que faz os blobs "derreterem" um no outro em vez de só se sobreporem.
float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

void main() {
  // uAspect corrige o esticamento: o plano cobre a viewport inteira, então sem
  // isso os blobs viram elipses numa tela widescreen.
  vec2 p = (vUv * 2.0 - 1.0) * uAspect;

  float breath = sin(uTime * 6.28318 / max(uBreathPeriod, 0.001)) * uBreathAmp;
  float boost = uVolume * uAudioReactivity;
  float t = uTime * (0.18 + uNoiseSpeed * 0.4);

  // Três blobs em órbitas de raios e fases diferentes, para o agrupamento
  // nunca se repetir exatamente.
  // Centros bem separados: na referência os três núcleos são distinguíveis,
  // ligados apenas pelo stick. Órbitas pequenas em torno de posições fixas.
  vec2 c1 = vec2(cos(t * 0.9) * 0.045, sin(t * 0.7) * 0.040) + vec2(-0.26, 0.10);
  vec2 c2 = vec2(cos(t * 0.6 + 2.1) * 0.038, sin(t * 1.1 + 1.4) * 0.044) + vec2(0.28, 0.03);
  vec2 c3 = vec2(cos(t * 1.3 + 4.2) * 0.042, sin(t * 0.8 + 3.3) * 0.036) + vec2(0.02, -0.28);

  float base = uRadius * 0.20 + breath * 0.5 + boost * 0.04;
  float r1 = base * 1.25;
  float r2 = base * 0.70;
  float r3 = base * 0.92;

  // k pequeno: funde só onde os blobs quase se tocam, preservando os núcleos
  // separados. Com k grande os três viram uma mancha só.
  float d = length(p - c1) - r1;
  d = smin(d, length(p - c2) - r2, 0.055);
  d = smin(d, length(p - c3) - r3, 0.055);

  // O noise ondula a fronteira para os blobs não parecerem círculos perfeitos.
  float wobble = fbm(vec3(p * uNoiseFreq * 1.4, uTime * 0.25), uNoiseSpeed, uTime);
  d += wobble * (0.03 + uNoiseAmp * 0.12);

  // --- Falloff difuso ---
  // "core" é o miolo quase preto; "stick" é a névoa larga ao redor. São duas
  // rampas separadas porque a referência tem uma queda muito longa e suave
  // que um único smoothstep não reproduz.
  float core = 1.0 - smoothstep(-0.10, 0.06, d);
  float stick = 1.0 - smoothstep(-0.05, 0.52, d);

  float density = clamp(core * 0.85 + stick * 0.55, 0.0, 1.0);

  // Fundo claro, blobs escuros: a cor é subtraída do branco.
  vec3 bg = vec3(0.94, 0.95, 0.96);

  // Núcleo bem escuro com matiz do estado; o stick é uma versão dessaturada.
  vec3 deep = uPrimary * 0.16;
  vec3 mist = mix(bg, mix(uPrimary, uSecondary, 0.5) * 0.75, 0.55);

  vec3 color = mix(bg, mist, clamp(stick * 0.9, 0.0, 1.0));
  color = mix(color, deep, clamp(core * 0.95, 0.0, 1.0));

  // Franja ciano no limite do núcleo — o realce claro da referência, onde a
  // borda do blob pega luz antes de cair para o preto.
  float rim = smoothstep(0.02, -0.01, d) - smoothstep(-0.01, -0.06, d);
  color += vec3(0.20, 0.62, 0.78) * rim * (0.55 + uEnergy * uAudioReactivity * 0.5) * uGlow;

  // Grão fotográfico: a referência tem ruído visível, sobretudo nos meios-tons.
  float grain = snoise(vec3(p * 420.0, floor(uTime * 24.0)));
  color += grain * 0.022 * (0.35 + density);

  // O plano é menor que a tela (ver JarvisOrb: quadrado em vez de viewport
  // inteira). Sem este fade a borda do plano fica visível contra o clear color.
  vec2 q = abs(vUv * 2.0 - 1.0);
  float edgeFade = 1.0 - smoothstep(0.72, 1.0, max(q.x, q.y));

  gl_FragColor = vec4(color, uOpacity * edgeFade);
}
