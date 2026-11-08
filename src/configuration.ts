import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { SettingSource } from '@anthropic-ai/claude-agent-sdk'
import type { ClaudeInstance } from './state.js'
import { readConfig } from './config-files.js'

const pluginRoot = () => join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'dsh-plugin-claude-code')

export interface PreparedConfiguration {
  configDir?: string
  settingsPath?: string
  settingSources: SettingSource[]
  cleanup(): Promise<void>
}

export interface ProviderRuntime { model: string; baseUrl?: string }

function remoteSettings(raw: Record<string, unknown>, instance: ClaudeInstance, provider: ProviderRuntime): Record<string, unknown> {
  const original = raw.env && typeof raw.env === 'object' && !Array.isArray(raw.env)
    ? raw.env as Record<string, unknown> : {}
  const env = Object.fromEntries(Object.entries(original).filter(([key]) =>
    !key.startsWith('ANTHROPIC_') && !key.startsWith('CLAUDE_CODE_USE_')))
  return { ...raw, model: provider.model, env: {
    ...env,
    ...(provider.baseUrl === undefined ? {} : { ANTHROPIC_BASE_URL: provider.baseUrl }),
    ANTHROPIC_MODEL: provider.model,
    ANTHROPIC_DEFAULT_OPUS_MODEL: instance.opusModel ?? provider.model,
    ANTHROPIC_DEFAULT_SONNET_MODEL: instance.sonnetModel ?? provider.model,
    ANTHROPIC_DEFAULT_HAIKU_MODEL: instance.haikuModel ?? provider.model,
    ANTHROPIC_SMALL_FAST_MODEL: instance.haikuModel ?? provider.model,
  } }
}

/** Build a DSH-only settings layer. A remote provider always wins over JSON env/model values. */
export async function prepareConfiguration(instance: ClaudeInstance, provider?: ProviderRuntime): Promise<PreparedConfiguration> {
  const owned = await readConfig(instance.id)
  if (instance.source === 'local') return {
    configDir: instance.useClaudeSettings ? instance.configDir : undefined,
    settingsPath: instance.useClaudeSettings ? (owned.exists ? owned.path : instance.settingsFile) : undefined,
    settingSources: instance.useClaudeSettings ? ['user', 'project', 'local'] : [],
    cleanup: async () => {},
  }

  const configDir = join(pluginRoot(), 'claude-home', instance.id)
  if (!instance.useClaudeSettings) return { configDir, settingSources: [], cleanup: async () => {} }

  let raw: unknown = owned.exists ? JSON.parse(owned.text) as unknown : {}
  if (!owned.exists && (instance.settingsFile || instance.configDir)) {
    const source = instance.settingsFile ?? join(instance.configDir!, 'settings.json')
    try { raw = JSON.parse(await readFile(source, 'utf8')) as unknown }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new Error('Selected Claude settings file does not exist')
      throw error
    }
  }
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Claude settings file must be a JSON object')
  if (!provider) throw new Error('Remote Claude instance is missing its provider')
  const safe = remoteSettings(raw as Record<string, unknown>, instance, provider)
  const directory = join(pluginRoot(), 'runtime-settings', randomUUID())
  await mkdir(directory, { recursive: true, mode: 0o700 })
  const settingsPath = join(directory, 'settings.json')
  await writeFile(settingsPath, JSON.stringify(safe), { mode: 0o600 })
  return { configDir, settingsPath, settingSources: [], cleanup: async () => { await rm(directory, { recursive: true, force: true }) } }
}
