/** Прокрутка гида проверяется на синтетической геометрии контейнера и секций. */
import { expect, it } from "vitest";
import { scrollToGuideSection } from "../apps/frontend/src/features/library/guide-navigation";

/** После изменения высоты предыдущих картинок координата пересчитывается из текущих rect/scrollTop, а не берётся из кэша. */
it("recomputes the section position after earlier images expand and after scrolling", () => {
  let sectionTop = 500;
  let top: number | undefined;
  const container = {
    scrollTop: 200,
    clientTop: 2,
    getBoundingClientRect: () => ({ top: 40 }),
    scrollTo: (options: ScrollToOptions) => {
      top = options.top;
    },
  } as HTMLDivElement;
  const section = {
    getBoundingClientRect: () => ({ top: sectionTop }),
  } as HTMLDivElement;
  scrollToGuideSection(container, section);
  expect(top).toBe(638);
  sectionTop = 1700;
  container.scrollTop = 400;
  scrollToGuideSection(container, section);
  expect(top).toBe(2038);
});

/** Отступ заголовка не должен увести прокрутку выше нуля. */
it("keeps the first section within the scroll container", () => {
  let top: number | undefined;
  const container = {
    scrollTop: 0,
    clientTop: 0,
    getBoundingClientRect: () => ({ top: 50 }),
    scrollTo: (options: ScrollToOptions) => {
      top = options.top;
    },
  } as HTMLDivElement;
  const section = {
    getBoundingClientRect: () => ({ top: 55 }),
  } as HTMLDivElement;
  scrollToGuideSection(container, section);
  expect(top).toBe(0);
});
