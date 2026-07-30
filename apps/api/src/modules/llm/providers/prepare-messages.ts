type RawMessage = { role: string; content: string };

export function prepareMessages(messages: RawMessage[]) {
  const systemMessages = messages.filter((m) => m.role === 'system');
  const chatMessages = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

  const system = systemMessages.map((m) => m.content).join('\n') || undefined;

  return { system, messages: chatMessages };
}
