import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { isAbsolute, join, resolve, win32 } from 'node:path'

export type InstanceSource = 'local' | 'dsh' | '1flowbase'
export interface ClaudeInstance {
  id: string
  name: string
  source: InstanceSource
  enabled: boolean
  model: string
  opusModel?: string
  sonnetModel?: string
  haikuModel?: string
  provider?: string
  flowbaseInstanceId?: string
  applicationId?: string
  /** Optional alternate Claude Code settings directory. Never written by this plugin. */
  configDir?: string
  /** Optional Claude Code settings JSON file used only by this DSH instance. */
  settingsFile?: string
  /** One switch controls whether Claude Code settings are loaded for this instance. */
  useClaudeSettings: boolean
}

export interface InstanceInput extends Omit<ClaudeInstance, 'id'> { id?: string }

const root = () => resolve(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'dsh-plugin-claude-code')
export const statePath = () => join(root(), 'instances.json')

export class InstanceStore {
  private instances: ClaudeInstance[] = []
  private pending = Promise.resolve()

  async load(): Promise<void> {
    try {
      const raw: unknown = JSON.parse(await readFile(statePath(), 'utf8'))
      if (!Array.isArray(raw)) throw new Error('Invalid instance state')
      this.instances = raw.map(validateInstance)
      const active = this.instances.filter(row => row.enabled)
      if (active.length !== 1) {
        const selected = active.at(-1) ?? this.instances.find(row => row.id === 'local') ?? this.instances[0]
        if (!selected) throw new Error('Instance state is empty')
        this.activate(selected.id)
        await this.save()
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      this.instances = [{ id: 'local', name: '本地 Claude Code', source: 'local', enabled: true,
        model: 'default', useClaudeSettings: true }]
      await this.save()
    }
  }

  list(): ClaudeInstance[] { return this.instances.map(row => ({ ...row })) }
  get(id: string): ClaudeInstance | undefined { return this.list().find(row => row.id === id) }

  async put(input: InstanceInput): Promise<ClaudeInstance> {
    const row = validateInstance({ ...input, id: input.id ?? randomUUID() })
    await this.mutate(() => {
      const index = this.instances.findIndex(item => item.id === row.id)
      if (index >= 0 && this.instances[index].enabled && !row.enabled) {
        throw new Error('Activate another instance to switch Claude Code configuration')
      }
      if (index < 0) this.instances.push(row)
      else this.instances[index] = row
      if (row.enabled) this.activate(row.id)
    })
    return row
  }

  async patch(id: string, patch: Partial<ClaudeInstance>): Promise<ClaudeInstance> {
    if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) throw new Error('Invalid patch')
    const allowed = new Set(['name', 'enabled', 'model', 'opusModel', 'sonnetModel', 'haikuModel',
      'configDir', 'settingsFile', 'useClaudeSettings'])
    for (const key of Object.keys(patch)) if (!allowed.has(key)) throw new Error(`Cannot update ${key}`)
    await this.mutate(() => {
      const index = this.instances.findIndex(row => row.id === id)
      if (index < 0) throw new Error('Instance not found')
      if (patch.enabled === false && this.instances[index].enabled) throw new Error('Activate another instance to switch Claude Code configuration')
      this.instances[index] = validateInstance({ ...this.instances[index], ...patch })
      if (patch.enabled === true) this.activate(id)
    })
    return this.get(id)!
  }

  async remove(id: string): Promise<void> {
    if (id === 'local') throw new Error('Default local instance cannot be removed')
    await this.mutate(() => {
      const removed = this.instances.find(row => row.id === id)
      if (!removed) throw new Error('Instance not found')
      this.instances = this.instances.filter(row => row.id !== id)
      if (removed.enabled) this.activate(this.instances.find(row => row.id === 'local')?.id ?? this.instances[0].id)
    })
  }

  private activate(id: string): void {
    this.instances = this.instances.map(row => ({ ...row, enabled: row.id === id }))
  }

  private async mutate(update: () => void): Promise<void> {
    const operation = this.pending.then(async () => { update(); await this.save() })
    this.pending = operation.catch(() => {})
    await operation
  }

  private async save(): Promise<void> {
    await mkdir(root(), { recursive: true, mode: 0o700 })
    const file = statePath()
    const temp = `${file}.${process.pid}.tmp`
    await writeFile(temp, JSON.stringify(this.instances, null, 2), { mode: 0o600 })
    await rename(temp, file)
  }
}

function validText(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${field} is required`)
  return value.trim()
}

export function validateInstance(value: unknown): ClaudeInstance {
  if (value === null || typeof value !== 'object') throw new Error('Invalid instance')
  const row = value as Record<string, unknown>
  if (row.source !== 'local' && row.source !== 'dsh' && row.source !== '1flowbase') throw new Error('Invalid source')
  const id = validText(row.id, 'id')
  if (!/^[A-Za-z0-9_-]{1,128}$/u.test(id)) throw new Error('Invalid instance id')
  const name = validText(row.name, 'name')
  const model = validText(row.model, 'model')
  const opusModel = row.opusModel === undefined || row.opusModel === '' ? undefined : validText(row.opusModel, 'opusModel')
  const sonnetModel = row.sonnetModel === undefined || row.sonnetModel === '' ? undefined : validText(row.sonnetModel, 'sonnetModel')
  const haikuModel = row.haikuModel === undefined || row.haikuModel === '' ? undefined : validText(row.haikuModel, 'haikuModel')
  const configDir = row.configDir === undefined || row.configDir === '' ? undefined : validText(row.configDir, 'configDir')
  const settingsFile = row.settingsFile === undefined || row.settingsFile === '' ? undefined : validText(row.settingsFile, 'settingsFile')
  if (configDir !== undefined && !isAbsolute(configDir) && !win32.isAbsolute(configDir)) throw new Error('configDir must be absolute')
  if (settingsFile !== undefined && !isAbsolute(settingsFile) && !win32.isAbsolute(settingsFile)) throw new Error('settingsFile must be absolute')
  if (id === 'local' && row.source !== 'local') throw new Error('The default local instance must stay local')
  const provider = row.source === 'dsh' ? validText(row.provider, 'provider') : undefined
  const flowbaseInstanceId = row.source === '1flowbase' ? validText(row.flowbaseInstanceId, 'flowbaseInstanceId') : undefined
  const applicationId = row.source === '1flowbase' ? validText(row.applicationId, 'applicationId') : undefined
  return { id, name, source: row.source, enabled: row.enabled === true, model,
    useClaudeSettings: row.useClaudeSettings === true,
    ...(opusModel === undefined ? {} : { opusModel }),
    ...(sonnetModel === undefined ? {} : { sonnetModel }),
    ...(haikuModel === undefined ? {} : { haikuModel }),
    ...(configDir === undefined ? {} : { configDir }),
    ...(settingsFile === undefined ? {} : { settingsFile }),
    ...(provider === undefined ? {} : { provider }),
    ...(flowbaseInstanceId === undefined ? {} : { flowbaseInstanceId }),
    ...(applicationId === undefined ? {} : { applicationId }) }
}
