import { createHash } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { targets } from '../lib/targets'
import { required } from './common'

const directory = required('ASSET_DIR')
const names = targets.map(target => `sensos-${target.asset}.tar.gz`).sort()
const lines = await Promise.all(
  names.map(async name => {
    const bytes = await Bun.file(join(directory, name)).bytes()
    return `${createHash('sha256').update(bytes).digest('hex')}  ${name}\n`
  })
)
await writeFile(join(directory, 'SHA256SUMS'), lines.join(''))
