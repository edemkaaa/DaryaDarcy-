/** Серверный вход обычной HTML-формы обрабатывает отправку до клиентской гидратации и возвращает контролируемый переход. */
/** Safe fallback before hydration. Authentication is handled by the existing JSON API. */
export function POST(): Response {
  // Do not read, echo or forward the submitted credentials.
  return new Response(null, {
    status: 303,
    headers: {
      Location: "/login?form=unavailable",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
