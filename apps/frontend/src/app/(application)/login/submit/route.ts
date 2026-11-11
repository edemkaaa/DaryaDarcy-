/** Серверный вход обычной HTML-формы обрабатывает отправку до клиентской гидратации и возвращает контролируемый переход. Авторизацию выполняет существующий JSON API. */
/** Прерываем обычную отправку HTML-формы до гидратации через 303; credentials не читаются, не отражаются и не отправляются дальше. */
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
