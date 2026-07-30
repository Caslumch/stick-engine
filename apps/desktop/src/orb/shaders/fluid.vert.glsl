varying vec2 vUv;

void main() {
  vUv = uv;
  // Billboard simples: um plano sempre de frente para a câmera. A silhueta é
  // recortada no fragment, então nada aqui deforma a borda do círculo.
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
