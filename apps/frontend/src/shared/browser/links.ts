/** Открытие ссылки использует общий проверенный путь внешней навигации вместо отдельной логики в каждом экране. */
import { openExternalUrl } from "./actions";
export async function openBrowserAsync(url: string) {
  await openExternalUrl(url);
}
