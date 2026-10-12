import { execFileSync } from "node:child_process";
import { expect, it } from "vitest";

const corePath = require.resolve("@trpc/server/unstable-core-do-not-import");

// The vulnerable experimental caller is not used by the app. Characterize its
// upstream converter in disposable children so a RED cannot pollute our worker.
it.each(["__proto__", "constructor.prototype"])(
  "does not write global prototype through form path %s",
  (prefix) => {
    const output = execFileSync(
      process.execPath,
      [
        "-e",
        `const { formDataToObject } = require(process.argv[1]);
         const form = new FormData();
         form.append(process.argv[2] + '.codexFixturePolluted', 'fixture');
         try { formDataToObject(form); } catch {}
         console.log(JSON.stringify({
           polluted: Object.hasOwn(Object.prototype, 'codexFixturePolluted')
         }));`,
        corePath,
        prefix,
      ],
      { encoding: "utf8", timeout: 2000, maxBuffer: 4096 },
    );
    expect(JSON.parse(output)).toEqual({ polluted: false });
  },
);

it("preserves ordinary nested form fields", () => {
  const { formDataToObject } = require(
    corePath,
  ) as typeof import("@trpc/server/unstable-core-do-not-import");
  const form = new FormData();
  form.append("profile[name]", "Fixture");
  form.append("tags[0]", "one");
  form.append("tags[1]", "two");
  expect(formDataToObject(form)).toEqual({
    profile: { name: "Fixture" },
    tags: ["one", "two"],
  });
});
