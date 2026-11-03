import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const nginx =
  "nginx:stable-alpine@sha256:0985e772fb9f729e6fa0980da05fca5d9c468e870eed43071545afa9d2e27d94";
const python =
  "python@sha256:34386ef0cb081344d7ec1c103ba398e6e9f64e9ab3a1509accc92a4e24a07258";
const wire = `import http.server,json,socket,socketserver,threading,time
writes=0
class Handler(http.server.BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def do_GET(self):
  body=json.dumps(dict(instance=socket.gethostname(),writes=writes,url=self.path)).encode()
  self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
 def do_POST(self):
  global writes
  writes+=1
  self.connection.shutdown(socket.SHUT_RDWR);self.connection.close()
for port in [3000,8081,8082]:
 server=http.server.ThreadingHTTPServer(('0.0.0.0',port),Handler)
 threading.Thread(target=server.serve_forever,daemon=True).start()
threading.Event().wait()`;

// Real Nginx/Docker DNS and disposable transport wires only. No working network,
// application secrets, volumes, DB, S3, payments or messages are used.
describe.skipIf(process.env.API_EDGE_DOCKER_ACCEPTANCE !== "true")(
  "API replica edge routing",
  () => {
    let owner: string, network: string;
    let ids: string[];
    const docker = (...args: string[]) =>
      execFileSync("docker", args, {
        encoding: "utf8",
        timeout: 20_000,
      }).trim();
    const inspect = (id: string) => JSON.parse(docker("inspect", id))[0];
    const backend = (name: string, aliases: string[]) => {
      const id = docker(
        "run",
        "--pull=never",
        "-d",
        "--label",
        `codex.owner=${owner}`,
        "--network",
        network,
        ...aliases.flatMap((alias) => ["--network-alias", alias]),
        "--hostname",
        name,
        "--memory=64m",
        "--cpus=0.5",
        "--read-only",
        "--cap-drop=ALL",
        "--security-opt=no-new-privileges",
        "--log-driver=none",
        python,
        "python",
        "-c",
        wire,
      );
      ids.push(id);
      return id;
    };
    function remove(id: string) {
      if (inspect(id).Config.Labels["codex.owner"] !== owner)
        throw new Error("Refusing unowned fixture cleanup");
      docker("rm", "-f", id);
      const index = ids.indexOf(id);
    if (index >= 0) ids.splice(index, 1);
    }
    beforeEach(() => {
      owner = `darcy-edge-${randomUUID()}`;
      network = owner;
      ids = [];
      docker(
        "network",
        "create",
        "--internal",
        "--label",
        `codex.owner=${owner}`,
        network,
      );
    });
    afterEach(() => {
      // A daemon failure can happen after create but before returning the ID.
    // Discover only this run's exact owner label, never prune shared resources.
    const created = docker("ps", "-a", "--filter", `label=codex.owner=${owner}`, "--format", "{{.ID}}")
      .split(/\s+/).filter(Boolean);
    for (const id of created.reverse()) remove(id);
      if (
        !docker(
          "network",
          "ls",
          "--filter",
          `name=^${network}$`,
          "--format",
          "{{.ID}}",
        )
      )
        return;
      const config = JSON.parse(docker("network", "inspect", network))[0];
      if (config.Labels["codex.owner"] !== owner)
        throw new Error("Refusing unowned network cleanup");
      docker("network", "rm", network);
    });
    it.each(["edge.conf", "edge.video.conf"])(
      "balances, preserves writes and follows a changed API address with %s",
      async (filename) => {
        const a = backend("api-a", ["api"]);
        const b = backend("api-b", ["api"]);
        const client = backend("web-wire", ["web", "video"]);
        for (const id of [a, b])
          docker(
            "exec",
            id,
            "python",
            "-c",
            "import urllib.request;urllib.request.urlopen('http://127.0.0.1:3000/api/health')",
          );
        const edge = docker(
          "create",
          "--pull=never",
          "--label",
          `codex.owner=${owner}`,
          "--network",
          network,
          "--network-alias",
          "edge",
          "--user=101:101",
          "--memory=32m",
          "--cpus=0.5",
          "--tmpfs=/tmp:rw,size=16m,mode=1777",
          "--cap-drop=ALL",
          "--security-opt=no-new-privileges",
          "--entrypoint",
          "nginx",
          nginx,
          "-g",
          "daemon off;",
        );
        ids.push(edge);
        docker(
          "cp",
          resolve("infrastructure/deploy/teamassist", filename),
          `${edge}:/etc/nginx/nginx.conf`,
        );
        docker("start", edge);
        const request = (method: string, path: string) =>
          JSON.parse(
            docker(
              "exec",
              client,
              "python",
              "-c",
              `import http.client,json;c=http.client.HTTPConnection('edge',8080,timeout=2);c.request(${JSON.stringify(method)},${JSON.stringify(path)},body='synthetic' if ${JSON.stringify(method)}=='POST' else None);r=c.getresponse();print(json.dumps(dict(status=r.status,body=r.read().decode())))`,
            ),
          );
        const read = async () => {
          const response = request("GET", "/api/probe?preserve=query");
          expect(response.status).toBe(200);
          return JSON.parse(response.body) as { instance: string; url: string };
        };
        await expect
          .poll(
            async () => {
              try {
                return (await read()).url;
              } catch {
                return "not-ready";
              }
            },
            { timeout: 5000 },
          )
          .toBe("/api/probe?preserve=query");
        const first = new Set<string>();
        for (let i = 0; i < 8; i++) first.add((await read()).instance);
        expect(first).toEqual(new Set(["api-a", "api-b"]));
        // A mutation accepted by one upstream must not be replayed to another by
        // the proxy after an unknown response. Do not enable non_idempotent retry.
        const write = request("POST", "/api/write");
        expect(write.status).toBe(502);
        const total = [a, b].reduce(
          (sum, id) =>
            sum +
            JSON.parse(
              docker(
                "exec",
                id,
                "python",
                "-c",
                "import urllib.request;print(urllib.request.urlopen('http://127.0.0.1:3000/api/stats').read().decode())",
              ),
            ).writes,
          0,
        );
        expect(total).toBe(1);
        const oldAddress =
          inspect(a).NetworkSettings.Networks[network].IPAddress;
        remove(a);
        // Occupy the old address so Docker cannot mask stale DNS by reusing it.
        const hold = docker(
          "run",
          "--pull=never",
          "-d",
          "--label",
          `codex.owner=${owner}`,
          "--network",
          network,
          "--ip",
          oldAddress,
          "--memory=32m",
          "--read-only",
          "--log-driver=none",
          python,
          "python",
          "-c",
          "import time;time.sleep(86400)",
        );
        ids.push(hold);
        const c = backend("api-c", ["api"]);
        expect(inspect(c).NetworkSettings.Networks[network].IPAddress).not.toBe(
          oldAddress,
        );
        const current = new Set<string>();
        await expect
          .poll(
            async () => {
              try {
                current.add((await read()).instance);
              } catch {
                /* DNS convergence; never a false success. */
              }
              return current.has("api-b") && current.has("api-c");
            },
            { timeout: 16000, interval: 250 },
          )
          .toBe(true);
      },
      60000,
    );
  },
);
