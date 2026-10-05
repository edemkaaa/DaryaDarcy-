import {
  formatInspirationList,
  stripInspirationDescription,
} from "@/domain/post/inspiration-titles";

describe("stripInspirationDescription", () => {
  it("removes trailing description after em dash", () => {
    expect(
      stripInspirationDescription(
        "«Мисс Поттер» (2006) — история Беатрис Поттер, её рисунки и жизнь в Lake District",
      ),
    ).toBe("«Мисс Поттер» (2006)");
  });

  it("keeps dashes inside the title", () => {
    expect(
      stripInspirationDescription(
        "«О всех созданиях — больших и малых» (All Creatures Great and Small) — Йоркшир, ветеринар, деревенская жизнь 1930-х",
      ),
    ).toBe("«О всех созданиях — больших и малых» (All Creatures Great and Small)");
  });

  it("returns entries without a separator unchanged", () => {
    expect(stripInspirationDescription("Первый рыцарь")).toBe("Первый рыцарь");
    expect(
      stripInspirationDescription("«Туманы Авалона» Мэрион Циммер Брэдли"),
    ).toBe("«Туманы Авалона» Мэрион Циммер Брэдли");
  });

  it("formats comma-separated title lists", () => {
    expect(
      formatInspirationList([
        "Country Living (UK) — интерьеры, сады, рецепты",
        "Victoria Magazine — романтика, цветы",
      ]),
    ).toBe("Country Living (UK), Victoria Magazine");
  });
});
