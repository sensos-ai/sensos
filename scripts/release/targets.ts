import { targets } from '../lib/targets'

if (import.meta.main) console.log(JSON.stringify({ include: targets }))
