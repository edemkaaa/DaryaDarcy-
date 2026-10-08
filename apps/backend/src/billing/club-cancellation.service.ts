import { Injectable } from "@nestjs/common";
import type { confirmProviderCancellation } from "./cancellation";
import type { ProdamusCancellationProfile } from "./prodamus-cancellation";

type CancellationDatabase = Parameters<typeof confirmProviderCancellation>[0];
export type ClubCancellationPorts = Readonly<{
  getDb: () => Promise<CancellationDatabase | null>;
  confirm: typeof confirmProviderCancellation;
}>;

/** Post-verification orchestration; durable cancellation owns the transaction. */
@Injectable()
export class ClubCancellationService {
  constructor(private readonly ports: ClubCancellationPorts) {}

  async confirm(profile: ProdamusCancellationProfile): Promise<boolean> {
    const database = await this.ports.getDb();
    if (!database) throw new Error("Database unavailable");
    return this.ports.confirm(database, profile);
  }
}
