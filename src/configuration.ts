import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { SettingSource } from '@anthropic-ai/claude-agent-sdk'
import type { ClaudeInstance } from './state.js'

const pluginRoot = () => join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'dsh-plugin-claude-code')

export interface PreparedConfiguration {
  configDir?: string
  settingsPath?: string
  settingSources: SettingSource[]
  cleanup(): Promise<void>
}

/** Keep remote-provider credentials above Claude's settings-file env layer. */
export async function prepareConfiguration(instance: ClaudeInstance): Promise<PreparedConfiguration> {
  if (instance.source === 'local') return {
    configDir: instance.useClaudeSettings ? instance.configDir : undefined,
    settingsPath: instance.useClaudeSettings ? instance.settingsFile : undefined,
    settingSources: instance.useClaudeSettings ? ['user', 'project', 'local'] : [],
    cleanup: async () => {},
  }

  const configDir = join(pluginRoot(), 'claude-home', instance.id)
  if (!instance.useClaudeSettings) return { configDir, settingSources: [], cleanup: async () => {} }

  const source = instance.settingsFile ?? join(instance.configDir ?? join(homedir(), '.claude'), 'settings.json')
  let raw: unknown
  try { raw = JSON.parse(await readFile(source, 'utf8')) as unknown }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      if (instance.settingsFile || instance.configDir) throw new Error('Selected Claude settings file does not exist')
      return { configDir, settingSources: [], cleanup: async () => {} }
    }
    throw error
  }
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Claude settings file must be a JSON object')
  const safe = { ...raw as Record<string, unknown> }
  // Settings.env is applied inside the CLI after process creation. Letting it
  // through can silently replace the instance's Messages endpoint and key.
  delete safe.env
  delete safe.model
  const directory = join(pluginRoot(), 'runtime-settings', randomUUID())
  await mkdir(directory, { recursive: true, mode: 0o700 })
  const settingsPath = join(directory, 'settings.json')
  await writeFile(settingsPath, JSON.stringify(safe), { mode: 0o600 })
  return { configDir, settingsPath, settingSources: [], cleanup: async () => { await rm(directory, { recursive: true, force: true }) } }
}
