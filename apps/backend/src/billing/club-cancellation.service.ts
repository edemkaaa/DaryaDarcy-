/** Соединяет уже проверенное уведомление об отмене с её долговечным SQL-состоянием. */
import { Injectable } from "@nestjs/common";
import type { confirmProviderCancellation } from "./cancellation";
import type { ProdamusCancellationProfile } from "./prodamus-cancellation";

type CancellationDatabase = Parameters<typeof confirmProviderCancellation>[0];
export type ClubCancellationPorts = Readonly<{
  getDb: () => Promise<CancellationDatabase | null>;
  confirm: typeof confirmProviderCancellation;
}>;

/** Оркестрация после проверки уведомления; транзакцией владеет долговечная отмена. */
@Injectable()
export class ClubCancellationService {
  /** Принимает порты БД и подтверждения отмены, не вызывая их при создании сервиса. */
  constructor(private readonly ports: ClubCancellationPorts) {}

  /** После проверки webhook получает БД и передаёт профиль долговечной транзакционной отмене; без БД не подтверждает успех. */
  async confirm(profile: ProdamusCancellationProfile): Promise<boolean> {
    const database = await this.ports.getDb();
    if (!database) throw new Error("Database unavailable");
    return this.ports.confirm(database, profile);
  }
}
