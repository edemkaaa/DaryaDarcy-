import type { QueryClient, QueryKey } from "@tanstack/react-query";
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
};
export function mergeCursorHead<P extends CursorPage>(
  previous: CursorChain<P> | undefined,
  head: P,
): CursorChain<P> {
  const before = previous?.pages[0];
  const unchanged =
    before?.nextCursor === head.nextCursor &&
    before.items.length === head.items.length &&
    before.items.every((item, index) => item.id === head.items[index].id);
  return unchanged && previous
    ? { ...previous, pages: [head, ...previous.pages.slice(1)] }
    : { pages: [head], pageParams: [null] };
}
export function appendCursorPage<P extends CursorPage>(
  previous: CursorChain<P>,
  cursor: string,
  page: P,
): CursorChain<P> {
  if (
    previous.pageParams.includes(cursor) ||
    page.nextCursor === cursor ||
    (page.nextCursor !== null && previous.pageParams.includes(page.nextCursor))
  )
    throw new Error("Курсор списка повторился. Обновите список.");
  return {
    pages: [...previous.pages, page],
    pageParams: [...previous.pageParams, cursor],
  };
}
