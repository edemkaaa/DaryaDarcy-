"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div role="alert" className="ui-stack route-error">
      <p>Не удалось открыть страницу.</p>
      <button onClick={reset}>Попробовать ещё раз</button>
    </div>
  );
}
