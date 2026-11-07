import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-agent'

export const name = 'claude-code-instance-route'

export function apply(ctx: Context): void {
  ctx.on('agent/request', async (_request, next) => {
    const upstream = await next()
    return { ...upstream, provider: 'claude-code',
      model: upstream.provider === 'claude-code' ? upstream.model : 'local' }
  })
}
