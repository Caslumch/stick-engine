uniform vec3 uPrimary;
uniform vec3 uSecondary;
uniform float uGlow;
uniform float uOpacity;

varying vec3 vNormal;
varying vec3 vViewDir;
varying float vNoise;

void main() {
  vec3 normal = normalize(vNormal);
  vec3 view = normalize(vViewDir);

  // Fresnel: borda acesa, centro escuro — é o que dá a leitura de "esfera de energia".
  float fresnel = pow(1.0 - clamp(dot(normal, view), 0.0, 1.0), 2.6);

  // O noise mistura as duas cores, criando as veias luminosas.
  float mixFactor = clamp(vNoise * 0.5 + 0.5, 0.0, 1.0);
  vec3 base = mix(uSecondary, uPrimary, mixFactor);

  // O mesh é sólido e ocupa muito mais pixels que o point cloud, então o mesmo
  // uGlow satura tudo em branco no bloom. Escala reduzida compensa.
  vec3 color = base * (0.06 + fresnel * 0.85) * uGlow;

  // Núcleo levemente aceso para a orb não ficar oca no meio.
  color += uPrimary * 0.05 * uGlow;

  float alpha = clamp(0.35 + fresnel * 0.9, 0.0, 1.0) * uOpacity;
  gl_FragColor = vec4(color, alpha);
}
