/**
 * Espelha um log no terminal da API.
 *
 * No Tauri o console do WebView só aparece abrindo o DevTools; mandar pro
 * backend faz a mensagem sair junto do `pnpm dev:tauri`.
 */
export function logUI(message: string, scope = 'UI') {
  console.log(`[${scope}]`, message)
  fetch('http://localhost:3000/api/logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scope, message }),
  }).catch(() => {})
}
