/** Вход маршрута /oauth/callback передаёт параметры экрану; интерактивное состояние и вызовы API остаются в соответствующей feature. */
import { redirect } from "next/navigation";
export default function Page() {
  redirect("/login");
}
