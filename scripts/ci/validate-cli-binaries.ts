import { stat } from 'node:fs/promises'
import { resolve } from 'node:path'

const targets = [
  {
    name: 'linux-x64',
    magic: [0x7f, 0x45, 0x4c, 0x46],
    cpuOffset: 18,
    cpu: [0x3e, 0x00],
  },
  {
    name: 'linux-arm64',
    magic: [0x7f, 0x45, 0x4c, 0x46],
    cpuOffset: 18,
    cpu: [0xb7, 0x00],
  },
  {
    name: 'darwin-x64',
    magic: [0xcf, 0xfa, 0xed, 0xfe],
    cpuOffset: 4,
    cpu: [0x07, 0x00, 0x00, 0x01],
  },
  {
    name: 'darwin-arm64',
    magic: [0xcf, 0xfa, 0xed, 0xfe],
    cpuOffset: 4,
    cpu: [0x0c, 0x00, 0x00, 0x01],
  },
] as const

for (const target of targets) {
  const path = resolve('packages/cli/dist', `sensos-${target.name}`)
  const metadata = await stat(path)
  if (!metadata.isFile() || (metadata.mode & 0o111) === 0) {
    throw new Error(`${target.name}: output is not an executable file`)
  }

  const bytes = new Uint8Array(
    await Bun.file(path).slice(0, 32).arrayBuffer()
  )
  const matches = (offset: number, expected: readonly number[]) =>
    expected.every((byte, index) => bytes[offset + index] === byte)

  if (
    !matches(0, target.magic) ||
    !matches(target.cpuOffset, target.cpu)
  ) {
    throw new Error(
      `${target.name}: output has the wrong executable format`
    )
  }

  console.log(`${target.name}: executable format is valid`)
}
