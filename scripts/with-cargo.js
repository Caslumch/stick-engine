#!/usr/bin/env node
/**
 * Roda um comando (normalmente `tauri dev`) garantindo que o cargo esteja no PATH.
 *
 * Terminais abertos ANTES da instalacao do Rust nao herdam o PATH do usuario,
 * e o Tauri falha com "failed to run 'cargo metadata': program not found".
 * Isso evita ter que reiniciar o terminal/editor so pra rodar o app.
 */
const { spawn } = require('child_process');
const { existsSync } = require('fs');
const { join, delimiter } = require('path');
const os = require('os');

const candidates = [
  join(os.homedir(), '.cargo', 'bin'),
  process.env.CARGO_HOME ? join(process.env.CARGO_HOME, 'bin') : null,
].filter(Boolean);

const env = { ...process.env };
const isWin = process.platform === 'win32';
const exe = isWin ? 'cargo.exe' : 'cargo';

// Chave do PATH varia de caixa no Windows (Path vs PATH)
const pathKey = Object.keys(env).find((k) => k.toUpperCase() === 'PATH') || 'PATH';
const current = (env[pathKey] || '').split(delimiter);

for (const dir of candidates) {
  if (existsSync(join(dir, exe)) && !current.includes(dir)) {
    env[pathKey] = dir + delimiter + env[pathKey];
  }
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('uso: node scripts/with-cargo.js <comando> [args...]');
  process.exit(1);
}

// shell: true resolve os .cmd/.ps1 do npm no Windows
const child = spawn(args[0], args.slice(1), { stdio: 'inherit', env, shell: true });
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
child.on('error', (err) => {
  console.error(`falha ao rodar "${args.join(' ')}":`, err.message);
  process.exit(1);
});
