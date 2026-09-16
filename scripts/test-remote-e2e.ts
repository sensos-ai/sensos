import { resolve } from 'node:path'

const configuredBackendRoot = process.env.SENSOS_E2E_BACKEND_ROOT?.trim()
if (!configuredBackendRoot) {
  throw new Error(
    'Set SENSOS_E2E_BACKEND_ROOT to the sensos backend checkout before running the remote E2E'
  )
}

const workspaceRoot = resolve(import.meta.dir, '..')
const backendRoot = resolve(configuredBackendRoot)

async function run(command: string[], cwd: string): Promise<void> {
  const child = Bun.spawn(command, {
    cwd,
    env: process.env,
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
  })
  const exitCode = await child.exited
  if (exitCode !== 0) process.exit(exitCode)
}

await run(['bun', 'run', 'scripts/build-sensos.ts'], backendRoot)
await run(['bun', 'run', 'turbo:build'], workspaceRoot)
await run(
  [
    'bun',
    'test',
    '--no-orphans',
    'packages/cli/tests/e2e/cli/remote-engine.test.ts',
  ],
  workspaceRoot
)
