import { afterAll, beforeAll, describe, it } from "vitest";
import {
  chromium,
  expect as browserExpect,
  type Browser,
} from "@playwright/test";
import { build } from "esbuild";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { resolve } from "node:path";

describe.skipIf(!process.env.PLAYWRIGHT_EXECUTABLE_PATH)(
  "Field keyboard submission in Chromium",
  () => {
    let browser: Browser | undefined;
    let server: Server | undefined;
    let origin: string;

    beforeAll(async () => {
      const bundle = await build({
        stdin: {
          contents: `
            import { useState } from 'react';
            import { createRoot } from 'react-dom/client';
            import { Field } from './apps/frontend/src/shared/ui/field';

            function Probe() {
              const mode = new URLSearchParams(location.search).get('mode');
              const [value, setValue] = useState('');
              const [submissions, setSubmissions] = useState([]);
              const [keys, setKeys] = useState(0);
              const [formSubmissions, setFormSubmissions] = useState(0);
              return <form onSubmit={event => {
                event.preventDefault();
                setFormSubmissions(count => count + 1);
              }}>
                <Field aria-label="Value" value={value}
                  onValueChange={setValue} multiline={mode === 'multiline'}
                  onSubmit={mode === 'native' ? undefined : () => {
                    setSubmissions(previous => [...previous, value]);
                  }}
                  onKeyDown={event => {
                    setKeys(count => count + 1);
                    if (mode === 'cancel') event.preventDefault();
                  }} />
                <output data-testid="submissions">{JSON.stringify(submissions)}</output>
                <output data-testid="keys">{keys}</output>
                <output data-testid="form-submissions">{formSubmissions}</output>
                <button type="submit">Submit form</button>
              </form>;
            }
            createRoot(document.getElementById('root')).render(<Probe />);
          `,
          loader: "tsx",
          resolveDir: resolve(import.meta.dirname, ".."),
        },
        bundle: true,
        write: false,
        platform: "browser",
        jsx: "automatic",
        define: { "process.env.NODE_ENV": '"production"' },
      });
      server = createServer((request, response) => {
        if (request.url === "/probe.js") {
          response.setHeader("Content-Type", "text/javascript");
          response.end(bundle.outputFiles[0].text);
        } else {
          response.setHeader("Content-Type", "text/html; charset=utf-8");
          response.end(
            '<!doctype html><html><body><main id="root"></main><script src="/probe.js"></script></body></html>',
          );
        }
      });
      await new Promise<void>((done) => server!.listen(0, "127.0.0.1", done));
      origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      browser = await chromium.launch({
        executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH,
      });
    });

    afterAll(async () => {
      await browser?.close();
      if (server?.listening)
        await new Promise<void>((done, reject) =>
          server!.close((error) => (error ? reject(error) : done())),
        );
    });

    const cases = [
      "ordinary Enter",
      "IME composition",
      "IME keyCode 229",
      "cancelled Enter",
      "multiline Enter",
      "another key",
      "native form submission",
    ] as const;

    it.each(cases)(
      "handles %s",
      async (scenario) => {
        const context = await browser!.newContext();
        try {
          const page = await context.newPage();
          await page.route("**/*", (route) =>
            new URL(route.request().url()).origin === origin
              ? route.continue()
              : route.abort(),
          );
          const mode = {
            "ordinary Enter": "ordinary",
            "IME composition": "ordinary",
            "IME keyCode 229": "ordinary",
            "cancelled Enter": "cancel",
            "multiline Enter": "multiline",
            "another key": "ordinary",
            "native form submission": "native",
          }[scenario];
          await page.goto(`${origin}/?mode=${mode}`);
          const field = page.getByRole("textbox", {
            name: "Value",
            exact: true,
          });
          const submissions = page.getByTestId("submissions");
          const formSubmissions = page.getByTestId("form-submissions");
          await field.fill("途中");

          if (
            scenario === "IME composition" ||
            scenario === "IME keyCode 229"
          ) {
            await field.dispatchEvent("compositionstart", { data: "途中" });
            await field.dispatchEvent("keydown", {
              key: "Enter",
              code: "Enter",
              keyCode: scenario === "IME keyCode 229" ? 229 : 13,
              isComposing: scenario === "IME composition",
              bubbles: true,
              cancelable: true,
            });
          } else
            await field.press(
              scenario === "another key" ? "ArrowLeft" : "Enter",
            );

          await browserExpect(page.getByTestId("keys")).toHaveText("1");
          await browserExpect(submissions).toHaveText(
            scenario === "ordinary Enter" ? '["途中"]' : "[]",
          );
          await browserExpect(formSubmissions).toHaveText(
            scenario === "native form submission" ? "1" : "0",
          );
          if (scenario === "multiline Enter")
            await browserExpect(field).toHaveValue("途中\n");

          if (
            scenario === "IME composition" ||
            scenario === "IME keyCode 229"
          ) {
            await field.dispatchEvent("compositionend", { data: "完成" });
            await field.fill("完成");
            await field.press("Enter");
            await browserExpect(submissions).toHaveText('["完成"]');
            await browserExpect(formSubmissions).toHaveText("0");
            await browserExpect(field).toHaveValue("完成");
          }
        } finally {
          await context.close();
        }
      },
      10_000,
    );
  },
);
