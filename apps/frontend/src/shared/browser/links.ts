import { openExternalUrl } from "./actions";
export async function openBrowserAsync(url: string) {
  await openExternalUrl(url);
}
