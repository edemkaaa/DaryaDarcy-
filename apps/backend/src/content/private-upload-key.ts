/** Формат ключа повторяемой загрузки общий для API и хранения квитанций. */
import { z } from "zod";

// Keep input validation independent of upload services and the database facade.
export const privateUploadKey = z.string().regex(/^[A-Za-z0-9._:-]{16,128}$/);
