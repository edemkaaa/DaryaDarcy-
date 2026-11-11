// Формирует ссылку из явно переданного sandbox-окружения. Не подгружает ключи автоматически и не подтверждает успешность платежа.
import { ProdamusSandboxService } from "../../apps/backend/src/billing/prodamus-sandbox.service";

// Environment is supplied explicitly by the operator; never auto-load secrets.
if (process.argv.length > 2) {
  console.error("Sandbox link does not accept command-line overrides");
  process.exitCode = 1;
} else {
  try {
    const checkoutUrl = new ProdamusSandboxService(process.env).buildLink();
    console.log(
      JSON.stringify({ mode: "demo", accessGranted: false, checkoutUrl }),
    );
  } catch {
    console.error("Prodamus sandbox is not configured");
    process.exitCode = 1;
  }
}
