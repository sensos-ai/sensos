# Releases

## Flows

- PRs: `CI / checks` requires lint, typecheck, and unit tests. Docs-only changes skip installation. No workflow runs E2E or integration suites.
- Same-repository PRs: **Package previews** independently publishes shared/client with the repository-installed pkg.pr.new. Its summary contains install commands; failure is not a required check. CLI packages are never published.
- Main pushes run validation only. They never publish a release.
- Dispatch **Release** on main, optionally supply `release_type`. Autoship resolves the release type, uses `Release.bump()` to calculate the version, and generates AI notes. Changesets applies that version to CLI/shared/client. The workflow validates and commits the prepared version, builds four binaries, publishes the SDK packages, and creates GitHub releases plus the CDN mirror.
- Canary is disabled. Versions start from the unreleased `0.0.0` baseline; choosing `patch` produces `0.0.1`. CI run numbers never affect versions.

Changesets versions CLI/shared/client together and checks its result against `Release.bump()`. The root manifest is synchronized too. The CLI stays private and is distributed only as compiled binaries; shared/client publish privately to GitHub Packages. Do not manually version one package independently.

## Required setup

Configure these repository variables/secrets before enabling publication:

| Kind | Name | Purpose |
| --- | --- | --- |
| Secret | `RELEASE_TOKEN` | Token with contents write access and permission to bypass main protection for the prepared version commit |
| Variable | `RELEASE_APP_ID` | Optional alternative: installed GitHub App with contents write access and main-rule bypass |
| Secret | `RELEASE_APP_PRIVATE_KEY` | Required when using the GitHub App alternative |
| Secret | `AI_GATEWAY_API_KEY` | Autoship release-type evaluation and changelog generation |
| Variable | `EVAL_MODEL` | Optional; defaults to `typesafe-ai/jev` |
| Variable | `CHANGELOG_MODEL` | Optional AI Gateway changelog model; defaults to `openai/gpt-5.6-luna` |
| Variable | `TURBO_TEAM` | Optional Vercel cache team; configure trusted OIDC policies, deny fork identities |
| Variable | `SENSOS_REGISTRY_ENDPOINT` | Production HTTPS registry endpoint |
| Variable | `SENSOS_STREAMS_URL` | Production HTTPS streams endpoint |
| Variable | `R2_ENDPOINT` | `https://<account-id>.r2.cloudflarestorage.com` |
| Variable | `R2_BUCKET` | Release bucket behind `releases.sensos.dev` (normally `sensos-cdn`) |
| Secret | `R2_ACCESS_KEY_ID` | R2 S3 credential scoped to object read/write in the release bucket |
| Secret | `R2_SECRET_ACCESS_KEY` | Matching R2 S3 secret |

Install the pkg.pr.new GitHub App on this repository. Allow Actions to publish packages and attestations and create release tags; ensure tag rules permit this workflow's token. Keep branch protection requiring `CI / checks` only, not the preview workflow. Hosted native runners are used for Linux x64/arm64 and macOS x64/arm64.

GitHub package visibility must remain **private**. Link each shared/client package to this repository and allow the backend repository under package **Manage Actions access**. Private source manifests are not the privacy mechanism: setting `private: true` on the libraries would prohibit publication entirely.

The installer-upload workflow uses the same R2 S3 credentials as binary publication. It writes `/install` with `Cache-Control: no-store` so subsequent updates are not held by the CDN. Optionally configure `CLOUDFLARE_API_TOKEN` with cache-purge permission and `CLOUDFLARE_ZONE_ID` to purge any already-cached installer or 404 response immediately after upload; without them, an old cached response may remain until its TTL expires.

Remote-first CLI releases do not require an engine build ID. Local mode still requires a separately installed `sensos-engine`; release binaries are not paired with one yet.

## Consumers

For backend Actions, grant package-read access to the backend repository, set `permissions: packages: read`, and create a temporary npm config:

```ini
@sensos-ai:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

Use that workflow's `GITHUB_TOKEN` as `NODE_AUTH_TOKEN`. Local consumers need a classic PAT with `read:packages` and organization SSO authorization when applicable. Never commit tokens. Install the desired shared/client versions or `@latest`. The backend checkout is not changed by this work. PR preview URLs require no private-registry authentication.

CLI users install through `curl -fsSL https://releases.sensos.dev/install | sh`, optionally `sh -s -- 0.0.1`. The installer checks `SHA256SUMS` from the same source as the archive and refuses mismatches before replacing the installed binary. Until the first manual release succeeds there is no `latest` to install.

## Artifacts and recovery

The CLI release is titled `Sensos CLI v<version>` with tag `v<version>`. SDK releases use their complete package identities: `@sensos-ai/shared@<version>` and `@sensos-ai/client@<version>`. Only the CLI release is marked GitHub Latest. SDK releases carry their Changesets changelog; they do not duplicate the CLI binaries.

The CLI release and R2 `<version>/` directory contain `sensos-linux-x86_64.tar.gz`, `sensos-linux-aarch64.tar.gz`, `sensos-macos-x86_64.tar.gz`, `sensos-macos-aarch64.tar.gz`, matching provenance bundles, `SHA256SUMS`, and `release.json`. Archives contain only `sensos`. Configure CDN rules to respect `Cache-Control: no-store` for `latest.txt` and `latest.json`; versioned artifacts are immutable.

Re-run the same **Release** run to recover partial publication. Preparation records its workflow run ID and reuses the exact committed version and source on retries, including after main advances. A new manual run refuses to increment an incompletely published version. Registry selection may return `none` after a successful package publish; binary/GitHub/R2 completion still proceeds. Existing conflicting tags or immutable bytes fail instead of being overwritten. Attestation signatures are preserved on retries when they match the archive digest.

Packages first publish under a version-specific `release-<version>` dist-tag. Only after mirrored binaries succeed does publication promote `latest`. Serialized publication and R2 version comparison prevent older retries from regressing that pointer. A final `complete.json` marker records successful publication. Do not manually edit completion metadata; investigate conflicts rather than deleting immutable assets blindly.

Publication runs without restored build outputs (Bun dependency downloads may be cached). Rebuilding with different production configuration or a different toolchain can produce an immutable-asset conflict; keep release variables fixed while recovering a run. No command in local verification publishes packages, tags, GitHub releases, or R2 objects.

## Local verification

```sh
bun install --frozen-lockfile
bun run turbo:lint
bun run turbo:typecheck
bun run turbo:test
bun run turbo:build --filter=@sensos-ai/shared --filter=@sensos-ai/client
bun run scripts/ci/validate-package-tarballs.ts
```

`bun run publish:preview` is an explicit network publication command, not a validation check. Run it only when a preview is intended. The normal workflows do not run integration or E2E tests.
