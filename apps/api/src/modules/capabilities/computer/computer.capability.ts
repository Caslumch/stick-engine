import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { Capability, CapabilityResult, Tool } from '../../../common/interfaces';
import { CapabilityRegistryService } from '../capability-registry.service';

const execAsync = promisify(exec);

// Segurança: apps/comandos que NUNCA devem ser executados
const APP_BLOCKLIST = ['format', 'diskpart', 'regedit', 'taskkill', 'shutdown', 'restart', 'del', 'rmdir', 'rd', 'fdisk', 'cipher'];
const BLOCKED_PATTERNS = [
  /rm\s+(-rf?|--recursive)\s+[\/\\]/i, /del\s+\/s/i, /format\s+[a-z]:/i,
  /mkfs/i, /dd\s+if=/i, /shutdown/i, /reboot/i, /:\(\)\{.*\}/, />\s*\/dev\/sd/i, /reg\s+delete/i,
];

@Injectable()
export class ComputerCapability implements Capability, OnModuleInit {
  private readonly logger = new Logger(ComputerCapability.name);

  readonly name = 'computer';
  readonly description = 'Controla o computador do usuario: abrir programas, executar comandos e gerenciar arquivos.';

  readonly tools: Tool[] = [
    {
      name: 'open_application',
      description: 'Abre um aplicativo pelo nome via "start <nome>". Se falhar, use run_command com comandos PowerShell (o shell já é PowerShell). Ex: Start-Process "steam://", ou buscar: Get-ChildItem "$env:ProgramData\\Microsoft\\Windows\\Start Menu" -Recurse -Filter "*nome*"',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nome do aplicativo (ex: chrome, notepad, steam)' },
          path: { type: 'string', description: 'Caminho ou URL para abrir com o app (opcional)' },
        },
        required: ['name'],
      },
    },
    {
      name: 'run_command',
      description: 'Executa um comando no terminal. PLATAFORMA: Windows, shell: PowerShell. Use cmdlets diretamente (Get-ChildItem, Start-Process, etc.) sem prefixar com "powershell -Command". Exemplos: Start-Process "steam://" | Get-ChildItem "$env:ProgramData\\Microsoft\\Windows\\Start Menu" -Recurse -Filter "*steam*"',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'Comando para executar' },
          cwd: { type: 'string', description: 'Diretorio de trabalho (opcional)' },
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
          action: { type: 'string', description: 'Acao', enum: ['create_dir', 'list', 'read', 'write', 'delete', 'move', 'copy'] },
          path: { type: 'string', description: 'Caminho do arquivo ou pasta' },
          content: { type: 'string', description: 'Conteudo (apenas write)' },
          destination: { type: 'string', description: 'Destino (apenas move/copy)' },
        },
        required: ['action', 'path'],
      },
    },
  ];

  constructor(private readonly registry: CapabilityRegistryService) {}
  onModuleInit() { this.registry.register(this); }

  async execute(toolName: string, params: Record<string, unknown>): Promise<CapabilityResult> {
    switch (toolName) {
      case 'open_application': {
        let name = (params.name ?? params.application ?? params.app_name ?? params.app) as string;
        if (!name) {
          const strValues = Object.values(params).filter((v) => typeof v === 'string' && v.trim()) as string[];
          if (strValues.length > 0) name = strValues[0];
        }
        if (!name) return { success: false, message: 'Passe o nome do app. Use run_command se precisar buscar.' };
        return this.openApplication(name, (params.path ?? params.file_path) as string | undefined);
      }
      case 'run_command':
        return this.runCommand(params.command as string, params.cwd as string | undefined);
      case 'manage_files':
        return this.manageFiles(params as any);
      default:
        return { success: false, message: `Tool desconhecida: ${toolName}` };
    }
  }

  // ── Open Application (simples — LLM resolve fallbacks via run_command) ──

  private async openApplication(name: string, targetPath?: string): Promise<CapabilityResult> {
    const normalized = name.toLowerCase().trim();

    // URLs → abrir no navegador padrão
    if (/^https?:\/\//i.test(normalized)) {
      const cmd = process.platform === 'win32' ? `start "" "${normalized}"` : `open "${normalized}"`;
      try {
        await execAsync(cmd, { timeout: 10000 });
        return { success: true, message: `URL aberta.`, data: { command: cmd } };
      } catch (e) {
        return { success: false, message: `Erro: ${(e as Error).message}` };
      }
    }

    // Blocklist
    if (APP_BLOCKLIST.some((b) => normalized.includes(b))) {
      return { success: false, message: `"${name}" bloqueado por segurança.` };
    }

    // Path handling
    const isUrl = targetPath && /^https?:\/\//i.test(targetPath);
    const resolvedPath = targetPath ? (isUrl ? targetPath : this.resolvePath(targetPath)) : '';
    const pathArg = resolvedPath ? ` "${resolvedPath}"` : '';
    const isWindows = process.platform === 'win32';

    // Tentar abrir diretamente
    const cmd = isWindows ? `start "" "${normalized}"${pathArg}` : `${normalized}${pathArg}`;
    try {
      await execAsync(cmd, { timeout: 10000 });
      this.logger.log(`[CMD] ${cmd}`);
      return { success: true, message: `"${name}" aberto.`, data: { command: cmd } };
    } catch {
      // Fallback: descobrir automaticamente via PowerShell (sem hardcodar caminhos)
      if (isWindows) {
        return this.discoverAndLaunch(name, normalized);
      }
      return { success: false, message: `"${name}" não encontrado.` };
    }
  }

  // ── Helpers ──

  /**
   * Descobre e abre um app dinamicamente via PowerShell.
   * Tenta 3 estratégias em sequência, sem hardcodar caminhos:
   * 1. Get-StartApps (apps registrados no Windows)
   * 2. Protocolo URI (steam://, discord://, etc.)
   * 3. Busca no Menu Iniciar (atalhos .lnk)
   */
  private async discoverAndLaunch(displayName: string, search: string): Promise<CapabilityResult> {
    const strategies = [
      // 1. Get-StartApps — lista apps instalados do Windows
      {
        name: 'Get-StartApps',
        cmd: `Get-StartApps | Where-Object { $_.Name -like '*${search}*' } | Select-Object -First 1 -ExpandProperty AppID`,
        launch: (appId: string) => `Start-Process "shell:AppsFolder\\${appId}"`,
      },
      // 2. Protocolo URI — muitos apps registram protocolos
      {
        name: 'URI protocol',
        cmd: `$null`, // não precisa descobrir
        direct: `Start-Process "${search}://"`,
      },
      // 3. Menu Iniciar — busca atalhos .lnk
      {
        name: 'Start Menu',
        cmd: [
          `Get-ChildItem "$env:ProgramData\\Microsoft\\Windows\\Start Menu\\Programs" -Recurse -Filter '*.lnk' | Where-Object { $_.BaseName -like '*${search}*' } | Select-Object -First 1 -ExpandProperty FullName`,
          `Get-ChildItem "$env:APPDATA\\Microsoft\\Windows\\Start Menu\\Programs" -Recurse -Filter '*.lnk' | Where-Object { $_.BaseName -like '*${search}*' } | Select-Object -First 1 -ExpandProperty FullName`,
        ],
        launch: (path: string) => `Start-Process '${path}'`,
      },
    ];

    for (const strategy of strategies) {
      try {
        if ('direct' in strategy && strategy.direct) {
          // Tentar execução direta (protocolo URI)
          await execAsync(strategy.direct, { timeout: 8000, shell: 'powershell.exe' });
          this.logger.log(`[${strategy.name}] ${strategy.direct}`);
          return { success: true, message: `"${displayName}" aberto.`, data: { command: strategy.direct, method: strategy.name } };
        }

        // Descobrir e lançar
        const cmds = Array.isArray(strategy.cmd) ? strategy.cmd : [strategy.cmd];
        for (const cmd of cmds) {
          if (cmd === '$null') continue;
          try {
            const { stdout } = await execAsync(cmd, { timeout: 8000, shell: 'powershell.exe' });
            const result = stdout.trim();
            if (result && strategy.launch) {
              const launchCmd = strategy.launch(result);
              await execAsync(launchCmd, { timeout: 8000, shell: 'powershell.exe' });
              this.logger.log(`[${strategy.name}] ${launchCmd}`);
              return { success: true, message: `"${displayName}" aberto.`, data: { command: launchCmd, discovered: result, method: strategy.name } };
            }
          } catch { /* próximo cmd */ }
        }
      } catch { /* próxima estratégia */ }
    }

    return { success: false, message: `"${displayName}" não encontrado no sistema. Verifique se está instalado.` };
  }

  private get homeDir(): string {
    return process.env.USERPROFILE || process.env.HOME || '.';
  }

  /** Mapeia nomes de pastas PT-BR pros nomes reais no Windows */
  private readonly FOLDER_MAP: Record<string, string> = {
    'imagens': 'Pictures', 'imagem': 'Pictures', 'fotos': 'Pictures',
    'documentos': 'Documents', 'downloads': 'Downloads',
    'desktop': 'Desktop', 'area de trabalho': 'Desktop', 'área de trabalho': 'Desktop',
    'musica': 'Music', 'musicas': 'Music', 'música': 'Music', 'músicas': 'Music',
    'videos': 'Videos', 'vídeos': 'Videos',
  };

  private resolvePath(p: string): string {
    let resolved = p.replace(/^~[/\\]?/, this.homeDir + path.sep);
    const lower = resolved.toLowerCase();
    for (const [pt, en] of Object.entries(this.FOLDER_MAP)) {
      if (lower.includes(pt)) resolved = resolved.replace(new RegExp(pt, 'i'), en);
    }
    if (path.isAbsolute(resolved)) return resolved;
    return path.resolve(this.homeDir, resolved);
  }

  // ── Run Command ──

  private async runCommand(command: string, cwd?: string): Promise<CapabilityResult> {
    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(command)) {
        return { success: false, message: 'Comando bloqueado por segurança.' };
      }
    }
    try {
      const workDir = cwd ? this.resolvePath(cwd) : this.homeDir;

      // No Windows, usar PowerShell como shell padrão (suporta cmdlets + cmd commands)
      const isWindows = process.platform === 'win32';
      const { stdout, stderr } = await execAsync(command, {
        cwd: workDir,
        timeout: 30000,
        maxBuffer: 1024 * 1024,
        shell: isWindows ? 'powershell.exe' : undefined,
      });
      const output = stdout.trim() || stderr.trim();
      this.logger.log(`[CMD] ${command}`);
      return { success: true, message: 'Comando executado.', data: { output: output.slice(0, 5000), command } };
    } catch (error: any) {
      const output = error.stdout?.trim() || error.stderr?.trim() || error.message;
      return { success: false, message: `Erro: ${output?.slice(0, 2000)}`, data: { command } };
    }
  }

  // ── Manage Files ──

  private async manageFiles(params: { action: string; path: string; content?: string; destination?: string }): Promise<CapabilityResult> {
    const filePath = this.resolvePath(params.path);
    try {
      switch (params.action) {
        case 'create_dir': await fs.mkdir(filePath, { recursive: true }); return { success: true, message: `Pasta criada: ${filePath}` };
        case 'list': {
          const entries = await fs.readdir(filePath, { withFileTypes: true });
          return { success: true, message: `${entries.length} itens.`, data: entries.map((e) => ({ name: e.name, type: e.isDirectory() ? 'dir' : 'file' })) };
        }
        case 'read': {
          const stat = await fs.stat(filePath);
          if (stat.size > 100 * 1024) return { success: false, message: 'Arquivo muito grande (max 100KB).' };
          return { success: true, message: 'Arquivo lido.', data: await fs.readFile(filePath, 'utf-8') };
        }
        case 'write': {
          if (!params.content) return { success: false, message: 'Conteudo não fornecido.' };
          await fs.mkdir(path.dirname(filePath), { recursive: true });
          await fs.writeFile(filePath, params.content, 'utf-8');
          return { success: true, message: `Arquivo escrito: ${filePath}` };
        }
        case 'delete': await fs.rm(filePath, { recursive: true }); return { success: true, message: `Deletado: ${filePath}` };
        case 'move': {
          if (!params.destination) return { success: false, message: 'Destino não fornecido.' };
          await fs.rename(filePath, this.resolvePath(params.destination));
          return { success: true, message: `Movido para: ${params.destination}` };
        }
        case 'copy': {
          if (!params.destination) return { success: false, message: 'Destino não fornecido.' };
          await fs.copyFile(filePath, this.resolvePath(params.destination));
          return { success: true, message: `Copiado para: ${params.destination}` };
        }
        default: return { success: false, message: `Ação desconhecida: ${params.action}` };
      }
    } catch (error) {
      return { success: false, message: `Erro: ${(error as Error).message}` };
    }
  }
}
