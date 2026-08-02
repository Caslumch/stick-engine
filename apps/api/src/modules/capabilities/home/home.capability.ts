import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as crypto from 'crypto';
import type { Capability, CapabilityResult, Tool } from '../../../common/interfaces';
import { CapabilityRegistryService } from '../capability-registry.service';
import { SettingsService } from '../../settings/settings.service';

/**
 * Tuya Cloud API integration for smart home devices.
 * Works with Positivo Smart Home, Smart Life, and other Tuya-based brands.
 *
 * Setup:
 * 1. Create account at https://platform.tuya.com
 * 2. Create a Cloud project (Industry: Smart Home)
 * 3. Link your Positivo/Smart Life account
 * 4. Get Access ID and Access Secret
 */

const TUYA_REGIONS: Record<string, string> = {
  us: 'https://openapi.tuyaus.com',
  eu: 'https://openapi.tuyaeu.com',
  cn: 'https://openapi.tuyacn.com',
  in: 'https://openapi.tuyain.com',
};

@Injectable()
export class HomeCapability implements Capability, OnModuleInit {
  private readonly logger = new Logger(HomeCapability.name);
  private accessToken: string | null = null;
  private tokenExpiry = 0;

  readonly name = 'home';
  readonly description = 'Controla dispositivos inteligentes da casa: luzes, tomadas, cenas.';

  readonly tools: Tool[] = [
    {
      name: 'home_list_devices',
      description:
        'Lista todos os dispositivos inteligentes da casa. Use pra saber quais dispositivos estao disponiveis.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'home_control',
      description:
        'Controla um dispositivo: ligar, desligar, mudar cor ou brilho. Use quando o usuario pedir "acende a luz", "apaga", "muda a cor pra azul", etc.',
      parameters: {
        type: 'object',
        properties: {
          device_name: {
            type: 'string',
            description: 'Nome do dispositivo (ou parte dele)',
          },
          action: {
            type: 'string',
            description: 'Acao: on, off, brightness, color, toggle',
          },
          value: {
            type: 'string',
            description: 'Valor (brilho: 10-100, cor: red/blue/green/warm/cool, ou hex)',
          },
        },
        required: ['device_name', 'action'],
      },
    },
    {
      name: 'home_scene',
      description:
        'Executa uma cena/automacao. Use quando o usuario pedir "ativa cena X", "modo filme", etc.',
      parameters: {
        type: 'object',
        properties: {
          scene_name: {
            type: 'string',
            description: 'Nome da cena (ou parte dele)',
          },
        },
        required: ['scene_name'],
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
      case 'home_list_devices':
        return this.listDevices();
      case 'home_control':
        return this.controlDevice(
          params.device_name as string,
          params.action as string,
          params.value as string | undefined,
        );
      case 'home_scene':
        return this.triggerScene(params.scene_name as string);
      default:
        return { success: false, message: `Tool desconhecida: ${toolName}` };
    }
  }

  // ── Tuya Auth ───────────────────────────────────────────────

  private async getConfig() {
    const [accessId, accessSecret, region, uid] = await Promise.all([
      this.settings.get('home.tuyaAccessId'),
      this.settings.get('home.tuyaAccessSecret'),
      this.settings.get('home.tuyaRegion'),
      this.settings.get('home.tuyaUid'),
    ]);
    return { accessId, accessSecret, region: region || 'us', uid };
  }

  private async authenticate(): Promise<string | null> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const { accessId, accessSecret, region } = await this.getConfig();
    if (!accessId || !accessSecret) return null;

    const baseUrl = TUYA_REGIONS[region] || TUYA_REGIONS.us;
    const timestamp = Date.now().toString();
    const signStr = accessId + timestamp;
    const sign = crypto
      .createHmac('sha256', accessSecret)
      .update(signStr)
      .digest('hex')
      .toUpperCase();

    try {
      const resp = await fetch(`${baseUrl}/v1.0/token?grant_type=1`, {
        headers: {
          client_id: accessId,
          sign,
          t: timestamp,
          sign_method: 'HMAC-SHA256',
        },
      });

      const data = await resp.json();
      if (!data.success) {
        this.logger.error(`Tuya auth failed: ${data.msg}`);
        return null;
      }

      this.accessToken = data.result.access_token;
      this.tokenExpiry = Date.now() + (data.result.expire_time * 1000) - 60000;
      return this.accessToken;
    } catch (error) {
      this.logger.error(`Tuya auth error: ${error}`);
      return null;
    }
  }

  private async tuyaApi(method: string, path: string, body?: unknown): Promise<CapabilityResult> {
    const token = await this.authenticate();
    if (!token) {
      return {
        success: false,
        message: 'Nao foi possivel autenticar na Tuya. Configure Access ID e Secret em Settings > Integrations.',
      };
    }

    const { accessId, accessSecret, region } = await this.getConfig();
    const baseUrl = TUYA_REGIONS[region] || TUYA_REGIONS.us;
    const timestamp = Date.now().toString();

    const bodyStr = body ? JSON.stringify(body) : '';
    const contentHash = crypto.createHash('sha256').update(bodyStr).digest('hex');
    const signStr = [accessId, token, timestamp, method, contentHash, '', path].join('\n');
    // Simplified sign — Tuya's full sign is more complex but this works for basic calls
    const stringToSign = accessId + token + timestamp + method + '\n' + contentHash + '\n\n' + path;
    const sign = crypto
      .createHmac('sha256', accessSecret)
      .update(stringToSign)
      .digest('hex')
      .toUpperCase();

    try {
      const resp = await fetch(`${baseUrl}${path}`, {
        method,
        headers: {
          client_id: accessId,
          access_token: token,
          sign,
          t: timestamp,
          sign_method: 'HMAC-SHA256',
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = await resp.json();
      if (!data.success) {
        return { success: false, message: `Tuya: ${data.msg || 'erro desconhecido'}` };
      }

      return { success: true, message: '', data: data.result };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, message: `Erro Tuya: ${msg}` };
    }
  }

  // ── Device Operations ──────────────────────────────────────

  private async listDevices(): Promise<CapabilityResult> {
    const { uid } = await this.getConfig();
    if (!uid) {
      return { success: false, message: 'UID Tuya nao configurado. Configure em Settings > Integrations.' };
    }

    const result = await this.tuyaApi('GET', `/v1.0/users/${uid}/devices`);
    if (!result.success) return result;

    const devices = (result.data as any[]) || [];
    const list = devices.map((d) => ({
      id: d.id,
      name: d.name,
      category: d.category,
      online: d.online,
    }));

    const text = list.map((d) =>
      `- ${d.name} (${d.category}) — ${d.online ? '🟢 online' : '⚪ offline'}`
    ).join('\n');

    return {
      success: true,
      message: list.length > 0 ? `${list.length} dispositivo(s):\n${text}` : 'Nenhum dispositivo encontrado.',
      data: list,
    };
  }

  private async controlDevice(deviceName: string, action: string, value?: string): Promise<CapabilityResult> {
    // First, find the device
    const { uid } = await this.getConfig();
    if (!uid) {
      return { success: false, message: 'UID Tuya nao configurado.' };
    }

    const devResult = await this.tuyaApi('GET', `/v1.0/users/${uid}/devices`);
    if (!devResult.success) return devResult;

    const devices = (devResult.data as any[]) || [];
    const device = devices.find((d) =>
      d.name.toLowerCase().includes(deviceName.toLowerCase()),
    );

    if (!device) {
      const names = devices.map((d: any) => d.name).join(', ');
      return {
        success: false,
        message: `Dispositivo "${deviceName}" nao encontrado. Disponiveis: ${names}`,
      };
    }

    // Build commands based on action
    const commands = this.buildCommands(action, value);

    const result = await this.tuyaApi('POST', `/v1.0/devices/${device.id}/commands`, { commands });
    if (!result.success) return result;

    return {
      success: true,
      message: `${device.name}: ${action}${value ? ` (${value})` : ''} — feito.`,
    };
  }

  private buildCommands(action: string, value?: string): Array<{ code: string; value: unknown }> {
    switch (action.toLowerCase()) {
      case 'on':
        return [{ code: 'switch_led', value: true }];
      case 'off':
        return [{ code: 'switch_led', value: false }];
      case 'toggle':
        return [{ code: 'switch_led', value: true }]; // Tuya doesn't support toggle natively
      case 'brightness':
        const bri = Math.min(1000, Math.max(10, Math.round(Number(value || 100) * 10)));
        return [{ code: 'bright_value_v2', value: bri }];
      case 'color': {
        const colors: Record<string, { h: number; s: number; v: number }> = {
          red: { h: 0, s: 1000, v: 1000 },
          green: { h: 120, s: 1000, v: 1000 },
          blue: { h: 240, s: 1000, v: 1000 },
          warm: { h: 30, s: 500, v: 1000 },
          cool: { h: 200, s: 300, v: 1000 },
          purple: { h: 280, s: 1000, v: 1000 },
          yellow: { h: 60, s: 1000, v: 1000 },
          white: { h: 0, s: 0, v: 1000 },
        };
        const c = colors[(value || '').toLowerCase()] || colors.warm;
        return [
          { code: 'work_mode', value: 'colour' },
          { code: 'colour_data_v2', value: c },
        ];
      }
      default:
        return [{ code: 'switch_led', value: true }];
    }
  }

  private async triggerScene(sceneName: string): Promise<CapabilityResult> {
    const { uid } = await this.getConfig();
    if (!uid) {
      return { success: false, message: 'UID Tuya nao configurado.' };
    }

    // List home scenes
    // First get home ID
    const homesResult = await this.tuyaApi('GET', `/v1.0/users/${uid}/homes`);
    if (!homesResult.success) return homesResult;

    const homes = (homesResult.data as any[]) || [];
    if (homes.length === 0) {
      return { success: false, message: 'Nenhuma casa encontrada na Tuya.' };
    }

    const homeId = homes[0].home_id;
    const scenesResult = await this.tuyaApi('GET', `/v1.0/homes/${homeId}/scenes`);
    if (!scenesResult.success) return scenesResult;

    const scenes = (scenesResult.data as any[]) || [];
    const scene = scenes.find((s: any) =>
      s.name.toLowerCase().includes(sceneName.toLowerCase()),
    );

    if (!scene) {
      const names = scenes.map((s: any) => s.name).join(', ');
      return {
        success: false,
        message: `Cena "${sceneName}" nao encontrada. Disponiveis: ${names || 'nenhuma'}`,
      };
    }

    const result = await this.tuyaApi('POST', `/v1.0/homes/${homeId}/scenes/${scene.scene_id}/trigger`);
    if (!result.success) return result;

    return { success: true, message: `Cena "${scene.name}" ativada.` };
  }
}
