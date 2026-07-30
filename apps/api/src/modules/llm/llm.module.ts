import { Module } from '@nestjs/common';
import { LlmService } from './llm.service';
import { OllamaProvider } from './providers/ollama.provider';
import { OpenAiProvider } from './providers/openai.provider';
import { DecisionModule } from '../decision/decision.module';
import { LLM_PROVIDERS } from '../../common/interfaces';

@Module({
  imports: [DecisionModule],
  providers: [
    OllamaProvider,
    OpenAiProvider,
    {
      provide: LLM_PROVIDERS,
      useFactory: (ollama: OllamaProvider, openai: OpenAiProvider) => [ollama, openai],
      inject: [OllamaProvider, OpenAiProvider],
    },
    LlmService,
  ],
  exports: [LlmService],
})
export class LlmModule {}
