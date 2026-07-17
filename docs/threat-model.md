# Threat model

## Assets

- Platform credentials (GitHub, Databricks, Snowflake, MongoDB, Jira).
- Log content, query text, database metadata, source code, Jira/PR text.
- The user's machine / CI runner and any connected systems.

## Trust boundaries

1. **Untrusted external content → agent.** Logs, Jira descriptions/comments, PR
   titles/bodies, commit messages, DB object names, and any file the agent reads
   are **untrusted** and may contain prompt-injection payloads.
2. **Agent → external systems (writes).** Creating/updating Jira or GitHub issues
   crosses into mutation of external state.
3. **Agent → AI provider (optional).** When enabled, redacted context leaves the
   machine.
4. **Config/credential store → agent.** Secrets are resolved through providers,
   never embedded in config.

## Risks and mitigations

| Threat | Vector | Mitigation |
| --- | --- | --- |
| Secret exfiltration | Tokens/keys in logs flow into reports or AI | Deny-by-default redaction (`@pfa/security`) at every connector ingest boundary, before the normalized model, reports, logs, or AI. Config field masking. |
| Prompt injection | "Ignore instructions…" text in logs/Jira/PRs steers the LLM | Untrusted content is wrapped in a data envelope with explicit "do not follow" framing; injection markers flagged; envelope-breaking tokens neutralized; AI output can never trigger a write tool. |
| Unauthorized writes | Agent auto-creates/updates issues | Read/write split; writes require explicit `approve()`; default context denies. No writes in non-interactive mode unless `--yes`. |
| Over-collection of business data | Connector returns raw rows | DB connectors prefer metadata / query plans / stats; MongoDB sampled values excluded by default; log truncation (`maxLogChars`). |
| Credential at rest | Plaintext tokens on disk | VS Code SecretStorage / OS keychain / AWS Secrets Manager only; config schema has no secret fields; config written `0600`. |
| SSRF / unexpected egress | Connector talks to arbitrary hosts | Connectors target configured, allowlisted hosts with timeouts and bounded retries. |
| Supply chain | Malicious dependency | Minimal dependency surface (`commander`, `zod`, `picocolors`); dependency + secret scanning in CI; AWS SDK is an optional runtime import. |
| Audit gaps | Silent tool use | Every tool request/approval/denial is recorded in a redacted audit log. |

## Credential-broker model (AWS)

Third-party SaaS (GitHub/Snowflake/Databricks/MongoDB/Jira) cannot federate to AWS
IAM directly. Instead, **AWS Secrets Manager + IAM** is offered as a first-class
`CredentialProvider`: IAM roles/groups govern *which principal may read which
connector secret*, and in CI, GitHub OIDC → `AssumeRole` supplies short-lived AWS
credentials (no static keys). AWS-native connectors (future: Glue, Step Functions)
use IAM/STS `AssumeRole` directly. IAM is the access-control and secret-broker
layer, not a universal OAuth broker.

## Non-goals (current phase)

Autonomous remediation, unattended writes, and network monitoring are out of scope.
Watch mode (phase 2) will analyze only; it will not mutate external systems unless
a narrowly scoped, explicitly enabled automation policy allows it.
