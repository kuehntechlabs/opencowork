/**
 * Ambient typecheck guard for the dynamic import of the opencode Node bundle
 * shipped from vendor/opencode/packages/opencode/dist/node/node.js.
 *
 * Sidecar imports the bundle via `import(bundleUrl) as OpencodeServerModule`.
 * Renaming or removing any of these in a submodule bump trips `tsc --noEmit`
 * before runtime.
 */

export interface OpencodeServerListenOptions {
  port: number;
  hostname: string;
  username?: string;
  password?: string;
  cors?: string[];
  mdns?: boolean;
  mdnsDomain?: string;
}

export interface OpencodeServerListener {
  hostname: string;
  port: number;
  url: URL;
  stop(force?: boolean): Promise<void>;
}

export interface OpencodeServer {
  listen(opts: OpencodeServerListenOptions): Promise<OpencodeServerListener>;
}

export interface OpencodeJsonMigration {
  run(
    client: unknown,
    opts: {
      progress: (event: { current: number; total: number }) => void;
    },
  ): Promise<void>;
}

export interface OpencodeLog {
  init(opts: { level: "DEBUG" | "INFO" | "WARN" | "ERROR" }): Promise<void>;
}

export interface OpencodeDatabase {
  Client(): { $client: unknown };
}

export interface OpencodeServerModule {
  Server: OpencodeServer;
  Database: OpencodeDatabase;
  JsonMigration: OpencodeJsonMigration;
  Log: OpencodeLog;
  Config?: unknown;
  bootstrap?: () => Promise<void>;
}
