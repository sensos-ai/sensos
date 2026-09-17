import { defineComponents } from 'blume'
import Tabs from './components/blume/Tabs.astro'
import Bash from './components/Bash.astro'

export default defineComponents({
  mdx: {
    Bash,
    Tabs,
  },
})
