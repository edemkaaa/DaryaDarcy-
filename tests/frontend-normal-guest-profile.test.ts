import { afterEach, expect, it } from "vitest";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});
function build(
  mode: "valid" | "wrong-profile" | "missing-manifest" | "build-failure",
) {
  const directory = mkdtempSync(join(tmpdir(), "darcy-normal-guest-profile-"));
  directories.push(directory);
  const bin = join(directory, "bin");
  mkdirSync(bin);
  const output = join(directory, "observed.json");
  writeFileSync(
    join(bin, "pnpm"),
    `#!${process.execPath}
const fs=require('fs');
const flags=Object.fromEntries(['NEXT_PUBLIC_CLUB_TEST_CHECKOUT','NEXT_PUBLIC_PRODAMUS_TEST_ENABLED','NEXT_PUBLIC_NORMAL_CHECKOUT_RECOVERY_ENABLED','NEXT_PUBLIC_GUEST_CHECKOUT_RECOVERY_ENABLED'].map(k=>[k,process.env[k]]));
fs.writeFileSync(${JSON.stringify(output)},JSON.stringify({args:process.argv.slice(2),flags}));
if(${JSON.stringify(mode)}==='build-failure')process.exit(9);
if(${JSON.stringify(mode)}==='wrong-profile')flags.NEXT_PUBLIC_PRODAMUS_TEST_ENABLED='true';
if(${JSON.stringify(mode)}!=='missing-manifest'){fs.mkdirSync('apps/frontend/.next',{recursive:true});fs.writeFileSync('apps/frontend/.next/required-server-files.json',JSON.stringify({config:{env:flags}}));}
`,
    { mode: 0o700 },
  );
  const child = spawnSync(
    process.execPath,
    [resolve("tooling/scripts/build-normal-guest.mjs")],
    {
      cwd: directory,
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        NEXT_PUBLIC_CLUB_TEST_CHECKOUT: "true",
        NEXT_PUBLIC_PRODAMUS_TEST_ENABLED: "true",
        NEXT_PUBLIC_NORMAL_CHECKOUT_RECOVERY_ENABLED: "false",
        NEXT_PUBLIC_GUEST_CHECKOUT_RECOVERY_ENABLED: "false",
      },
      encoding: "utf8",
    },
  );
  return { child, observed: JSON.parse(readFileSync(output, "utf8")) };
}
it("selects NORMAL/GUEST even when the invoking shell enables TEST and disables recovery", () => {
  const { child, observed } = build("valid");
  expect(child.status).toBe(0);
  expect(observed.args).toEqual(["build:web"]);
  expect(observed.flags).toEqual({
    NEXT_PUBLIC_CLUB_TEST_CHECKOUT: "false",
    NEXT_PUBLIC_PRODAMUS_TEST_ENABLED: "false",
    NEXT_PUBLIC_NORMAL_CHECKOUT_RECOVERY_ENABLED: "true",
    NEXT_PUBLIC_GUEST_CHECKOUT_RECOVERY_ENABLED: "true",
  });
});
it.each(["wrong-profile", "missing-manifest"] as const)(
  "rejects a successful build with %s",
  (mode) => {
    expect(build(mode).child.status).not.toBe(0);
  },
);
it("preserves a failing build exit instead of declaring the profile accepted", () => {
  expect(build("build-failure").child.status).toBe(9);
});
