import type { GenerateOptions } from '@deepseek-ai/dsh-llm'

/** The native DSH loop appends synthetic user-role context after the human turn. */
export function directUserText(messages: GenerateOptions['messages']): string {
  const human = [...messages].reverse().find(message =>
    message.role === 'user' && message.source?.kind === 'user')
  const text = human?.content.filter(block => block.type === 'text').map(block => block.text).join('\n')
  if (!text?.trim()) throw new Error('Claude Code needs a direct user text message')
  return text
}
