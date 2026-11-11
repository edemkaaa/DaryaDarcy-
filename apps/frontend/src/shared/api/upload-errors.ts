/** Ошибки закрытых загрузок преобразуем в понятные сообщения без перехода на публичный маршрут. */
import { getHttpStatus } from "./errors";

/** Специальные 404/413 объясняют текущий отказ загрузки; они не отменяют ранее отправленную попытку с тем же ключом. */
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
