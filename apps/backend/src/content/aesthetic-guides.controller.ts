/** Защищённая HTTP-выдача текстов эстетик. Проверка доступа находится на серверной границе. */
import { Controller, Get, Inject, Param, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { aestheticKeySchema } from "../../../../packages/shared/src/aesthetic-guide";
import { HttpError } from "../../../../packages/shared/src/_core/errors";
import { SessionService } from "../identity/session.service";
import { userHasClubAccess } from "../identity/club-access";
import { aestheticGuides } from "./aesthetic-guides";

@Controller("api/library/guides/aesthetics")
export class AestheticGuidesController {
  /** Получает единый SessionService приложения, чтобы выдача гида учитывала актуальный epoch пользователя. */
  constructor(
    @Inject(SessionService) private readonly sessions: SessionService,
  ) {}

  /** Валидирует ключ/отсутствие query и требует текущую сессию с клубным доступом; denial скрыт под 404, инфраструктурная ошибка даёт 503 и no-store. */
  @Get(":key")
  async read(
    @Param("key") key: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.vary("Cookie");
    res.vary("Authorization");
    const parsed = aestheticKeySchema.safeParse(key);
    try {
      if (
        !parsed.success ||
        Object.keys(req.query).length ||
        (!req.headers.cookie && !req.headers.authorization) ||
        !(await userHasClubAccess(await this.sessions.authenticateRequest(req)))
      )
        return res.status(404).json({ error: "Материал недоступен." });
      return res.json({ key: parsed.data, ...aestheticGuides[parsed.data] });
    } catch (error) {
      if (error instanceof HttpError && [401, 403].includes(error.statusCode))
        return res.status(404).json({ error: "Материал недоступен." });
      return res.status(503).json({ error: "Материал временно недоступен." });
    }
  }
}
