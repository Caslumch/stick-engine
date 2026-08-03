import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { PrismaService } from '../../prisma/prisma.service';
import { CapabilityRegistryService } from '../capabilities/capability-registry.service';
import type { Capability, CapabilityResult, Tool } from '../../common/interfaces';

interface McpConnection {
  client: Client;
  serverId: string;
  serverName: string;
  tools: Tool[];
}

@Injectable()
export class McpService implements OnModuleInit {
  private readonly logger = new Logger(McpService.name);
  private readonly connections = new Map<string, McpConnection>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: CapabilityRegistryService,
  ) {}

  async onModuleInit() {
    await this.connectAll();
  }

  /** Connect to all enabled MCP servers from the database */
  async connectAll() {
    const servers = await this.prisma.mcpServer.findMany({
      where: { enabled: true },
    });

    for (const server of servers) {
      await this.connect(server.id);
    }
  }

  /** Connect to a specific MCP server and register its tools */
  async connect(serverId: string): Promise<{ tools: string[] } | { error: string }> {
    // Disconnect if already connected
    if (this.connections.has(serverId)) {
      await this.disconnect(serverId);
    }

    const server = await this.prisma.mcpServer.findUnique({
      where: { id: serverId },
    });

    if (!server) {
      return { error: `Server ${serverId} not found` };
    }

    try {
      const client = new Client({
        name: 'jarvis',
        version: '1.0.0',
      });

      let transport;

      switch (server.transport) {
        case 'stdio': {
          if (!server.command) {
            return { error: 'Stdio transport requires a command' };
          }
          const args = server.args ? JSON.parse(server.args) : [];
          transport = new StdioClientTransport({
            command: server.command,
            args,
          });
          break;
        }
        case 'sse': {
          if (!server.url) {
            return { error: 'SSE transport requires a URL' };
          }
          transport = new SSEClientTransport(new URL(server.url));
          break;
        }
        case 'streamable-http': {
          if (!server.url) {
            return { error: 'HTTP transport requires a URL' };
          }
          transport = new StreamableHTTPClientTransport(new URL(server.url));
          break;
        }
        default:
          return { error: `Unknown transport: ${server.transport}` };
      }

      await client.connect(transport);

      // Discover tools
      const toolsResult = await client.listTools();
      const mcpTools: Tool[] = (toolsResult.tools || []).map((t) => ({
        name: `mcp_${server.name}_${t.name}`,
        description: t.description || t.name,
        parameters: {
          type: 'object' as const,
          properties: (t.inputSchema as any)?.properties ?? {},
          required: (t.inputSchema as any)?.required ?? [],
        },
      }));

      const connection: McpConnection = {
        client,
        serverId: server.id,
        serverName: server.name,
        tools: mcpTools,
      };

      this.connections.set(server.id, connection);

      // Register as capability
      const capability = this.createCapability(connection, toolsResult.tools || []);
      this.registry.register(capability);

      this.logger.log(
        `Connected to MCP server "${server.name}" (${server.transport}) — ${mcpTools.length} tool(s): ${mcpTools.map(t => t.name).join(', ')}`,
      );

      return { tools: mcpTools.map((t) => t.name) };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to connect to MCP server "${server.name}": ${msg}`);
      return { error: msg };
    }
  }

  /** Disconnect from an MCP server */
  async disconnect(serverId: string) {
    const conn = this.connections.get(serverId);
    if (!conn) return;

    try {
      await conn.client.close();
    } catch {
      // Ignore close errors
    }

    this.connections.delete(serverId);
    this.logger.log(`Disconnected from MCP server "${conn.serverName}"`);
  }

  /** Create a Capability wrapper for an MCP connection */
  private createCapability(
    connection: McpConnection,
    rawTools: Array<{ name: string; description?: string; inputSchema?: unknown }>,
  ): Capability {
    const toolNameMap = new Map<string, string>();
    for (const t of rawTools) {
      toolNameMap.set(`mcp_${connection.serverName}_${t.name}`, t.name);
    }

    return {
      name: `mcp:${connection.serverName}`,
      description: `MCP Server: ${connection.serverName}`,
      tools: connection.tools,
      execute: async (toolName: string, params: Record<string, unknown>): Promise<CapabilityResult> => {
        const originalName = toolNameMap.get(toolName);
        if (!originalName) {
          return { success: false, message: `Tool "${toolName}" not found on MCP server` };
        }

        try {
          const result = await connection.client.callTool({
            name: originalName,
            arguments: params,
          });

          const text = (result.content as any[])
            ?.map((c: any) => c.text ?? JSON.stringify(c))
            .join('\n') ?? '';

          return {
            success: !result.isError,
            message: text,
            data: result.content,
          };
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          return { success: false, message: `MCP error: ${msg}` };
        }
      },
    };
  }

  // ── CRUD ────────────────────────────────────────────────────

  async listServers() {
    const servers = await this.prisma.mcpServer.findMany({
      orderBy: { createdAt: 'asc' },
    });

    return servers.map((s) => ({
      ...s,
      connected: this.connections.has(s.id),
      tools: this.connections.get(s.id)?.tools.map((t) => t.name) ?? [],
    }));
  }

  async addServer(data: {
    name: string;
    transport: string;
    command?: string;
    args?: string;
    url?: string;
  }) {
    const server = await this.prisma.mcpServer.create({ data });
    this.logger.log(`MCP server added: "${data.name}" (${data.transport})`);

    // Auto-connect
    const result = await this.connect(server.id);
    return { server, ...result };
  }

  async updateServer(
    id: string,
    data: {
      name?: string;
      transport?: string;
      command?: string;
      args?: string;
      url?: string;
      enabled?: boolean;
    },
  ) {
    const server = await this.prisma.mcpServer.update({
      where: { id },
      data,
    });

    // Reconnect if enabled, disconnect if disabled
    if (data.enabled === false) {
      await this.disconnect(id);
    } else {
      await this.connect(id);
    }

    return server;
  }

  async removeServer(id: string) {
    await this.disconnect(id);
    await this.prisma.mcpServer.delete({ where: { id } });
    this.logger.log(`MCP server removed: ${id}`);
  }

  async reconnect(id: string) {
    return this.connect(id);
  }
}
