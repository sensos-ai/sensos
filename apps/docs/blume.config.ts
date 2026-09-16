import { defineConfig } from 'blume'

export default defineConfig({
  title: 'Sensos AI',
  description: 'Open source experiments in AI engineering',
  theme: {
    fonts: {
      display: 'geist',
      body: 'geist',
      mono: 'jetbrains-mono',
    },
  },
  github: {
    dir: 'apps/docs',
    owner: 'sensos-ai',
    repo: 'sensos',
  },
})
