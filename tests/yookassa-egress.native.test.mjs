import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { test } from "node:test";

// Explicit opt-in: this starts bounded, disposable containers, never the app.
const enabled = process.env.YOOKASSA_EGRESS_NATIVE_TEST === "true";
const nginx =
  "nginx:stable-alpine@sha256:0985e772fb9f729e6fa0980da05fca5d9c468e870eed43071545afa9d2e27d94";
const probeImage = process.env.YOOKASSA_EGRESS_PROBE_IMAGE;
const prefix = `daryadarcy-yoo-egress-${randomUUID().slice(0, 8)}`;
const control = `${prefix}-control`;
const external = `${prefix}-external`;
const gateway = `${prefix}-gateway`;
const probe = `${prefix}-probe`;
const label = `daryadarcy.task=${prefix}`;
// A remote Docker daemon needs its own absolute bind-mount source path.
const config =
  process.env.YOOKASSA_EGRESS_CONFIG ||
  resolve(
    import.meta.dirname,
    "../infrastructure/deploy/teamassist/yookassa-egress.conf",
  );
const owned = [];

test(
  "opt-in payment overlay retains existing media isolation and exposes no port",
  {
    skip: !enabled,
  },
  () => {
    const compose = spawnSync(
      "docker",
      [
        "compose",
        "-f",
        "infrastructure/deploy/teamassist/compose.yaml",
        "-f",
        "infrastructure/deploy/teamassist/compose.video.yaml",
        "-f",
        "infrastructure/deploy/teamassist/compose.images.yaml",
        "-f",
        "infrastructure/deploy/teamassist/compose.yookassa.yaml",
        "config",
        "--no-env-resolution",
        "--format",
        "json",
      ],
      {
        encoding: "utf8",
        timeout: 20_000,
        env: {
          ...process.env,
          STAGING_IMAGE: "daryadarcy-staging:config-test",
          STAGING_VIDEO_IMAGE: "daryadarcy-video:config-test",
        },
      },
    );
    assert.equal(compose.status, 0, "Compose validation failed");
    const cfg = JSON.parse(compose.stdout);
    const keys = (service) =>
      Object.keys(cfg.services[service].networks).sort();
    assert.deepEqual(keys("api"), ["isolated", "payment-control"]);
    assert.deepEqual(keys("web"), ["image-egress", "isolated"]);
    assert.deepEqual(keys("video"), ["video-control", "video-egress"]);
    assert.deepEqual(keys("mysql"), ["isolated"]);
    assert.deepEqual(keys("edge"), ["ingress", "isolated", "video-control"]);
    assert.equal(cfg.networks["payment-control"].internal, true);
    const gate = cfg.services["payment-egress"];
    assert.deepEqual(keys("payment-egress"), [
      "payment-control",
      "payment-egress",
    ]);
    assert.deepEqual(gate.networks["payment-control"].aliases, [
      "api.yookassa.ru",
    ]);
    assert.equal(gate.ports, undefined);
    assert.equal(gate.environment, undefined);
    assert.equal(gate.read_only, true);
    assert.equal(gate.mem_limit, "33554432");
    assert.deepEqual(gate.cap_drop, ["ALL"]);
  },
);

function docker(...args) {
  return spawnSync("docker", args, { encoding: "utf8", timeout: 20_000 });
}
function create(kind, name, ...args) {
  const result = docker(...args);
  assert.equal(result.status, 0, `Cannot create ${kind}: ${result.stderr}`);
  owned.push({ kind, name });
}
function inProbe(script) {
  const result = docker("exec", probe, "node", "-e", script);
  assert.equal(result.status, 0, "Probe failed (no provider body logged)");
  return JSON.parse(result.stdout);
}

test(
  "payment gateway permits verified YooKassa TLS only while the caller stays isolated",
  { skip: !enabled, timeout: 120_000 },
  async () => {
    assert.match(probeImage || "", /^sha256:[a-f0-9]{64}$/);
    assert.equal(docker("info", "--format", "{{.ServerVersion}}").status, 0);
    try {
      create(
        "network",
        control,
        "network",
        "create",
        "--internal",
        "--label",
        label,
        control,
      );
      create(
        "network",
        external,
        "network",
        "create",
        "--label",
        label,
        external,
      );
      create(
        "container",
        gateway,
        "run",
        "-d",
        "--name",
        gateway,
        "--label",
        label,
        "--network",
        control,
        "--network-alias",
        "api.yookassa.ru",
        "--user",
        "101:101",
        "--read-only",
        "--cap-drop",
        "ALL",
        "--security-opt",
        "no-new-privileges:true",
        "--memory",
        "32m",
        "--cpus",
        "0.1",
        "--pids-limit",
        "32",
        "--tmpfs",
        "/tmp:size=16m,mode=1777,noexec,nosuid,nodev",
        "--mount",
        `type=bind,source=${config},target=/etc/nginx/nginx.conf,readonly`,
        "--entrypoint",
        "nginx",
        nginx,
        "-g",
        "daemon off;",
      );
      assert.equal(docker("network", "connect", external, gateway).status, 0);
      assert.equal(docker("exec", gateway, "nginx", "-t").status, 0);
      create(
        "container",
        probe,
        "run",
        "-d",
        "--name",
        probe,
        "--label",
        label,
        "--network",
        control,
        "--read-only",
        "--cap-drop",
        "ALL",
        "--security-opt",
        "no-new-privileges:true",
        "--memory",
        "64m",
        "--cpus",
        "0.15",
        "--pids-limit",
        "32",
        "--entrypoint",
        "node",
        probeImage,
        "-e",
        "setInterval(()=>{},1000)",
      );

      const allowed = inProbe(`
        const https = require('node:https');
        const req = https.get('https://api.yookassa.ru/v3/me', {timeout:15000}, res=>{
          res.resume();
          res.on('end',()=>console.log(JSON.stringify({
            status:res.statusCode, authorized:res.socket?.authorized ?? req.socket.authorized
          })));
        });
        req.on('timeout',()=>req.destroy(new Error('timeout')));
        req.on('error',()=>process.exit(1));
      `);
      assert.deepEqual(allowed, { status: 401, authorized: true });

      for (const servername of ["example.com", ""]) {
        const refused = inProbe(`
          const https = require('node:https');
          const req = https.get({hostname:'api.yookassa.ru',port:443,path:'/v3/me',
            servername:${JSON.stringify(servername)},timeout:5000},res=>{
              res.resume(); console.log(JSON.stringify({refused:false}));
          });
          req.on('timeout',()=>req.destroy(new Error('timeout')));
          req.on('error',e=>console.log(JSON.stringify({refused:e.code==='ECONNRESET'})));
        `);
        assert.deepEqual(refused, { refused: true });
      }
      const plaintext = inProbe(`
        const net = require('node:net'); let bytes=0, timedOut=false;
        const socket=net.connect(443,'api.yookassa.ru',()=>socket.write(
          'GET /v3/me HTTP/1.1\\r\\nHost: api.yookassa.ru\\r\\n\\r\\n'));
        socket.setTimeout(5000,()=>{timedOut=true;socket.destroy()});
        socket.on('data',chunk=>{bytes+=chunk.length});
        socket.on('error',()=>{});
        socket.on('close',()=>console.log(JSON.stringify({bytes,timedOut})));
      `);
      assert.deepEqual(plaintext, { bytes: 0, timedOut: false });
      const direct = inProbe(`
        const net=require('node:net');let connected=false;
        const socket=net.connect(443,'1.1.1.1',()=>{connected=true;socket.destroy()});
        socket.setTimeout(4000,()=>socket.destroy());socket.on('error',()=>{});
        socket.on('close',()=>console.log(JSON.stringify({connected})));
      `);
      assert.deepEqual(direct, { connected: false });
      const identities = JSON.parse(docker("inspect", gateway, probe).stdout);
      assert.deepEqual(Object.keys(identities[1].NetworkSettings.Networks), [
        control,
      ]);
      assert.deepEqual(
        Object.keys(identities[0].NetworkSettings.Networks).sort(),
        [control, external].sort(),
      );
      for (const identity of identities) {
        assert.deepEqual(identity.HostConfig.PortBindings, {});
        assert.equal(identity.HostConfig.ReadonlyRootfs, true);
      }
    } finally {
      // Only names created successfully by this invocation, label checked first.
      for (const { kind, name } of owned.reverse()) {
        const inspect = docker(
          kind === "network" ? "network" : "container",
          "inspect",
          name,
        );
        assert.equal(
          inspect.status,
          0,
          `Cannot verify cleanup ownership of ${name}`,
        );
        const identity = JSON.parse(inspect.stdout)[0];
        const labels =
          kind === "network" ? identity.Labels : identity.Config.Labels;
        assert.equal(labels["daryadarcy.task"], prefix);
        const removed =
          kind === "network"
            ? docker("network", "rm", name)
            : docker("container", "rm", "-f", name);
        assert.equal(removed.status, 0, `Cannot clean up own ${kind}`);
      }
    }
  },
);
