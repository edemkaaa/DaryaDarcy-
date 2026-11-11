/** Опциональный Chromium проверяет настоящий AuthProvider с собственным HTTP и синтетическим пользователем. */
import { it, expect } from "vitest";
import {
  chromium,
  expect as browserExpect,
  type Browser,
} from "@playwright/test";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { build } from "esbuild";
import { resolve } from "node:path";

/** Профиль wire-фикстуры позволяет различать владельца provider и дочернего локального состояния. */
const member = (id: number) => ({
  id,
  openId: `provider-${id}`,
  name: `Person ${id}`,
  email: `person-${id}@example.test`,
  phone: null,
  gender: null,
  avatarUrl: null,
  loginMethod: "email",
  role: "user",
  lastSignedIn: "2026-10-11T00:00:00.000Z",
});
/** Точный promise-барьер удерживает старый me-ответ до переключения identity. */
function barrier() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
type Harness = {
  switchOwner(): Promise<void>;
  privateValue(): unknown;
  seedPrivate(): void;
};

/** После applySession(2) subtree remount и QueryClient очистка не допускают данные1; предыдущий me-fetch отменяется, а external browser requests запрещены. */
it.skipIf(!process.env.PLAYWRIGHT_EXECUTABLE_PATH)(
  "real AuthProvider remounts private state and aborts its old session read when a new identity is applied",
  async () => {
    const bundle = await build({
      stdin: {
        contents: `import {useState} from 'react';
          import {createRoot} from 'react-dom/client';
          import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
          import {AuthProvider,useAuth} from '@/domain/session/session-context';
          const cache=new QueryClient();
          window.seedPrivate=()=>cache.setQueryData(['private'],'PERSON_1_PRIVATE');
          window.privateValue=()=>cache.getQueryData(['private']);
          function Probe(){const auth=useAuth();const [owner]=useState(()=>auth.user?.id??'none');
            window.switchOwner=()=>auth.applySession(${JSON.stringify(member(2))});
            return <p>{auth.user?.id??'none'}|{owner}</p>}
          createRoot(document.getElementById('root')).render(
            <QueryClientProvider client={cache}><AuthProvider><Probe/></AuthProvider></QueryClientProvider>);`,
        resolveDir: process.cwd(),
        loader: "tsx",
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
    const entered = barrier(),
      release = barrier(),
      aborted = barrier();
    let reads = 0;
    const server = createServer(async (request, response) => {
      if (request.url !== "/api/auth/me") {
        response.setHeader("Content-Type", "text/html");
        response.end('<main id="root"></main>');
        return;
      }
      if (++reads === 2) {
        response.once("close", () => {
          if (!response.writableEnded) aborted.resolve();
        });
        entered.resolve();
        await release.promise;
      }
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({ user: member(1) }));
    });
    let browser: Browser | undefined;
    try {
      await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
      const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      browser = await chromium.launch({
        executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
      });
      const context = await browser.newContext();
      await context.route("**/*", (route) =>
        new URL(route.request().url()).origin === origin
          ? route.continue()
          : route.abort("blockedbyclient"),
      );
      const page = await context.newPage();
      page.setDefaultTimeout(5_000);
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(origin);
      await page.addScriptTag({ content: bundle.outputFiles[0].text });
      await browserExpect(page.locator("#root")).toHaveText("1|1");
      await page.evaluate(() => (window as unknown as Harness).seedPrivate());
      expect(
        await page.evaluate(() =>
          (window as unknown as Harness).privateValue(),
        ),
      ).toBe("PERSON_1_PRIVATE");
      await page.evaluate(() => window.dispatchEvent(new Event("online")));
      await entered.promise;
      await page.evaluate(() => (window as unknown as Harness).switchOwner());
      await browserExpect(page.locator("#root")).toHaveText("2|2");
      expect(
        await page.evaluate(() =>
          (window as unknown as Harness).privateValue(),
        ),
      ).toBeUndefined();
      await aborted.promise;
      release.resolve();
      expect(reads).toBe(2);
      expect(errors).toEqual([]);
    } finally {
      release.resolve();
      await browser?.close();
      server.closeAllConnections();
      await new Promise<void>((done, reject) =>
        server.close((error) => (error ? reject(error) : done())),
      );
    }
  },
  15_000,
);
