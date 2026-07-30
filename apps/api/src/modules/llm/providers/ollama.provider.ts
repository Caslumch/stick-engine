import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateText, streamText, isStepCount } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import type { LlmProvider, LlmRequest, LlmResponse, LlmStreamCallback } from '../../../common/interfaces';
import { prepareMessages } from './prepare-messages';

@Injectable()
export class OllamaProvider implements LlmProvider {
  readonly name = 'ollama';
  readonly type = 'local' as const;

  private readonly modelId: string;
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    this.modelId = config.get<string>('jarvis.ollama.model', 'qwen2.5');
    this.baseUrl = config.get<string>('jarvis.ollama.url', 'http://localhost:11434');
  }

  private createModel() {
    const client = createOpenAI({
      baseURL: `${this.baseUrl}/v1`,
      apiKey: 'ollama',
    });
    return client.chat(this.modelId);
  }

  async generate(request: LlmRequest): Promise<LlmResponse> {
    const { system, messages } = prepareMessages(request.messages);
    const hasTools = request.tools && Object.keys(request.tools).length > 0;

    const result = await generateText({
      model: this.createModel(),
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
    const { system, messages } = prepareMessages(request.messages);
    const hasTools = request.tools && Object.keys(request.tools).length > 0;

    const result = streamText({
      model: this.createModel(),
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
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`);
      return res.ok;
    } catch {
      return false;
    }
  }
}
