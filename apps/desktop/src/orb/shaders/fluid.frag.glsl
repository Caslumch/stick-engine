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

varying vec2 vUv;

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float dist = length(p);

  // A silhueta NÃO é deformada por noise — só respira e reage ao volume.
  // É isso que dá a borda perfeitamente lisa da referência.
  float breath = sin(uTime * 6.28318 / max(uBreathPeriod, 0.001)) * uBreathAmp;
  float radius = uRadius * 0.82 + breath + uVolume * uAudioReactivity * 0.1;

  // Máscara nítida: antialias de ~1.5px via derivada, sem blur na borda.
  // O clamp é uma salvaguarda: se o plano for renderizado inclinado, fwidth
  // dispara e a "borda" engorda até cobrir o quadrado inteiro em vez de
  // recortar o círculo.
  float edge = clamp(fwidth(dist) * 1.5, 0.0, 0.02);
  float mask = 1.0 - smoothstep(radius - edge, radius + edge, dist);
  if (mask <= 0.001) discard;

  // Coordenada "esférica": comprime o interior perto da borda, dando a
  // impressão de que o padrão está enrolado numa esfera e não colado num disco.
  float z = sqrt(max(0.0, radius * radius - dist * dist));
  // Normalizado: é a normal da superfície de uma esfera vista de frente. Como
  // z cai rápido perto da borda, o padrão amostrado aqui comprime no limbo —
  // é isso que faz as cores parecerem enroladas num volume, e não coladas.
  vec3 sphere = normalize(vec3(p, max(z, 0.0001)));

  // Escala bem menor que nas outras variantes: aqui queremos poucas manchas
  // largas atravessando a orb, não um mármore de detalhes finos.
  float scale = uNoiseFreq * 0.30;
  // uNoiseAmp é calibrado para deslocar vértices (0.05..0.4); como warp de
  // coordenada esses valores somem, então reescalamos para uma faixa útil.
  float warpStrength = 0.6 + uNoiseAmp * 3.0 + uVolume * uAudioReactivity * 0.5;

  // --- Domain warping em duas passagens ---
  // O truque do efeito de nuvem/tinta: em vez de amostrar o noise direto,
  // usa-se um noise para deslocar as coordenadas de outro, duas vezes.
  vec3 q = vec3(
    fbm(sphere * scale, uNoiseSpeed, uTime),
    fbm(sphere * scale + vec3(5.2, 1.3, 2.8), uNoiseSpeed, uTime),
    fbm(sphere * scale + vec3(1.7, 9.2, 4.1), uNoiseSpeed, uTime)
  );

  vec3 r = vec3(
    fbm(sphere * scale + warpStrength * q + vec3(1.7, 9.2, 0.0), uNoiseSpeed, uTime),
    fbm(sphere * scale + warpStrength * q + vec3(8.3, 2.8, 0.0), uNoiseSpeed, uTime),
    fbm(sphere * scale + warpStrength * q + vec3(3.1, 6.4, 0.0), uNoiseSpeed, uTime)
  );

  float pattern = fbm(sphere * scale + warpStrength * r, uNoiseSpeed, uTime);
  pattern = clamp(pattern * 0.5 + 0.5, 0.0, 1.0);

  // Gradiente vertical: azul no topo, branco embaixo — como na referência.
  // O pitch só INCLINA o eixo (nunca o inverte), senão a voz viraria a orb
  // de cabeça para baixo em vez de dar um leve movimento lateral.
  // O eixo é 3D e o produto escalar usa a normal da esfera (não só x/y). Isso
  // faz a faixa de cor ENVOLVER o volume: perto da borda ela comprime por causa
  // da curvatura, exatamente como numa esfera real. Usando apenas sphere.xy o
  // gradiente vira faixas retas e a orb lê como um disco chapado.
  vec3 axis = normalize(vec3((uPitch - 0.5) * 0.45, -1.0, 0.0));
  float lat = dot(normalize(sphere), axis);
  float vertical = clamp(lat * 0.85 + 0.48, 0.0, 1.0);

  // O gradiente vertical domina (azul no topo -> branco embaixo) e o noise
  // apenas ondula a fronteira. Com peso alto no pattern vira mármore uniforme.
  float blend = clamp(vertical + (pattern - 0.5) * 0.55, 0.0, 1.0);
  // Faixa larga o suficiente para a fronteira ser difusa (e não um horizonte
  // duro), mas estreita o bastante para topo e base lerem como cores próprias.
  blend = smoothstep(0.18, 0.82, blend);

  // As cores de estado são escuras (pensadas para blending aditivo). Aqui o
  // material é opaco, então derivamos os dois polos a partir do próprio matiz —
  // assim states.ts continua sendo a única fonte da cor. A saturação é feita
  // afastando do cinza, não multiplicando (que estouraria o canal mais forte).
  vec3 base = mix(uPrimary, uSecondary, 0.3);
  float lum = dot(base, vec3(0.2126, 0.7152, 0.0722));
  vec3 deep = clamp(mix(vec3(lum), base, 1.45) * 1.12, 0.0, 1.0);
  vec3 pale = mix(uPrimary, vec3(1.0), 0.94);

  vec3 color = mix(deep, pale, blend);
  float highlight = smoothstep(0.62, 1.0, blend + uEnergy * uAudioReactivity * 0.2);
  color = mix(color, vec3(1.0), highlight * 0.8);

  // --- Volume ---
  // n.z vai de 1 no centro a 0 na borda; é o que dá a leitura de esfera.
  vec3 n = normalize(sphere);

  // Luz vinda de cima e um pouco à frente, como na referência.
  vec3 lightDir = normalize(vec3(-0.25, 0.75, 0.62));
  float lambert = clamp(dot(n, lightDir) * 0.5 + 0.5, 0.0, 1.0);

  // Escurece progressivamente em direção à borda (limbo). Sem isso o círculo
  // fica com brilho uniforme e o olho o lê como um adesivo, não uma bola.
  float limb = pow(clamp(n.z, 0.0, 1.0), 0.42);

  float shade = mix(0.55, 1.06, lambert * 0.55 + limb * 0.5);

  // Aqui a cor já é quase branca; multiplicar por uGlow direto (1.25 em
  // "speaking") satura tudo e o bloom vaza para fora do círculo. Comprimimos
  // o glow numa faixa estreita em torno de 1.0 — ele modula, não amplifica.
  color *= shade * mix(0.88, 1.06, clamp(uGlow * 0.6, 0.0, 1.0));

  // Brilho especular suave no alto: o ponto de luz que denuncia uma superfície
  // curva. Largo e fraco, para parecer material fosco e não plástico.
  float spec = pow(clamp(dot(n, lightDir), 0.0, 1.0), 3.5);
  color += spec * 0.16 * mix(vec3(1.0), pale, 0.5);

  color = min(color, vec3(1.0));

  gl_FragColor = vec4(color, mask * uOpacity);
}
