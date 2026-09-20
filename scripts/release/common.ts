import { appendFile } from 'node:fs/promises'

export const libraries = ['shared', 'client'] as const
export const workspaces = [...libraries, 'cli'] as const

export function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing ${name}`)
  return value
}

export async function run(
  command: string[],
  cwd = process.cwd()
): Promise<void> {
  const child = Bun.spawn(command, {
    cwd,
    stdout: 'inherit',
    stderr: 'inherit',
  })
  if ((await child.exited) !== 0)
    throw new Error(`Command failed: ${command.join(' ')}`)
}

export function git(...args: string[]): string {
  const result = Bun.spawnSync(['git', ...args], { stderr: 'pipe' })
  if (result.exitCode !== 0) throw new Error(result.stderr.toString())
  return result.stdout.toString().trim()
}

export async function outputs(values: Record<string, string>) {
  for (const [key, value] of Object.entries(values)) {
    if (/[\r\n]/.test(value)) throw new Error('Invalid output')
    console.log(`${key}=${value}`)
    if (process.env.GITHUB_OUTPUT)
      await appendFile(process.env.GITHUB_OUTPUT, `${key}=${value}\n`)
  }
}
