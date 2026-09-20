export const targets = [
  {
    name: 'linux-x64',
    asset: 'linux-x86_64',
    bun: 'bun-linux-x64',
    keyring: 'linux-x64-gnu',
    runner: 'ubuntu-latest',
  },
  {
    name: 'linux-arm64',
    asset: 'linux-aarch64',
    bun: 'bun-linux-arm64',
    keyring: 'linux-arm64-gnu',
    runner: 'ubuntu-24.04-arm',
  },
  {
    name: 'darwin-x64',
    asset: 'macos-x86_64',
    bun: 'bun-darwin-x64',
    keyring: 'darwin-x64',
    runner: 'macos-15-intel',
  },
  {
    name: 'darwin-arm64',
    asset: 'macos-aarch64',
    bun: 'bun-darwin-arm64',
    keyring: 'darwin-arm64',
    runner: 'macos-15',
  },
] as const
