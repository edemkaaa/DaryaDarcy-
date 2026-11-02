import { expect, it } from "vitest";
import { chromium, expect as browserExpect } from "@playwright/test";
import { build } from "esbuild";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { resolve } from "node:path";

// Real providers/controller/client in Chromium; controlled HTTP billing replies,
// not live provider/SQL/payment acceptance.
it
  .skipIf(!process.env.PLAYWRIGHT_EXECUTABLE_PATH)
  .each(["business", "server", "proxy", "wrong-path", "lost-response"])(
  "distinguishes a confirmed cancellation refusal from an unknown write: %s",
  async (failure) => {
    const paid = true;
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
          <output data-testid="notice-status">{c.notice?.status??''}</output><output data-testid="busy">{String(c.busy)}</output><output data-testid="notice">{c.notice?.message??''}</output><output data-testid="blocked">{String(c.blocked)}</output>
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
    const cancellationStatus = "none";
    let reads = 0,
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
              if (failure === "lost-response") {
                // Lose the body after headers: a socket closed before headers
                // can be retried transparently by Chromium's HTTP transport.
                response.writeHead(200);
                response.write('{"result":');
                setTimeout(() => response.destroy(), 10);
                return null;
              }
              response.statusCode = failure === "server" ? 500 : 400;
              if (failure === "proxy") return { message: "Proxy refused" };
              return {
                error: {
                  json: {
                    message:
                      "Не удалось определить подписку. Обратитесь в поддержку.",
                    code: -32600,
                    data: {
                      code:
                        failure === "server"
                          ? "INTERNAL_SERVER_ERROR"
                          : "BAD_REQUEST",
                      httpStatus: failure === "server" ? 500 : 400,
                      path:
                        failure === "wrong-path"
                          ? "other.mutation"
                          : "club.cancel",
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
                    cancelAtPeriodEnd: false,
                    cancellationStatus,
                    isOwner: false,
                    monthlyPrice: "790",
                  },
                },
              },
            };
          });
        if (failure === "lost-response" && url.pathname.endsWith("club.cancel"))
          return;
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
      const open = async () => {
        await page.goto(origin);
        await page.addScriptTag({ content: bundle.outputFiles[0].text });
      };
      await open();
      await browserExpect(page.getByTestId("access")).toHaveText("access");
      await browserExpect(page.getByTestId("notice")).toHaveText("");
      await page.getByRole("button", { name: "Cancel subscription" }).click();
      await browserExpect.poll(() => writes).toBe(1);
      await browserExpect(page.getByTestId("busy")).toHaveText("false");
      if (failure === "business") {
        await browserExpect(page.getByTestId("notice-status")).toHaveText(
          "error",
        );
        await browserExpect(page.getByTestId("notice")).toContainText(
          "Не удалось определить подписку. Обратитесь в поддержку.",
        );
        await browserExpect(page.getByTestId("blocked")).toHaveText("false");
      } else {
        await browserExpect(page.getByTestId("notice-status")).toHaveText(
          "unknown",
        );
        await browserExpect(page.getByTestId("notice")).toContainText(
          "Отмена ещё не подтверждена",
        );
        await browserExpect(page.getByTestId("blocked")).toHaveText("true");
        const before = reads;
        await page.getByRole("button", { name: "Check cancellation" }).click();
        await browserExpect.poll(() => reads).toBeGreaterThan(before);
        await browserExpect(page.getByTestId("busy")).toHaveText("false");
        await browserExpect(page.getByTestId("blocked")).toHaveText("true");
        await page.getByRole("button", { name: "Cancel subscription" }).click();
      }
      expect(cancellationStatus).toBe("none");
      expect(writes).toBe(1);
    } finally {
      await browser.close();
      await new Promise<void>((done) => server.close(() => done()));
    }
  },
  20_000,
);
