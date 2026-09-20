# Releases

## Flows

- PRs: `CI / checks` requires lint, typecheck, and unit tests. Docs-only changes skip installation. No workflow runs E2E or integration suites.
- Same-repository PRs: **Package previews** independently publishes shared/client with the repository-installed pkg.pr.new. Its summary contains install commands; failure is not a required check. CLI packages are never published.
- Main: successful push CI hands its exact source/base SHAs to **Release**. Relevant normal pushes produce `next-patch-canary.<CI-run-number>` snapshots; docs-only pushes do nothing.
- Stable: dispatch **Prepare release** on main, optionally supply `release_type`. Autoship generates notes and a Changeset; Changesets opens/updates `changeset-release/main`. Review and merge it normally. Successful main CI then publishes that stable version. There is no tag-trigger workflow.

Changesets versions CLI/shared/client together. The CLI stays private and is distributed only as compiled binaries; shared/client publish privately to GitHub Packages. Canary version changes exist only in the runner checkout. Do not manually version one package independently.

## Required setup

Configure these repository variables/secrets before enabling publication:

| Kind | Name | Purpose |
| --- | --- | --- |
| Variable | `RELEASE_APP_ID` | Installed GitHub App with repository contents and pull requests write access |
| Secret | `RELEASE_APP_PRIVATE_KEY` | App private key; App token allows the release PR to trigger ordinary CI |
| Secret | `AI_GATEWAY_API_KEY` | Autoship release-type evaluation and changelog generation |
| Variable | `EVAL_MODEL` | Optional; defaults to `typesafe-ai/jev` |
| Variable | `CHANGELOG_MODEL` | AI Gateway changelog model |
| Variable | `TURBO_TEAM` | Optional Vercel cache team; configure trusted OIDC policies, deny fork identities |
| Variable | `SENSOS_ENGINE_BUILD_ID` | Identity supplied by the compatible backend engine artifact release; never `development` |
| Variable | `SENSOS_REGISTRY_ENDPOINT` | Production HTTPS registry endpoint |
| Variable | `SENSOS_STREAMS_URL` | Production HTTPS streams endpoint |
| Variable | `R2_ENDPOINT` | `https://<account-id>.r2.cloudflarestorage.com` |
| Variable | `R2_BUCKET` | Release bucket behind `releases.sensos.dev` (normally `sensos-cdn`) |
| Secret | `R2_ACCESS_KEY_ID` | R2 S3 credential scoped to object read/write in the release bucket |
| Secret | `R2_SECRET_ACCESS_KEY` | Matching R2 S3 secret |

Install the pkg.pr.new GitHub App on this repository. Allow Actions to publish packages and attestations and create release tags; ensure tag rules permit this workflow's token. Keep branch protection requiring `CI / checks` only, not the preview workflow. Hosted native runners are used for Linux x64/arm64 and macOS x64/arm64.

GitHub package visibility must remain **private**. Link each shared/client package to this repository and allow the backend repository under package **Manage Actions access**. Private source manifests are not the privacy mechanism: setting `private: true` on the libraries would prohibit publication entirely.

The existing installer-upload workflow additionally uses `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and `CLOUDFLARE_ZONE_ID`. It is separate from binary publication.

## Consumers

For backend Actions, grant package-read access to the backend repository, set `permissions: packages: read`, and create a temporary npm config:

```ini
@sensos-ai:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

Use that workflow's `GITHUB_TOKEN` as `NODE_AUTH_TOKEN`. Local consumers need a classic PAT with `read:packages` and organization SSO authorization when applicable. Never commit tokens. Install the desired shared/client versions, or use `@canary`. The backend checkout is not changed by this work. PR preview URLs require no private-registry authentication.

CLI users install through `curl -fsSL https://releases.sensos.dev/install | sh`, optionally `sh -s -- canary` or `sh -s -- 0.1.1`. The installer checks `SHA256SUMS` from the same source as the archive and refuses mismatches before replacing the installed binary.

## Artifacts and recovery

Each immutable `v<version>` GitHub release and R2 `<version>/` directory contains four `sensos-<target>.tar.gz` files, provenance bundles, `SHA256SUMS`, and `release.json` source/digest metadata. Archives contain only `sensos`. The public R2 domain must expose these paths. Configure CDN rules to respect `Cache-Control: no-store` for `latest.txt`, `canary.txt`, and channel JSON; do not force-cache pointers. Versioned artifacts are immutable.

Re-run the **Release** run to recover a partial publication. The originating CI run number, not the release run attempt, determines a canary identity. Registry selection may return `none` after a successful package publish; binary/GitHub/R2 completion still proceeds. Existing conflicting tags or immutable bytes fail instead of being overwritten. Attestation signatures are preserved on retries when they match the archive digest.

Packages first publish under a version-specific `release-<version>` dist-tag. Only after mirrored binaries succeed does publication promote `latest` or `canary`. Serialized publication and R2 channel state prevent older retries from regressing channel pointers. Stable never updates canary and vice versa. A final `complete.json` marker skips fully completed retries. Do not manually edit completion/channel metadata; investigate and resolve conflicts rather than deleting immutable assets blindly.

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
