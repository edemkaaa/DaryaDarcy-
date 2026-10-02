import { describe, expect, it } from "vitest";
import { checkDocumentationLinks } from "../tooling/scripts/documentation-links";

const files = new Set([
  "README.md",
  "docs/README.md",
  "docs/development/workflow.md",
  "docs/architecture/api.md",
  "docs/reference/a file.md",
  "docs/reference/picture.png",
  "apps/frontend/app/(tabs)/index.tsx",
  "packages/database/src/schema.ts",
]);

describe("documentation file links", () => {
  it("reports a missing document with its source line", () => {
    expect(
      checkDocumentationLinks(
        "README.md",
        "# Intro\n\n[API](docs/OLD-API.md)",
        files,
      ),
    ).toEqual([
      {
        file: "README.md",
        line: 3,
        target: "docs/OLD-API.md",
        reason: "missing-target",
      },
    ]);
  });

  it("accepts the same document after its link is rebased", () => {
    expect(
      checkDocumentationLinks(
        "docs/development/workflow.md",
        "[API](../architecture/api.md)\n[Schema](../../packages/database/src/schema.ts)",
        files,
      ),
    ).toEqual([]);
  });

  it("accepts a directory only when the inventory contains its children", () => {
    expect(
      checkDocumentationLinks(
        "README.md",
        "[Docs](docs/)\n[Empty](absent/)",
        files,
      ),
    ).toEqual([
      {
        file: "README.md",
        line: 2,
        target: "absent/",
        reason: "missing-target",
      },
    ]);
  });

  it("supports images and reference definitions", () => {
    expect(
      checkDocumentationLinks(
        "README.md",
        '![Screenshot](docs/reference/picture.png)\n[Read][guide]\n[guide]: docs/MISSING.md "Title"',
        files,
      ),
    ).toEqual([
      {
        file: "README.md",
        line: 3,
        target: "docs/MISSING.md",
        reason: "missing-target",
      },
    ]);
  });

  it("supports angles, percent-encoded spaces, titles, query and fragment", () => {
    expect(
      checkDocumentationLinks(
        "README.md",
        '[One](<docs/reference/a file.md> "Title")\n[Two](docs/reference/a%20file.md?view=source#intro)',
        files,
      ),
    ).toEqual([]);
  });

  it("supports balanced parentheses in Expo route paths", () => {
    expect(
      checkDocumentationLinks(
        "README.md",
        "[Screen](apps/frontend/app/(tabs)/index.tsx)",
        files,
      ),
    ).toEqual([]);
    expect(
      checkDocumentationLinks(
        "README.md",
        "[Screen](apps/frontend/app/(tabs)/missing.tsx)",
        files,
      ),
    ).toEqual([
      {
        file: "README.md",
        line: 1,
        target: "apps/frontend/app/(tabs)/missing.tsx",
        reason: "missing-target",
      },
    ]);
  });

  it("rejects links outside the repository", () => {
    expect(
      checkDocumentationLinks(
        "docs/README.md",
        "[Secret](../../outside.md)",
        files,
      ),
    ).toEqual([
      {
        file: "docs/README.md",
        line: 1,
        target: "../../outside.md",
        reason: "outside-repository",
      },
    ]);
  });

  it("accepts repository-root paths", () => {
    expect(
      checkDocumentationLinks(
        "docs/development/workflow.md",
        "[Root](/README.md)",
        files,
      ),
    ).toEqual([]);
  });

  it("does not fetch URLs or treat headings as file paths", () => {
    expect(
      checkDocumentationLinks(
        "README.md",
        "[Web](https://example.invalid/missing)\n[Mail](mailto:user@example.invalid)\n[Anchor](#intro)\n[Host](//example.invalid/file)",
        files,
      ),
    ).toEqual([]);
  });

  it("ignores fenced examples and inline code but preserves line numbers", () => {
    const source =
      "~~~md\n[Example](missing.md)\n~~~\n`[Example](missing.md)`\n[Broken](missing.md)";
    expect(checkDocumentationLinks("README.md", source, files)).toEqual([
      {
        file: "README.md",
        line: 5,
        target: "missing.md",
        reason: "missing-target",
      },
    ]);
  });

  it("handles bad encoding without crashing the rest of the scan", () => {
    expect(
      checkDocumentationLinks(
        "README.md",
        "[Bad](docs/%ZZ.md)\n[Good](docs/README.md)",
        files,
      ),
    ).toEqual([
      {
        file: "README.md",
        line: 1,
        target: "docs/%ZZ.md",
        reason: "invalid-encoding",
      },
    ]);
  });
});
