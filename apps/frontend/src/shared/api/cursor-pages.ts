/** Чистые операции над страницами сохраняют навигационные курсоры без удержания всех ранее просмотренных карточек. */
import type { QueryClient, QueryKey } from "@tanstack/react-query";

/** Добавляем владельца и версию контракта к исходному queryKey, чтобы несовместимые страницы не разделили кеш. */
export function cursorQueryKey(
  key: QueryKey,
  scope: string,
  version?: string,
): QueryKey {
  return [...key, { ownerScope: scope, ...(version ? { version } : {}) }];
}

/** Откладываем проверку до microtask: соседний observer может подписаться в том же проходе React и ещё нуждаться в запросе. */
export function cancelInactiveCursorQuery(client: QueryClient, key: QueryKey) {
  queueMicrotask(() => {
    const query = client.getQueryCache().find({ queryKey: key, exact: true });
    if (query && !query.isActive())
      void client.cancelQueries({ queryKey: key, exact: true });
  });
}
export type CursorPage = { items: { id: number }[]; nextCursor: string | null };
export type CursorChain<P extends CursorPage> = {
  pages: P[];
  pageParams: (string | null)[];
  refreshedAt?: number[];
  head?: CursorPage;
  previousCursors?: (string | null)[];
};
export class CursorChainError extends Error {
  /** Отдельный вид ошибки позволяет UI выбрать перечитывание цепочки вместо повторной отправки зацикленного курсора. */
  constructor() {
    super("Курсор списка повторился. Обновите список.");
  }
}

// Следующая страница обязана продвигать цепочку; повтор токена иначе привёл бы к бесконечной догрузке.
/** Присоединяем страницу только при новом токене; повтор любого удержанного или возвратного курсора считается нарушением цепочки. */
export function appendCursorPage<P extends CursorPage>(
  previous: CursorChain<P>,
  cursor: string,
  page: P,
): CursorChain<P> {
  if (
    previous.pageParams.includes(cursor) ||
    previous.previousCursors?.includes(cursor) ||
    page.nextCursor === cursor ||
    (page.nextCursor !== null &&
      previous.previousCursors?.includes(page.nextCursor)) ||
    (page.nextCursor !== null && previous.pageParams.includes(page.nextCursor))
  )
    throw new CursorChainError();
  return {
    ...previous,
    pages: [...previous.pages, page],
    pageParams: [...previous.pageParams, cursor],
    refreshedAt: [
      ...(previous.refreshedAt ?? previous.pages.map(() => 0)),
      Date.now(),
    ],
  };
}

export const POST_PAGE_WINDOW = { maxPages: 8, pageSize: 12 };
export const CURSOR_PAGE_LIMIT = 8;
/** Для сравнения головы достаточно порядка ID и nextCursor: полные тексты отброшенных карточек удерживать не нужно. */
const boundary = (page: CursorPage): CursorPage => ({
  nextCursor: page.nextCursor,
  items: page.items.map(({ id }) => ({ id })),
});

// Сбрасываем далёкие карточки, оставляя лёгкие токены возврата и границу головы для будущего обновления.
/** Оставляем окно нужного направления и лёгкую историю курсоров; начало окна определяет, какую сторону карточек освобождаем. */
export function boundCursorChain<P extends CursorPage>(
  chain: CursorChain<P>,
  maxPages: number,
  direction: "next" | "previous",
  rememberPrevious = true,
): CursorChain<P> {
  const start =
    direction === "next" ? Math.max(0, chain.pages.length - maxPages) : 0;
  return {
    ...chain,
    head:
      chain.pageParams[0] === null
        ? boundary(chain.pages[0])
        : chain.head && boundary(chain.head),
    pages: chain.pages.slice(start, start + maxPages),
    pageParams: chain.pageParams.slice(start, start + maxPages),
    refreshedAt: chain.refreshedAt?.slice(start, start + maxPages),
    previousCursors: !rememberPrevious
      ? undefined
      : direction === "next"
        ? [
            ...(chain.previousCursors ?? []),
            ...chain.pageParams.slice(0, start),
          ]
        : chain.previousCursors,
  };
}

/** Возвращаем ранее отброшенную страницу по сохранённому непрозрачному токену и требуем совпадения её границы с текущей головой окна. Данные отброшенных карточек не остаются во втором кэше страниц. */
export function prependCursorPage<P extends CursorPage>(
  chain: CursorChain<P>,
  page: P,
): CursorChain<P> {
  const trail = chain.previousCursors ?? [];
  if (!trail.length || page.nextCursor !== chain.pageParams[0])
    throw new CursorChainError();
  return {
    ...chain,
    pages: [page, ...chain.pages],
    pageParams: [trail.at(-1)!, ...chain.pageParams],
    previousCursors: trail.slice(0, -1),
    refreshedAt: [
      Date.now(),
      ...(chain.refreshedAt ?? chain.pages.map(() => 0)),
    ],
  };
}

/** Порядок ID важен наравне с курсором: перестановка или исчезновение карточки требует пересборки соответствующего окна. */
const sameBoundary = (a: CursorPage | undefined, b: CursorPage) =>
  a?.nextCursor === b.nextCursor &&
  a.items.length === b.items.length &&
  a.items.every((item, index) => item.id === b.items[index].id);

/** Читаем свежую голову и выбранные видимые страницы; смена границы запускает согласованную пересборку удержанного окна до commit. */
export async function refreshCursorChain<P extends CursorPage>(
  previous: CursorChain<P> | undefined,
  fetchPage: (cursor: string | null) => Promise<P>,
  visibleIds: ReadonlySet<number>,
  mode: "background" | "all" | "restart",
): Promise<CursorChain<P>> {
  const fresh = new Map<string | null, P>();
  /** В одном обновлении каждый курсор читается один раз, чтобы все сравнения использовали один ответ, а цикл курсоров завершался ошибкой. */
  const read = async (cursor: string | null) => {
    const cached = fresh.get(cursor);
    if (cached) return cached;
    const page = await fetchPage(cursor);
    if (
      page.nextCursor !== null &&
      (page.nextCursor === cursor || page.nextCursor === "0")
    )
      throw new CursorChainError();
    fresh.set(cursor, page);
    return page;
  };
  const head = await read(null);
  const now = Date.now();
  if (!previous || mode === "restart")
    return {
      pages: [head],
      pageParams: [null],
      refreshedAt: [now],
      head: boundary(head),
    };
  const selected = previous.pages
    .map((page, index) => ({ page, index }))
    .filter(
      ({ page, index }) =>
        previous.pageParams[index] !== null &&
        page.items.some((item) => visibleIds.has(item.id)),
    )
    .slice(0, 2);
  // Lists without visibility reporting still rotate through their retained tail.
  if (!visibleIds.size && !selected.length && previous.pages.length > 1) {
    const index = previous.pages
      .map((_, i) => i)
      .filter((i) => previous.pageParams[i] !== null)
      .sort(
        (a, b) =>
          (previous.refreshedAt?.[a] ?? 0) - (previous.refreshedAt?.[b] ?? 0),
      )[0];
    if (index !== undefined)
      selected.push({ page: previous.pages[index], index });
  }
  let changed = !sameBoundary(
    previous.pageParams[0] === null ? previous.pages[0] : previous.head,
    head,
  );
  if (mode !== "all" && !changed) {
    for (const { page, index } of selected) {
      if (!sameBoundary(page, await read(previous.pageParams[index])))
        changed = true;
    }
  }
  // Изменение границы требует перечитать связанное окно целиком: смешанные старые offsets дают пропуски и повторы.
  if (mode === "all" || changed) {
    const pages: P[] = [],
      pageParams: (string | null)[] = [];
    let cursor = previous.pageParams[0];
    for (let index = 0; index < previous.pages.length; index++) {
      if (pageParams.includes(cursor)) throw new CursorChainError();
      const page = await read(cursor);
      pages.push(page);
      pageParams.push(cursor);
      if (page.nextCursor === null) break;
      cursor = page.nextCursor;
    }
    if (
      pages.at(-1)?.nextCursor !== null &&
      pageParams.includes(pages.at(-1)!.nextCursor)
    )
      throw new CursorChainError();
    return {
      pages,
      pageParams,
      refreshedAt: pages.map(() => now),
      head: boundary(head),
      previousCursors: previous.previousCursors,
    };
  }
  return {
    ...previous,
    head: boundary(head),
    pages: previous.pages.map(
      (page, index) => fresh.get(previous.pageParams[index]) ?? page,
    ),
    refreshedAt: previous.pages.map((_, index) =>
      fresh.has(previous.pageParams[index])
        ? now
        : (previous.refreshedAt?.[index] ?? 0),
    ),
  };
}
