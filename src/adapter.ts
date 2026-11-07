import { query, type CanUseTool } from '@anthropic-ai/claude-agent-sdk'
import { LlmAdapter, type GenerateOptions, type LlmModelInfo, type LlmResolvedModelInfo,
  type StreamChunk } from '@deepseek-ai/dsh-llm'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-agent-preset-registry'
import type {} from '@deepseek-ai/dsh-user-approval'
import { InstanceStore } from './state.js'
import { resolveInstance } from './sources.js'
import { SessionBindings } from './bindings.js'
import { directUserText } from './prompt.js'
import { prepareConfiguration } from './configuration.js'

export interface AdapterOptions { executablePath: string; store: InstanceStore; bindings: SessionBindings }

function childEnvironment(source: 'local' | 'dsh' | '1flowbase'): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (value === undefined || key.startsWith('DSH_')) continue
    if (/(?:KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|COOKIE|AUTHORIZATION)/iu.test(key)
      && !(source === 'local' && /^ANTHROPIC_(?:API_KEY|AUTH_TOKEN)$/u.test(key))) continue
    env[key] = value
  }
  if (source !== 'local') {
    delete env.ANTHROPIC_BASE_URL
    delete env.CLAUDE_CONFIG_DIR
  }
  return env
}

export class ClaudeCodeAdapter extends LlmAdapter {
  constructor(private readonly ctx: Context, private readonly settings: AdapterOptions) { super() }

  override providerInfo(provider: string) { return { id: provider, name: 'Claude Code' } }
  override async listModels(provider: string): Promise<readonly LlmModelInfo[]> {
    return this.settings.store.list().filter(row => row.enabled).map(row => ({ provider, id: row.id,
      name: row.name, description: `${row.source} · ${row.model}`, inputModalities: ['text', 'image'] }))
  }
  override async resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo> {
    const row = this.settings.store.get(model)
    return { provider, id: model, name: row?.name ?? model, inputModalities: ['text', 'image'] }
  }

  override async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    if (options.purpose !== undefined) throw new Error(`Claude Code does not serve ${options.purpose} requests`)
    const instance = this.settings.store.get(options.model)
    if (!instance?.enabled) throw new Error('Claude Code instance is disabled or missing')
    const agent = this.ctx.agents.currentInitiator() ??
      (options.sessionId === undefined ? undefined : this.ctx.agents.get(options.sessionId))
    if (!agent || this.ctx.agentPresets.composedPreset(agent.ctx) !== 'claude-code') {
      throw new Error('Claude Code instance requires the Claude Code preset')
    }
    const prompt = directUserText(options.messages)
    const sessionId = String(agent.id)
    const resolved = await resolveInstance(this.ctx, instance)
    const previous = await this.settings.bindings.read(sessionId)
    const fingerprint = JSON.stringify({ id: instance.id, source: instance.source, model: resolved.model,
      baseUrl: resolved.baseUrl, configDir: instance.configDir, settingsFile: instance.settingsFile,
      useClaudeSettings: instance.useClaudeSettings,
      opusModel: instance.opusModel, sonnetModel: instance.sonnetModel, haikuModel: instance.haikuModel })
    const prepared = await prepareConfiguration(instance)
    const abort = new AbortController()
    const onAbort = () => abort.abort(options.signal?.reason)
    options.signal?.addEventListener('abort', onAbort, { once: true })
    const canUseTool: CanUseTool = async (toolName, input, request) => {
      const approval = this.ctx.get('approval')
      if (!approval) return { behavior: 'deny', message: 'DSH approval is unavailable', toolUseID: request.toolUseID }
      const decision = await approval.request({ agent, toolName,
        reason: request.title ?? request.description ?? `Claude Code wants to use ${toolName}`,
        signal: request.signal })
      return decision === 'allowed-once'
        ? { behavior: 'allow', updatedInput: input, toolUseID: request.toolUseID }
        : { behavior: 'deny', message: 'User did not approve this action in DSH', toolUseID: request.toolUseID }
    }
    const env = { ...childEnvironment(instance.source),
      ...(resolved.baseUrl === undefined ? {} : { ANTHROPIC_BASE_URL: resolved.baseUrl }),
      ...(resolved.apiKey === undefined ? {} : { ANTHROPIC_AUTH_TOKEN: resolved.apiKey,
        ANTHROPIC_API_KEY: resolved.apiKey }),
      ...(instance.source === 'local' ? {} : {
        ANTHROPIC_DEFAULT_OPUS_MODEL: instance.opusModel ?? resolved.model,
        ANTHROPIC_DEFAULT_SONNET_MODEL: instance.sonnetModel ?? resolved.model,
        ANTHROPIC_DEFAULT_HAIKU_MODEL: instance.haikuModel ?? resolved.model,
        ANTHROPIC_SMALL_FAST_MODEL: instance.haikuModel ?? resolved.model,
      }),
      ...(prepared.configDir === undefined ? {} : { CLAUDE_CONFIG_DIR: prepared.configDir }),
      CLAUDE_AGENT_SDK_CLIENT_APP: 'dsh-plugin-claude-code/0.1.0' }
    let sdk: ReturnType<typeof query> | undefined
    let answer = ''
    let claudeSessionId: string | undefined
    try {
      sdk = query({ prompt, options: {
      pathToClaudeCodeExecutable: this.settings.executablePath,
      cwd: agent.session.header.cwd ?? process.cwd(),
      model: resolved.model === 'default' ? undefined : resolved.model,
      settingSources: prepared.settingSources,
      ...(prepared.settingsPath === undefined ? {} : { settings: prepared.settingsPath }),
      mcpServers: resolved.mcpServers,
      env,
      abortController: abort,
      permissionMode: 'default',
      canUseTool,
      ...(previous?.fingerprint === fingerprint ? { resume: previous.claudeSessionId } : {}),
      } })
      for await (const message of sdk) {
        if (message.type === 'system' && message.subtype === 'init') claudeSessionId = message.session_id
        if (message.type === 'result') {
          claudeSessionId = message.session_id
          if (message.subtype !== 'success') throw new Error(message.errors.join('; ') || 'Claude Code failed')
          answer = message.result
        }
      }
      if (claudeSessionId) await this.settings.bindings.write(sessionId, { claudeSessionId, fingerprint })
      yield { type: 'block-start', index: 0, blockType: 'text' }
      yield { type: 'text-delta', index: 0, text: answer }
      yield { type: 'block-end', index: 0, block: { type: 'text', text: answer } }
      yield { type: 'finish', reason: { kind: 'stop' } }
    } finally {
      options.signal?.removeEventListener('abort', onAbort)
      sdk?.close()
      await prepared.cleanup()
    }
  }
}
