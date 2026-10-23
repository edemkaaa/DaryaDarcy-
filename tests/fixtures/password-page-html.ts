import { passwordPage } from "../../apps/backend/src/identity/password-page";

// Cross-app test composition stays outside production dependency layers.
// Render the shipped template, not a copied snapshot or an extracted script.
export const passwordPageHtml = passwordPage(
  new URL("/login", "http://localhost:8081"),
  "fixture-nonce",
);
