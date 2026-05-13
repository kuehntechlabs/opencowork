// Electron harness for the opencode smoke test. Loads in Electron main, forks
// a utility process that imports the Node bundle, calls Server.listen, hits
// /health, then quits.
const { app, utilityProcess } = require("electron");
const { writeFileSync, mkdtempSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { randomUUID } = require("node:crypto");

const bundle = process.env.OPENCODE_BUNDLE;
if (!bundle) {
  console.error("OPENCODE_BUNDLE env var required");
  app.exit(1);
}

const stateDir = mkdtempSync(join(tmpdir(), "opencowork-smoke-"));
const password = randomUUID();

// Worker source: imports the bundle, starts the server, posts ready/error.
const workerSrc = `
process.parentPort.on("message", async ({ data }) => {
  if (data?.type !== "start") return;
  try {
    process.env.OPENCODE_SERVER_USERNAME = "opencode";
    process.env.OPENCODE_SERVER_PASSWORD = ${JSON.stringify(password)};
    process.env.XDG_STATE_HOME = ${JSON.stringify(stateDir)};
    process.env.XDG_DATA_HOME = ${JSON.stringify(stateDir)};
    process.env.XDG_CACHE_HOME = ${JSON.stringify(stateDir)};
    process.env.NO_PROXY = "127.0.0.1,localhost,::1";
    const mod = await import(${JSON.stringify(bundle)});
    if (!mod?.Server || typeof mod.Server.listen !== "function") {
      process.parentPort.postMessage({ type: "error", reason: "no Server.listen" });
      return;
    }
    if (mod.Log?.init) await mod.Log.init({ level: "WARN" });
    const listener = await mod.Server.listen({
      port: 0,
      hostname: "127.0.0.1",
      username: "opencode",
      password: ${JSON.stringify(password)},
    });
    const port = listener?.port ?? listener?.url?.port ?? null;
    const url = listener?.url?.toString?.() ?? (port ? "http://127.0.0.1:" + port : null);
    process.parentPort.postMessage({ type: "ready", port, url });
    process.parentPort.on("message", async ({ data }) => {
      if (data?.type === "stop") {
        try { await listener.stop?.(true); } catch {}
        process.parentPort.postMessage({ type: "stopped" });
        process.exit(0);
      }
    });
  } catch (err) {
    process.parentPort.postMessage({
      type: "error",
      reason: err && err.message ? err.message : String(err),
      stack: err && err.stack,
    });
  }
});
`;

const workerPath = join(stateDir, "worker.cjs");
writeFileSync(workerPath, workerSrc);

app.whenReady().then(async () => {
  const child = utilityProcess.fork(workerPath, [], {
    serviceName: "opencode smoke",
    stdio: "pipe",
  });

  let resolved = false;
  const fail = (msg, code = 1) => {
    if (resolved) return;
    resolved = true;
    console.error(`smoke FAIL: ${msg}`);
    try { child.kill(); } catch {}
    app.exit(code);
  };
  const ok = () => {
    if (resolved) return;
    resolved = true;
    console.log("smoke OK");
    try { child.kill(); } catch {}
    app.exit(0);
  };

  child.stdout?.on("data", (b) => process.stdout.write("[worker] " + b));
  child.stderr?.on("data", (b) => process.stderr.write("[worker err] " + b));
  child.on("exit", (code) => {
    if (!resolved) fail(`worker exited code=${code}`);
  });

  const timeout = setTimeout(() => fail("server did not become ready in 60s"), 60_000);

  child.on("message", async (msg) => {
    if (msg?.type === "ready") {
      clearTimeout(timeout);
      console.log(`smoke: server ready at ${msg.url}`);
      try {
        const auth = "Basic " + Buffer.from("opencode:" + password).toString("base64");
        // Try a few common health/probe paths — the bundle's surface may vary by version.
        const probes = ["/global/health", "/health", "/"];
        let lastErr = null;
        for (const p of probes) {
          try {
            const res = await fetch(msg.url + p, { headers: { Authorization: auth } });
            console.log(`smoke: probe ${p} -> ${res.status}`);
            if (res.ok || res.status === 401 || res.status === 404 || res.status === 200) {
              // 200 is best; 401 means server is up + auth-rejecting (also fine — it's alive).
              // 404 means the route doesn't exist but server is alive.
              ok();
              return;
            }
            lastErr = `status ${res.status}`;
          } catch (e) {
            lastErr = e?.message ?? String(e);
          }
        }
        fail(`no probe succeeded; last error: ${lastErr}`);
      } catch (e) {
        fail(`fetch threw: ${e?.message ?? e}`);
      }
    } else if (msg?.type === "error") {
      clearTimeout(timeout);
      fail(`worker error: ${msg.reason}\n${msg.stack ?? ""}`);
    }
  });

  child.postMessage({ type: "start" });
});

app.on("window-all-closed", () => {});
