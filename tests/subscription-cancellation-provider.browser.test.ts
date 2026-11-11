/** Опциональный Chromium проверяет реальные session/club/cancel providers над synthetic billing HTTP, не настоящий provider cancel. */
import { expect, it } from "vitest";
import { chromium, expect as browserExpect } from "@playwright/test";
import { build } from "esbuild";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { resolve } from "node:path";

// Real providers/controller/HTTP client in Chromium, controlled billing replies.
// This is a client guard regression, not JWT/SQL/provider cancellation acceptance.
/** Moderator с одним service access не вызывает dialog/POST; при реальном paid-флаге подтверждает ровно одну отмену. Все внешние browser requests запрещены, child UI bundle сохранён дословно. */
it.skipIf(!process.env.PLAYWRIGHT_EXECUTABLE_PATH).each([false, true])(
  "cancellation handler requires paid access, not moderator service access (paid=%s)",
  async (paid) => {
    const bundle = await build({
      stdin: {
        contents: `import {useState} from 'react';
          import {createRoot} from 'react-dom/client';
          import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
          import {AuthProvider} from '@/domain/session/session-context';
          import {ClubProvider,useClub} from '@/domain/subscription/subscription-context';
          import {SubscriptionCancellationProvider,useSubscriptionCancellation} from '@/features/profile/use-subscription-cancellation';
          import {trpc,createTRPCClient} from '@/shared/api/trpc';
          const cache=new QueryClient(); const client=createTRPCClient();
          function Probe(){const club=useClub();const cancellation=useSubscriptionCancellation();const [done,setDone]=useState(false);
            return <><output>{club.status}/{club.hasServiceAccess?'service':'paid'}</output>
              <button onClick={async()=>{await cancellation.cancel();setDone(true)}}>Invoke cancellation</button>
              <output>{done?'completed':'waiting'}</output></>}
          createRoot(document.getElementById('root')).render(
            <QueryClientProvider client={cache}><trpc.Provider client={client} queryClient={cache}>
              <AuthProvider><ClubProvider><SubscriptionCancellationProvider active={true}>
                <Probe/>
              </SubscriptionCancellationProvider></ClubProvider></AuthProvider>
            </trpc.Provider></QueryClientProvider>);`,
        loader: "tsx",
        resolveDir: process.cwd(),
      },
      bundle: true,
      write: false,
      platform: "browser",
      jsx: "automatic",
      alias: { "@": resolve("apps/frontend/src") },
      define: {
        "process.env.NODE_ENV": '"production"',
        "process.env.NEXT_PUBLIC_API_BASE_URL": '""',
      },
    });
    let writes = 0,
      dialogs = 0,
      cancelled = false;
    const expiration = "2030-01-01T00:00:00Z";
    const server = createServer(async (request, response) => {
      response.setHeader("Content-Type", "application/json");
      if (request.url === "/api/auth/me") {
        response.end(
          JSON.stringify({
            user: {
              id: 101,
              openId: "cancel-moderator",
              name: "Moderator",
              email: "moderator@example.test",
              phone: null,
              gender: null,
              avatarUrl: null,
              role: "moderator",
              loginMethod: "email",
              lastSignedIn: "2026-10-13T00:00:00Z",
            },
          }),
        );
      } else if (request.url?.startsWith("/api/trpc/")) {
        const url = new URL(request.url, "http://127.0.0.1");
        const results = url.pathname
          .split("/api/trpc/")[1]
          .split(",")
          .map((name) => {
            if (name === "club.cancel") {
              expect(request.method).toBe("POST");
              writes++;
              cancelled = true;
              return {
                result: { data: { json: { ok: true, expiresAt: expiration } } },
              };
            }
            expect(name).toBe("club.subscription");
            return {
              result: {
                data: {
                  json: {
                    hasClubAccess: true,
                    subscribed: paid,
                    expiresAt: paid ? expiration : null,
                    cancelAtPeriodEnd: cancelled,
                    cancellationStatus: cancelled ? "confirmed" : "none",
                    isOwner: false,
                    monthlyPrice: "790",
                  },
                },
              },
            };
          });
        response.end(
          JSON.stringify(url.searchParams.has("batch") ? results : results[0]),
        );
      } else {
        response.setHeader("Content-Type", "text/html");
        response.end('<main id="root"></main>');
      }
    });
    const browser = await chromium.launch({
      executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
    });
    try {
      await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
      const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      const page = await browser.newPage();
      await page.route("**/*", (route) =>
        new URL(route.request().url()).origin === origin
          ? route.continue()
          : route.abort("blockedbyclient"),
      );
      page.on("dialog", async (dialog) => {
        dialogs++;
        await dialog.accept();
      });
      await page.goto(origin);
      await page.addScriptTag({ content: bundle.outputFiles[0].text });
      await browserExpect(
        page.getByText(paid ? "active/paid" : "active/service", {
          exact: true,
        }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Invoke cancellation" }).click();
      await browserExpect(
        page.getByText("completed", { exact: true }),
      ).toBeVisible();
      if (paid) {
        await browserExpect.poll(() => writes).toBe(1);
      }
      expect(dialogs).toBe(paid ? 1 : 0);
      expect(writes).toBe(paid ? 1 : 0);
    } finally {
      await browser.close();
      await new Promise<void>((done) => server.close(() => done()));
    }
  },
);
