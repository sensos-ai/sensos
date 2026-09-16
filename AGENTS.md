# Repository workflow

## Tooling

- Read `package.json` before invoking repository tooling.
- Apply Biome fixes with `bun run format` and `bun run lint`.
- Validate formatting and lint rules with `bun run turbo:lint`.
- Use the `turbo:*` scripts for cached build, typecheck, lint, and test
  boundaries.

## Architecture

This repository owns the Sensos controller CLI: commands, authentication,
credential storage, terminal UI, the local session catalog, remote transport,
and launching an optional external `sensos-engine` executable.

The backend owns actor implementations, model execution, Rivet services, and
the engine binary. Keep imports from `src/runtime/actors`, AgentOS, Rivet
engine packages, and backend server modules out of this repository.

This repository is authoritative for shared wire contracts. Keep them in
`packages/shared`, consume them through `@sensos-ai/shared`, and regenerate the
checked-in registry bundle rather than copying backend implementation files.

## Testing

Read [`.agents/reference/testing.md`](.agents/reference/testing.md) before
changing or running tests, fixtures, helpers, runners, or test infrastructure.

## Engine compatibility

- Build releases with the matching `SENSOS_ENGINE_BUILD_ID` supplied by the
  engine artifact release. The CLI uses this identity to decide whether an
  existing local engine can be reused.
- Run `bun run turbo:build` after source, dependency, generated protocol, or
  build-configuration changes before testing `dist/sensos`.
- Local mode launches a separate `sensos-engine`; it never imports or embeds
  the backend runtime.
