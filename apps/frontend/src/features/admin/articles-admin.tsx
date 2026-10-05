"use client";
import classes from "./articles-admin.module.scss";
import {
  ScrollArea,
  Typography,
  Action,
  Background,
  Field,
  Spinner,
} from "@/shared/ui/elements";
import { useRef, useState } from "react";
import { Picture } from "@/shared/media/image";
import { MaterialIcons } from "@/shared/ui/icons";
import { QueryRetryState } from "@/shared/ui/query-retry-state";
import { trpc } from "@/shared/api/trpc";
import { ArticleContent } from "@/domain/content/article-content";
import {
  useSessionOperation,
  checkOperationAccessError,
} from "@/domain/session/use-session-operation";
import { requireUploadedUrl } from "@/shared/media/upload-result";
import { getHttpStatus } from "@/shared/api/errors";
import { fileToUpload, pickWebFiles } from "@/shared/media/image-upload";
import {
  emptyBlock,
  normalizeArticleBlocks,
  type ArticleBlock,
} from "@/domain/content/article-blocks";
import {
  BROWN,
  BROWN_LIGHT,
  CREAM,
  ACCENT,
  ADD_BLOCKS,
  BLOCK_LABELS,
} from "./articles-admin.content";
type Access = "public" | "club";
export function ArticlesAdmin() {
  const utils = trpc.useUtils();
  const list = trpc.admin.articles.useQuery();
  const remove = trpc.admin.deleteArticle.useMutation({
    onSuccess: () => {
      void utils.admin.articles.invalidate();
      void utils.articles.list.invalidate();
      void utils.club.list.invalidate();
    },
    onError: (err) => notify(err.message),
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [access, setAccess] = useState<Access>("club");
  const [previewing, setPreviewing] = useState(false);
  const [blocks, setBlocks] = useState<ArticleBlock[]>([emptyBlock("text")]);
  const operation = useSessionOperation(showForm, editingId);
  const uploading = operation.kind === "photos";
  const [published, setPublished] = useState(true);
  const uncertainSave = useRef(false);
  const notify = (message: string) => {
    window.alert(message);
  };
  const reset = () => {
    operation.cancel();
    uncertainSave.current = false;
    setPublished(true);
    setEditingId(null);
    setShowForm(false);
    setTitle("");
    setCoverUrl("");
    setAccess("club");
    setPreviewing(false);
    setBlocks([emptyBlock("text")]);
  };
  const pickImages = async (
    preserveAlpha: boolean,
    multiple: boolean,
    commit: (urls: string[]) => void,
  ) => {
    const task = operation.begin("photos");
    if (!task) return;
    const urls: string[] = [];
    try {
      const files = await pickWebFiles(
        preserveAlpha ? "image/png,image/webp" : "image/*",
        multiple,
        { signal: task.signal },
      );
      for (const file of files) {
        const payload = await fileToUpload(file, {
          preserveAlpha,
          signal: task.signal,
        });
        task.assertCurrent();
        const url = requireUploadedUrl(
          await utils.client.admin.uploadPhoto.mutate(payload, {
            signal: task.signal,
          }),
        );
        task.assertCurrent();
        urls.push(url);
      }
    } catch (error) {
      checkOperationAccessError(error);
      if (task.isCurrent())
        notify(
          error instanceof Error ? error.message : "Не удалось загрузить файл",
        );
    } finally {
      if (task.isCurrent() && urls.length) commit(urls);
      task.finish();
    }
  };
  const insertBlock = (index: number, type: ArticleBlock["type"]) => {
    setBlocks((prev) => {
      const next = [...prev];
      next.splice(index + 1, 0, emptyBlock(type));
      return next;
    });
  };
  const updateBlock = (index: number, patch: Partial<ArticleBlock>) => {
    setBlocks((prev) =>
      prev.map((block, i) => (i === index ? { ...block, ...patch } : block)),
    );
  };
  const moveBlock = (index: number, direction: -1 | 1) => {
    setBlocks((prev) => {
      const to = index + direction;
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });
  };
  const save = async () => {
    if (!title.trim()) {
      notify("Напишите название статьи");
      return;
    }
    if (uncertainSave.current) {
      notify(
        "Результат сохранения не подтверждён. Проверьте статью в списке перед новой попыткой.",
      );
      return;
    }
    const task = operation.begin("save");
    if (!task) return;
    try {
      const payload = {
        title: title.trim(),
        coverUrl: coverUrl || null,
        access,
        published,
        sections: blocks,
      };
      const result = editingId
        ? await utils.client.admin.updateArticle.mutate(
            { id: editingId, ...payload },
            { signal: task.signal },
          )
        : await utils.client.admin.createArticle.mutate(payload, {
            signal: task.signal,
          });
      if (
        editingId
          ? !result || typeof result !== "object" || result.ok !== true
          : typeof result !== "number" ||
            !Number.isSafeInteger(result) ||
            result <= 0
      )
        throw new Error("Сервер не подтвердил сохранение статьи");
      task.assertCurrent();
      void utils.admin.articles.invalidate();
      void utils.articles.list.invalidate();
      void utils.club.list.invalidate();
      reset();
    } catch (error) {
      checkOperationAccessError(error);
      const status = getHttpStatus(error);
      if (task.isCurrent()) uncertainSave.current = !status || status >= 500;
      if (task.isCurrent())
        notify(
          uncertainSave.current
            ? "Результат сохранения не подтверждён. Проверьте статью в списке перед новой попыткой."
            : error instanceof Error
              ? error.message
              : "Не удалось сохранить статью",
        );
    } finally {
      task.finish();
    }
  };
  const startEdit = (item: {
    id: number;
    title: string;
    coverUrl: string | null;
    access: Access;
    published: boolean;
    sections: unknown;
  }) => {
    operation.cancel();
    uncertainSave.current = false;
    setPublished(item.published);
    setEditingId(item.id);
    setTitle(item.title);
    setCoverUrl(item.coverUrl || "");
    setAccess(item.access);
    setPreviewing(false);
    setBlocks(normalizeArticleBlocks(item.sections));
    setShowForm(true);
  };
  const confirmDelete = (id: number) => {
    const run = () => remove.mutate({ id });
    {
      if (window.confirm("Удалить статью?")) run();
      return;
    }
  };
  if (showForm) {
    const busy = operation.busy;
    return (
      <ScrollArea contentClassName={classes.form}>
        <div inert={operation.busy} style={{ display: "contents" }}>
          <Typography className={classes.formTitle}>
            {editingId ? "Редактировать статью" : "Новая статья"}
          </Typography>
          <Action
            onClick={() => setPublished((value) => !value)}
            className={classes.btnGhost}
          >
            <Typography className={classes.btnGhostText}>
              {published ? "Статус: опубликована" : "Статус: черновик"}
            </Typography>
          </Action>
          <Typography className={classes.label}>Куда уйдёт статья</Typography>
          <div className={["ui-stack ", classes.row].filter(Boolean).join(" ")}>
            <Action
              onClick={() => {
                setAccess("club");
                setPreviewing(false);
              }}
              className={[
                classes.chipOn,
                access === "club" && !previewing
                  ? classes.backgroundColorState
                  : classes.backgroundColorState2,
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <Typography
                className={[
                  classes.chipTextOn,
                  access === "club" && !previewing
                    ? classes.colorState
                    : classes.colorState2,
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                Клуб / эксклюзив
              </Typography>
            </Action>
            <Action
              onClick={() => {
                setAccess("public");
                setPreviewing(false);
              }}
              className={[
                classes.chipOn,
                access === "public" && !previewing
                  ? classes.backgroundColorState3
                  : classes.backgroundColorState4,
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <MaterialIcons
                name="lock"
                size={13}
                color={access === "public" && !previewing ? CREAM : BROWN}
              />
              <Typography
                className={[
                  classes.chipTextOn,
                  access === "public" && !previewing
                    ? classes.colorState3
                    : classes.colorState4,
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                Клуб + библиотека
              </Typography>
            </Action>
            <Action
              onClick={() => setPreviewing(true)}
              className={[
                classes.chipOn,
                previewing
                  ? classes.backgroundColorState5
                  : classes.backgroundColorState6,
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <Typography
                className={[
                  classes.chipTextOn,
                  previewing ? classes.colorState5 : classes.colorState6,
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                Предпросмотр
              </Typography>
            </Action>
          </div>
          <Typography className={classes.hint}>
            {access === "public"
              ? "Появится в Эксклюзиве клуба и в библиотеке с замочком — только по подписке. В общую ленту статьи не попадают."
              : "Только во вкладке Эксклюзив клуба, без библиотеки и без общей ленты."}
          </Typography>

          {previewing ? (
            <Background
              source={{
                uri: "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/d0db18ed8f2e-MasrlKbgCBdeyOhE.jpg",
              }}
              className={classes.previewPaper}
              imageClassName={classes.backgroundimage}
            >
              <ArticleContent
                title={title}
                coverUrl={coverUrl || null}
                blocks={blocks}
              />
            </Background>
          ) : (
            <>
              <Typography className={classes.label}>
                Баннер (узкий, широкий)
              </Typography>
              <Action
                onClick={() =>
                  pickImages(false, false, (urls) => {
                    if (urls[0]) setCoverUrl(urls[0]);
                  })
                }
                className={classes.btn}
              >
                <MaterialIcons
                  name="photo-size-select-actual"
                  size={16}
                  color={CREAM}
                />
                <Typography className={classes.btnText}>
                  {uploading
                    ? "Загрузка..."
                    : coverUrl
                      ? "Сменить баннер"
                      : "Выбрать баннер"}
                </Typography>
              </Action>
              {coverUrl ? (
                <Picture
                  source={{ uri: coverUrl }}
                  contentFit="cover"
                  className={classes.banner}
                />
              ) : null}

              <Typography className={classes.label}>Заголовок</Typography>
              <Field
                value={title}
                onValueChange={setTitle}
                placeholder="Что посмотреть осенью..."
                placeholderColor="#A89880"
                multiline
                className={classes.titleInput}
              />

              {blocks.map((block, index) => (
                <div
                  key={`${block.type}-${index}`}
                  className={["ui-stack ", classes.blockCard]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <div
                    className={["ui-stack ", classes.blockHead]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <Typography className={classes.blockLabel}>
                      {BLOCK_LABELS[block.type]}
                    </Typography>
                    <div
                      className={["ui-stack ", classes.row]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <Action
                        aria-label={`Переместить блок ${index + 1} вверх`}
                        onClick={() => moveBlock(index, -1)}
                        hitArea={8}
                      >
                        <MaterialIcons
                          name="keyboard-arrow-up"
                          size={20}
                          color={BROWN_LIGHT}
                        />
                      </Action>
                      <Action
                        aria-label={`Переместить блок ${index + 1} вниз`}
                        onClick={() => moveBlock(index, 1)}
                        hitArea={8}
                      >
                        <MaterialIcons
                          name="keyboard-arrow-down"
                          size={20}
                          color={BROWN_LIGHT}
                        />
                      </Action>
                      {blocks.length > 1 ? (
                        <Action
                          aria-label={`Удалить блок ${index + 1}`}
                          onClick={() =>
                            setBlocks((prev) =>
                              prev.filter((_, i) => i !== index),
                            )
                          }
                          hitArea={8}
                        >
                          <MaterialIcons
                            name="close"
                            size={18}
                            color="#A85C5C"
                          />
                        </Action>
                      ) : null}
                    </div>
                  </div>

                  {block.type === "heading" || block.type === "text" ? (
                    <Field
                      style={{
                        ...((block.type === "heading" ? true : false)
                          ? {
                              fontSize:
                                block.type === "heading" ? 18 : undefined,
                            }
                          : {}),
                        ...((block.type === "heading" ? true : false)
                          ? {
                              fontFamily:
                                block.type === "heading"
                                  ? "EBGaramond-Bold"
                                  : undefined,
                            }
                          : {}),
                        ...((block.type === "heading" ? true : false)
                          ? {
                              textAlign:
                                block.type === "heading" ? "center" : undefined,
                            }
                          : {}),
                        ...((block.type === "heading" ? false : true)
                          ? {
                              minHeight:
                                block.type === "heading" ? undefined : 120,
                            }
                          : {}),
                      }}
                      value={block.text || ""}
                      onValueChange={(value) =>
                        updateBlock(index, { text: value })
                      }
                      placeholder={
                        block.type === "heading"
                          ? "• Уютные 90-е •"
                          : "Абзац. Пустая строка — новый абзац. Ссылка: [название](https://...)"
                      }
                      placeholderColor="#A89880"
                      multiline
                      className={
                        block.type === "heading"
                          ? classes.appearanceState
                          : classes.appearanceState2
                      }
                    />
                  ) : null}

                  {block.type === "link" ? (
                    <>
                      <Field
                        value={block.label || ""}
                        onValueChange={(value) =>
                          updateBlock(index, { label: value })
                        }
                        placeholder="Текст ссылки, например Смотреть трейлер"
                        placeholderColor="#A89880"
                        className={classes.input}
                      />
                      <Field
                        value={block.url || ""}
                        onValueChange={(value) =>
                          updateBlock(index, { url: value })
                        }
                        placeholder="https://"
                        placeholderColor="#A89880"
                        autoCapitalize="off"
                        className={classes.input}
                      />
                    </>
                  ) : null}

                  {block.type === "carousel" ? (
                    <>
                      <Action
                        onClick={() =>
                          pickImages(false, true, (urls) =>
                            updateBlock(index, {
                              urls: [...(block.urls || []), ...urls],
                            }),
                          )
                        }
                        className={classes.btnSecondary}
                      >
                        <MaterialIcons
                          name="view-carousel"
                          size={16}
                          color={ACCENT}
                        />
                        <Typography className={classes.btnSecondaryText}>
                          {uploading
                            ? "Загрузка..."
                            : block.urls?.length
                              ? "Добавить кадры"
                              : "Выбрать фото для карусели"}
                        </Typography>
                      </Action>
                      {block.urls?.length ? (
                        <div
                          className={["ui-stack ", classes.carouselPreview]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          {block.urls.map((url, photoIndex) => (
                            <Action
                              aria-label={`Удалить фото ${photoIndex + 1} из блока ${index + 1}`}
                              key={`${url}-${photoIndex}`}
                              onClick={() =>
                                updateBlock(index, {
                                  urls: (block.urls || []).filter(
                                    (_, i) => i !== photoIndex,
                                  ),
                                })
                              }
                            >
                              <Picture
                                source={{ uri: url }}
                                contentFit="cover"
                                className={classes.carouselThumb}
                              />
                            </Action>
                          ))}
                        </div>
                      ) : null}
                      <Typography className={classes.hint}>
                        Нажмите на миниатюру, чтобы убрать кадр. Скруглённая
                        карусель появится в тексте статьи.
                      </Typography>
                      <Field
                        value={block.caption || ""}
                        onValueChange={(value) =>
                          updateBlock(index, { caption: value })
                        }
                        placeholder="Подпись под каруселью: источник..."
                        placeholderColor="#A89880"
                        className={classes.input}
                      />
                    </>
                  ) : null}

                  {block.type === "photo" || block.type === "png" ? (
                    <>
                      <Action
                        onClick={() =>
                          pickImages(block.type === "png", true, (urls) => {
                            setBlocks((prev) => {
                              const next = [...prev];
                              next[index] = {
                                type: block.type,
                                url: urls[0],
                                caption: block.caption || "",
                              };
                              const extra = urls.slice(1).map(
                                (url) =>
                                  ({
                                    type: block.type,
                                    url,
                                    caption: "",
                                  }) as ArticleBlock,
                              );
                              next.splice(index + 1, 0, ...extra);
                              return next;
                            });
                          })
                        }
                        className={classes.btnSecondary}
                      >
                        <MaterialIcons
                          name={block.type === "png" ? "image" : "photo"}
                          size={16}
                          color={ACCENT}
                        />
                        <Typography className={classes.btnSecondaryText}>
                          {uploading
                            ? "Загрузка..."
                            : block.url
                              ? "Заменить"
                              : block.type === "png"
                                ? "Выбрать PNG без фона"
                                : "Выбрать фото или GIF"}
                        </Typography>
                      </Action>
                      {block.url ? (
                        <Picture
                          source={{ uri: block.url }}
                          style={{
                            ...((block.type === "png" ? true : false)
                              ? {
                                  height:
                                    block.type === "png" ? 160 : undefined,
                                }
                              : {}),
                            ...((block.type === "png" ? false : true)
                              ? {
                                  aspectRatio:
                                    block.type === "png" ? undefined : 1.6,
                                }
                              : {}),
                            ...((block.type === "png" ? false : true)
                              ? {
                                  borderRadius:
                                    block.type === "png" ? undefined : 8,
                                }
                              : {}),
                          }}
                          contentFit={
                            block.type === "png" ? "contain" : "cover"
                          }
                          className={
                            block.type === "png"
                              ? classes.appearanceState3
                              : classes.appearanceState4
                          }
                        />
                      ) : null}
                      <Field
                        value={block.caption || ""}
                        onValueChange={(value) =>
                          updateBlock(index, { caption: value })
                        }
                        placeholder="Подпись под фото: источник, автор..."
                        placeholderColor="#A89880"
                        className={classes.input}
                      />
                    </>
                  ) : null}

                  <div
                    className={["ui-stack ", classes.addRow]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {ADD_BLOCKS.map((item) => (
                      <Action
                        key={item.type}
                        onClick={() => insertBlock(index, item.type)}
                        className={classes.addChip}
                      >
                        <MaterialIcons
                          name={item.icon}
                          size={14}
                          color={ACCENT}
                        />
                        <Typography className={classes.addChipText}>
                          {item.label}
                        </Typography>
                      </Action>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
        <div
          className={["ui-stack ", classes.formActions]
            .filter(Boolean)
            .join(" ")}
        >
          <Action onClick={reset} className={classes.btnGhost}>
            <Typography className={classes.btnGhostText}>Отмена</Typography>
          </Action>
          <Action
            onClick={save}
            disabled={busy}
            aria-busy={busy}
            aria-label={
              editingId
                ? "Сохранить"
                : published
                  ? "Опубликовать"
                  : "Сохранить черновик"
            }
            className={classes.btn}
          >
            {busy ? (
              <Spinner color={CREAM} />
            ) : (
              <Typography className={classes.btnText}>
                {editingId
                  ? "Сохранить"
                  : published
                    ? "Опубликовать"
                    : "Сохранить черновик"}
              </Typography>
            )}
          </Action>
        </div>
      </ScrollArea>
    );
  }
  return (
    <ScrollArea contentClassName={classes.list}>
      <Action onClick={() => setShowForm(true)} className={classes.btn}>
        <MaterialIcons name="menu-book" size={16} color={CREAM} />
        <Typography className={classes.btnText}>Написать статью</Typography>
      </Action>
      <Typography className={classes.hint}>
        Два места: только Эксклюзив клуба или Эксклюзив + библиотека с замочком.
        В общую ленту статьи не попадают.
      </Typography>
      <QueryRetryState
        isLoading={list.isLoading}
        isError={list.isError}
        onRetry={() => void list.refetch()}
        message="Не удалось загрузить статьи"
      />
      {(list.data || []).map((item) => (
        <div
          key={item.id}
          className={["ui-stack ", classes.card].filter(Boolean).join(" ")}
        >
          {item.coverUrl ? (
            <Picture
              source={{ uri: item.coverUrl }}
              contentFit="cover"
              className={classes.cardCover}
            />
          ) : null}
          <div className={["ui-stack ", classes.div].filter(Boolean).join(" ")}>
            <Typography className={classes.cardTitle}>{item.title}</Typography>
            <Typography className={classes.cardMeta}>
              {item.access === "public" ? "Клуб + библиотека" : "Эксклюзив"}
              {item.published ? "" : " · черновик"} ·{" "}
              {(item.sections || []).length} бл.
            </Typography>
            <div
              className={["ui-stack ", classes.row].filter(Boolean).join(" ")}
            >
              <Action
                onClick={() => startEdit(item)}
                className={classes.linkBtn}
              >
                <Typography className={classes.btnSecondaryText}>
                  Править
                </Typography>
              </Action>
              <Action
                onClick={() => confirmDelete(item.id)}
                className={classes.linkBtn}
              >
                <Typography className={classes.typography}>Удалить</Typography>
              </Action>
            </div>
          </div>
        </div>
      ))}
      {!list.isLoading && !list.isError && !(list.data || []).length ? (
        <Typography className={classes.hint}>
          Пока нет статей — напишите подборку, гид или «обо мне».
        </Typography>
      ) : null}
    </ScrollArea>
  );
}
