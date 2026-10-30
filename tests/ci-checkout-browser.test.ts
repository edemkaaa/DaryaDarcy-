import { afterEach, expect, it } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const script = resolve("tooling/scripts/check-checkout-browser.mjs");
const owned: string[] = [];
afterEach(() => {
  for (const p of owned.splice(0)) rmSync(p, { recursive: true });
});
function run(profile: string, mode = "valid") {
  const cwd = mkdtempSync(join(tmpdir(), "darcy-checkout-ci-"));
  owned.push(cwd);
  const bin = join(cwd, "bin");
  mkdirSync(bin);
  writeFileSync(
    join(bin, "pnpm"),
    `#!${process.execPath}
const fs=require('node:fs');
const args=process.argv.slice(2);
const keys=['NEXT_PUBLIC_PRODAMUS_TEST_ENABLED','NEXT_PUBLIC_GUEST_CHECKOUT_RECOVERY_ENABLED','NEXT_PUBLIC_NORMAL_CHECKOUT_RECOVERY_ENABLED','NEXT_PUBLIC_API_BASE_URL','API_PROXY_TARGET','DATABASE_URL','BACKEND_TEST_DATABASE_URL'];
fs.appendFileSync('calls.jsonl',JSON.stringify({args,env:Object.fromEntries(keys.map(k=>[k,process.env[k]]))})+'\\n');
const build=args[0]==='build:web';
if(build)process.exit(process.env.FIXTURE_MODE==='build-fail'?7:0);
if(process.env.FIXTURE_MODE==='browser-fail')process.exit(8);
if(process.env.FIXTURE_MODE==='missing-report')process.exit(0);
const files=process.env.NEXT_PUBLIC_PRODAMUS_TEST_ENABLED==='true'?['prodamus-return.spec.ts','guest-contact-fields.spec.ts']:['guest-checkout-recovery.spec.ts','normal-checkout-recovery.spec.ts'];
const skipped=process.env.FIXTURE_MODE==='all-skip';
const suites=files.map(file=>({title:file,specs:[{title:'synthetic success',file,tests:[{status:skipped?'skipped':'expected',results:[{status:skipped?'skipped':'passed'}]}]}]}));
if(process.env.FIXTURE_MODE==='missing-suite')suites.pop();
if(process.env.FIXTURE_MODE==='unexpected-skip')suites[0].specs.push({title:'unexplained skip',file:files[0],tests:[{status:'skipped',results:[{status:'skipped'}]}]});
if(process.env.FIXTURE_MODE==='legacy-skip')suites[1].specs.push({title:'guests keep the existing checkout even when the NORMAL integration build is enabled',file:files[1],tests:[{status:'skipped',results:[{status:'skipped'}]}]});
fs.writeFileSync(process.env.PLAYWRIGHT_JSON_OUTPUT_FILE,JSON.stringify({suites,stats:{unexpected:0,flaky:0}}));
`,
    { mode: 0o700 },
  );
  const result = spawnSync(process.execPath, [script, profile], {
    cwd,
    encoding: "utf8",
    timeout: 10000,
    env: {
      PATH: `${bin}:${process.env.PATH}`,
      HOME: process.env.HOME,
      FIXTURE_MODE: mode,
      NEXT_PUBLIC_PRODAMUS_TEST_ENABLED: "incorrect-inherited",
      DATABASE_URL: "PRIVATE_DATABASE_SENTINEL",
      BACKEND_TEST_DATABASE_URL: "PRIVATE_TEST_DATABASE_SENTINEL",
      API_PROXY_TARGET: "https://working.example.invalid",
    },
  });
  const calls = existsSync(join(cwd, "calls.jsonl"))
    ? readFileSync(join(cwd, "calls.jsonl"), "utf8")
        .trim()
        .split("\n")
        .map((s) => JSON.parse(s))
    : [];
  return { result, calls, output: result.stdout + result.stderr };
}
it("rejects unknown profiles before spawning a command", () => {
  const { result, calls } = run("../../working");
  expect(result.status).not.toBe(0);
  expect(calls).toEqual([]);
});
it.each(["prodamus-test", "guest-normal"])(
  "builds %s and then tests with the same explicit flags and no SQL/proxy",
  (profile) => {
    const { result, calls, output } = run(profile);
    expect(result.status, output).toBe(0);
    expect(calls).toHaveLength(2);
    expect(calls[0].args).toEqual(["build:web"]);
    for (const call of calls) {
      expect(call.env).toMatchObject({
        NEXT_PUBLIC_PRODAMUS_TEST_ENABLED:
          profile === "prodamus-test" ? "true" : "false",
        NEXT_PUBLIC_GUEST_CHECKOUT_RECOVERY_ENABLED: "true",
        NEXT_PUBLIC_NORMAL_CHECKOUT_RECOVERY_ENABLED: "true",
        DATABASE_URL: "",
        BACKEND_TEST_DATABASE_URL: "",
        API_PROXY_TARGET: "",
        NEXT_PUBLIC_API_BASE_URL: "",
      });
    }
    expect(calls[1].args.slice(0, 5)).toEqual([
      "--filter",
      "@daryadarcy/frontend",
      "exec",
      "playwright",
      "test",
    ]);
    expect(output).not.toContain("PRIVATE_DATABASE_SENTINEL");
  },
);
it("does not start browser tests after a build failure", () => {
  const { result, calls } = run("prodamus-test", "build-fail");
  expect(result.status).toBe(7);
  expect(calls).toHaveLength(1);
});
it("propagates a browser failure", () => {
  expect(run("prodamus-test", "browser-fail").result.status).toBe(8);
});
it.each(["missing-report", "all-skip", "missing-suite", "unexpected-skip"])(
  "rejects a false green browser run: %s",
  (mode) => {
    expect(run("guest-normal", mode).result.status).not.toBe(0);
  },
);
it("allows only the known legacy guest skip in the guest/NORMAL profile", () => {
  expect(run("guest-normal", "legacy-skip").result.status).toBe(0);
  expect(run("prodamus-test", "legacy-skip").result.status).not.toBe(0);
});
