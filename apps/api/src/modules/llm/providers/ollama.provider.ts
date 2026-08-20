import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateText, streamText, isStepCount } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import type { LlmProvider, LlmRequest, LlmResponse, LlmStreamCallback } from '../../../common/interfaces';
import { prepareMessages } from './prepare-messages';
import { SettingsService } from '../../settings/settings.service';

@Injectable()
export class OllamaProvider implements LlmProvider, OnModuleInit {
  readonly name = 'ollama';
  readonly type = 'local' as const;
  private readonly logger = new Logger(OllamaProvider.name);

  private readonly defaultModel: string;
  private readonly baseUrl: string;

  constructor(
    config: ConfigService,
    private readonly settings: SettingsService,
  ) {
    this.defaultModel = config.get<string>('jarvis.ollama.model', 'llama3.1');
    this.baseUrl = config.get<string>('jarvis.ollama.url', 'http://localhost:11434');
  }

  /** Pré-aquecer o modelo no startup — carrega na memória do Ollama */
  async onModuleInit() {
    try {
      const modelId = await this.getModelId();
      this.logger.log(`Pré-aquecendo modelo ${modelId}...`);
      await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: modelId, prompt: '', keep_alive: '30m' }),
      });
      this.logger.log(`Modelo ${modelId} carregado na memória.`);
    } catch {
      this.logger.warn('Ollama não disponível — modelo não pré-aquecido.');
    }
  }

  private async getModelId(): Promise<string> {
    const fromSettings = await this.settings.get('llm.ollama.model');
    return fromSettings || this.defaultModel;
  }

  private createModel(modelId: string): any {
    const client = createOpenAI({
      baseURL: `${this.baseUrl}/v1`,
      apiKey: 'ollama',
    });
    return client.chat(modelId);
  }

  async generate(request: LlmRequest): Promise<LlmResponse> {
    const { system, messages } = prepareMessages(request.messages);
    const hasTools = request.tools && Object.keys(request.tools).length > 0;
    const modelId = await this.getModelId();

    const result = await generateText({
      model: this.createModel(modelId),
      system,
      messages,
      ...(hasTools && {
        tools: request.tools,
        stopWhen: isStepCount(request.maxSteps ?? 5),
      }),
    });

    return {
      content: result.text,
      model: modelId,
      provider: this.name,
      toolCalls: result.toolCalls?.map((tc: any) => ({
        toolCallId: tc.toolCallId,
        toolName: tc.toolName,
        args: tc.input ?? tc.args ?? {},
      })),
      toolResults: result.toolResults?.map((tr: any) => ({
        toolCallId: tr.toolCallId,
        toolName: tr.toolName,
        result: tr.output ?? tr.result,
      })),
    };
  }

  async generateStream(request: LlmRequest, onToken: LlmStreamCallback): Promise<LlmResponse> {
    const { system, messages } = prepareMessages(request.messages);
    const hasTools = request.tools && Object.keys(request.tools).length > 0;
    const modelId = await this.getModelId();

    const result = streamText({
      model: this.createModel(modelId),
      system,
      messages,
      ...(hasTools && {
        tools: request.tools,
        stopWhen: isStepCount(request.maxSteps ?? 5),
      }),
    });

    let fullContent = '';

    for await (const chunk of result.textStream) {
      onToken(chunk);
      fullContent += chunk;
    }

    const toolCalls = await result.toolCalls;
    const toolResults = await result.toolResults;

    return {
      content: fullContent,
      model: modelId,
      provider: this.name,
      toolCalls: toolCalls?.map((tc: any) => ({
        toolCallId: tc.toolCallId,
        toolName: tc.toolName,
        args: tc.input ?? tc.args ?? {},
      })),
      toolResults: toolResults?.map((tr: any) => ({
        toolCallId: tr.toolCallId,
        toolName: tr.toolName,
        result: tr.output ?? tr.result,
      })),
    };
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`);
      return res.ok;
    } catch {
      return false;
    }
  }
}
