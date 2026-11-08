import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { InstanceStore } from '../src/state.js'
import { flowbaseMcpServers, modelChoices, providerChoices, resolveInstance } from '../src/sources.js'
import { directUserText } from '../src/prompt.js'
import { prepareConfiguration } from '../src/configuration.js'
import { readConfig, writeConfig } from '../src/config-files.js'

let root = ''
const oldHome = process.env.DSH_HOME
beforeEach(async () => { root = await mkdtemp(join(tmpdir(), 'dsh-claude-test-')); process.env.DSH_HOME = root })
afterEach(() => { if (oldHome === undefined) delete process.env.DSH_HOME; else process.env.DSH_HOME = oldHome })

it('keeps instance settings in DSH_HOME and never changes the user Claude settings', async () => {
  const store = new InstanceStore()
  await store.load()
  const row = await store.put({ name: 'Gateway', source: 'dsh', enabled: true,
    model: 'claude-custom', provider: 'gateway', useClaudeSettings: false })
  expect(row.id).toBeTruthy()
  expect(store.list().filter(item => item.enabled).map(item => item.id)).toEqual([row.id])
  expect(new InstanceStore()).toBeDefined()
  expect(JSON.parse(await readFile(join(root, 'dsh-plugin-claude-code', 'instances.json'), 'utf8'))).toHaveLength(2)
  await Promise.all([
    store.patch(row.id, { opusModel: 'claude-custom' }),
    store.patch(row.id, { settingsFile: '/tmp/alternate-settings.json' }),
  ])
  expect(store.get(row.id)).toMatchObject({ opusModel: 'claude-custom', settingsFile: '/tmp/alternate-settings.json' })
})

it('keeps exactly one Claude Code instance active when switching, deleting, and loading old state', async () => {
  const store = new InstanceStore()
  await store.load()
  const first = await store.put({ name: 'First', source: 'dsh', enabled: false,
    model: 'first', provider: 'gateway', useClaudeSettings: true })
  expect(store.list().filter(row => row.enabled).map(row => row.id)).toEqual(['local'])
  await store.patch(first.id, { enabled: true })
  expect(store.list().filter(row => row.enabled).map(row => row.id)).toEqual([first.id])
  await expect(store.patch(first.id, { enabled: false })).rejects.toThrow('Activate another instance')
  const second = await store.put({ name: 'Second', source: 'dsh', enabled: true,
    model: 'second', provider: 'gateway', useClaudeSettings: true })
  expect(store.list().filter(row => row.enabled).map(row => row.id)).toEqual([second.id])
  await store.remove(second.id)
  expect(store.list().filter(row => row.enabled).map(row => row.id)).toEqual(['local'])

  const file = join(root, 'dsh-plugin-claude-code', 'instances.json')
  await writeFile(file, JSON.stringify(store.list().map(row => ({ ...row, enabled: true }))))
  const migrated = new InstanceStore()
  await migrated.load()
  expect(migrated.list().filter(row => row.enabled).map(row => row.id)).toEqual([first.id])
  expect(JSON.parse(await readFile(file, 'utf8')).filter((row: { enabled: boolean }) => row.enabled)).toHaveLength(1)
})

it('offers only DSH Messages routes, and resolves 1flowbase model plus enabled MCP at launch', async () => {
  const dir = join(root, '1flowbase-dsh-plugin')
  await mkdir(dir)
  await writeFile(join(dir, 'state.json'), JSON.stringify({ instances: [{
    id: 'fb1', name: '1flowbase', baseUrl: 'https://flow.example', token: 'console-secret',
    applications: [{ applicationId: 'app1', name: 'Translation', apiKey: 'app-secret',
      models: [{ id: 'translated-claude', name: 'Translated Claude' }] }],
    mcps: [{ mcpInstanceId: 'mcp1', name: 'Tools', serverName: 'Tools_mcp1' }],
  }] }))
  const ctx = { get(name: string) {
    if (name === 'settings') return { describe: () => [{ ns: 'llm-pi-ai', value: { providers: {
      gateway: { api: 'anthropic-messages', baseURL: 'https://gateway.example/v1', apiKeyEnv: 'GATEWAY_KEY',
        models: [{ id: 'claude-custom' }] },
      ignored: { api: 'openai-completions', baseURL: 'https://other.example', models: [{ id: 'other' }] },
    } } }] }
    if (name === 'credentials') return { resolve: async () => ({ value: 'dsh-secret' }) }
  } } as never
  expect((await modelChoices(ctx)).map(row => row.model)).toEqual(['claude-custom', 'translated-claude'])
  expect((await providerChoices(ctx)).map(row => ({ source: row.source, models: row.models.length }))).toEqual([
    { source: 'dsh', models: 1 }, { source: '1flowbase', models: 1 },
  ])
  const resolved = await resolveInstance(ctx, { id: 'fb-instance', name: 'Flow', source: '1flowbase', enabled: true,
    model: 'translated-claude', opusModel: 'translated-claude', flowbaseInstanceId: 'fb1', applicationId: 'app1', useClaudeSettings: false })
  expect(resolved).toMatchObject({ model: 'translated-claude', baseUrl: 'https://flow.example', apiKey: 'app-secret' })
  expect((await flowbaseMcpServers()).Tools_mcp1).toMatchObject({ type: 'http',
    url: 'https://flow.example/api/mcp/mcp1', headers: { authorization: 'Bearer console-secret' } })
  await expect(resolveInstance(ctx, { id: 'fb-instance', name: 'Flow', source: '1flowbase', enabled: true,
    model: 'translated-claude', haikuModel: 'missing', flowbaseInstanceId: 'fb1', applicationId: 'app1',
    useClaudeSettings: false })).rejects.toThrow('model is no longer registered')
})

it('sends the human prompt instead of DSH synthetic runtime context', () => {
  const messages = [
    { role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: 'Reply OK' }] },
    { role: 'user', source: { kind: 'runtime-context' }, content: [{ type: 'text', text: 'Context changed' }] },
  ] as never
  expect(directUserText(messages)).toBe('Reply OK')
})

it('loads an alternate Claude settings file without letting its provider env replace the selected instance', async () => {
  const file = join(root, 'alternate-settings.json')
  await writeFile(file, JSON.stringify({ model: 'wrong-model', env: { ANTHROPIC_BASE_URL: 'https://wrong.example',
    ANTHROPIC_AUTH_TOKEN: 'fixture-secret' }, permissions: { deny: ['Bash(*)'] } }))
  const prepared = await prepareConfiguration({ id: 'remote', name: 'Remote', source: 'dsh', enabled: true,
    model: 'chosen-model', provider: 'gateway', useClaudeSettings: true, settingsFile: file },
    { model: 'chosen-model', baseUrl: 'https://gateway.example' })
  expect(prepared.configDir).toContain(join(root, 'dsh-plugin-claude-code', 'claude-home', 'remote'))
  expect(prepared.settingSources).toEqual([])
  const safe = JSON.parse(await readFile(prepared.settingsPath!, 'utf8'))
  expect(safe.permissions).toEqual({ deny: ['Bash(*)'] })
  expect(safe.model).toBe('chosen-model')
  expect(safe.env).toMatchObject({ ANTHROPIC_BASE_URL: 'https://gateway.example',
    ANTHROPIC_MODEL: 'chosen-model', ANTHROPIC_DEFAULT_OPUS_MODEL: 'chosen-model' })
  expect(safe.env).not.toHaveProperty('ANTHROPIC_AUTH_TOKEN')
  await prepared.cleanup()
  await expect(readFile(prepared.settingsPath!, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })
})

it('edits a DSH-owned JSON file and uses it without changing the user settings file', async () => {
  const instance = { id: 'profile-one', name: 'Profile', source: 'dsh' as const, enabled: true,
    model: 'main', provider: 'gateway', useClaudeSettings: true }
  const source = join(root, 'user-settings.json')
  await writeFile(source, '{"theme":"unchanged"}')
  const editable = '{\n  "permissions": { "deny": ["Bash(*)"] },\n  "env": { "ANTHROPIC_AUTH_TOKEN": "fixture" }\n}\n'
  const path = await writeConfig(instance.id, editable)
  expect((await readConfig(instance.id)).text).toBe(editable)
  const prepared = await prepareConfiguration(instance, { model: 'main', baseUrl: 'https://gateway.example' })
  expect(prepared.settingsPath).not.toBe(path)
  expect(JSON.parse(await readFile(prepared.settingsPath!, 'utf8')).env).not.toHaveProperty('ANTHROPIC_AUTH_TOKEN')
  expect(await readFile(source, 'utf8')).toBe('{"theme":"unchanged"}')
  await prepared.cleanup()
})
