/** Черновик профиля хранит исходную ревизию и принадлежность аккаунту, не выдавая старый ввод за новую серверную версию. */
import { describe, expect, it } from "vitest";
import {
  restoreProfileDraft,
  type ProfileDraft,
} from "../apps/frontend/src/domain/profile/profile-draft";

const fresh = {
  revision: 8,
  name: "New server name",
  gender: "female" as const,
};
const defaults = { name: fresh.name, gender: fresh.gender };
const old: ProfileDraft = {
  version: 1,
  ownerId: 101,
  base: { revision: 2, name: "Original name", gender: "male" },
  values: { name: "Unsent input" },
  needsReview: false,
};

/** Проверяем совместимость старых форматов и сохранение нерешённого сравнения после reload. */
describe("profile draft baselines", () => {
  /** Свежий профиль не заменяет base, с которым пользователь начал редактирование. */
  it("restores the original snapshot rather than the latest server revision", () => {
    expect(
      restoreProfileDraft(JSON.stringify(old), 101, fresh, defaults, true),
    ).toEqual(old);
  });
  /** Прежняя строка имени сохраняется буквально, даже если похожа на JSON; базовая ревизия неизвестна. */
  it.each(["Old name", "123", "null", "true", '"Quoted name"', "[]"])(
    "keeps legacy literal name %s while requiring review",
    (name) => {
      expect(
        restoreProfileDraft(name, 101, fresh, defaults, true),
      ).toMatchObject({
        values: { name },
        base: { revision: null },
        needsReview: true,
      });
    },
  );
  /** Повторный вход не стирает already-pending review при появлении следующей серверной версии. */
  it("preserves an unresolved comparison across reload", () => {
    const awaiting = { ...old, needsReview: true, review: fresh };
    expect(
      restoreProfileDraft(
        JSON.stringify(awaiting),
        101,
        { ...fresh, revision: 9 },
        defaults,
        false,
      ),
    ).toEqual(awaiting);
  });
  /** Старая пара имя/пол требует явной сверки, а не автоматического присвоения текущей ревизии. */
  it("migrates legacy setup without assigning it a server version", () => {
    expect(
      restoreProfileDraft(
        JSON.stringify({ name: "Old setup", gender: "male" }),
        101,
        fresh,
        defaults,
        false,
      ),
    ).toMatchObject({
      values: { name: "Old setup", gender: "male" },
      base: { revision: null },
      needsReview: true,
    });
  });
  /** Черновик другого ownerId не применяется к текущему профилю. */
  it("rejects another owner's draft", () => {
    expect(() =>
      restoreProfileDraft(JSON.stringify(old), 202, fresh, defaults, true),
    ).toThrow("другому аккаунту");
  });
  /** Неизвестную версию структуры не интерпретируем как допустимый patch. */
  it("leaves unsupported structured drafts out of writes", () => {
    expect(() =>
      restoreProfileDraft(
        JSON.stringify({ ...old, version: 2 }),
        101,
        fresh,
        defaults,
        true,
      ),
    ).toThrow("не поддерживается");
  });
});
