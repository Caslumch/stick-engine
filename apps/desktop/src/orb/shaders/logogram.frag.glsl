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

// fbm em 2D com rotação entre oitavas. A rotação evita o alinhamento em grade
// que denuncia noise procedural — aqui precisamos de wisps orgânicos de tinta.
float fbm2(vec2 p, float octaves) {
  float sum = 0.0;
  float amp = 0.5;
  float norm = 0.0;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int i = 0; i < 6; i++) {
    if (float(i) >= octaves) break;
    sum += amp * snoise(vec3(p, 0.0));
    norm += amp;
    p = rot * p * 2.02;
    amp *= 0.5;
  }
  return sum / max(norm, 0.001);
}

void main() {
  vec2 p = (vUv * 2.0 - 1.0) * uAspect;

  float breath = sin(uTime * 6.28318 / max(uBreathPeriod, 0.001)) * uBreathAmp;
  float boost = uVolume * uAudioReactivity;
  float t = uTime * (0.10 + uNoiseSpeed * 0.22);

  float a = atan(p.y, p.x);
  float r = length(p);

  float radius = uRadius * 0.46 + breath * 0.5 + boost * 0.05;

  // --- Espessura irregular ---
  // dir varia devagar demais em torno do círculo (|dir| = 1 sempre), então o
  // noise mal muda com o ângulo. Multiplicar o ângulo por um fator alto é o que
  // gera trechos finos e grossos alternando ao longo do anel.
  vec2 dir = vec2(cos(a * 3.0), sin(a * 3.0));
  vec2 dirSlow = vec2(cos(a), sin(a));

  float thickNoise = fbm2(dir * 1.7 + vec2(t * 0.6, t * 0.35), 4.0);

  // Adensamento: uma única região pesada do anel. smoothstep estreito garante
  // que só um trecho engrosse, como a mancha das referências.
  float clumpRaw = fbm2(dirSlow * 0.9 + vec2(t * 0.3, -t * 0.2), 2.0);
  float clump = smoothstep(0.12, 0.62, clumpRaw);

  // Base bem fina: nas referências o traço é delicado quase todo o tempo.
  float thickness = 0.010
    + thickNoise * 0.016
    + clump * (0.085 + boost * 0.06)
    + uNoiseAmp * 0.03;
  thickness = max(thickness, 0.0015);

  // O raio também ondula: o anel não é um círculo perfeito.
  float wob = fbm2(dir * 1.6 + vec2(-t * 0.4, t * 0.5), 3.0);
  float ringR = radius + wob * (0.020 + uNoiseAmp * 0.06);

  // Distância à linha do anel.
  float d = abs(r - ringR) - thickness;

  // --- Farpas / volutas ---
  // As farpas só existem na vizinhança do anel; longe dele a tinta some.
  // Alcance maior + expoente < 1 alongam os filamentos, em vez de deixá-los
  // como uma franja curta e uniforme colada no traço.
  float band = abs(r - ringR);
  float reach = 0.26 + clump * 0.16;
  float near = pow(1.0 - smoothstep(0.0, reach, band), 0.65);

  // PERFORMANCE: o domain warping abaixo custa 4 fbm por pixel e só tem efeito
  // dentro da faixa do anel. Pular esses pixels tira o custo da maior parte da
  // tela — sem isso a variante roda a poucos fps em GPU integrada.
  if (near > 0.001) {
    // Domain warping: puxa a tinta para fora e para dentro em filamentos, que é
    // o que dá o aspecto de líquido esguichado em vez de um traço de caneta.
    vec2 warp = vec2(
      fbm2(p * (2.4 + uNoiseFreq * 0.6) + vec2(t * 0.9, t * 0.4), 3.0),
      fbm2(p * (2.4 + uNoiseFreq * 0.6) + vec2(-t * 0.5, t * 1.1) + 7.3, 3.0)
    );
    float tendril = fbm2(p * (3.6 + uNoiseFreq) + warp * 1.9 + vec2(t * 0.7, -t * 0.6), 4.0);
    d -= max(0.0, tendril) * near * (0.11 + uEnergy * uAudioReactivity * 0.05);

    // Respingos finos: pontinhos soltos junto ao adensamento.
    float spatter = smoothstep(0.62, 0.98, fbm2(p * 26.0 + vec2(t * 2.0, 0.0), 2.0));
    d -= spatter * near * clump * 0.05;
  }

  // --- Composição ---
  // A tinta é escura sobre um fundo pálido, então trabalhamos em "densidade".
  float ink = 1.0 - smoothstep(-0.006, 0.012, d);

  // Halo difuso: a tinta se dissolvendo no meio. Alcance moderado — a suavidade
  // extra vem da bruma da atmosfera, não de esticar o stick.
  float bleed = 1.0 - smoothstep(-0.02, 0.07 + clump * 0.06, d);

  // --- Atmosfera ---
  // A câmara do filme é uma névoa fria e PROFUNDA, não um fundo de papel.
  // Duas camadas em escalas diferentes dão sensação de volume: a larga é o
  // gradiente da câmara, a fina são as correntes de bruma passando.
  float fogFar = fbm2(p * 0.85 + vec2(t * 0.14, -t * 0.10), 3.0) * 0.5 + 0.5;
  float fogNear = fbm2(p * 2.3 + vec2(-t * 0.22, t * 0.17) + 3.3, 3.0) * 0.5 + 0.5;

  // Azul-acinzentado frio. Faixa estreita entre claro e escuro: na cena a
  // câmara é um cinza uniforme, sem áreas brancas.
  vec3 fogLight = vec3(0.615, 0.660, 0.690);
  vec3 fogDark = vec3(0.430, 0.482, 0.520);

  // Sem o +0.15 de viés: ele somava às duas camadas de fog e saturava o centro
  // em branco, fazendo o miolo do anel parecer iluminado por dentro.
  float depth = clamp(fogFar * 0.5 + fogNear * 0.22 - p.y * 0.12, 0.0, 1.0);
  vec3 bg = mix(fogDark, fogLight, depth);

  // Vinhete suave. Forte demais cria um stick claro no centro, e o interior do
  // anel passa a parecer iluminado em vez de ser a mesma névoa do fundo.
  bg *= 1.0 - smoothstep(0.30, 1.4, length(p)) * 0.22;

  // Nas margens do plano a névoa converge para a cor de clear (#828e98, ver
  // OrbCanvas), então a emenda com o resto da tela some sem precisar deixar o
  // plano translúcido.
  vec2 qq = abs(vUv * 2.0 - 1.0);
  bg = mix(bg, vec3(0.510, 0.557, 0.596), smoothstep(0.55, 1.0, max(qq.x, qq.y)));

  // Tinta preta neutra. A cor do estado entra bem de leve — com peso alto o
  // preto vira azul-marinho e perde a leitura de nanquim.
  vec3 inkColor = mix(vec3(0.035, 0.035, 0.038), uPrimary * 0.22, 0.12);

  // Sombra interna: na cena o miolo do logograma é levemente MAIS ESCURO que a
  // câmara em volta — a névoa ali está por trás do anel. Sem isso o interior
  // lê como um vazio iluminado e a forma parece um adesivo recortado.
  float inside = 1.0 - smoothstep(ringR - 0.02, ringR + 0.10, r);
  vec3 field = bg * mix(1.0, 0.88, inside);

  vec3 color = mix(field, mix(field, inkColor, 0.55), clamp(bleed, 0.0, 1.0));
  color = mix(color, inkColor, clamp(ink, 0.0, 1.0));

  // Bruma NA FRENTE do anel: velar parte da tinta é o que cria profundidade —
  // sem isso o logograma parece colado por cima do fundo, e não dentro dele.
  float veil = smoothstep(0.55, 0.95, fogNear) * 0.30;
  color = mix(color, field, veil);

  // Grão: as referências são fotográficas/fílmicas.
  float grain = snoise(vec3(p * 380.0, floor(uTime * 24.0)));
  color += grain * 0.016;

  // uGlow clareia levemente a névoa nos estados mais "ativos", sem tocar a tinta.
  color *= mix(0.97, 1.04, clamp(uGlow * 0.5, 0.0, 1.0));

  // O plano é menor que a tela (ver JarvisOrb: quadrado em vez de viewport
  // inteira). Sem este fade a névoa termina numa borda reta visível contra o
  // clear color; aqui ela se dissolve nele.
  // O fade só pode agir na MARGEM do plano. Começando cedo (0.30) ele torna
  // translúcida a área do anel, e o clear color aparece por baixo — clareando
  // justamente o interior, onde a tinta é rala.
  vec2 q = abs(vUv * 2.0 - 1.0);
  float edgeFade = 1.0 - smoothstep(0.86, 1.0, max(q.x, q.y));

  gl_FragColor = vec4(clamp(color, 0.0, 1.0), uOpacity * edgeFade);
}
