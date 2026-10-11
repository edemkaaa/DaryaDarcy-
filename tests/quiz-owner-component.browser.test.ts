import { expect, it } from "vitest";
import { chromium, expect as browserExpect } from "@playwright/test";
import { build } from "esbuild";
import { resolve } from "node:path";

type QuizHarness = Window & {
  reads: ((raw: string) => void)[];
  setOwner(id: number): void;
};

it.skipIf(!process.env.PLAYWRIGHT_EXECUTABLE_PATH)(
  "cancels an old quiz restore when its auth owner changes before the read completes",
  async () => {
    // Native React/Chromium effect probe. Auth/storage and leaf views are
    // explicit controlled adapters, not the full Next/API/SQL application.
    const adapters: Record<string, string> = {
      "@/domain/session/session-context": `import {useSyncExternalStore} from 'react';
        export function useAuth(){return useSyncExternalStore(window.subscribeOwner,()=>window.owner)}`,
      "@/shared/browser/storage": `export default {getItem(){return new Promise(resolve=>window.reads.push(resolve))}}`,
      "@/features/quiz/quiz-welcome": `export function QuizWelcome(){return <p>welcome</p>}`,
      "@/features/quiz/quiz-question": `export function QuizQuestion(){return <p>question</p>}`,
      "@/features/quiz/quiz-result": `import {useQuiz} from '@/domain/quiz/quiz-state';
        export function QuizResultScreen(){return <p>{useQuiz().state.result.primary.key}</p>}`,
    };
    const bundle = await build({
      stdin: {
        contents: `import {createRoot} from 'react-dom/client';
          import {flushSync} from 'react-dom';
          import QuizScreen from '@/features/quiz/quiz-screen';
          const listeners=new Set(); window.reads=[];
          window.owner={loading:false,user:{id:1}};
          window.subscribeOwner=listener=>{listeners.add(listener);return ()=>listeners.delete(listener)};
          window.setOwner=id=>flushSync(()=>{window.owner={loading:false,user:{id}};listeners.forEach(fn=>fn())});
          const root=createRoot(document.getElementById('root'));
          flushSync(()=>root.render(<QuizScreen showSavedResult/>));`,
        resolveDir: process.cwd(),
        loader: "tsx",
      },
      bundle: true,
      write: false,
      platform: "browser",
      jsx: "automatic",
      alias: { "@": resolve("apps/frontend/src") },
      define: { "process.env.NODE_ENV": '"production"' },
      plugins: [
        {
          name: "controlled-quiz-boundaries",
          setup(builder) {
            builder.onResolve({ filter: /^@\// }, (args) =>
              adapters[args.path]
                ? { path: args.path, namespace: "quiz-adapter" }
                : undefined,
            );
            builder.onLoad(
              { filter: /.*/, namespace: "quiz-adapter" },
              (args) => ({
                contents: adapters[args.path],
                loader: "tsx",
                resolveDir: process.cwd(),
              }),
            );
          },
        },
      ],
    });
    const browser = await chromium.launch({
      executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
    });
    try {
      const context = await browser.newContext();
      await context.route("**/*", (route) => route.abort("blockedbyclient"));
      const page = await context.newPage();
      page.setDefaultTimeout(5_000);
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.setContent('<main id="root"></main>');
      await page.addScriptTag({ content: bundle.outputFiles[0].text });
      await page.waitForFunction(
        () => (window as unknown as QuizHarness).reads.length === 1,
      );
      await page.evaluate(() => (window as unknown as QuizHarness).setOwner(2));
      await page.waitForFunction(
        () => (window as unknown as QuizHarness).reads.length === 2,
      );
      const saved = (key: string) =>
        JSON.stringify({
          primaryKey: key,
          secondaryKey: null,
          isBlend: false,
          scores: {
            cottagecore: 0,
            goblincore: 0,
            witchcore: 0,
            castlecore: 0,
            fairycore: 0,
            darkAcademia: 0,
            lightAcademia: 0,
            [key]: 21,
          },
        });
      await page.evaluate(async (raw) => {
        (window as unknown as QuizHarness).reads[0](raw);
        // Wait for React's browser rendering opportunity, not an elapsed delay.
        await new Promise<void>((done) =>
          requestAnimationFrame(() => requestAnimationFrame(() => done())),
        );
      }, saved("cottagecore"));
      await browserExpect(page.locator("#root")).toHaveText("welcome");
      await page.evaluate(
        (raw) => (window as unknown as QuizHarness).reads[1](raw),
        saved("goblincore"),
      );
      await browserExpect(page.locator("#root")).toHaveText("goblincore");
      expect(
        await page.evaluate(
          () => (window as unknown as QuizHarness).reads.length,
        ),
      ).toBe(2);
      expect(errors).toEqual([]);
    } finally {
      await browser.close();
    }
  },
  15_000,
);
