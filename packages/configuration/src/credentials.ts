/**
 * Credential providers. Credentials are NEVER stored in config, logs or reports.
 * A connection references a provider by name; the provider resolves the secret
 * at call time. This is the single seam behind which all auth lives.
 *
 * Providers included:
 *  - env                : environment variables (CI-friendly).
 *  - aws-secrets-manager: the recommended broker — IAM roles/groups govern which
 *                         secrets a principal may read; in CI, GitHub OIDC →
 *                         AssumeRole supplies short-lived credentials.
 *
 * The VS Code extension supplies a `vscode-secretstorage` provider and the CLI a
 * native OS-keychain provider by implementing this same interface.
 */
export interface CredentialProvider {
  readonly name: string;
  /** Resolve a named secret, or undefined if absent. Must never throw. */
  get(key: string): Promise<string | undefined>;
}

export class EnvCredentialProvider implements CredentialProvider {
  readonly name = 'env';
  constructor(private readonly prefix = '') {}
  async get(key: string): Promise<string | undefined> {
    return process.env[this.prefix + key] ?? process.env[key];
  }
}

/**
 * AWS Secrets Manager provider. Loaded lazily so the AWS SDK is an *optional*
 * dependency — the core never requires it. Uses the ambient AWS credential
 * chain (instance profile, SSO, or OIDC-assumed role), so no static keys.
 */
export class AwsSecretsManagerProvider implements CredentialProvider {
  readonly name = 'aws-secrets-manager';
  // Typed loosely on purpose: @aws-sdk/client-secrets-manager is an OPTIONAL
  // peer dependency, resolved at runtime so the core never requires it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private client: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private sdk: any;
  constructor(
    private readonly region?: string,
    private readonly prefix = '',
  ) {}

  async get(key: string): Promise<string | undefined> {
    try {
      if (!this.client) {
        const moduleName = '@aws-sdk/client-secrets-manager';
        // Indirect specifier so bundlers/TS do not require the optional module.
        this.sdk = await import(/* @vite-ignore */ moduleName).catch(() => undefined);
        if (!this.sdk) return undefined;
        this.client = new this.sdk.SecretsManagerClient(this.region ? { region: this.region } : {});
      }
      const res = await this.client.send(
        new this.sdk.GetSecretValueCommand({ SecretId: this.prefix + key }),
      );
      return res.SecretString ?? undefined;
    } catch {
      // SDK not installed or secret unavailable — degrade gracefully.
      return undefined;
    }
  }
}

/** In-memory provider for tests and mocks. */
export class MemoryCredentialProvider implements CredentialProvider {
  readonly name = 'memory';
  constructor(private readonly store: Record<string, string> = {}) {}
  async get(key: string): Promise<string | undefined> {
    return this.store[key];
  }
}

export class CredentialRegistry {
  private providers = new Map<string, CredentialProvider>();
  register(p: CredentialProvider): this {
    this.providers.set(p.name, p);
    return this;
  }
  resolve(name: string): CredentialProvider | undefined {
    return this.providers.get(name);
  }
  async get(providerName: string, key: string): Promise<string | undefined> {
    return this.providers.get(providerName)?.get(key);
  }
}

/** Default registry with env + AWS providers registered. */
export function defaultRegistry(): CredentialRegistry {
  return new CredentialRegistry()
    .register(new EnvCredentialProvider())
    .register(new AwsSecretsManagerProvider(process.env.AWS_REGION))
    .register(new MemoryCredentialProvider());
}
