/** Открытие ссылки использует общий проверенный путь внешней навигации вместо отдельной логики в каждом экране. */
import { openExternalUrl } from "./actions";
/** Совместимый вызов делегирует открытие общему URL-валидатору, не создавая отдельного окна приложения или авторизации. */
export async function openBrowserAsync(url: string) {
  await openExternalUrl(url);
}
