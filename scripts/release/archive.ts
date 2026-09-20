import {
  chmod,
  copyFile,
  mkdir,
  mkdtemp,
  rm,
  utimes,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { targets } from '../lib/targets'
import { required, run } from './common'

const target = targets.find(
  target => target.name === required('SENSOS_BUILD_TARGET')
)
if (!target) throw new Error('Unsupported target')
const destination = resolve(required('ASSET_DIR'))
await mkdir(destination, { recursive: true })
const stage = await mkdtemp(join(tmpdir(), 'sensos-archive-'))
try {
  await copyFile(
    `packages/cli/dist/sensos-${target.name}`,
    join(stage, 'sensos')
  )
  await chmod(join(stage, 'sensos'), 0o755)
  await utimes(join(stage, 'sensos'), 0, 0)
  // Fixed metadata makes archives identical across retries on the same toolchain.
  const ownership =
    process.platform === 'darwin'
      ? ['--uid', '0', '--gid', '0', '--uname', 'root', '--gname', 'root']
      : ['--owner=0', '--group=0', '--numeric-owner']
  const tar = Bun.spawn(
    [
      'tar',
      '--format=ustar',
      ...ownership,
      '-cf',
      '-',
      '-C',
      stage,
      'sensos',
    ],
    { stdout: 'pipe', stderr: 'inherit' }
  )
  const gzip = Bun.spawn(['gzip', '-n'], {
    stdin: tar.stdout,
    stdout: Bun.file(join(destination, `sensos-${target.name}.tar.gz`)),
    stderr: 'inherit',
  })
  if ((await tar.exited) !== 0 || (await gzip.exited) !== 0)
    throw new Error('Archive creation failed')
  await run([
    'tar',
    '-tzf',
    join(destination, `sensos-${target.name}.tar.gz`),
  ])
} finally {
  await rm(stage, { recursive: true, force: true })
}
