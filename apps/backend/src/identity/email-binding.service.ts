import { Injectable } from "@nestjs/common";
import { getDb } from "../db";
import {
  EmailBindingError,
  requestMemberEmailBinding,
  type EmailBindingActor,
  type EmailBindingRequest,
} from "./email-binding";
import { getMemberEmailBindingStatus } from "./email-binding-status";
import { confirmMemberEmailBinding } from "./email-binding-confirmation";

@Injectable()
export class EmailBindingService {
  private async database() {
    const database = await getDb();
    if (!database) throw new EmailBindingError("unavailable");
    return database;
  }
  async request(actor: EmailBindingActor, input: EmailBindingRequest) {
    return requestMemberEmailBinding(await this.database(), actor, input);
  }
  async status(actor: EmailBindingActor, requestKey: string) {
    return getMemberEmailBindingStatus(
      await this.database(),
      actor,
      requestKey,
    );
  }
  async confirm(token: string) {
    return confirmMemberEmailBinding(await this.database(), token);
  }
}
