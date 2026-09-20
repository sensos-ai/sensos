export const targets = [
  {
    name: 'linux-x64',
    bun: 'bun-linux-x64',
    keyring: 'linux-x64-gnu',
    runner: 'ubuntu-latest',
  },
  {
    name: 'linux-arm64',
    bun: 'bun-linux-arm64',
    keyring: 'linux-arm64-gnu',
    runner: 'ubuntu-24.04-arm',
  },
  {
    name: 'darwin-x64',
    bun: 'bun-darwin-x64',
    keyring: 'darwin-x64',
    runner: 'macos-15-intel',
  },
  {
    name: 'darwin-arm64',
    bun: 'bun-darwin-arm64',
    keyring: 'darwin-arm64',
    runner: 'macos-15',
  },
] as const
