import { z } from "zod";
import { collectArticleReferences } from "../lib/media-reference-map";

// stdin only: no .env, database connection, filesystem export, storage or URL fetch.
async function main() {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of process.stdin) {
    const buffer = Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > 1024 * 1024) throw new Error("Input limit exceeded");
    chunks.push(buffer);
  }
  const input = z
    .object({ articles: z.unknown() })
    .strict()
    .parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
  const report = collectArticleReferences(input.articles);
  process.stdout.write(JSON.stringify(report) + "\n");
}
void main().catch(() => {
  // Parser errors can contain source values or signed URLs: never log them.
  process.stderr.write("Invalid media reference snapshot\n");
  process.exitCode = 1;
});
