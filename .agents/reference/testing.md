# Testing

Use tests as boundary evidence. Read `package.json` before running commands.

## Layers

- `tests/unit` owns controller logic, authentication, credential storage,
  terminal rendering, local catalog behavior, and dependency-injected
  transport contracts. Unit tests must not read the developer's credentials.
- `tests/e2e/cli/auth.test.ts` owns compiled credential-command journeys in
  isolated HOME, XDG config, and XDG state directories.
- The remaining `tests/e2e/cli` journeys are cross-repository system tests.
  They require a compatible `dist/sensos-engine` supplied by the backend
  build until engine artifact installation exists.
- Backend actor, workflow, model-execution, Rivet integration, and server
  tests belong in `sensos-ai/backend`.

## Local loop

Run one unit file:

```sh
bun test --no-orphans tests/unit/path/to/example.test.ts
```

Run all controller unit tests:

```sh
bun run test:unit
```

Run the compiled auth E2E:

```sh
bun run turbo:build
bun test --no-orphans tests/e2e/cli/auth.test.ts
```

Run static validation:

```sh
bun run turbo:typecheck
bun run turbo:lint
```

Run the default repository checks:

```sh
bun run turbo:check
```

## Isolation

Tests own and clean every process, port, temporary directory, catalog, and
credential backend they create. Credential tests inject in-memory or isolated
file storage. They never access the developer's Keychain.

Keep `--no-orphans` on the test runner, but remove
`BUN_FEATURE_FLAG_NO_ORPHANS` from environments passed to product
subprocesses. Synchronize on observable output or bounded polling rather than
fixed sleeps. Put cleanup in `finally`.

Generated terminal captures and runtime logs belong under
`tests/e2e/artifacts`, which is ignored by Git.
