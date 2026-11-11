// Строит воспроизводимый план переноса по инвентарю и хешам. План не является разрешением выполнить запись на рабочем хранилище.
import { createHash } from "node:crypto";
import type { inventoryLegacyMedia } from "./legacy-media-inventory";

type Report = ReturnType<typeof inventoryLegacyMedia>;

/** A work list, never an import/ACL approval. Source bytes must be verified separately. */
export function planLegacyMedia(report: Report) {
  // Строит детерминированный план копирования с ключом операции; без размера и хеша источника план не готов к применению.

  const operations = [],
    blocked = [],
    alreadyProtected = [];
  for (const group of report.groups) {
    for (const ref of group.references.filter(
      (ref) => ref.access === "restricted",
    )) {
      const subject = { kind: ref.kind, id: ref.id, slot: ref.slot };
      if (group.classification === "protected-reference") {
        alreadyProtected.push({
          subject,
          sourceFingerprint: group.fingerprint,
        });
        continue;
      }
      const supported =
        (ref.kind === "postPhoto" && /^photos\.\d+$/.test(ref.slot)) ||
        (ref.kind === "postMedia" && ref.slot === "url") ||
        (ref.kind === "articleMedia" &&
          /^sections\.[1-9]\d*\.(?:url|urls\.\d+)$/.test(ref.slot));
      if (
        !supported ||
        !group.location ||
        !["restricted-candidate", "shared-public"].includes(
          group.classification,
        )
      ) {
        blocked.push({
          subject,
          sourceFingerprint: group.fingerprint,
          reason: supported ? group.classification : "unsupported-slot",
        });
        continue;
      }
      const operationId = createHash("sha256")
        .update(JSON.stringify([subject, group.location]))
        .digest("hex");
      operations.push({
        operationId,
        idempotencyKey: `legacy:${operationId}`,
        subject,
        expectedOldUrl: group.location,
        expectedSourceSha256: null,
        expectedSourceBytes: null,
        sharedPublic: group.classification === "shared-public",
        preserveOriginal: true,
        ready: false,
      });
    }
  }
  return {
    version: 1,
    mode: "legacy-media-plan",
    coverage: report.coverage,
    retirementAllowed: false,
    operations: operations.sort((a, b) =>
      a.operationId.localeCompare(b.operationId),
    ),
    blocked,
    alreadyProtected,
  };
}
