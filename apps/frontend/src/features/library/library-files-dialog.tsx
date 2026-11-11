"use client";
/** Список скачивания берётся из защищённого API; ссылка открывает файл отдельно и не заменяется старым публичным источником. */
import { Dialog, Action, Typography } from "@/shared/ui/elements";
import { QueryRetryState } from "@/shared/ui/query-retry-state";
import { apiUrl } from "@/shared/config/api";
import { useClub } from "@/domain/subscription/subscription-context";
import { useLibraryFiles } from "./use-library-files";
import type { LibraryMaterialKey } from "./library-files-api";
import classes from "./article-screen.module.scss";
import dialogClasses from "./library-files-dialog.module.scss";

/** Показываем только подтверждённые серверные привязки и открываем скачивание в отдельном окне с текущей cookie-сессией. */
export function LibraryFilesDialog({
  material,
  title,
  onClose,
}: {
  material: LibraryMaterialKey;
  title: string;
  onClose: () => void;
}) {
  const { hasClubAccess } = useClub();
  const query = useLibraryFiles(material);
  return (
    <Dialog
      open
      label={title}
      onClose={onClose}
      className={dialogClasses.overlay}
    >
      <div className={dialogClasses.panel}>
        <Typography className={classes.title}>{title}</Typography>
        {!hasClubAccess ? (
          <Typography className={classes.body}>
            Материал доступен участницам клуба Darcy.
          </Typography>
        ) : (
          <QueryRetryState
            isLoading={query.isPending}
            isError={query.isError || query.data?.length === 0}
            message="Материал сейчас недоступен. Попробуйте позже."
            onRetry={query.retry}
          >
            {query.data?.map((file) => (
              <a
                key={file.fileKey}
                href={apiUrl(file.url)}
                target="_blank"
                rel="noopener noreferrer"
                className={classes.clubBtn}
              >
                <Typography className={classes.clubBtnText}>
                  Скачать: {file.filename}
                </Typography>
              </a>
            ))}
          </QueryRetryState>
        )}
        <Action onClick={onClose} className={classes.clubBtn}>
          <Typography className={classes.clubBtnText}>Закрыть</Typography>
        </Action>
      </div>
    </Dialog>
  );
}
