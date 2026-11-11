"use client";
/** Настройки сезонов сохраняются с ожидаемой ревизией; после неизвестного PUT сначала сравниваем актуальный серверный вариант. */
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  LaunchConfiguration,
  LaunchConfigurationSnapshot,
  Season,
  SeasonAppearance,
} from "@shared/launch-settings";
import { apiCall } from "@/shared/api/auth";
import {
  getHttpStatus,
  getRequestErrorMessage,
  invalidResponse,
} from "@/shared/api/errors";
import { useAuth } from "@/domain/session/session-context";
import {
  checkOperationAccessError,
  useSessionOperation,
} from "@/domain/session/use-session-operation";
import {
  SEASONS,
  SEASON_NAMES,
  parseLaunchSnapshot,
  sameLaunchConfiguration,
  validAnnualDate,
  validSeasonUrl,
  isSeasonSharingPage,
} from "@/domain/launch/settings";
import { CLUB_APPEARANCE_KEY } from "@/domain/launch/use-club-appearance";
import { Action, Field, ScrollArea, Typography } from "@/shared/ui/elements";
import { QueryRetryState } from "@/shared/ui/query-retry-state";
import { StatusNotice } from "@/shared/ui/status-notice";
import classes from "./admin-screen.module.scss";

const readSettings = async (signal: AbortSignal) =>
  /* Проверяет форму серверного снимка и ревизию до использования в редакторе сезонов. */ parseLaunchSnapshot(
    await apiCall<unknown>("/api/admin/launch-settings", { signal }),
  );
function validationMessage(config: LaunchConfiguration): string | null {
  // Проверяет уникальные ежегодные даты и прямые HTTPS-изображения, отличая страницу Яндекс Диска от файла.

  if (
    SEASONS.some(
      (key) =>
        isSeasonSharingPage(config.seasons[key].backgroundUrl) ||
        isSeasonSharingPage(config.seasons[key].bannerUrl),
    )
  )
    return "Укажите прямую ссылку на изображение, а не страницу Яндекс Диска";
  if (SEASONS.some((key) => !validAnnualDate(config.seasons[key].startsOn)))
    return "Укажите даты начала в формате ММ-ДД. 29 февраля не поддерживается.";
  if (new Set(SEASONS.map((key) => config.seasons[key].startsOn)).size !== 4)
    return "Даты начала четырёх сезонов должны отличаться.";
  if (
    SEASONS.some(
      (key) =>
        !validSeasonUrl(config.seasons[key].backgroundUrl) ||
        !validSeasonUrl(config.seasons[key].bannerUrl),
    )
  )
    return "Для изображений нужны HTTPS-ссылки без логина и пароля либо пустые поля.";
  return null;
}
function SeasonEditor({
  snapshot,
  ownerId,
}: {
  snapshot: LaunchConfigurationSnapshot;
  ownerId: number;
}) {
  // Редактирует локальную копию сезонной конфигурации; неопределённый PUT и конфликт блокируют новую запись до сверки.

  const cache = useQueryClient();
  const [base, setBase] = useState(snapshot);
  const [draft, setDraft] = useState(() => structuredClone(snapshot.config));
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [unknown, setUnknown] = useState(false);
  const unknownRef = useRef(false);
  const [conflict, setConflict] = useState<LaunchConfigurationSnapshot | null>(
    null,
  );
  const operation = useSessionOperation();
  const blocked = operation.busy || unknown;
  const dirty = !sameLaunchConfigurationSafe(draft, base.config);
  const rememberUnknown = (value: boolean) => {
    // Обновляет ref и UI синхронно, не позволяя второму нажатию обогнать React-рендер.

    unknownRef.current = value;
    setUnknown(value);
  };
  const confirmed = (next: LaunchConfigurationSnapshot, message: string) => {
    // Принимает подтверждённую конфигурацию как базу и инвалидирует оформление Клуба для последующего чтения.

    setBase(next);
    setDraft(structuredClone(next.config));
    setConflict(null);
    rememberUnknown(false);
    setError(null);
    setNotice(message);
    cache.setQueryData(["launch-settings", ownerId], next);
    void cache.invalidateQueries({ queryKey: CLUB_APPEARANCE_KEY });
  };
  // Отправляем снимок с базовой ревизией; неизвестный ответ блокирует новую запись до явной проверки.
  const save = async () => {
    // Отправляет снимок с expectedRevision и проверяет ответ на точное следующее поколение и те же настройки.

    if (unknownRef.current) return;
    const invalid = validationMessage(draft);
    if (invalid) {
      setError(invalid);
      return;
    }
    if (base.revision >= 2147483647) {
      setError(
        "Нельзя сохранить настройки с этой ревизией. Обратитесь к разработчику.",
      );
      return;
    }
    const task = operation.begin("save");
    if (!task) return;
    setError(null);
    setNotice(null);
    rememberUnknown(true);
    const payload = structuredClone(draft);
    try {
      const result = parseLaunchSnapshot(
        await apiCall<unknown>("/api/admin/launch-settings", {
          method: "PUT",
          signal: task.signal,
          body: JSON.stringify({
            expectedRevision: base.revision,
            config: payload,
          }),
        }),
      );
      task.assertCurrent();
      if (
        result.revision !== base.revision + 1 ||
        !sameLaunchConfiguration(result.config, payload)
      )
        throw invalidResponse();
      confirmed(result, "Настройки сезонов сохранены.");
    } catch (cause) {
      checkOperationAccessError(cause);
      if (!task.isCurrent()) return;
      const status = getHttpStatus(cause);
      if (status === 409)
        setError(
          "Настройки уже изменились. Проверьте актуальную версию; ваш ввод сохранён.",
        );
      else if (!status || status >= 500)
        setError(
          "Сохранение не подтверждено. Проверьте настройки перед новой попыткой; ваш ввод сохранён.",
        );
      else {
        rememberUnknown(false);
        setError(getRequestErrorMessage(cause));
      }
    } finally {
      task.finish();
    }
  };
  // Читающая сверка различает нашу подтверждённую запись и чужую версию, сохраняя введённое оформление.
  const inspect = async () => {
    // Читает сервер, различая нашу запись, неизменённую базу и чужую новую версию; введённое оформление не затирается молча.

    const task = operation.begin("read");
    if (!task) return;
    setNotice(null);
    try {
      const next = await readSettings(task.signal);
      task.assertCurrent();
      if (
        next.revision < base.revision ||
        (next.revision === base.revision &&
          !sameLaunchConfiguration(next.config, base.config))
      )
        throw invalidResponse();
      if (sameLaunchConfigurationSafe(next.config, draft))
        confirmed(next, "Актуальные настройки совпадают с вашим вариантом.");
      else if (next.revision === base.revision) {
        rememberUnknown(false);
        setConflict(null);
        setError(null);
        setNotice(
          "Настройки проверены. Ваш ввод сохранён; можно сохранить его отдельно.",
        );
      } else if (!dirty && !unknownRef.current)
        confirmed(next, "Актуальные настройки загружены.");
      else {
        setConflict(next);
        rememberUnknown(true);
        setError(
          "На сервере другая версия. Ваш ввод сохранён. Загрузите актуальные настройки перед дальнейшим редактированием.",
        );
      }
    } catch (cause) {
      checkOperationAccessError(cause);
      if (task.isCurrent()) setError(getRequestErrorMessage(cause));
    } finally {
      task.finish();
    }
  };
  const changeAppearance = (
    key: Season,
    field: keyof SeasonAppearance,
    value: string,
  ) => {
    // Меняет одно поле сезона в локальной копии; пустой URL означает встроенное оформление.

    setDraft((previous) => ({
      ...previous,
      seasons: {
        ...previous.seasons,
        [key]: {
          ...previous.seasons[key],
          [field]: field === "startsOn" ? value.trim() : value.trim() || null,
        },
      },
    }));
    setNotice(null);
  };
  return (
    <ScrollArea
      className={classes.formScroll}
      contentClassName={classes.formContent}
    >
      <form
        className="ui-stack"
        style={{ gap: 16 }}
        aria-label="Настройки сезонов"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <Typography className={classes.formLabel}>Оформление Клуба</Typography>
        <Typography className={classes.formHint}>
          Даты и режим общие для всех участниц. Часовой пояс — Москва. Пустые
          ссылки используют готовое оформление: осеннее для осени, зимнее для
          остальных сезонов.
        </Typography>
        {error ? <StatusNotice tone="error">{error}</StatusNotice> : null}
        {notice ? <StatusNotice tone="success">{notice}</StatusNotice> : null}
        {operation.busy ? (
          <StatusNotice>
            {operation.kind === "save"
              ? "Сохраняем настройки…"
              : "Проверяем настройки…"}
          </StatusNotice>
        ) : null}
        <div
          className="ui-stack"
          style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}
        >
          <Action
            type="submit"
            disabled={blocked || !dirty}
            className={classes.newPostBtn}
          >
            <Typography className={classes.submitBtnText}>
              Сохранить сезоны
            </Typography>
          </Action>
          <Action
            disabled={operation.busy}
            onClick={() => void inspect()}
            className={classes.newPostBtn}
          >
            <Typography className={classes.submitBtnText}>
              Проверить настройки
            </Typography>
          </Action>
          {conflict ? (
            <Action
              disabled={operation.busy}
              className={classes.newPostBtn}
              onClick={() => {
                if (
                  window.confirm(
                    "Заменить ваш ввод актуальными настройками сервера? Несохранённые изменения будут потеряны.",
                  )
                )
                  confirmed(conflict, "Актуальные настройки загружены.");
              }}
            >
              <Typography className={classes.submitBtnText}>
                Загрузить актуальные настройки
              </Typography>
            </Action>
          ) : null}
        </div>
        <label className={`ui-stack ${classes.formGroup}`}>
          <Typography className={classes.formLabel}>
            Режим смены сезонов
          </Typography>
          <select
            disabled={blocked}
            className={classes.sortInput}
            style={{ width: "100%", minWidth: 0 }}
            value={draft.seasonMode}
            onChange={(event) => {
              setDraft((previous) => ({
                ...previous,
                seasonMode: event.target.value as "fixed" | "calendar",
              }));
              setNotice(null);
            }}
          >
            <option value="fixed">Фиксированный сезон</option>
            <option value="calendar">По датам</option>
          </select>
        </label>
        <label className={`ui-stack ${classes.formGroup}`}>
          <Typography className={classes.formLabel}>
            Фиксированный сезон
          </Typography>
          <select
            disabled={blocked || draft.seasonMode !== "fixed"}
            className={classes.sortInput}
            style={{ width: "100%", minWidth: 0 }}
            value={draft.fixedSeason}
            onChange={(event) => {
              setDraft((previous) => ({
                ...previous,
                fixedSeason: event.target.value as Season,
              }));
              setNotice(null);
            }}
          >
            {SEASONS.map((key) => (
              <option key={key} value={key}>
                {SEASON_NAMES[key]}
              </option>
            ))}
          </select>
        </label>
        {SEASONS.map((key) => (
          <section
            key={key}
            className={`ui-stack ${classes.formGroup}`}
            aria-label={SEASON_NAMES[key]}
          >
            <Typography className={classes.formLabel}>
              {SEASON_NAMES[key]}
            </Typography>
            <label className="ui-stack">
              <Typography className={classes.formHint}>
                Начало, ММ-ДД
              </Typography>
              <Field
                aria-label={`${SEASON_NAMES[key]}: дата начала`}
                disabled={blocked}
                value={draft.seasons[key].startsOn}
                maxLength={5}
                placeholder="ММ-ДД"
                className={classes.sortInput}
                style={{ width: "100%", minWidth: 0 }}
                onValueChange={(value) =>
                  changeAppearance(key, "startsOn", value)
                }
              />
            </label>
            {(["backgroundUrl", "bannerUrl"] as const).map((field) => (
              <label key={field} className="ui-stack">
                <Typography className={classes.formHint}>
                  {field === "backgroundUrl" ? "Фон" : "Баннер"}, прямая
                  HTTPS-ссылка на изображение
                </Typography>
                <Field
                  aria-label={`${SEASON_NAMES[key]}: ${field === "backgroundUrl" ? "фон" : "баннер"}`}
                  disabled={blocked}
                  value={draft.seasons[key][field] ?? ""}
                  maxLength={2048}
                  placeholder="Прямая ссылка на картинку или пустое поле"
                  className={classes.sortInput}
                  style={{ width: "100%", minWidth: 0 }}
                  onValueChange={(value) => changeAppearance(key, field, value)}
                />
              </label>
            ))}
          </section>
        ))}
      </form>
    </ScrollArea>
  );
}
// In-progress dates/URLs can be incomplete; validation belongs to explicit save.
function sameLaunchConfigurationSafe(
  a: LaunchConfiguration,
  b: LaunchConfiguration,
): boolean {
  // Неполные поля во время ввода считаются отличием, а строгая проверка остаётся у явного сохранения.

  try {
    return sameLaunchConfiguration(a, b);
  } catch {
    return false;
  }
}
export function SeasonSettings() {
  // Изолирует запрос конфигурации по аккаунту и перемонтирует редактор при смене владельца.

  const { isOwner, user } = useAuth();
  const query = useQuery({
    queryKey: ["launch-settings", user?.id],
    queryFn: ({ signal }) => /* Читает снимок с сигналом query, не отправляя изменений при открытии вкладки. */ readSettings(signal),
    enabled: isOwner,
    retry: false,
  });
  if (!isOwner || !user) return null;
  return (
    <QueryRetryState
      isLoading={query.isLoading}
      isError={query.isError}
      hasData={Boolean(query.data)}
      onRetry={() => void query.refetch()}
      message="Не удалось загрузить настройки сезонов"
    >
      {query.data ? (
        <SeasonEditor key={user.id} snapshot={query.data} ownerId={user.id} />
      ) : null}
    </QueryRetryState>
  );
}
