import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Capability, CapabilityResult, Tool } from '../../../common/interfaces';
import { CapabilityRegistryService } from '../capability-registry.service';
import { SettingsService } from '../../settings/settings.service';

const SPOTIFY_API = 'https://api.spotify.com/v1';
const SPOTIFY_AUTH = 'https://accounts.spotify.com/api/token';

/**
 * Spotify integration using Client Credentials flow for search
 * and user's access token (from Settings) for playback control.
 *
 * Setup:
 * 1. Go to https://developer.spotify.com/dashboard
 * 2. Create an app (free, just needs a Spotify account)
 * 3. Copy Client ID and Client Secret to Settings > Integrations
 * 4. For playback control, user needs Spotify Premium + active device
 */

@Injectable()
export class SpotifyCapability implements Capability, OnModuleInit {
  private readonly logger = new Logger(SpotifyCapability.name);
  private clientToken: string | null = null;
  private clientTokenExpiry = 0;

  readonly name = 'spotify';
  readonly description = 'Controla musica: pesquisar, tocar, pausar, pular.';

  readonly tools: Tool[] = [
    {
      name: 'spotify_search',
      description:
        'Pesquisa musicas, artistas ou playlists no Spotify. Use quando o usuario pedir "toca algo", "procura musica X", etc.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Termo de busca (musica, artista, ou estilo)',
          },
          type: {
            type: 'string',
            description: 'Tipo: track, artist, playlist (padrao: track)',
          },
        },
        required: ['query'],
      },
    },
    {
      name: 'spotify_play',
      description:
        'Toca uma musica ou playlist no Spotify. Requer Spotify Premium e um dispositivo ativo.',
      parameters: {
        type: 'object',
        properties: {
          uri: {
            type: 'string',
            description: 'Spotify URI (ex: spotify:track:xxx). Se nao fornecido, resume a reproducao.',
          },
          query: {
            type: 'string',
            description: 'Se nao tem URI, pesquisa e toca o primeiro resultado.',
          },
        },
      },
    },
    {
      name: 'spotify_control',
      description:
        'Controla a reproducao: pausar, pular, voltar, volume.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            description: 'Acao: pause, next, previous, volume, shuffle, repeat',
          },
          value: {
            type: 'string',
            description: 'Valor (volume: 0-100, shuffle: true/false, repeat: track/context/off)',
          },
        },
        required: ['action'],
      },
    },
    {
      name: 'spotify_now_playing',
      description:
        'Mostra o que esta tocando agora no Spotify.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  ];

  constructor(
    private readonly registry: CapabilityRegistryService,
    private readonly settings: SettingsService,
  ) {}

  onModuleInit() {
    this.registry.register(this);
  }

  async execute(toolName: string, params: Record<string, unknown>): Promise<CapabilityResult> {
    switch (toolName) {
      case 'spotify_search':
        return this.search(params.query as string, (params.type as string) || 'track');
      case 'spotify_play':
        return this.play(params.uri as string | undefined, params.query as string | undefined);
      case 'spotify_control':
        return this.control(params.action as string, params.value as string | undefined);
      case 'spotify_now_playing':
        return this.nowPlaying();
      default:
        return { success: false, message: `Tool desconhecida: ${toolName}` };
    }
  }

  // ── Auth ────────────────────────────────────────────────────

  private async getClientToken(): Promise<string | null> {
    if (this.clientToken && Date.now() < this.clientTokenExpiry) {
      return this.clientToken;
    }

    const [clientId, clientSecret] = await Promise.all([
      this.settings.get('spotify.clientId'),
      this.settings.get('spotify.clientSecret'),
    ]);

    if (!clientId || !clientSecret) return null;

    try {
      const resp = await fetch(SPOTIFY_AUTH, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        },
        body: 'grant_type=client_credentials',
      });

      if (!resp.ok) return null;

      const data = await resp.json();
      this.clientToken = data.access_token;
      this.clientTokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
      return this.clientToken;
    } catch {
      return null;
    }
  }

  /**
   * Token de usuario, renovado quando expirado.
   *
   * O access_token do Spotify dura 1h. Sem renovar, os comandos de voz
   * ("toca X") parariam de funcionar uma hora depois do login.
   */
  private async getUserToken(): Promise<string | null> {
    const [token, expiresAt] = await Promise.all([
      this.settings.get('spotify.userAccessToken'),
      this.settings.get('spotify.tokenExpiresAt'),
    ]);
    if (!token) return null;

    const expired = !expiresAt || Date.now() > Number(expiresAt) - 60_000;
    if (!expired) return token;

    return (await this.refreshUserToken()) ?? null;
  }

  /** Troca o refresh_token por um access_token novo e persiste. */
  private async refreshUserToken(): Promise<string | null> {
    const [clientId, clientSecret, refreshToken] = await Promise.all([
      this.settings.get('spotify.clientId'),
      this.settings.get('spotify.clientSecret'),
      this.settings.get('spotify.refreshToken'),
    ]);
    if (!clientId || !clientSecret || !refreshToken) return null;

    try {
      const resp = await fetch(SPOTIFY_AUTH, {
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
      if (data.refresh_token) {
        await this.settings.set('spotify.refreshToken', data.refresh_token);
      }
      return data.access_token;
    } catch {
      return null;
    }
  }

  private async spotifyApi(
    method: string,
    path: string,
    body?: unknown,
    useUserToken = false,
  ): Promise<CapabilityResult> {
    const token = useUserToken
      ? await this.getUserToken()
      : await this.getClientToken();

    if (!token) {
      return {
        success: false,
        message: useUserToken
          ? 'Token de usuario Spotify nao configurado. Configure em Settings > Integrations.'
          : 'Client ID/Secret do Spotify nao configurados. Configure em Settings > Integrations.',
      };
    }

    try {
      const resp = await fetch(`${SPOTIFY_API}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (resp.status === 204) return { success: true, message: 'OK' };

      if (!resp.ok) {
        const err = await resp.text();
        return { success: false, message: `Spotify: ${resp.status} - ${err}` };
      }

      return { success: true, message: '', data: await resp.json() };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, message: `Erro Spotify: ${msg}` };
    }
  }

  // ── Operations ─────────────────────────────────────────────

  private async search(query: string, type: string): Promise<CapabilityResult> {
    const result = await this.spotifyApi(
      'GET',
      `/search?q=${encodeURIComponent(query)}&type=${type}&limit=5&market=BR`,
    );

    if (!result.success) return result;

    const data = result.data as any;
    const items = data.tracks?.items || data.artists?.items || data.playlists?.items || [];

    if (items.length === 0) {
      return { success: true, message: `Nenhum resultado para "${query}".` };
    }

    if (type === 'track') {
      const text = items.map((t: any) =>
        `- "${t.name}" — ${t.artists.map((a: any) => a.name).join(', ')} (${t.uri})`
      ).join('\n');
      return {
        success: true,
        message: `Resultados para "${query}":\n${text}`,
        data: items.map((t: any) => ({
          name: t.name,
          artist: t.artists.map((a: any) => a.name).join(', '),
          uri: t.uri,
        })),
      };
    }

    const text = items.map((i: any) => `- ${i.name} (${i.uri})`).join('\n');
    return { success: true, message: `Resultados:\n${text}`, data: items };
  }

  private async play(uri?: string, query?: string): Promise<CapabilityResult> {
    // If query provided, search first
    if (!uri && query) {
      const searchResult = await this.search(query, 'track');
      if (!searchResult.success) return searchResult;
      const tracks = searchResult.data as any[];
      if (!tracks || tracks.length === 0) {
        return { success: false, message: `Nenhuma musica encontrada para "${query}".` };
      }
      uri = tracks[0].uri;
    }

    // Mira o player embutido ("Jarvis") quando ele esta registrado; sem isso
    // o Spotify exige um dispositivo ja ativo e responde 404.
    const device = await this.findPlaybackDevice();
    const path = device ? `/me/player/play?device_id=${device.id}` : '/me/player/play';

    if (uri) {
      const result = await this.spotifyApi('PUT', path, { uris: [uri] }, true);
      if (!result.success) return result;
      return {
        success: true,
        message: device ? `Tocando agora em ${device.name}.` : 'Tocando agora.',
      };
    }

    // Resume playback
    const result = await this.spotifyApi('PUT', path, undefined, true);
    if (!result.success) return result;
    return { success: true, message: 'Reproducao retomada.' };
  }

  /**
   * Dispositivo onde tocar: o player embutido ("Jarvis") tem prioridade,
   * depois o que ja estiver ativo, depois qualquer um disponivel.
   */
  private async findPlaybackDevice(): Promise<{ id: string; name: string } | null> {
    const result = await this.spotifyApi('GET', '/me/player/devices', undefined, true);
    if (!result.success) return null;

    const devices: any[] = (result.data as any)?.devices ?? [];
    if (!devices.length) return null;

    const escolhido =
      devices.find((d) => d.name === 'Jarvis') ??
      devices.find((d) => d.is_active) ??
      devices[0];

    return escolhido ? { id: escolhido.id, name: escolhido.name } : null;
  }

  private async control(action: string, value?: string): Promise<CapabilityResult> {
    switch (action.toLowerCase()) {
      case 'pause':
        return this.spotifyApi('PUT', '/me/player/pause', undefined, true)
          .then((r) => r.success ? { ...r, message: 'Pausado.' } : r);
      case 'next':
        return this.spotifyApi('POST', '/me/player/next', undefined, true)
          .then((r) => r.success ? { ...r, message: 'Proxima musica.' } : r);
      case 'previous':
        return this.spotifyApi('POST', '/me/player/previous', undefined, true)
          .then((r) => r.success ? { ...r, message: 'Musica anterior.' } : r);
      case 'volume': {
        const vol = Math.min(100, Math.max(0, Number(value || 50)));
        return this.spotifyApi('PUT', `/me/player/volume?volume_percent=${vol}`, undefined, true)
          .then((r) => r.success ? { ...r, message: `Volume: ${vol}%` } : r);
      }
      case 'shuffle': {
        const on = value !== 'false';
        return this.spotifyApi('PUT', `/me/player/shuffle?state=${on}`, undefined, true)
          .then((r) => r.success ? { ...r, message: `Shuffle: ${on ? 'ligado' : 'desligado'}` } : r);
      }
      default:
        return { success: false, message: `Acao desconhecida: ${action}` };
    }
  }

  private async nowPlaying(): Promise<CapabilityResult> {
    const result = await this.spotifyApi('GET', '/me/player/currently-playing', undefined, true);
    if (!result.success) return result;

    const data = result.data as any;
    if (!data || !data.item) {
      return { success: true, message: 'Nada tocando no momento.' };
    }

    const track = data.item;
    return {
      success: true,
      message: `Tocando: "${track.name}" — ${track.artists.map((a: any) => a.name).join(', ')}`,
      data: {
        name: track.name,
        artist: track.artists.map((a: any) => a.name).join(', '),
        album: track.album?.name,
        uri: track.uri,
        isPlaying: data.is_playing,
      },
    };
  }
}
