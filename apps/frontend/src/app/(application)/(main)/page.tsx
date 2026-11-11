/** Вход маршрута / передаёт параметры экрану; интерактивное состояние и вызовы API остаются в соответствующей feature. */
import Screen from "@/features/home/home-screen";
// The public landing page is cached; browser calendar state updates after hydration.
export const revalidate = 3600;
export default function Page() {
  return <Screen initialDate={new Date().toISOString()} />;
}
