/** Чтения отметок отдельных карточек объединяем в ограниченные запросы и сохраняем версию чтения для проверки восстановления. */
import {
  interactionBatches,
  requirePostInteractions,
  type PostInteractions,
} from "./post-interaction-data";
import { invalidResponse } from "@/shared/api/errors";

export type PostInteractionSnapshot = PostInteractions & {
  readVersion: number;
};
type Group = { controller: AbortController; entries: Entry[] };
type Entry = {
  id: number;
  signal: AbortSignal;
  resolve: (value: PostInteractionSnapshot) => void;
  reject: (error: unknown) => void;
  abort: () => void;
  group?: Group;
};

/** Коротким окном объединяем потребности карточек в wire batches; отдельные подписчики сохраняют свои сигналы и версии свежего чтения. Отдельная кеш-запись принадлежит одному посту. */
export function createPostInteractionReader(
  load: (ids: number[], signal: AbortSignal) => Promise<unknown>,
) {
  const entries = new Set<Entry>();
  let scheduled: ReturnType<typeof setTimeout> | undefined;
  let readVersion = 0;
  /** Удаляем ожидающего читателя и его abort-listener после любого завершения. */
  const release = (entry: Entry) => {
    entries.delete(entry);
    entry.signal.removeEventListener("abort", entry.abort);
  };
  /** Валидируем batch один раз и раздаём каждому активному читателю только его ID с общей новой readVersion. */
  const run = async (group: Group, ids: number[]) => {
    try {
      const data = requirePostInteractions(
        await load(ids, group.controller.signal),
        ids,
      );
      group.controller.signal.throwIfAborted();
      const version = ++readVersion;
      for (const entry of group.entries) {
        if (!entries.has(entry)) continue;
        release(entry);
        entry.resolve({
          likedIds: data.likedIds.includes(entry.id) ? [entry.id] : [],
          savedIds: data.savedIds.includes(entry.id) ? [entry.id] : [],
          readVersion: version,
        });
      }
    } catch (error) {
      for (const entry of group.entries) {
        if (!entries.has(entry)) continue;
        release(entry);
        entry.reject(error);
      }
    }
  };
  /** Формируем группы только для ещё не отправленных читателей; уже выполняющийся batch не переназначаем. */
  const flush = () => {
    scheduled = undefined;
    const queued = [...entries].filter((entry) => !entry.group);
    for (const ids of interactionBatches(queued.map((entry) => entry.id))) {
      const selected = new Set(ids);
      const group: Group = {
        controller: new AbortController(),
        entries: queued.filter((entry) => selected.has(entry.id)),
      };
      for (const entry of group.entries) entry.group = group;
      void run(group, ids);
    }
  };
  return {
    /** Ставим чтение одного поста в очередь; отмена последнего потребителя останавливает общий запрос группы. */
    read(id: number, signal: AbortSignal): Promise<PostInteractionSnapshot> {
      if (signal.aborted) return Promise.reject(signal.reason);
      if (!Number.isSafeInteger(id) || id <= 0)
        return Promise.reject(invalidResponse());
      return new Promise((resolve, reject) => {
        const entry: Entry = {
          id,
          signal,
          resolve,
          reject,
          /** Снимаем одного читателя; общий controller отзываем лишь когда в группе не осталось ожидающих подписчиков. */
          abort: () => {
            if (!entries.has(entry)) return;
            release(entry);
            reject(
              signal.reason ??
                new DOMException("Операция отменена", "AbortError"),
            );
            const group = entry.group;
            if (group && group.entries.every((item) => !entries.has(item)))
              group.controller.abort();
            if (entries.size === 0 && scheduled !== undefined) {
              clearTimeout(scheduled);
              scheduled = undefined;
            }
          },
        };
        entries.add(entry);
        signal.addEventListener("abort", entry.abort, { once: true });
        // Retry timers run in separate tasks. A short collection window also
        // batches those reads instead of issuing one procedure per post.
        if (scheduled === undefined) scheduled = setTimeout(flush, 5);
      });
    },
    /** Отзываем всех ожидающих читателей при смене владельца, включая отложенный flush. */
    cancel() {
      for (const entry of entries) entry.abort();
    },
  };
}
