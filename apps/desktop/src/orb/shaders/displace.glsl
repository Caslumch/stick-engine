// Deslocamento compartilhado entre a esfera sólida e o point cloud,
// para que os dois materiais tenham exatamente a mesma silhueta.
//
// Requer: snoise/fbm de noise.glsl.

uniform float uTime;
uniform float uNoiseAmp;
uniform float uNoiseFreq;
uniform float uNoiseSpeed;
uniform float uRadius;
uniform float uBreathAmp;
uniform float uBreathPeriod;
uniform float uAudioReactivity;
uniform float uVolume;   // 0..1 — amplitude RMS do áudio
uniform float uPitch;    // 0..1 — centroide espectral normalizado
uniform float uEnergy;   // 0..1 — energia de alta frequência

// Retorna o quanto a superfície se afasta do raio unitário, na direção da normal.
float orbDisplacement(vec3 dir, out float outNoise) {
  // Respiração: presente em todos os estados, nunca deixa a orb totalmente parada.
  float breath = sin(uTime * 6.28318 / max(uBreathPeriod, 0.001)) * uBreathAmp;

  // O pitch inclina o campo de noise, então vozes agudas e graves deformam
  // a esfera em direções diferentes em vez de só mudarem a intensidade.
  vec3 tilt = vec3(0.0, uPitch * 1.2 - 0.6, 0.0);

  float n = fbm(dir * uNoiseFreq + tilt, uNoiseSpeed, uTime);
  outNoise = n;

  // A energia (alta frequência) acelera as ondas sem aumentar o tamanho.
  float ripple = snoise(dir * uNoiseFreq * 2.7 + vec3(uTime * (0.4 + uEnergy * 1.8)));

  float amp = uNoiseAmp + uVolume * uAudioReactivity * 0.35;
  float disp = n * amp + ripple * uEnergy * uAudioReactivity * 0.06;

  // Volume também empurra o raio inteiro para fora — a orb "incha" ao falar.
  float grow = uVolume * uAudioReactivity * 0.18;

  return uRadius + breath + grow + disp;
}
