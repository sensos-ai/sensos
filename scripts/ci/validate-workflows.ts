// Syntax and executable-entrypoint checks; semantic actionlint runs in CI too.
for await (const path of new Bun.Glob(
  '.github/{workflows,actions}/**/*.{yml,yaml}'
).scan('.')) {
  const source = await Bun.file(path).text()
  const value = Bun.YAML.parse(source)
  if (!value || typeof value !== 'object')
    throw new Error(`Invalid YAML: ${path}`)
  if (
    /\brun:.*(?:test:e2e|test:integration|tests\/e2e|tests\/integration)/.test(
      source
    )
  ) {
    throw new Error(
      `E2E/integration suites are not allowed in workflows: ${path}`
    )
  }
  console.log(`Valid YAML: ${path}`)
}
