"use client";
/** Персональные ключи изолируем по подтверждённому владельцу; часть операций требует записи с явной ошибкой вместо тихого fallback. */
const personalKeys = new Set([
  "@darcy_club_profile_name",
  "@darcy_club_profile_gender",
  "@darcy_club_profile_avatar",
  "@darcy_club_profile_completed",
  "@darcy_club_profile_draft",
  "@darcy_profile_name_draft",
  "@darcy_club_profile_pending",
  "@darcy_profile_name_pending",
  "@darcy_saved_feed",
  "@darcy_saved_club",
  "@darcy_quiz_result",
  "@darcy_quiz_progress",
  "@darcy_last_seen_feed_id",
  "@darcy_last_seen_club_id",
]);
let personalDataOwner: number | null = null;
/** Именное пространство добавляется только известным персональным ключам; глобальные UI-предпочтения сохраняют прежние имена. */
const scopedKey = (key: string, owner = personalDataOwner) =>
  personalKeys.has(key) ? `darcy:user:${owner ?? "guest"}:${key}` : key;

/** Асинхронный результат проверяет этого владельца до применения, включая отдельное гостевое пространство null. */
export function isPersonalDataOwner(userId: number | null): boolean {
  return personalDataOwner === userId;
}

/** Required drafts must report storage failures rather than pretend to persist. */
// Для черновиков тихий отказ недопустим: вызывающий код должен сохранить ввод и показать проблему записи.
export const requiredStorage = {
  getItem: (key: string) => window.localStorage.getItem(scopedKey(key)),
  setItem: (key: string, value: string) =>
    window.localStorage.setItem(scopedKey(key), value),
  removeItem: (key: string) => window.localStorage.removeItem(scopedKey(key)),
};

/** Удаляем непривязанные legacy-данные и старые scoped-ключи при смене владельца, чтобы следующий вход не наследовал персональный ввод. */
export function setPersonalDataOwner(owner: number | null): void {
  for (const key of personalKeys) {
    try {
      window.localStorage.removeItem(key);
      if (owner !== personalDataOwner)
        window.localStorage.removeItem(scopedKey(key));
    } catch {
      /* Browser storage is optional. */
    }
  }
  personalDataOwner = owner;
}

const storage = {
  /** Optional reader трактует запрет хранилища как отсутствие значения; обязательные черновики используют requiredStorage. */
  async getItem(key: string) {
    try {
      return window.localStorage.getItem(scopedKey(key));
    } catch {
      return null;
    }
  },
  /** Optional запись предпочтения не останавливает навигацию при quota/privacy отказе браузера. */
  async setItem(key: string, value: string) {
    try {
      window.localStorage.setItem(scopedKey(key), value);
    } catch {
      // Optional UI preferences must not prevent navigation or sign-in.
    }
  },
  /** Удаляем scoped optional значение по возможности; результат не служит доказательством серверного удаления данных. */
  async removeItem(key: string) {
    try {
      window.localStorage.removeItem(scopedKey(key));
    } catch {}
  },
  /** Пакетная совместимая очистка пользуется тем же scoped optional методом для каждого переданного ключа. */
  async multiRemove(keys: readonly string[]) {
    await Promise.all(keys.map((k) => storage.removeItem(k)));
  },
};
export default storage;
