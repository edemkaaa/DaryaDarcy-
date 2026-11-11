/** Refresh ограниченной cursor-chain не должен мутировать подтверждённый cache или перечитывать весь посещённый архив. */
import { describe, expect, it, vi } from "vitest";
import {
  appendCursorPage,
  boundCursorChain,
  refreshCursorChain,
  type CursorChain,
  type CursorPage,
} from "../apps/frontend/src/shared/api/cursor-pages";

type Page = Omit<CursorPage, "items"> & {
  items: { id: number; text: string }[];
};
/** Синтетический reader отдаёт12строк и позволяет менять набор между чтениями. */
function fixture(count = 120) {
  let rows = Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    text: `post ${i + 1}`,
  }));
  /** Читаем текущее окно строк по числовому fixture cursor, записывая вызовы для assertions. */
  const read = vi.fn(async (cursor: string | null): Promise<Page> => {
    const start = Number(cursor ?? 0);
    return {
      items: rows.slice(start, start + 12),
      nextCursor: start + 12 < rows.length ? String(start + 12) : null,
    };
  });
  /** Строим исходную подтверждённую цепочку и очищаем счётчик подготовительных reads. */
  const chain = async (pages = 4) => {
    let result = await refreshCursorChain<Page>(
      undefined,
      read,
      new Set(),
      "background",
    );
    for (let i = 1; i < pages; i++) {
      const cursor = result.pages.at(-1)!.nextCursor!;
      result = appendCursorPage(result, cursor, await read(cursor));
    }
    read.mockClear();
    return result;
  };
  return {
    read,
    chain,
    update: (fn: (items: Page["items"]) => Page["items"]) => {
      rows = fn(rows);
    },
  };
}

/** Сверяем объём перезагрузки, связность границ и поведение при вставках/удалениях. */
describe("post page refresh", () => {
  /** Фоновое обновление читает head и видимую дальнюю страницу, сохраняя невидимые ссылки cache. */
  it("refreshes only the head and visible later pages when boundaries are stable", async () => {
    const f = fixture(),
      before = await f.chain(6);
    f.update((rows) => rows.map((row) => ({ ...row, text: "updated" })));
    const after = await refreshCursorChain(
      before,
      f.read,
      new Set([37, 38]),
      "background",
    );
    expect(f.read.mock.calls.map(([cursor]) => cursor)).toEqual([null, "36"]);
    expect(after.pages[3].items[0].text).toBe("updated");
    expect(after.pages[1]).toBe(before.pages[1]);
  });
  /** Изменённая граница требует перестроить удерживаемый хвост, а не только убрать дубли. */
  it("rebuilds the retained chain after insertion and deletion without duplicates or gaps", async () => {
    const f = fixture(),
      before = await f.chain();
    f.update((rows) => [
      { id: 999, text: "new" },
      ...rows.filter((row) => row.id !== 15),
    ]);
    const after = await refreshCursorChain(
      before,
      f.read,
      new Set([16]),
      "background",
    );
    expect(f.read.mock.calls.map(([cursor]) => cursor)).toEqual([
      null,
      "12",
      "24",
      "36",
    ]);
    expect(
      after.pages.flatMap((page) => page.items.map((row) => row.id)),
    ).toEqual([
      999,
      ...Array.from({ length: 48 }, (_, i) => i + 1).filter((id) => id !== 15),
    ]);
  });
  /** Удалённая средняя страница сокращает цепочку без повторного чтения одного cursor. */
  it("detects deletion beyond the head and truncates an exhausted tail", async () => {
    const f = fixture(30),
      before = await f.chain(3);
    f.update((rows) => rows.filter((row) => row.id <= 12 || row.id > 24));
    const after = await refreshCursorChain(
      before,
      f.read,
      new Set([16]),
      "background",
    );
    expect(after.pages).toHaveLength(2);
    expect(after.pages[1].items.map((row) => row.id)).toEqual([
      25, 26, 27, 28, 29, 30,
    ]);
    expect(new Set(f.read.mock.calls.map(([cursor]) => cursor)).size).toBe(
      f.read.mock.calls.length,
    );
  });
  /** Пользовательский all обновляет весь retained window; restart начинает с одной страницы. */
  it("explicit refresh updates all retained pages; restart reads just the head", async () => {
    const f = fixture(),
      before = await f.chain();
    f.update((rows) => rows.map((row) => ({ ...row, text: "edited" })));
    const after = await refreshCursorChain(before, f.read, new Set([1]), "all");
    expect(f.read).toHaveBeenCalledTimes(4);
    expect(
      after.pages.flatMap((p) => p.items).every((row) => row.text === "edited"),
    ).toBe(true);
    f.read.mockClear();
    expect(
      (await refreshCursorChain(after, f.read, new Set(), "restart")).pages,
    ).toHaveLength(1);
    expect(f.read).toHaveBeenCalledTimes(1);
  });
  /** Неполученный хвост не заменяет старый cache частично свежими данными. */
  it("keeps the old confirmed chain intact when a later read fails", async () => {
    const f = fixture(),
      before = await f.chain(),
      copy = structuredClone(before);
    f.read
      .mockImplementationOnce(async () => ({
        items: [{ id: 999, text: "new" }],
        nextCursor: "12",
      }))
      .mockRejectedValueOnce(new Error("offline"));
    await expect(
      refreshCursorChain(before, f.read, new Set(), "all"),
    ).rejects.toThrow("offline");
    expect(before).toEqual(copy);
  });
  /** Сохраняем восьмистраничное окно и необходимые opaque границы без старых payload. */
  it("bounds forward and backward windows and refreshes a deep window without reading the discarded archive", async () => {
    const f = fixture(240);
    let chain = boundCursorChain(await f.chain(10), 8, "next");
    expect(chain.pages).toHaveLength(8);
    expect(chain.pageParams[0]).toBe("24");
    f.update((rows) => [{ id: 999, text: "new" }, ...rows]);
    chain = await refreshCursorChain(
      chain,
      f.read,
      new Set([70]),
      "background",
    );
    expect(f.read.mock.calls.map(([cursor]) => cursor)).toEqual([
      null,
      "24",
      "36",
      "48",
      "60",
      "72",
      "84",
      "96",
      "108",
    ]);
    const previous = await f.read("12");
    const prepended: CursorChain<Page> = {
      ...chain,
      pages: [previous, ...chain.pages],
      pageParams: ["12", ...chain.pageParams],
    };
    chain = boundCursorChain(prepended, 8, "previous");
    expect(chain.pageParams).toEqual([
      "12",
      "24",
      "36",
      "48",
      "60",
      "72",
      "84",
      "96",
    ]);
    expect(chain.pages.at(-1)!.nextCursor).toBe("108");
  });
  /** Непродвигающийся reader не зацикливает refresh. */
  it("rejects looping cursors during refresh as well as pagination", async () => {
    const f = fixture(),
      before = await f.chain();
    f.read.mockImplementation(async (cursor) => ({
      items: [{ id: 1, text: "bad" }],
      nextCursor: cursor ?? "12",
    }));
    await expect(
      refreshCursorChain(before, f.read, new Set(), "all"),
    ).rejects.toThrow("Курсор");
  });
});
