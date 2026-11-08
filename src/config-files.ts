import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

const root = () => join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'dsh-plugin-claude-code', 'configs')

export function configPath(id: string): string {
  if (!/^[A-Za-z0-9_-]{1,128}$/u.test(id)) throw new Error('Invalid instance id')
  return join(root(), `${id}.json`)
}

export function parseConfigText(text: string): Record<string, unknown> {
  if (typeof text !== 'string' || Buffer.byteLength(text, 'utf8') > 256 * 1024) {
    throw new Error('Claude configuration must be JSON under 256 KiB')
  }
  let value: unknown
  try { value = JSON.parse(text) as unknown }
  catch { throw new Error('Claude configuration contains invalid JSON') }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Claude configuration must be a JSON object')
  }
  return value as Record<string, unknown>
}

export async function readConfig(id: string): Promise<{ path: string; text: string; exists: boolean }> {
  const path = configPath(id)
  try { return { path, text: await readFile(path, 'utf8'), exists: true } }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { path, text: '{}\n', exists: false }
    throw error
  }
}

export async function writeConfig(id: string, text: string): Promise<string> {
  parseConfigText(text)
  const path = configPath(id)
  await mkdir(root(), { recursive: true, mode: 0o700 })
  const temp = join(root(), `.${id}.${randomUUID()}.tmp`)
  try {
    await writeFile(temp, text, { mode: 0o600 })
    await rename(temp, path)
  } catch (error) {
    await rm(temp, { force: true })
    throw error
  }
  return path
}

export async function removeConfig(id: string): Promise<void> {
  await rm(configPath(id), { force: true })
}
