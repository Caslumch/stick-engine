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
  private readonly loggers = new Map<string, Logger>();

  private loggerFor(scope: string): Logger {
    let l = this.loggers.get(scope);
    if (!l) {
      l = new Logger(scope);
      this.loggers.set(scope, l);
    }
    return l;
  }

  @Post()
  write(@Body() body: { scope?: string; message?: string; level?: string }) {
    const scope = (body?.scope ?? 'UI').slice(0, 32);
    const message = (body?.message ?? '').slice(0, 2000);
    if (!message) return { ok: false };

    // Um Logger por scope: passar o contexto como 2o argumento de error()
    // seria interpretado como stack trace e sairia numa linha solta.
    const logger = this.loggerFor(scope);
    if (body?.level === 'error') logger.error(message);
    else if (body?.level === 'warn') logger.warn(message);
    else logger.log(message);

    return { ok: true };
  }
}
