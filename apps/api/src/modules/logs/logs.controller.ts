import { Body, Controller, Logger, Post } from '@nestjs/common';

/**
 * Ponte de logs do frontend para o terminal.
 *
 * No Tauri o console do WebView so aparece abrindo o DevTools. Este endpoint
 * deixa o front espelhar mensagens no mesmo terminal do `pnpm dev:tauri`,
 * onde ja saem os logs da API.
 */
@Controller('api/logs')
export class LogsController {
  private readonly logger = new Logger('UI');

  @Post()
  write(@Body() body: { scope?: string; message?: string; level?: string }) {
    const scope = (body?.scope ?? 'UI').slice(0, 32);
    const message = (body?.message ?? '').slice(0, 2000);
    if (!message) return { ok: false };

    const line = `[${scope}] ${message}`;
    if (body?.level === 'error') this.logger.error(line);
    else if (body?.level === 'warn') this.logger.warn(line);
    else this.logger.log(line);

    return { ok: true };
  }
}
