import { constants } from 'node:fs'
import { access, readdir } from 'node:fs/promises'
import { delimiter, dirname, isAbsolute, join } from 'node:path'
import { homedir } from 'node:os'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-agent-preset-registry'
import type {} from '@deepseek-ai/dsh-client-connection'
import type {} from '@deepseek-ai/dsh-credentials'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-settings'
import type {} from '@deepseek-ai/dsh-user-approval'
import type {} from '@deepseek-ai/dsh-llm'
import { ClaudeCodeAdapter } from './adapter.js'
import { SessionBindings } from './bindings.js'
import { modelChoices, providerChoices } from './sources.js'
import { InstanceStore, type InstanceInput } from './state.js'
import { readConfig, removeConfig, writeConfig } from './config-files.js'

export const name = 'dsh-plugin-claude-code'
export const inject = ['llm', 'agents', 'agentPresets', 'connection']
export interface Config { executablePath?: string }

async function executable(configured?: string): Promise<string> {
  const nvmRoot = join(homedir(), '.nvm', 'versions', 'node')
  const nvmVersions = await readdir(nvmRoot).catch(() => [] as string[])
  const candidates = configured ? [configured] : [
    join(dirname(process.execPath), 'claude'),
    ...((process.env.PATH ?? '').split(delimiter).map(dir => join(dir, 'claude'))),
    join(homedir(), '.local', 'bin', 'claude'),
    ...nvmVersions.map(version => join(nvmRoot, version, 'bin', 'claude')),
    '/usr/local/bin/claude', '/opt/homebrew/bin/claude',
  ]
  for (const candidate of candidates) {
    if (!isAbsolute(candidate)) continue
    try { await access(candidate, constants.X_OK); return candidate } catch { /* try next */ }
  }
  // The route still registers so settings can be fixed without losing the page.
  return configured ?? 'claude'
}

function respond(res: ServerResponse, code: number, data: unknown): void {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(data))
}

async function bodyOf(req: IncomingMessage): Promise<unknown> {
  let raw = ''
  for await (const chunk of req) {
    raw += String(chunk)
    if (raw.length > 512 * 1024) throw new Error('Request is too large')
  }
  return JSON.parse(raw) as unknown
}

function sameOrigin(req: IncomingMessage): boolean {
  const origin = req.headers.origin
  if (origin === undefined) return false
  try { return new URL(origin).host === req.headers.host } catch { return false }
}

export async function apply(ctx: Context, config: Config = {}): Promise<void> {
  const store = new InstanceStore()
  await store.load()
  const adapter = new ClaudeCodeAdapter(ctx, { executablePath: await executable(config.executablePath),
    store, bindings: new SessionBindings() })
  const handle = ctx.llm.registerAdapter(['claude-code'], adapter)
  ctx.effect(() => handle, 'Claude Code model route')
  ctx.inject(['webServer', 'connection'], web => {
    web.effect(() => web.webServer.register({ kind: 'prefix', path: '/api/dsh-claude-code',
      handler: async (req, res) => {
        try {
          const rejected = web.connection.requestRejection(req)
          if (rejected !== undefined) return respond(res, rejected, { ok: false, error: 'Unauthorized' })
          const path = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`).pathname
            .slice('/api/dsh-claude-code'.length)
          if (req.method === 'GET' && path === '/instances') return respond(res, 200, { ok: true, data: store.list() })
          if (req.method === 'GET' && path === '/models') return respond(res, 200, { ok: true, data: await modelChoices(ctx) })
          if (req.method === 'GET' && path === '/providers') return respond(res, 200, { ok: true, data: await providerChoices(ctx) })
          const configMatch = /^\/instances\/([^/]+)\/config$/u.exec(path)
          if (req.method === 'GET' && configMatch) {
            const id = decodeURIComponent(configMatch[1])
            if (!store.get(id)) throw new Error('Instance not found')
            return respond(res, 200, { ok: true, data: await readConfig(id) })
          }
          if (!sameOrigin(req) || req.headers['x-dsh-claude-code-request'] !== '1') return respond(res, 403, { ok: false, error: 'Forbidden' })
          if (req.method === 'POST' && path === '/instances') {
            const row = await store.put(await bodyOf(req) as InstanceInput)
            return respond(res, 200, { ok: true, data: row })
          }
          if (req.method === 'PATCH' && path.startsWith('/instances/')) {
            const row = await store.patch(decodeURIComponent(path.slice('/instances/'.length)),
              await bodyOf(req) as Partial<import('./state.js').ClaudeInstance>)
            return respond(res, 200, { ok: true, data: row })
          }
          if (req.method === 'PUT' && configMatch) {
            const id = decodeURIComponent(configMatch[1])
            if (!store.get(id)) throw new Error('Instance not found')
            const input = await bodyOf(req) as { text?: unknown }
            const file = await writeConfig(id, input?.text as string)
            return respond(res, 200, { ok: true, data: { path: file } })
          }
          if (req.method === 'DELETE' && path.startsWith('/instances/')) {
            const id = decodeURIComponent(path.slice('/instances/'.length))
            await store.remove(id)
            await removeConfig(id)
            return respond(res, 200, { ok: true, data: true })
          }
          respond(res, 404, { ok: false, error: 'Not found' })
        } catch (error) {
          respond(res, 400, { ok: false, error: error instanceof Error ? error.message : 'Invalid request' })
        }
      },
    }), 'Claude Code settings API')
  })
}
