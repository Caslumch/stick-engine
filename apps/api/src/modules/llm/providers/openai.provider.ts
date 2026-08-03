import { Injectable } from '@nestjs/common';
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

  private readonly modelId: string;
  private readonly envApiKey: string;

  constructor(
    config: ConfigService,
    private readonly settings: SettingsService,
  ) {
    this.modelId = config.get<string>('jarvis.openai.model', 'gpt-4o-mini');
    this.envApiKey = config.get<string>('jarvis.openai.apiKey', '');
  }

  /** API key: prioridade settings (UI) > env var */
  private async getApiKey(): Promise<string> {
    const fromSettings = await this.settings.get('openai.apiKey');
    return fromSettings || this.envApiKey;
  }

  async generate(request: LlmRequest): Promise<LlmResponse> {
    const openai = createOpenAI({ apiKey: await this.getApiKey() });
    const { system, messages } = prepareMessages(request.messages);
    const hasTools = request.tools && Object.keys(request.tools).length > 0;

    const result = await generateText({
      model: openai.chat(this.modelId),
      system,
      messages,
      ...(hasTools && {
        tools: request.tools,
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
    const hasTools = request.tools && Object.keys(request.tools).length > 0;

    const result = streamText({
      model: openai.chat(this.modelId),
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
