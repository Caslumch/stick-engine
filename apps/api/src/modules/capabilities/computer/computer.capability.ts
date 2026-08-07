import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { Capability, CapabilityResult, Tool } from '../../../common/interfaces';
import { CapabilityRegistryService } from '../capability-registry.service';

const execAsync = promisify(exec);

// Blocklist: apps perigosos que NUNCA devem ser abertos por comando de voz
const APP_BLOCKLIST = [
  'format', 'diskpart', 'regedit', 'taskkill', 'shutdown', 'restart',
  'del', 'rmdir', 'rd', 'fdisk', 'cipher',
];

/** Mapeia nomes amigáveis para comandos reais no Windows */
const WIN_APP_MAP: Record<string, string> = {
  // Navegadores
  chrome: 'start chrome',
  'google chrome': 'start chrome',
  firefox: 'start firefox',
  edge: 'start msedge',
  brave: 'start brave',
  // Dev
  code: 'code',
  'visual studio code': 'code',
  'vs code': 'code',
  // Sistema
  notepad: 'notepad',
  'bloco de notas': 'notepad',
  calculator: 'calc',
  calc: 'calc',
  calculadora: 'calc',
  explorer: 'explorer',
  'gerenciador de arquivos': 'explorer',
  cmd: 'start cmd',
  powershell: 'start powershell',
  wt: 'start wt',
  terminal: 'start wt',
  // Apps
  spotify: 'start spotify',
  discord: 'start discord',
  slack: 'start slack',
  teams: 'start msteams',
  steam: 'start steam',
  telegram: 'start telegram',
  whatsapp: 'start whatsapp',
  // Office
  word: 'start winword',
  excel: 'start excel',
  powerpoint: 'start powerpnt',
  // URLs — abre no navegador padrão
  youtube: 'start https://youtube.com',
  google: 'start https://google.com',
};

// Blocked patterns for run_command
const BLOCKED_PATTERNS = [
  /rm\s+(-rf?|--recursive)\s+[\/\\]/i,
  /del\s+\/s/i,
  /format\s+[a-z]:/i,
  /mkfs/i,
  /dd\s+if=/i,
  /shutdown/i,
  /reboot/i,
  /:\(\)\{.*\}/,  // fork bomb
  />\s*\/dev\/sd/i,
  /reg\s+delete/i,
];

@Injectable()
export class ComputerCapability implements Capability, OnModuleInit {
  private readonly logger = new Logger(ComputerCapability.name);

  readonly name = 'computer';
  readonly description = 'Controla o computador do usuario: abrir programas, executar comandos e gerenciar arquivos.';

  readonly tools: Tool[] = [
    {
      name: 'open_application',
      description: 'Abre qualquer aplicativo instalado no computador do usuario. Passe o nome do programa (ex: "chrome", "spotify", "steam", "photoshop"). NAO use esta tool para pesquisar na internet.',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Nome do aplicativo para abrir (ex: code, chrome, notepad)',
          },
          path: {
            type: 'string',
            description: 'Caminho do arquivo ou pasta para abrir com o aplicativo (opcional, ex: Documents/projects/meu-projeto)',
          },
        },
        required: ['name'],
      },
    },
    {
      name: 'run_command',
      description: 'Executa um comando no terminal do computador. Use para tarefas como listar arquivos, verificar processos, instalar pacotes, etc.',
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'Comando para executar no terminal',
          },
          cwd: {
            type: 'string',
            description: 'Diretorio de trabalho (opcional, padrao: home do usuario)',
          },
        },
        required: ['command'],
      },
    },
    {
      name: 'manage_files',
      description: 'Gerencia arquivos e pastas: criar, mover, copiar, listar, ler ou deletar.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            description: 'Acao a realizar',
            enum: ['create_dir', 'list', 'read', 'write', 'delete', 'move', 'copy'],
          },
          path: {
            type: 'string',
            description: 'Caminho do arquivo ou pasta',
          },
          content: {
            type: 'string',
            description: 'Conteudo para escrever (apenas para action=write)',
          },
          destination: {
            type: 'string',
            description: 'Destino (apenas para action=move ou copy)',
          },
        },
        required: ['action', 'path'],
      },
    },
  ];

  constructor(private readonly registry: CapabilityRegistryService) {}

  onModuleInit() {
    this.registry.register(this);
  }

  async execute(toolName: string, params: Record<string, unknown>): Promise<CapabilityResult> {
    switch (toolName) {
      case 'open_application': {
        // LLMs sometimes use alternate param names or send empty args
        let name = (params.name ?? params.application ?? params.app_name ?? params.app) as string;

        // Fallback 1: qualquer valor string nos params
        if (!name) {
          const strValues = Object.values(params).filter((v) => typeof v === 'string' && v.trim()) as string[];
          if (strValues.length > 0) name = strValues[0];
        }

        // Fallback 2: procurar nome de app da whitelist em qualquer campo (incluindo query, text, etc.)
        if (!name) {
          const allText = Object.values(params).join(' ').toLowerCase();
          const found = Object.keys(WIN_APP_MAP).find((app) => allText.includes(app));
          if (found) name = found;
        }

        // Fallback 3: tentar extrair "chrome", "spotify" etc. do nome da tool call
        if (!name) {
          const toolCallStr = JSON.stringify(params).toLowerCase();
          const found = Object.keys(WIN_APP_MAP).find((app) => toolCallStr.includes(app));
          if (found) name = found;
        }

        if (!name) {
          // Retornar erro com instrução clara pro LLM
          return {
            success: false,
            message: 'Chame open_application com o parametro name. Exemplo: open_application({ name: "chrome" })',
          };
        }
        const filePath = (params.path ?? params.file_path ?? params.folder) as string | undefined;
        return this.openApplication(name, filePath);
      }
      case 'run_command':
        return this.runCommand(params.command as string, params.cwd as string | undefined);
      case 'manage_files':
        return this.manageFiles(params as any);
      default:
        return { success: false, message: `Tool desconhecida: ${toolName}` };
    }
  }

  private async openApplication(name: string, targetPath?: string): Promise<CapabilityResult> {
    const normalized = name.toLowerCase().trim();

    // Detectar URLs — abrir no navegador padrão
    if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
      try {
        const cmd = process.platform === 'win32' ? `start "" "${normalized}"` : `open "${normalized}"`;
        await execAsync(cmd, { timeout: 10000 });
        this.logger.log(`URL aberta: ${normalized}`);
        return { success: true, message: `URL "${normalized}" aberta no navegador.` };
      } catch (error) {
        return { success: false, message: `Erro ao abrir URL: ${error instanceof Error ? error.message : String(error)}` };
      }
    }

    // Blocklist: impedir apps perigosos
    if (APP_BLOCKLIST.some((b) => normalized.includes(b))) {
      return { success: false, message: `Aplicativo "${name}" bloqueado por segurança.` };
    }

    try {
      // Se path é URL, não resolver como caminho local
      const isUrl = targetPath && /^https?:\/\//i.test(targetPath);
      const resolvedPath = targetPath ? (isUrl ? targetPath : this.resolvePath(targetPath)) : '';
      const pathArg = resolvedPath ? ` "${resolvedPath}"` : '';
      const isWindows = process.platform === 'win32';

      let cmd: string;
      if (isWindows && WIN_APP_MAP[normalized]) {
        cmd = WIN_APP_MAP[normalized] + pathArg;
      } else if (isWindows) {
        cmd = `start "" "${normalized}"${pathArg}`;
      } else {
        cmd = `${normalized}${pathArg}`;
      }

      await execAsync(cmd, { timeout: 10000 });

      const msg = targetPath
        ? `Aplicativo "${name}" aberto com "${targetPath}".`
        : `Aplicativo "${name}" aberto com sucesso.`;
      this.logger.log(msg);
      return { success: true, message: msg };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, message: `Erro ao abrir "${name}": ${msg}` };
    }
  }

  private get homeDir(): string {
    return process.env.USERPROFILE || process.env.HOME || '.';
  }

  private resolvePath(p: string): string {
    if (path.isAbsolute(p)) return p;
    return path.resolve(this.homeDir, p);
  }

  private async runCommand(command: string, cwd?: string): Promise<CapabilityResult> {
    // Security check
    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(command)) {
        return {
          success: false,
          message: `Comando bloqueado por seguranca. Padrao destrutivo detectado.`,
        };
      }
    }

    try {
      const workDir = cwd ? this.resolvePath(cwd) : this.homeDir;

      const { stdout, stderr } = await execAsync(command, {
        cwd: workDir,
        timeout: 30000, // 30s max
        maxBuffer: 1024 * 1024, // 1MB
      });

      const output = stdout.trim() || stderr.trim();
      this.logger.log(`Command executed: ${command}`);

      return {
        success: true,
        message: `Comando executado com sucesso.`,
        data: output.slice(0, 5000), // Limit output
      };
    } catch (error: any) {
      const output = error.stdout?.trim() || error.stderr?.trim() || error.message;
      return {
        success: false,
        message: `Erro ao executar comando: ${output?.slice(0, 2000)}`,
      };
    }
  }

  private async manageFiles(params: {
    action: string;
    path: string;
    content?: string;
    destination?: string;
  }): Promise<CapabilityResult> {
    const filePath = this.resolvePath(params.path);

    try {
      switch (params.action) {
        case 'create_dir': {
          await fs.mkdir(filePath, { recursive: true });
          return { success: true, message: `Pasta criada: ${filePath}` };
        }

        case 'list': {
          const entries = await fs.readdir(filePath, { withFileTypes: true });
          const list = entries.map((e) => ({
            name: e.name,
            type: e.isDirectory() ? 'dir' : 'file',
          }));
          return { success: true, message: `${list.length} itens encontrados.`, data: list };
        }

        case 'read': {
          const stat = await fs.stat(filePath);
          if (stat.size > 100 * 1024) {
            return { success: false, message: 'Arquivo muito grande (max 100KB para leitura).' };
          }
          const content = await fs.readFile(filePath, 'utf-8');
          return { success: true, message: 'Arquivo lido.', data: content };
        }

        case 'write': {
          if (!params.content) {
            return { success: false, message: 'Conteudo nao fornecido para escrita.' };
          }
          await fs.mkdir(path.dirname(filePath), { recursive: true });
          await fs.writeFile(filePath, params.content, 'utf-8');
          return { success: true, message: `Arquivo escrito: ${filePath}` };
        }

        case 'delete': {
          await fs.rm(filePath, { recursive: true });
          return { success: true, message: `Deletado: ${filePath}` };
        }

        case 'move': {
          if (!params.destination) {
            return { success: false, message: 'Destino nao fornecido.' };
          }
          await fs.rename(filePath, this.resolvePath(params.destination));
          return { success: true, message: `Movido para: ${params.destination}` };
        }

        case 'copy': {
          if (!params.destination) {
            return { success: false, message: 'Destino nao fornecido.' };
          }
          await fs.copyFile(filePath, this.resolvePath(params.destination));
          return { success: true, message: `Copiado para: ${params.destination}` };
        }

        default:
          return { success: false, message: `Acao desconhecida: ${params.action}` };
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, message: `Erro: ${msg}` };
    }
  }
}
