// Принимает снимок связей через stdin и выводит карту использования медиа. Не подключается к БД и не скачивает либо закрывает найденные файлы.
import { z } from "zod";
import {
  collectArticleReferences,
  collectMediaSnapshot,
} from "../lib/media-reference-map";

// stdin only: no .env, database connection, filesystem export, storage or URL fetch.
async function main() {
  // Ограничивает фактический stdin одним МиБ и принимает только известные снимки; ошибки не выводят исходные значения или подписанные URL.

  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of process.stdin) {
    const buffer = Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > 1024 * 1024) throw new Error("Input limit exceeded");
    chunks.push(buffer);
  }
  const input = z
    .union([
      z.object({ articles: z.unknown() }).strict(),
      z
        .object({ content: z.unknown(), inventory: z.unknown().optional() })
        .strict(),
    ])
    .parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
  const report =
    "content" in input
      ? collectMediaSnapshot(input.content, input.inventory)
      : collectArticleReferences(input.articles);
  process.stdout.write(JSON.stringify(report) + "\n");
}
void main().catch(() => {
  // Parser errors can contain source values or signed URLs: never log them.
  process.stderr.write("Invalid media reference snapshot\n");
  process.exitCode = 1;
});
