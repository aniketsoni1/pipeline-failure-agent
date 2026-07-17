import type { Connector, ConnectorContext, ApprovalRequest, Platform } from '@pfa/core';
import { LocalConnector } from '@pfa/connector-local';
import { GithubConnector } from '@pfa/connector-github';
import { JiraConnector } from '@pfa/connector-jira';
import { DbtConnector } from '@pfa/connector-dbt';
import { SnowflakeConnector } from '@pfa/connector-snowflake';
import { DatabricksConnector } from '@pfa/connector-databricks';
import { MongodbConnector } from '@pfa/connector-mongodb';

export type ConnectorFactory = () => Connector;

/** Platform → connector factory. New connectors register here only. */
export const CONNECTOR_FACTORIES: Partial<Record<Platform, ConnectorFactory>> = {
  local: () => new LocalConnector(),
  github: () => new GithubConnector(),
  'github-actions': () => new GithubConnector(),
  jira: () => new JiraConnector(),
  dbt: () => new DbtConnector(),
  snowflake: () => new SnowflakeConnector(),
  databricks: () => new DatabricksConnector(),
  mongodb: () => new MongodbConnector(),
};

export function getConnector(platform: Platform): Connector | undefined {
  return CONNECTOR_FACTORIES[platform]?.();
}

export function listPlatforms(): Platform[] {
  return Object.keys(CONNECTOR_FACTORIES) as Platform[];
}

export interface ContextOptions {
  /** Resolves secrets by name (wire to CredentialRegistry). */
  getSecret?: (name: string) => Promise<string | undefined>;
  /** Approval callback for write/high-risk tools. Default: deny. */
  approve?: (req: ApprovalRequest) => Promise<boolean>;
  /** Log sink. Default: no-op. */
  onLog?: (level: string, message: string, meta?: Record<string, unknown>) => void;
  now?: () => Date;
}

/** Build a ConnectorContext. Defaults are safe: no secrets, deny writes. */
export function createContext(opts: ContextOptions = {}): ConnectorContext {
  return {
    getSecret: opts.getSecret ?? (async () => undefined),
    approve: opts.approve ?? (async () => false),
    log: (level, message, meta) => opts.onLog?.(level, message, meta),
    now: opts.now ?? (() => new Date()),
  };
}

export {
  LocalConnector,
  GithubConnector,
  JiraConnector,
  DbtConnector,
  SnowflakeConnector,
  DatabricksConnector,
  MongodbConnector,
};
