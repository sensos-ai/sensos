import { defineWorkspace } from 'bunup'

const external = ['ai', 'zod', 'rivetkit', 'rivetkit/client']

export default defineWorkspace([
  {
    name: 'shared',
    root: 'packages/shared',
    config: {
      entry: [
        'src/index.ts',
        'src/core.ts',
        'src/models.ts',
        'src/registry.ts',
        'src/session.ts',
        'src/streams.ts',
      ],
      outDir: 'dist',
      format: 'esm',
      target: 'node',
      preferredTsconfig: 'tsconfig.json',
      dts: { inferTypes: true },
      external,
    },
  },
  {
    name: 'client',
    root: 'packages/client',
    config: [
      {
        name: 'client-js',
        entry: 'src/index.ts',
        outDir: 'dist',
        format: 'esm',
        target: 'node',
        dts: false,
        external: ['@durable-streams/client', ...external],
        noExternal: ['@sensos-ai/shared'],
      },
      {
        name: 'client-dts',
        entry: 'src/index.ts',
        outDir: 'dist',
        format: 'esm',
        target: 'node',
        preferredTsconfig: 'tsconfig.json',
        dts: { inferTypes: true },
        dtsOnly: true,
        clean: false,
        external: [
          '@durable-streams/client',
          '@sensos-ai/shared',
          ...external,
        ],
      },
    ],
  },
])
