import { Controller, Get, Query, Res } from '@nestjs/common';
import { SettingsService } from '../../settings/settings.service';

/** Subconjunto do Response do Express que usamos (evita depender de @types/express). */
interface HttpResponse {
  redirect(url: string): void;
  send(body: string): void;
  status(code: number): HttpResponse;
}

/**
 * OAuth do Spotify (Authorization Code).
 *
 * O fluxo client_credentials autentica o APP e so permite busca.
 * Pra tocar musica e usar o Web Playback SDK e preciso um token de USUARIO:
 *
 *   1. navegador abre  GET /api/spotify/login
 *   2. usuario aprova no Spotify
 *   3. Spotify chama   GET /api/spotify/callback?code=...
 *   4. trocamos o code por access_token + refresh_token e salvamos nos settings
 *
 * O access_token dura 1h; o refresh_token e usado pra renovar sem novo login.
 */

const SPOTIFY_AUTHORIZE = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN = 'https://accounts.spotify.com/api/token';
const REDIRECT_URI = 'http://127.0.0.1:3000/api/spotify/callback';

// streaming: Web Playback SDK | *-playback-state: controlar e ler o player
const SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  // usados pra escolher algo quando nao ha nada pra retomar
  'user-read-recently-played',
  'user-library-read',
  'user-top-read',
  // suas playlists no modal do player
  'playlist-read-private',
  'playlist-read-collaborative',
  // artistas seguidos, na aba "Artistas" do modal
  'user-follow-read',
].join(' ');

@Controller('api/spotify')
export class SpotifyController {
  constructor(private readonly settings: SettingsService) {}

  /** Passo 1: redireciona pro consentimento do Spotify. */
  @Get('login')
  async login(@Res() res: HttpResponse) {
    const clientId = await this.settings.get('spotify.clientId');
    if (!clientId) {
      return res
        .status(400)
        .send(page('Configure o Client ID', 'Ajustes → Spotify → Client ID.'));
    }

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      redirect_uri: REDIRECT_URI,
      scope: SCOPES,
      show_dialog: 'true',
    });

    return res.redirect(`${SPOTIFY_AUTHORIZE}?${params}`);
  }

  /** Passo 3-4: troca o code por tokens e salva. */
  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('error') error: string,
    @Res() res: HttpResponse,
  ) {
    if (error) return res.send(page('Autorizacao negada', error));
    if (!code) return res.send(page('Faltou o code', 'Tente novamente pelo /api/spotify/login.'));

    const [clientId, clientSecret] = await Promise.all([
      this.settings.get('spotify.clientId'),
      this.settings.get('spotify.clientSecret'),
    ]);
    if (!clientId || !clientSecret) {
      return res.send(page('Credenciais ausentes', 'Configure Client ID e Secret nos Ajustes.'));
    }

    try {
      const resp = await fetch(SPOTIFY_TOKEN, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: REDIRECT_URI,
        }).toString(),
      });

      const data = await resp.json();
      if (!resp.ok || !data.access_token) {
        return res.send(page('Falha ao obter token', JSON.stringify(data).slice(0, 300)));
      }

      await this.settings.set('spotify.userAccessToken', data.access_token);
      if (data.refresh_token) {
        await this.settings.set('spotify.refreshToken', data.refresh_token);
      }
      await this.settings.set(
        'spotify.tokenExpiresAt',
        String(Date.now() + (data.expires_in ?? 3600) * 1000),
      );

      return res.send(page('Spotify conectado', 'Pode fechar esta aba e voltar pro Jarvis.'));
    } catch (e) {
      return res.send(page('Erro na troca de token', String(e).slice(0, 300)));
    }
  }

  /**
   * Token de acesso para o Web Playback SDK, renovado se necessario.
   *
   * O SDK roda no navegador e precisa do token REAL — por isso este endpoint
   * existe separado dos settings, que devolvem a chave mascarada.
   */
  @Get('token')
  async token() {
    const stored = await this.settings.get('spotify.userAccessToken');
    if (!stored) return { token: null, reason: 'not_connected' };

    // validToken renova com 60s de folga
    const token = await this.validToken();
    return token ? { token } : { token: null, reason: 'refresh_failed' };
  }

  /** Troca o refresh_token por um novo access_token. */
  private async refresh(): Promise<string | null> {
    const [clientId, clientSecret, refreshToken] = await Promise.all([
      this.settings.get('spotify.clientId'),
      this.settings.get('spotify.clientSecret'),
      this.settings.get('spotify.refreshToken'),
    ]);
    if (!clientId || !clientSecret || !refreshToken) return null;

    try {
      const resp = await fetch(SPOTIFY_TOKEN, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }).toString(),
      });

      const data = await resp.json();
      if (!resp.ok || !data.access_token) return null;

      await this.settings.set('spotify.userAccessToken', data.access_token);
      await this.settings.set(
        'spotify.tokenExpiresAt',
        String(Date.now() + (data.expires_in ?? 3600) * 1000),
      );
      // O Spotify as vezes devolve um refresh_token novo
      if (data.refresh_token) {
        await this.settings.set('spotify.refreshToken', data.refresh_token);
      }
      return data.access_token;
    } catch {
      return null;
    }
  }

  /**
   * Busca faixas/álbuns/playlists — usado pelo modal do player.
   * Existe separado da ferramenta de LLM porque o front precisa
   * dos resultados crus (capa, uri, duração) pra montar a lista.
   */
  @Get('search')
  async search(@Query('q') q: string, @Query('type') type = 'track') {
    if (!q?.trim()) return { items: [] };
    const token = await this.validToken();
    if (!token) return { items: [], error: 'not_connected' };

    const tipo = ['track', 'album', 'playlist', 'artist'].includes(type) ? type : 'track';
    try {
      const r = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=${tipo}&limit=10&market=BR`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!r.ok) {
        const detalhe = await r.text().catch(() => '');
        return { items: [], error: `spotify_${r.status}`, detail: detalhe.slice(0, 300) };
      }
      const d = await r.json();

      const bruto = d[`${tipo}s`]?.items ?? [];
      const items = bruto.filter(Boolean).map((it: any) => ({
        uri: it.uri,
        name: it.name,
        subtitle:
          tipo === 'track' || tipo === 'album'
            ? (it.artists ?? []).map((a: any) => a.name).join(', ')
            : tipo === 'playlist'
              ? (it.owner?.display_name ?? '')
              : '',
        image:
          it.album?.images?.[it.album.images.length - 1]?.url ??
          it.images?.[it.images.length - 1]?.url ??
          null,
        durationMs: it.duration_ms ?? null,
      }));
      return { items };
    } catch {
      return { items: [], error: 'request_failed' };
    }
  }

  /**
   * Conteudo inicial do modal: suas playlists e o que voce ouviu por ultimo.
   * Evita abrir a tela vazia esperando o usuario digitar.
   */
  @Get('library')
  async library() {
    const token = await this.validToken();
    if (!token) return { playlists: [], recent: [], error: 'not_connected' };
    const headers = { Authorization: `Bearer ${token}` };

    const pegar = async (path: string, mapear: (j: any) => any[]) => {
      try {
        const r = await fetch(`https://api.spotify.com/v1/${path}`, { headers });
        if (!r.ok) return [];
        return mapear(await r.json()).filter(Boolean);
      } catch {
        return [];
      }
    };

    const [playlists, recent, albums, artists] = await Promise.all([
      pegar('me/playlists?limit=20', (j) =>
        (j.items ?? []).map((p: any) => ({
          uri: p.uri,
          name: p.name,
          subtitle: `${p.tracks?.total ?? 0} faixas`,
          image: p.images?.[p.images.length - 1]?.url ?? null,
          durationMs: null,
        })),
      ),
      pegar('me/player/recently-played?limit=20', (j) => {
        const vistos = new Set<string>();
        return (j.items ?? [])
          .map((i: any) => i.track)
          .filter((t: any) => {
            if (!t?.uri || vistos.has(t.uri)) return false;
            vistos.add(t.uri);
            return true;
          })
          .map((t: any) => ({
            uri: t.uri,
            name: t.name,
            subtitle: (t.artists ?? []).map((a: any) => a.name).join(', '),
            image: t.album?.images?.[t.album.images.length - 1]?.url ?? null,
            durationMs: t.duration_ms ?? null,
          }));
      }),
      pegar('me/albums?limit=20', (j) =>
        (j.items ?? []).map((i: any) => {
          const a = i.album;
          if (!a) return null;
          return {
            uri: a.uri,
            name: a.name,
            subtitle: (a.artists ?? []).map((x: any) => x.name).join(', '),
            image: a.images?.[a.images.length - 1]?.url ?? null,
            durationMs: null,
          };
        }),
      ),
      pegar('me/following?type=artist&limit=20', (j) =>
        (j.artists?.items ?? []).map((a: any) => ({
          uri: a.uri,
          name: a.name,
          subtitle: a.genres?.[0] ?? 'Artista',
          image: a.images?.[a.images.length - 1]?.url ?? null,
          durationMs: null,
        })),
      ),
    ]);

    return { playlists, recent, albums, artists };
  }

  /** Token valido (renovando se preciso) — uso interno dos endpoints. */
  private async validToken(): Promise<string | null> {
    const [token, expiresAt] = await Promise.all([
      this.settings.get('spotify.userAccessToken'),
      this.settings.get('spotify.tokenExpiresAt'),
    ]);
    if (!token) return null;
    const expired = !expiresAt || Date.now() > Number(expiresAt) - 60_000;
    return expired ? await this.refresh() : token;
  }

  /** Estado da conexao — o frontend usa pra mostrar conectado/desconectado. */
  @Get('status')
  async status() {
    const [token, expiresAt, clientId] = await Promise.all([
      this.settings.get('spotify.userAccessToken'),
      this.settings.get('spotify.tokenExpiresAt'),
      this.settings.get('spotify.clientId'),
    ]);
    return {
      configured: !!clientId,
      connected: !!token,
      expiresAt: expiresAt ? Number(expiresAt) : null,
    };
  }
}

/** Pagina minima devolvida no navegador ao fim do fluxo. */
function page(title: string, detail: string): string {
  const esc = (s: string) =>
    s.replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
    );
  return `<!doctype html><meta charset="utf-8">
<title>${esc(title)}</title>
<div style="font:15px/1.6 system-ui;padding:48px;max-width:520px;margin:auto;color:#e6e6e6;background:#111;min-height:100vh">
  <h2 style="margin:0 0 8px">${esc(title)}</h2>
  <p style="color:#9a9a9a;margin:0">${esc(detail)}</p>
</div>`;
}
