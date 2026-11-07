import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import type { Context } from '@deepseek-ai/cordis'
import type { ClaudeInstance } from './state.js'

interface DshProvider { api?: string; baseURL?: string; apiKeyEnv?: string; models?: { id: string; name?: string }[] }
interface FlowbaseState { instances: {
  id: string; name: string; baseUrl: string; token: string
  applications: { applicationId: string; name: string; apiKey: string; models: { id: string; name?: string }[] }[]
  mcps: { mcpInstanceId: string; name: string; serverName: string }[]
}[] }

export interface ModelChoice { source: 'dsh' | '1flowbase'; provider: string; providerName: string;
  model: string; modelName: string; flowbaseInstanceId?: string; applicationId?: string }
export interface ResolvedInstance { model: string; baseUrl?: string; apiKey?: string;
  mcpServers: Record<string, { type: 'http'; url: string; headers: Record<string, string> }> }

function dshProviders(ctx: Context): Record<string, DshProvider> {
  const settings = ctx.get('settings')
  const descriptor = settings?.describe().find(row => row.ns === 'llm-pi-ai')
  const value = descriptor?.value as { providers?: Record<string, DshProvider> } | undefined
  return value?.providers ?? {}
}

function messagesProfile(provider: string, profile: DshProvider): boolean {
  return profile.api === 'anthropic-messages' || (provider === 'anthropic' && profile.api === undefined)
}

async function configuredModels(ctx: Context, provider: string, profile: DshProvider): Promise<{ id: string; name?: string }[]> {
  if (profile.models && profile.models.length > 0) return profile.models
  return (await ctx.llm.listModels(provider)).map(model => ({ id: model.id, name: model.name }))
}

function requiredModels(instance: ClaudeInstance): string[] {
  return [...new Set([instance.model, instance.opusModel, instance.sonnetModel, instance.haikuModel].filter((id): id is string => !!id))]
}

export async function flowbaseState(): Promise<FlowbaseState> {
  const path = join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), '1flowbase-dsh-plugin', 'state.json')
  try { return JSON.parse(await readFile(path, 'utf8')) as FlowbaseState }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { instances: [] }
    throw error
  }
}

export async function modelChoices(ctx: Context): Promise<ModelChoice[]> {
  const dsh = (await Promise.all(Object.entries(dshProviders(ctx)).map(async ([provider, profile]) => {
    if (!messagesProfile(provider, profile) || (provider !== 'anthropic' && !profile.baseURL)) return []
    const models = await configuredModels(ctx, provider, profile).catch(() => [])
    return models.map(model => ({ source: 'dsh' as const, provider,
      providerName: provider, model: model.id, modelName: model.name ?? model.id }))
  }))).flat()
  const flowbase = (await flowbaseState()).instances.flatMap(instance => instance.applications.flatMap(app =>
    app.models.map(model => ({ source: '1flowbase' as const, provider: `${instance.id}/${app.applicationId}`,
      providerName: `${instance.name} / ${app.name}`, model: model.id, modelName: model.name ?? model.id,
      flowbaseInstanceId: instance.id, applicationId: app.applicationId }))))
  return [...dsh, ...flowbase]
}

/** Resolve secrets only at launch. They are never returned by settings routes. */
export async function resolveInstance(ctx: Context, instance: ClaudeInstance): Promise<ResolvedInstance> {
  if (instance.source === 'local') return { model: instance.model, mcpServers: await flowbaseMcpServers() }
  if (instance.source === 'dsh') {
    const provider = instance.provider ?? ''
    const profile = dshProviders(ctx)[provider]
    if (!profile || !messagesProfile(provider, profile) || (provider !== 'anthropic' && !profile.baseURL)) {
      throw new Error('DSH provider is not a configured Messages endpoint')
    }
    const ref = profile.apiKeyEnv ?? (provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : undefined)
    if (ref === undefined) throw new Error('DSH Messages provider requires an API key reference')
    const key = (await ctx.get('credentials')?.resolve(credentialRef(ref)))?.value
      ?? process.env[ref]
    if (!key) throw new Error('DSH provider credential is unavailable')
    const available = new Set((await configuredModels(ctx, provider, profile)).map(model => model.id))
    if (requiredModels(instance).some(model => !available.has(model))) throw new Error('Model is no longer registered in DSH')
    return { model: instance.model, ...(profile.baseURL ? { baseUrl: normalizeClaudeBaseUrl(profile.baseURL) } : {}), apiKey: key,
      mcpServers: await flowbaseMcpServers() }
  }
  const source = (await flowbaseState()).instances.find(row => row.id === instance.flowbaseInstanceId)
  const app = source?.applications.find(row => row.applicationId === instance.applicationId)
  const available = new Set(app?.models.map(model => model.id) ?? [])
  if (!source || !app || requiredModels(instance).some(model => !available.has(model))) throw new Error('1flowbase model is no longer registered')
  return { model: instance.model, baseUrl: normalizeClaudeBaseUrl(source.baseUrl), apiKey: app.apiKey,
    mcpServers: await flowbaseMcpServers() }
}

export function normalizeClaudeBaseUrl(value: string): string {
  const url = new URL(value)
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Messages endpoint must use HTTP(S)')
  return value.replace(/\/+$/u, '').replace(/\/v1$/u, '')
}

export async function flowbaseMcpServers(): Promise<ResolvedInstance['mcpServers']> {
  const servers: ResolvedInstance['mcpServers'] = {}
  for (const instance of (await flowbaseState()).instances) {
    for (const mcp of instance.mcps) {
      servers[mcp.serverName] = { type: 'http',
        url: `${instance.baseUrl.replace(/\/+$/u, '')}/api/mcp/${encodeURIComponent(mcp.mcpInstanceId)}`,
        headers: { authorization: `Bearer ${instance.token}` } }
    }
  }
  return servers
}
