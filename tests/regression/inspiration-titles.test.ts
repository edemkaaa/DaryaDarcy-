/** Проверяем очистку описаний вдохновения без повреждения самих названий. */
import {
  formatInspirationList,
  stripInspirationDescription,
} from "@/domain/post/inspiration-titles";

/** Отделяем название от пояснения, сохраняя значимые тире внутри кавычек. */
describe("stripInspirationDescription", () => {
  /** Удаляем пояснение после закрытого названия и года, не затрагивая карточку фильма. */
  it("removes trailing description after em dash", () => {
    expect(
      stripInspirationDescription(
        "«Мисс Поттер» (2006) — история Беатрис Поттер, её рисунки и жизнь в Lake District",
      ),
    ).toBe("«Мисс Поттер» (2006)");
  });

  /** Тире внутри названия не считается границей описания. */
  it("keeps dashes inside the title", () => {
    expect(
      stripInspirationDescription(
        "«О всех созданиях — больших и малых» (All Creatures Great and Small) — Йоркшир, ветеринар, деревенская жизнь 1930-х",
      ),
    ).toBe("«О всех созданиях — больших и малых» (All Creatures Great and Small)");
  });

  /** Отсутствие разделителя не должно менять текст или терять автора книги. */
  it("returns entries without a separator unchanged", () => {
    expect(stripInspirationDescription("Первый рыцарь")).toBe("Первый рыцарь");
    expect(
      stripInspirationDescription("«Туманы Авалона» Мэрион Циммер Брэдли"),
    ).toBe("«Туманы Авалона» Мэрион Циммер Брэдли");
  });

  /** Для общего списка очищаем каждый элемент отдельно и соединяем только названия. */
  it("formats comma-separated title lists", () => {
    expect(
      formatInspirationList([
        "Country Living (UK) — интерьеры, сады, рецепты",
        "Victoria Magazine — романтика, цветы",
      ]),
    ).toBe("Country Living (UK), Victoria Magazine");
  });
});
