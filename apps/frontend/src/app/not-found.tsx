import Link from "next/link";
export default function NotFound() {
  return (
    <div className="ui-stack route-error">
      <p>Страница не найдена.</p>
      <Link href="/">Вернуться на главную →</Link>
    </div>
  );
}
