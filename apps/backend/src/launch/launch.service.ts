import { Injectable } from "@nestjs/common";
import { getDb } from "../db";
import { getCapabilities } from "./capabilities";
import {
  currentSeason,
  getLaunchConfiguration,
  saveLaunchConfiguration,
} from "./settings";

@Injectable()
export class LaunchService {
  private async database() {
    // Transitional Drizzle pool; ownership/lifecycle moves separately from HTTP.
    const database = await getDb();
    if (!database) throw new Error("Database unavailable");
    return database;
  }

  async publicConfiguration() {
    const snapshot = await this.configuration();
    const season = currentSeason(snapshot.config);
    return {
      revision: snapshot.revision,
      season,
      appearance: snapshot.config.seasons[season],
      managerEmail: snapshot.config.managerEmail,
      orderMethod: "email-client" as const,
      capabilities: getCapabilities(),
    };
  }

  async configuration() {
    return getLaunchConfiguration(await this.database());
  }

  async save(actorId: number, expectedRevision: number, config: unknown) {
    // The existing boundary validates untrusted JSON and atomically rechecks the
    // actor, locks the revision, updates settings, and records the audit event.
    return saveLaunchConfiguration(
      await this.database(),
      actorId,
      expectedRevision,
      config,
    );
  }
}
