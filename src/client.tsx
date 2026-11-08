import { useEffect, useMemo, useState } from 'react'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { ClaudeInstance, InstanceInput } from './state.js'
import type { ProviderChoice } from './sources.js'
import { installStyles } from './client-styles.js'

const PREFIX = '/api/dsh-claude-code'

async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(`${PREFIX}${path}`, {
    method,
    headers: { accept: 'application/json', 'content-type': 'application/json', 'x-dsh-claude-code-request': '1' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const payload = await response.json() as { ok: boolean; data: T; error?: string }
  if (!payload.ok) throw new Error(payload.error ?? `HTTP ${response.status}`)
  return payload.data
}

type Filter = 'all' | 'local' | 'dsh' | '1flowbase'
type ConfigView = { path: string; text: string; exists: boolean }

function sourceName(source: ClaudeInstance['source']): string {
  if (source === 'dsh') return 'DSH · Messages'
  if (source === '1flowbase') return '1flowbase'
  return '本地认证'
}

function sourceMark(source: ClaudeInstance['source']): string {
  if (source === 'dsh') return 'D'
  if (source === '1flowbase') return '1'
  return '✦'
}

function providerFor(row: Pick<ClaudeInstance, 'source' | 'provider' | 'flowbaseInstanceId' | 'applicationId'>,
  providers: readonly ProviderChoice[]): ProviderChoice | undefined {
  if (row.source === 'dsh') return providers.find(provider => provider.source === 'dsh' && provider.provider === row.provider)
  if (row.source === '1flowbase') return providers.find(provider => provider.source === '1flowbase'
    && provider.flowbaseInstanceId === row.flowbaseInstanceId && provider.applicationId === row.applicationId)
  return undefined
}

function ProviderCard({ row, provider, onEdit, onToggle, onDelete, busy }: {
  row: ClaudeInstance
  provider?: ProviderChoice
  onEdit(): void
  onToggle(): void
  onDelete(): void
  busy: boolean
}) {
  const [confirming, setConfirming] = useState(false)
  const missing = row.source !== 'local' && !provider
  return <article className={`cc-card${row.enabled ? ' cc-card-active' : ''}`}>
    <div className="cc-card-top">
      <div className="cc-card-icon" aria-hidden="true">{sourceMark(row.source)}</div>
      <div className="cc-card-main">
        <div className="cc-card-title">
          <h3>{row.name}</h3>
          <span className="cc-pill">{sourceName(row.source)}</span>
          <span className={`cc-pill${row.enabled ? ' cc-pill-on' : ''}`}>{row.enabled ? '已启用' : '已停用'}</span>
        </div>
        <p className="cc-card-url">{row.source === 'local'
          ? '使用本机 Claude Code 的认证和默认配置'
          : missing ? '来源供应商已移除，请重新配置' : `${provider?.name} · ${provider?.endpoint ?? '默认端点'}`}</p>
      </div>
    </div>
    <p className="cc-card-model"><span>主模型　</span>{row.model === 'default' ? 'Claude Code 默认模型' : row.model}</p>
    <div className="cc-card-bottom">
      <span className="cc-card-hint">{row.useClaudeSettings ? '使用 DSH 私有 Claude 配置' : '不加载实例配置文件'} · {row.enabled ? '对话模型列表中可选' : '对话模型列表中隐藏'}</span>
      <div className="cc-card-actions">
        {!missing && <button className={`cc-btn${row.enabled ? ' cc-btn-quiet' : ' cc-btn-primary'}`} type="button" disabled={busy} onClick={onToggle}>
          {row.enabled ? '停用' : '启用'}
        </button>}
        <button className="cc-btn" type="button" onClick={onEdit}>编辑配置</button>
        {row.id !== 'local' && (confirming
          ? <>
              <button className="cc-btn cc-btn-quiet" type="button" onClick={() => setConfirming(false)}>取消</button>
              <button className="cc-btn cc-btn-danger" type="button" disabled={busy} onClick={onDelete}>确认删除</button>
            </>
          : <button className="cc-btn cc-btn-quiet" type="button" onClick={() => setConfirming(true)}>删除</button>)}
      </div>
    </div>
  </article>
}

function SourceCard({ provider, onAdd }: { provider: ProviderChoice; onAdd(): void }) {
  return <article className="cc-card cc-source-card">
    <div className="cc-card-top">
      <div className="cc-card-icon" aria-hidden="true">{sourceMark(provider.source)}</div>
      <div className="cc-card-main">
        <div className="cc-card-title"><h3>{provider.name}</h3><span className="cc-pill">{sourceName(provider.source)}</span></div>
        <p className="cc-card-url">{provider.endpoint ?? '供应商默认端点'}</p>
      </div>
    </div>
    <div className="cc-card-bottom"><span className="cc-card-hint">{provider.models.length} 个已注册模型 · 凭据由来源插件管理</span>
      <button className="cc-btn" type="button" onClick={onAdd}>以此创建配置　→</button></div>
  </article>
}

function Editor({ initial, seed, providers, onBack, onSaved }: {
  initial?: ClaudeInstance
  seed?: ProviderChoice
  providers: ProviderChoice[]
  onBack(): void
  onSaved(): Promise<void>
}) {
  const [draft, setDraft] = useState<InstanceInput>(() => initial ? { ...initial } : seed ? {
    name: seed.name, source: seed.source, enabled: true, model: seed.models[0]?.id ?? '',
    provider: seed.source === 'dsh' ? seed.provider : undefined,
    flowbaseInstanceId: seed.flowbaseInstanceId, applicationId: seed.applicationId,
    useClaudeSettings: true,
  } : { name: '', source: 'dsh', enabled: true, model: '', useClaudeSettings: true })
  const [config, setConfig] = useState('{}\n')
  const [filePath, setFilePath] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(!!initial)
  const [tab, setTab] = useState<'models' | 'json'>(initial ? 'json' : 'models')
  useEffect(() => {
    if (!initial) return
    void request<ConfigView>(`/instances/${encodeURIComponent(initial.id)}/config`).then(view => {
      setConfig(view.text)
      setFilePath(view.path)
    }).catch(cause => setError(cause instanceof Error ? cause.message : String(cause))).finally(() => setLoading(false))
  }, [initial?.id])

  const selected = providerFor(draft, providers)
  const dsh = providers.filter(provider => provider.source === 'dsh')
  const flowbase = providers.filter(provider => provider.source === '1flowbase')
  const providerId = selected?.id ?? ''
  const availableModels = selected?.models ?? []
  const setField = <K extends keyof InstanceInput>(key: K, value: InstanceInput[K]) =>
    setDraft(current => ({ ...current, [key]: value }))

  const selectProvider = (id: string) => {
    const next = providers.find(provider => provider.id === id)
    if (!next) return
    setDraft(current => ({ ...current,
      source: next.source,
      provider: next.source === 'dsh' ? next.provider : undefined,
      flowbaseInstanceId: next.flowbaseInstanceId,
      applicationId: next.applicationId,
      name: current.name || next.name,
      model: next.models[0]?.id ?? '',
      opusModel: undefined, sonnetModel: undefined, haikuModel: undefined,
    }))
  }

  const formatJson = () => {
    try {
      const parsed: unknown = JSON.parse(config)
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('配置顶层必须是 JSON 对象')
      setConfig(`${JSON.stringify(parsed, null, 2)}\n`)
      setError('')
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) }
  }

  const save = async () => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      if (!draft.name.trim()) throw new Error('请填写配置名称')
      if (draft.source !== 'local') {
        if (!selected) throw new Error('请选择已注册的 Messages 或 1flowbase 供应商')
        const allowed = new Set(selected.models.map(model => model.id))
        if (!allowed.has(draft.model)) throw new Error('请选择该供应商已注册的主模型')
        for (const model of [draft.opusModel, draft.sonnetModel, draft.haikuModel]) {
          if (model && !allowed.has(model)) throw new Error('模型映射必须属于同一个供应商')
        }
      }
      const parsed: unknown = JSON.parse(config)
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('配置顶层必须是 JSON 对象')
      const row = initial
        ? await request<ClaudeInstance>(`/instances/${encodeURIComponent(initial.id)}`, 'PATCH', {
            name: draft.name.trim(), enabled: draft.enabled, model: draft.model,
            opusModel: draft.opusModel, sonnetModel: draft.sonnetModel, haikuModel: draft.haikuModel,
            useClaudeSettings: draft.useClaudeSettings,
          })
        : await request<ClaudeInstance>('/instances', 'POST', { ...draft, name: draft.name.trim() })
      await request(`/instances/${encodeURIComponent(row.id)}/config`, 'PUT', { text: config })
      await onSaved()
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) }
    finally { setBusy(false) }
  }

  const modelSelect = (label: string, value: string | undefined, onChange: (value: string | undefined) => void) =>
    <label className="cc-field">{label}
      <select className="cc-select" value={value ?? ''} onChange={event => onChange(event.target.value || undefined)}>
        <option value="">跟随主模型</option>
        {availableModels.map(model => <option key={model.id} value={model.id}>{model.name} · {model.id}</option>)}
      </select>
    </label>

  return <div className="cc-page">
    <header className="cc-header">
      <div className="cc-heading">
        <button className="cc-btn cc-back" type="button" onClick={onBack} aria-label="返回配置列表">←</button>
        <div><h2>{initial ? '编辑 Claude 配置' : '添加 Claude 配置'}</h2>
          <p className="cc-subtitle">按供应商配置模型；设置文件只在 DSH 中使用。</p></div>
      </div>
    </header>
    {error && <div className="cc-alert" role="alert">{error}</div>}
    <div className="cc-tabs" role="tablist" aria-label="Claude 配置编辑">
      <button type="button" role="tab" className="cc-tab" aria-selected={tab === 'models'} onClick={() => setTab('models')}>供应商与模型</button>
      <button type="button" role="tab" className="cc-tab" aria-selected={tab === 'json'} onClick={() => setTab('json')}>配置 JSON</button>
    </div>
    <div className="cc-editor">
      {tab === 'models' && <>
      <section className="cc-section">
        <div className="cc-section-head"><div><h3>供应商与模型</h3><p>供应商凭据沿用 DSH 或 1flowbase 已保存的配置，此处不填写 API Key。</p></div></div>
        <div className="cc-grid">
          <label className="cc-field">配置名称
            <input className="cc-input" value={draft.name} placeholder="例如：代码开发 · 1flowbase" onChange={event => setField('name', event.target.value)} />
          </label>
          {draft.source === 'local' ? <label className="cc-field">来源
            <input className="cc-input" value="本地 Claude Code 认证" disabled readOnly />
          </label> : <label className="cc-field">模型供应商
            <select className="cc-select" value={providerId} disabled={!!initial} onChange={event => selectProvider(event.target.value)}>
              <option value="">选择已注册供应商</option>
              <optgroup label="DSH · Anthropic Messages">
                {dsh.map(provider => <option key={provider.id} value={provider.id}>{provider.name}</option>)}
              </optgroup>
              <optgroup label="1flowbase · 已导入应用">
                {flowbase.map(provider => <option key={provider.id} value={provider.id}>{provider.name}</option>)}
              </optgroup>
            </select>
            <small>{draft.source === '1flowbase' ? '使用 1flowbase 已转换的 Messages 模型。' : '只列出 DSH 中使用 anthropic-messages 协议的供应商。'}</small>
          </label>}
          {draft.source === 'local' ? <label className="cc-field cc-field-wide">主模型
            <input className="cc-input" value={draft.model} onChange={event => setField('model', event.target.value)} placeholder="default" />
            <small>填 default 使用本地 Claude Code 的原有模型设置。</small>
          </label> : <>
            <label className="cc-field cc-field-wide">主模型
              <select className="cc-select" value={draft.model} disabled={!selected} onChange={event => setField('model', event.target.value)}>
                <option value="">选择主模型</option>
                {availableModels.map(model => <option key={model.id} value={model.id}>{model.name} · {model.id}</option>)}
              </select>
            </label>
            {modelSelect('Opus 默认模型', draft.opusModel, value => setField('opusModel', value))}
            {modelSelect('Sonnet 默认模型', draft.sonnetModel, value => setField('sonnetModel', value))}
            {modelSelect('Haiku 默认模型', draft.haikuModel, value => setField('haikuModel', value))}
          </>}
        </div>
      </section>

      <section className="cc-section">
        <div className="cc-section-head"><div><h3>实例行为</h3><p>启用的实例会出现在 DSH 对话的 Claude Code 模型列表中。</p></div></div>
        <label className="cc-switch-row"><span><strong>启用实例</strong><small>允许在新对话中选择这份配置</small></span>
          <input type="checkbox" checked={draft.enabled} onChange={event => setField('enabled', event.target.checked)} /></label>
        <label className="cc-switch-row"><span><strong>使用 DSH 私有 Claude 配置</strong><small>下方 JSON 存在 DSH 插件目录，不改动 ~/.claude/settings.json</small></span>
          <input type="checkbox" checked={draft.useClaudeSettings} onChange={event => setField('useClaudeSettings', event.target.checked)} /></label>
      </section>
      </>}

      {tab === 'json' &&
      <section className="cc-section">
        <div className="cc-section-head"><div><h3>配置 JSON <span className={`cc-pill${draft.useClaudeSettings ? ' cc-pill-on' : ''}`}>{draft.useClaudeSettings ? '已启用' : '未启用'}</span></h3><p>直接编辑此实例的 Claude 设置文件。模型与供应商认证在启动时按所选供应商覆盖。</p></div>
          <button className="cc-btn" type="button" onClick={formatJson}>格式化</button></div>
        {initial?.settingsFile && <p className="cc-note">原外部文件只作旧配置兼容；保存后使用下方的 DSH 私有文件。</p>}
        <div className="cc-editor-shell">
          <div className="cc-lines" aria-hidden="true">{Array.from({ length: Math.max(1, config.split('\n').length) }, (_, index) => index + 1).join('\n')}</div>
          <textarea className="cc-json" aria-label="Claude 配置 JSON" spellCheck={false} value={config} disabled={loading}
            onChange={event => setConfig(event.target.value)} />
        </div>
        <p className="cc-filepath">{filePath || '保存后在 DSH 插件目录创建独立配置文件'}</p>
      </section>
      }
      <footer className="cc-editor-foot">
        <span className="cc-card-hint">{draft.source === 'local' ? '本地认证保持原样' : 'API Key 不写入配置文件'}</span>
        <div className="cc-editor-actions"><button className="cc-btn" type="button" onClick={onBack}>取消</button>
          <button className="cc-btn cc-btn-primary" type="button" disabled={busy || loading} onClick={() => { void save() }}>{busy ? '保存中…' : '保存配置'}</button></div>
      </footer>
    </div>
  </div>
}

function Panel() {
  const [instances, setInstances] = useState<ClaudeInstance[]>([])
  const [providers, setProviders] = useState<ProviderChoice[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [editing, setEditing] = useState<string | 'new' | undefined>()
  const [seedId, setSeedId] = useState<string>()
  const [busyId, setBusyId] = useState<string>()
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const reload = async () => {
    const [rows, catalog] = await Promise.all([
      request<ClaudeInstance[]>('/instances'), request<ProviderChoice[]>('/providers'),
    ])
    setInstances(rows)
    setProviders(catalog)
  }
  useEffect(() => { void reload().catch(cause => setError(cause instanceof Error ? cause.message : String(cause))) }, [])
  const shown = useMemo(() => instances.filter(row => filter === 'all' || row.source === filter), [instances, filter])
  const current = editing && editing !== 'new' ? instances.find(row => row.id === editing) : undefined
  const seed = editing === 'new' ? providers.find(provider => provider.id === seedId) : undefined
  const available = providers.filter(provider => filter === 'all' || provider.source === filter)

  const toggle = async (row: ClaudeInstance) => {
    setBusyId(row.id)
    setError('')
    try {
      await request(`/instances/${encodeURIComponent(row.id)}`, 'PATCH', { enabled: !row.enabled })
      await reload()
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) }
    finally { setBusyId(undefined) }
  }
  const remove = async (row: ClaudeInstance) => {
    setBusyId(row.id)
    setError('')
    try {
      await request(`/instances/${encodeURIComponent(row.id)}`, 'DELETE')
      await reload()
      setStatus(`已删除「${row.name}」`)
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)) }
    finally { setBusyId(undefined) }
  }

  if (editing) return <Editor key={`${editing}:${seedId ?? ''}`} initial={current} seed={seed} providers={providers}
    onBack={() => setEditing(undefined)} onSaved={async () => { await reload(); setEditing(undefined); setStatus('配置已保存') }} />

  const filters: { id: Filter; label: string; count: number }[] = [
    { id: 'all', label: '全部', count: instances.length },
    { id: 'local', label: '本地', count: instances.filter(row => row.source === 'local').length },
    { id: 'dsh', label: 'DSH Messages', count: instances.filter(row => row.source === 'dsh').length },
    { id: '1flowbase', label: '1flowbase', count: instances.filter(row => row.source === '1flowbase').length },
  ]
  return <div className="cc-page">
    <header className="cc-header">
      <div className="cc-heading"><div className="cc-mark" aria-hidden="true">✦</div><div>
        <h2>Claude Code 配置</h2>
        <p className="cc-subtitle">为 DSH 对话保存独立配置，切换供应商时不改动本机 Claude Code。</p>
      </div></div>
      <div className="cc-header-actions">
        <button className="cc-btn" type="button" onClick={() => { void reload().catch(cause => setError(String(cause))) }}>刷新供应商</button>
        <button className="cc-btn cc-btn-primary" type="button" onClick={() => { setSeedId(undefined); setEditing('new') }}>＋ 添加配置</button>
      </div>
    </header>
    {error && <div className="cc-alert" role="alert">{error}</div>}
    {status && <div className="cc-note" role="status">{status}</div>}
    {providers.filter(provider => provider.source === 'dsh').length === 0 && <div className="cc-note">
      当前 DSH 没有使用 <code>anthropic-messages</code> 协议的供应商。可先在 DSH「模型」中配置；1flowbase 已导入应用仍可直接使用。
    </div>}
    <nav className="cc-filterbar" aria-label="配置来源">
      {filters.map(item => <button key={item.id} className="cc-filter" type="button" aria-pressed={filter === item.id}
        onClick={() => setFilter(item.id)}>{item.label}<span className="cc-filter-count">{item.count}</span></button>)}
    </nav>
    <div className="cc-list">
      {shown.length === 0 ? <div className="cc-empty">这里还没有配置。点右上角「添加配置」，从已注册供应商选择一个。</div>
        : shown.map(row => <ProviderCard key={row.id} row={row} provider={providerFor(row, providers)}
            busy={busyId === row.id} onEdit={() => setEditing(row.id)}
            onToggle={() => { void toggle(row) }} onDelete={() => { void remove(row) }} />)}
    </div>
    {available.length > 0 && <section className="cc-available">
      <div className="cc-available-head"><h3>可用供应商</h3><span>仅来自 DSH Messages 与 1flowbase 已注册供应商</span></div>
      <div className="cc-list">{available.map(provider => <SourceCard key={provider.id} provider={provider}
        onAdd={() => { setSeedId(provider.id); setEditing('new') }} />)}</div>
    </section>}
  </div>
}

export const inject = ['slots']
export function apply(ctx: {
  effect: (install: () => () => void, label: string) => unknown
  slots: { inject: (name: string, register: () => unknown) => void;
    register: (options: unknown, component: typeof Panel) => unknown }
}): void {
  ctx.effect(installStyles, 'Claude Code settings styles')
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section', id: 'claude-code-instances', order: 81,
    label: () => 'Claude Code',
  }, Panel))
}
