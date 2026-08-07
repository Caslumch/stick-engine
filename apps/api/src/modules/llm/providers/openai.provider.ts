import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateText, streamText, isStepCount } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import type { LlmProvider, LlmRequest, LlmResponse, LlmStreamCallback } from '../../../common/interfaces';
import { prepareMessages } from './prepare-messages';
import { SettingsService } from '../../settings/settings.service';

@Injectable()
export class OpenAiProvider implements LlmProvider {
  readonly name = 'openai';
  readonly type = 'cloud' as const;
  private readonly logger = new Logger(OpenAiProvider.name);

  private readonly modelId: string;
  private readonly envApiKey: string;

  constructor(
    config: ConfigService,
    private readonly settings: SettingsService,
  ) {
    this.modelId = config.get<string>('jarvis.openai.model', 'gpt-4o');
    this.envApiKey = config.get<string>('jarvis.openai.apiKey', '');
  }

  /** API key: prioridade settings (UI) > env var */
  private async getApiKey(): Promise<string> {
    const fromSettings = await this.settings.get('openai.apiKey');
    return fromSettings || this.envApiKey;
  }

  /** Modelos que suportam Responses API (web search nativo) */
  private supportsResponses(): boolean {
    const model = this.modelId.toLowerCase();
    if (model.includes('mini')) return false;
    if (model.includes('gpt-4o') || model.includes('gpt-4.1') || model.includes('o1') || model.includes('o3')) return true;
    return false;
  }

  /** Verifica se webSearch nativo deve ser usado pra esta request */
  private async useNativeWebSearch(request: LlmRequest): Promise<boolean> {
    if (!request.webSearch) return false; // só ativa quando o service pede
    const enabled = (await this.settings.get('openai.webSearch')) !== 'false';
    return enabled && this.supportsResponses();
  }

  /** Mescla as tools, adicionando webSearch se usando Responses API */
  private buildTools(
    openai: ReturnType<typeof createOpenAI>,
    requestTools: LlmRequest['tools'] | undefined,
    nativeSearch: boolean,
  ) {
    const tools: Record<string, any> = { ...requestTools };

    if (nativeSearch) {
      tools.web_search_openai = openai.tools.webSearch();
      // Remover Tavily pra evitar duplicata
      delete tools.web_search;
      this.logger.log('WebSearch nativo ativo (Responses API)');
    }

    return Object.keys(tools).length > 0 ? tools : undefined;
  }

  async generate(request: LlmRequest): Promise<LlmResponse> {
    const openai = createOpenAI({ apiKey: await this.getApiKey() });
    const { system, messages } = prepareMessages(request.messages);
    const nativeSearch = await this.useNativeWebSearch(request);
    const tools = this.buildTools(openai, request.tools, nativeSearch);

    const model = nativeSearch
      ? openai.responses(this.modelId)
      : openai.chat(this.modelId);

    const result = await generateText({
      model,
      system,
      messages,
      ...(tools && {
        tools,
        stopWhen: isStepCount(request.maxSteps ?? 5),
      }),
    });

    return {
      content: result.text,
      model: this.modelId,
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
    const openai = createOpenAI({ apiKey: await this.getApiKey() });
    const { system, messages } = prepareMessages(request.messages);
    const nativeSearch = await this.useNativeWebSearch(request);
    const tools = this.buildTools(openai, request.tools, nativeSearch);

    const model = nativeSearch
      ? openai.responses(this.modelId)
      : openai.chat(this.modelId);

    const result = streamText({
      model,
      system,
      messages,
      ...(tools && {
        tools,
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
      model: this.modelId,
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
    const key = await this.getApiKey();
    return key.length > 0;
  }
}
