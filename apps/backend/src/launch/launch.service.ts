/** Отбирает публичную часть оформления и передаёт административные изменения в атомарное сохранение. */
import { Injectable } from "@nestjs/common";
import { getDb } from "../db";
import { getCapabilities } from "./capabilities";
import {
  currentSeason,
  getLaunchConfiguration,
  saveLaunchConfiguration,
  type LaunchSettingsActor,
} from "./settings";

@Injectable()
export class LaunchService {
  private async database() {
    // Пул Drizzle общий; его жизненный цикл не принадлежит HTTP-методу сервиса.
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

  async save(
    actor: LaunchSettingsActor,
    expectedRevision: number,
    config: unknown,
  ) {
    return saveLaunchConfiguration(
      await this.database(),
      actor,
      expectedRevision,
      config,
    );
  }
}
