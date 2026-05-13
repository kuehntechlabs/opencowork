/**
 * Worker entry — runs inside an Electron utility process.
 *
 * Receives start/stop messages from the host (src/main/server.ts), imports the
 * opencode Node bundle dynamically, calls `Server.listen()`, and posts ready /
 * sqlite-progress / error messages back to the host via `process.parentPort`.
 */
import { pathToFileURL } from "node:url";
import type {
  OpencodeServerModule,
  OpencodeServerListener,
} from "./opencode-server";

// Electron's utility-process API exposes `process.parentPort`, but @types/node
// doesn't ship it. Augment locally so the rest of the file stays typed.
declare const process: NodeJS.Process & {
  parentPort: {
    on(event: "message", listener: (e: { data: unknown }) => void): void;
    postMessage(msg: unknown): void;
  };
};

type StartCommand = {
  type: "start";
  bundlePath: string;
  port: number;
  password: string;
  xdgStateHome: string;
  needsMigration: boolean;
};
type StopCommand = { type: "stop" };
type Cmd = StartCommand | StopCommand;

type OutMsg =
  | {
      type: "sqlite";
      progress:
        | { type: "InProgress"; value: number }
        | { type: "Done" };
    }
  | { type: "ready"; url: string; port: number }
  | { type: "stopped" }
  | { type: "error"; reason: string; stack?: string };

let listener: OpencodeServerListener | null = null;

function send(msg: OutMsg): void {
  process.parentPort.postMessage(msg);
}

process.parentPort.on("message", async (event: { data: unknown }) => {
  const cmd = event.data as Cmd;
  if (cmd?.type === "start") {
    try {
      process.env.OPENCODE_SERVER_USERNAME = "opencode";
      process.env.OPENCODE_SERVER_PASSWORD = cmd.password;
      process.env.XDG_STATE_HOME = cmd.xdgStateHome;
      process.env.XDG_DATA_HOME = cmd.xdgStateHome;
      process.env.XDG_CACHE_HOME = cmd.xdgStateHome;
      process.env.NO_PROXY = "127.0.0.1,localhost,::1";

      const mod = (await import(
        pathToFileURL(cmd.bundlePath).href
      )) as unknown as OpencodeServerModule;

      if (typeof mod?.Server?.listen !== "function") {
        send({
          type: "error",
          reason: "incompatible-bundle: Server.listen missing",
        });
        process.exit(1);
        return;
      }

      if (mod.Log?.init) {
        await mod.Log.init({ level: "WARN" });
      }

      // JsonMigration: only run if requested. Upstream's invocation needs a
      // drizzle client, which the bundle's Database.Client() provides. If
      // anything throws, surface to the host as a fatal error.
      if (
        cmd.needsMigration &&
        mod.JsonMigration?.run &&
        mod.Database?.Client
      ) {
        try {
          const client = mod.Database.Client();
          await mod.JsonMigration.run(client.$client, {
            progress: ({
              current,
              total,
            }: {
              current: number;
              total: number;
            }) => {
              const value =
                total > 0 ? Math.round((current / total) * 100) : 100;
              send({
                type: "sqlite",
                progress: { type: "InProgress", value },
              });
            },
          });
          send({ type: "sqlite", progress: { type: "Done" } });
        } catch (err) {
          throw err;
        }
      }

      listener = await mod.Server.listen({
        port: cmd.port,
        hostname: "127.0.0.1",
        username: "opencode",
        password: cmd.password,
        cors: ["http://localhost:*", "http://127.0.0.1:*"],
      });

      const actualPort = listener.port;
      const url =
        listener.url?.toString?.() ?? `http://127.0.0.1:${actualPort}/`;
      send({ type: "ready", url, port: actualPort });
    } catch (err) {
      send({
        type: "error",
        reason: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      process.exit(1);
    }
  } else if (cmd?.type === "stop") {
    try {
      await listener?.stop(true);
    } catch {
      // ignore — we're exiting anyway
    }
    send({ type: "stopped" });
    process.exit(0);
  }
});
