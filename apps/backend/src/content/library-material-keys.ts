/** Разрешённые идентификаторы материалов Библиотеки; произвольный путь не становится ключом материала. */
/** Club-only visual namespaces; free quiz houses and the horse PDF are excluded. */
export const aestheticMaterialKeys = [
  "aesthetic-castlecore",
  "aesthetic-cottagecore",
  "aesthetic-darkacademia",
  "aesthetic-fairycore",
  "aesthetic-goblincore",
  "aesthetic-lightacademia",
  "aesthetic-witchcore",
] as const;

export const libraryMaterialKeys = [
  "recipes",
  "peterburg",
  "patterns",
  ...aestheticMaterialKeys,
] as const;
