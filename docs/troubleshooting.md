# Troubleshooting

### `pipeline-agent: command not found`
During development, run via the workspace script: `npm run cli -- <args>`, or link
the bin with `npm link`. The published CLI installs the `pipeline-agent` bin.

### `Provide --platform (or a log file path).`
`investigate` needs either a positional log file or `--platform` + `--run-id`.

### `No connector with run retrieval for platform "x".`
The platform is unknown or lacks `runs.get`. List platforms with
`pipeline-agent plugins list`.

### The report shows `unknown` category
No signature matched the earliest error. Add a signature in
`packages/rule-engine/src/signatures.ts` (a regex + category + weight) and a test.
Deterministic classification is intended to be extended.

### Redaction hid something I needed
Lower the level for a single run with `--no-redact` (not recommended) or set
`security.redaction` to `standard` via `pipeline-agent configure --redaction standard`.
`strict` additionally masks emails.

### AWS Secrets Manager provider returns nothing
It is an optional runtime dependency. Install `@aws-sdk/client-secrets-manager`
and ensure the ambient AWS credential chain (SSO, instance profile, or
OIDC-assumed role) can read the secret id. It degrades silently to `undefined` if
unavailable.

### VS Code extension doesn't build
Install workspace deps at the root first (`npm install`), then in
`apps/vscode-extension` run `npm install && npm run build`. The esbuild config
resolves `@pfa/*` to the shared packages.

### Non-zero exit in CI
`--fail-on <low|medium|high>` intentionally exits `1` when the incident confidence
meets the threshold. Investigation errors exit `2`.
