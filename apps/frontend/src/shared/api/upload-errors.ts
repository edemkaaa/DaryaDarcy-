import { getHttpStatus } from "./errors";

/** A rejected upload is not evidence that an earlier attempt did not commit. */
export function privateUploadRejectionMessage(error: unknown): string | null {
  switch (getHttpStatus(error)) {
    case 404:
      return "Загрузка файлов сейчас недоступна. Попробуйте позже.";
    case 413:
      return "Сервер отклонил файл из-за ограничения размера. Попробуйте файл меньшего размера.";
    default:
      return null;
  }
}
