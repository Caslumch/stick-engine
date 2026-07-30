import { Injectable, Logger } from '@nestjs/common';
import type { Capability, Tool } from '../../common/interfaces';

@Injectable()
export class CapabilityRegistryService {
  private readonly logger = new Logger(CapabilityRegistryService.name);
  private readonly capabilities = new Map<string, Capability>();

  register(capability: Capability) {
    this.capabilities.set(capability.name, capability);
    this.logger.log(`Registered capability: ${capability.name} (${capability.tools.length} tools)`);
  }

  getAll(): Capability[] {
    return Array.from(this.capabilities.values());
  }

  getAllTools(): Tool[] {
    return this.getAll().flatMap((cap) => cap.tools);
  }

  findByToolName(toolName: string): Capability | undefined {
    return this.getAll().find((cap) =>
      cap.tools.some((tool) => tool.name === toolName),
    );
  }

  async execute(toolName: string, params: Record<string, unknown>) {
    const capability = this.findByToolName(toolName);
    if (!capability) {
      throw new Error(`No capability found for tool "${toolName}"`);
    }
    return capability.execute(toolName, params);
  }
}
