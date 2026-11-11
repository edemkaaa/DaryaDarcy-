/** Вход маршрута /oauth/callback передаёт параметры экрану; интерактивное состояние и вызовы API остаются в соответствующей feature. */
import { redirect } from "next/navigation";
/** Старый callback ведёт к актуальному входу; токены из адреса здесь не извлекаются и не устанавливают сессию. */
export default function Page() {
  redirect("/login");
}
