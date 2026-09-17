import { defineConfig } from 'blume'

export default defineConfig({
  title: 'Sensos AI',
  description: 'Open source experiments in AI engineering',
  basePath: '/docs',
  content: {
    root: 'content',
  },
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
  ai: {
    openInChat: ['claude', 'chatgpt', 'cursor'],
    // ask: {
    //   enabled: true,
    //   provider: 'gateway', // default
    //   model: 'openai/gpt-5.5',
    //   suggestions: [
    //     { label: 'What is Sensos?', icon: 'rocket' },
    //     {
    //       label: 'How do I use my provider subscriptio s?',
    //       icon: 'file-text',
    //     },
    //     { label: 'How do I configure the harness?', icon: 'settings' },
    //   ],
    // },
  },
})
