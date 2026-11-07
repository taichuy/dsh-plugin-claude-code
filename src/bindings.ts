import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'

export interface Binding { claudeSessionId: string; fingerprint: string }
export class SessionBindings {
  private dir = join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'dsh-plugin-claude-code', 'sessions')
  private path(id: string): string {
    if (!/^[a-zA-Z0-9_-]+$/u.test(id)) throw new Error('Invalid DSH session id')
    return join(this.dir, `${id}.json`)
  }
  async read(id: string): Promise<Binding | undefined> {
    try { return JSON.parse(await readFile(this.path(id), 'utf8')) as Binding }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw error }
  }
  async write(id: string, value: Binding): Promise<void> {
    const file = this.path(id)
    await mkdir(dirname(file), { recursive: true, mode: 0o700 })
    await writeFile(file, JSON.stringify(value), { mode: 0o600 })
  }
}
