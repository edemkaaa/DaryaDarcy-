/** Опциональный Chromium проверяет восстановление pending cancellation из subscription reads, без настоящей отмены/БД. */
import { expect, it } from "vitest";
import { chromium, expect as browserExpect } from "@playwright/test";
import { build } from "esbuild";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { resolve } from "node:path";

// Real providers/controller/client in Chromium; controlled HTTP billing replies,
// not live provider/SQL/payment acceptance.
/** При paid/истёкшем доступе pending остаётся видимым, Cancel не создаёт повторную запись; явный Check читает status до confirmed, writes остаётся0. */
it.skipIf(!process.env.PLAYWRIGHT_EXECUTABLE_PATH).each([false, true])(
  "restores pending cancellation after reload without new writes (paid=%s)",
  async (paid) => {
    const bundle = await build({
      stdin: {
        contents: `import {createRoot} from 'react-dom/client';
        import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
        import {AuthProvider} from '@/domain/session/session-context';
        import {ClubProvider,useClub} from '@/domain/subscription/subscription-context';
        import {SubscriptionCancellationProvider,useSubscriptionCancellation} from '@/features/profile/use-subscription-cancellation';
        import {trpc,createTRPCClient} from '@/shared/api/trpc';
        const cache=new QueryClient(),client=createTRPCClient();
        function Probe(){const club=useClub(),c=useSubscriptionCancellation();return <>
          <output data-testid="access">{club.hasClubAccess?'access':'closed'}</output>
          <output data-testid="notice">{c.notice?.message??''}</output>
          <button onClick={()=>void c.check()}>Check cancellation</button>
          <button onClick={()=>void c.cancel()}>Cancel subscription</button></>}
        createRoot(document.getElementById('root')).render(<QueryClientProvider client={cache}>
          <trpc.Provider client={client} queryClient={cache}><AuthProvider><ClubProvider>
          <SubscriptionCancellationProvider active={true}><Probe/></SubscriptionCancellationProvider>
          </ClubProvider></AuthProvider></trpc.Provider></QueryClientProvider>);`,
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
    let cancellationStatus = "pending",
      reads = 0,
      writes = 0;
    const server = createServer((request, response) => {
      response.setHeader("Content-Type", "application/json");
      if (request.url === "/api/auth/me")
        response.end(
          JSON.stringify({
            user: {
              id: 101,
              openId: "pending-member",
              name: "Member",
              email: "member@example.invalid",
              phone: null,
              gender: null,
              avatarUrl: null,
              role: "user",
              loginMethod: "email",
              lastSignedIn: "2026-10-21T00:00:00Z",
            },
          }),
        );
      else if (request.url?.startsWith("/api/trpc/")) {
        const url = new URL(request.url, "http://127.0.0.1");
        const results = url.pathname
          .split("/api/trpc/")[1]
          .split(",")
          .map((name) => {
            if (name === "club.cancel") {
              writes++;
              return {
                result: {
                  data: {
                    json: {
                      ok: true,
                      cancellationStatus: "pending",
                      expiresAt: null,
                      message: "Request saved",
                    },
                  },
                },
              };
            }
            expect(name).toBe("club.subscription");
            reads++;
            return {
              result: {
                data: {
                  json: {
                    hasClubAccess: paid,
                    subscribed: paid,
                    expiresAt: paid ? "2030-01-01T00:00:00Z" : null,
                    cancelAtPeriodEnd: cancellationStatus === "confirmed",
                    cancellationStatus,
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
      page.on("dialog", (dialog) => dialog.accept());
      /** Повторно загружаем synthetic document и настоящий provider bundle, имитируя reload с потерянным локальным состоянием. */
      const open = async () => {
        await page.goto(origin);
        await page.addScriptTag({ content: bundle.outputFiles[0].text });
      };
      await open();
      await browserExpect(page.getByTestId("notice")).toContainText(
        "Запрос на отмену сохранён",
      );
      await browserExpect(page.getByTestId("access")).toHaveText(
        paid ? "access" : "closed",
      );
      await page.getByRole("button", { name: "Cancel subscription" }).click();
      expect(writes).toBe(0);
      await open();
      await browserExpect(page.getByTestId("notice")).toContainText(
        "Запрос на отмену сохранён",
      );
      const before = reads;
      await page.getByRole("button", { name: "Check cancellation" }).click();
      await browserExpect.poll(() => reads).toBeGreaterThan(before);
      cancellationStatus = "confirmed";
      await page.getByRole("button", { name: "Check cancellation" }).click();
      await browserExpect(page.getByTestId("notice")).toHaveText("");
      expect(writes).toBe(0);
    } finally {
      await browser.close();
      await new Promise<void>((done) => server.close(() => done()));
    }
  },
  20_000,
);
