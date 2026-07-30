import { registerAs } from '@nestjs/config';

export const jarvisConfig = registerAs('jarvis', () => ({
  ollama: {
    url: process.env.OLLAMA_URL ?? 'http://localhost:11434',
    model: process.env.OLLAMA_MODEL ?? 'qwen2.5',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY ?? '',
    model: process.env.OPENAI_MODEL ?? 'gpt-4o-mini',
  },
}));

export type JarvisConfig = ReturnType<typeof jarvisConfig>;
