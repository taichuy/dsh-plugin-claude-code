import { useEffect, useState } from 'react'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { ClaudeInstance } from './state.js'
import type { ModelChoice } from './sources.js'

const base = '/api/dsh-claude-code'
async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(base + path, { method, headers: {
    'content-type': 'application/json', 'x-dsh-claude-code-request': '1' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  const payload = await response.json() as { ok: boolean; data: T; error?: string }
  if (!payload.ok) throw new Error(payload.error ?? 'Request failed')
  return payload.data
}

function Panel() {
  const [instances, setInstances] = useState<ClaudeInstance[]>([])
  const [choices, setChoices] = useState<ModelChoice[]>([])
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [choice, setChoice] = useState('')
  const [configDir, setConfigDir] = useState('')
  const [settingsFile, setSettingsFile] = useState('')
  const [opusModel, setOpusModel] = useState('')
  const [sonnetModel, setSonnetModel] = useState('')
  const [haikuModel, setHaikuModel] = useState('')
  const [useSettings, setUseSettings] = useState(false)
  const reload = async () => {
    const [nextInstances, nextChoices] = await Promise.all([
      request<ClaudeInstance[]>('/instances'), request<ModelChoice[]>('/models') ])
    setInstances(nextInstances); setChoices(nextChoices)
  }
  useEffect(() => { void reload().catch(error => setError(String(error))) }, [])
  const selectedChoice = choice === '' ? undefined : choices[Number(choice)]
  const modelsFor = (row: ClaudeInstance | ModelChoice) => choices.filter(choice =>
    row.source === choice.source && (row.source === 'dsh'
      ? 'provider' in row && row.provider === choice.provider
      : 'flowbaseInstanceId' in row && row.flowbaseInstanceId === choice.flowbaseInstanceId
        && 'applicationId' in row && row.applicationId === choice.applicationId))
  const tierSelect = (value: string | undefined, options: ModelChoice[], onChange: (value: string | undefined) => void) =>
    <select value={value ?? ''} onChange={event => onChange(event.target.value || undefined)}>
      <option value="">跟随主模型</option>
      {options.map(option => <option key={option.model} value={option.model}>{option.modelName}</option>)}
    </select>
  const save = async () => {
    try {
      const selected = selectedChoice
      if (!selected) throw new Error('选择一个模型')
      await request('/instances', 'POST', { name: name.trim() || `${selected.providerName} · ${selected.modelName}`,
        source: selected.source, enabled: true, model: selected.model,
        opusModel: opusModel || undefined, sonnetModel: sonnetModel || undefined,
        haikuModel: haikuModel || undefined,
        provider: selected.source === 'dsh' ? selected.provider : undefined,
        flowbaseInstanceId: selected.flowbaseInstanceId, applicationId: selected.applicationId,
        configDir: configDir.trim() || undefined, settingsFile: settingsFile.trim() || undefined,
        useClaudeSettings: useSettings })
      setName(''); setOpusModel(''); setSonnetModel(''); setHaikuModel(''); setError(''); await reload()
    } catch (error) { setError(error instanceof Error ? error.message : String(error)) }
  }
  const update = async (row: ClaudeInstance, patch: Partial<ClaudeInstance>) => {
    try { await request('/instances', 'POST', { ...row, ...patch }); setError(''); await reload() }
    catch (error) { setError(error instanceof Error ? error.message : String(error)) }
  }
  return <section style={{ maxWidth: 720, display: 'grid', gap: 12 }}>
    <h2>Claude Code 实例</h2>
    <p>在模型选择器中选择实例。配置只保存到 DSH 插件目录，不修改用户默认 Claude 配置。</p>
    {error && <p role="alert">{error}</p>}
    {instances.map(row => <div key={row.id} style={{ display: 'grid', gap: 6, padding: 12,
      border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 8 }}>
      <strong>{row.name}</strong><span>{row.source} · {row.model}</span>
      {row.source !== 'local' && <>
        <label>Opus 模型 {tierSelect(row.opusModel, modelsFor(row), value => { void update(row, { opusModel: value }) })}</label>
        <label>Sonnet 模型 {tierSelect(row.sonnetModel, modelsFor(row), value => { void update(row, { sonnetModel: value }) })}</label>
        <label>Haiku 模型 {tierSelect(row.haikuModel, modelsFor(row), value => { void update(row, { haikuModel: value }) })}</label>
      </>}
      <label><input type="checkbox" checked={row.enabled} onChange={event => { void update(row, { enabled: event.target.checked }) }} /> 启用实例</label>
      <label><input type="checkbox" checked={row.useClaudeSettings} onChange={event => { void update(row, { useClaudeSettings: event.target.checked }) }} /> 启用 Claude Code 配置</label>
      <label>Claude 配置目录 <input value={row.configDir ?? ''} placeholder="默认目录"
        onChange={event => { const value = event.target.value; setInstances(current => current.map(item => item.id === row.id ? { ...item, configDir: value } : item)) }}
        onBlur={() => { void update(row, { configDir: row.configDir || undefined }) }} /></label>
      <label>Claude 设置文件 <input value={row.settingsFile ?? ''} placeholder="可选，settings.json 的绝对路径"
        onChange={event => { const value = event.target.value; setInstances(current => current.map(item => item.id === row.id ? { ...item, settingsFile: value } : item)) }}
        onBlur={() => { void update(row, { settingsFile: row.settingsFile || undefined }) }} /></label>
      {row.id !== 'local' && <button onClick={() => { void request(`/instances/${encodeURIComponent(row.id)}`, 'DELETE').then(reload).catch(error => setError(String(error))) }}>删除</button>}
    </div>)}
    <h3>添加模型实例</h3>
    <label>名称 <input value={name} onChange={event => setName(event.target.value)} /></label>
    <label>主模型 <select value={choice} onChange={event => { setChoice(event.target.value); setOpusModel(''); setSonnetModel(''); setHaikuModel('') }}>
      <option value="">选择 DSH Messages 或 1flowbase 模型</option>
      {choices.map((row, index) => <option key={`${row.provider}/${row.model}`} value={index}>{row.providerName} · {row.modelName}</option>)}
    </select></label>
    {selectedChoice && <>
      <label>Opus 模型 {tierSelect(opusModel, modelsFor(selectedChoice), value => setOpusModel(value ?? ''))}</label>
      <label>Sonnet 模型 {tierSelect(sonnetModel, modelsFor(selectedChoice), value => setSonnetModel(value ?? ''))}</label>
      <label>Haiku 模型 {tierSelect(haikuModel, modelsFor(selectedChoice), value => setHaikuModel(value ?? ''))}</label>
    </>}
    <label>Claude 配置目录 <input value={configDir} placeholder="可选，绝对路径" onChange={event => setConfigDir(event.target.value)} /></label>
    <label>Claude 设置文件 <input value={settingsFile} placeholder="可选，settings.json 的绝对路径" onChange={event => setSettingsFile(event.target.value)} /></label>
    <label><input type="checkbox" checked={useSettings} onChange={event => setUseSettings(event.target.checked)} /> 启用 Claude Code 配置</label>
    <button onClick={() => { void save() }}>添加实例</button>
    <button onClick={() => { void reload().catch(error => setError(String(error))) }}>刷新模型目录</button>
  </section>
}

export const inject = ['slots']
export function apply(ctx: { slots: { inject: (name: string, register: () => unknown) => void;
  register: (options: unknown, component: typeof Panel) => unknown } }): void {
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section', id: 'claude-code-instances', order: 81,
    label: () => 'Claude Code',
  }, Panel))
}
