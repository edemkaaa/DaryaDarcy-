import { safeNextPath } from "./paths";

const loginKey = "darcy:login-return:v1";
const clubKey = "darcy:club-navigation:v1";
const loginHistoryKey = "__darcyLoginReturn";
const clubHistoryKey = "__darcyClubNavigation";
const lifetime = 30 * 60 * 1000;
export const navigationIntentEvent = "darcy:navigation-intent";

export type ClubNavigation = { checkout: boolean; paymentReturn: boolean };
export type LoginDestination = {
  pathname: string;
  club?: ClubNavigation;
};
type SavedDestination = { destination: LoginDestination; expiresAt: number };
type SavedClubNavigation = ClubNavigation & { expiresAt: number; key: string };
const memory = new Map<string, string | null>();
const unusedParameters = new Set([
  "next",
  "form",
  "checkout",
  "paid",
  "payment",
  "order",
  "token",
  "access_token",
  "refresh_token",
  "id_token",
  "code",
  "state",
]);
const secretParameters = new Set([
  "token",
  "access_token",
  "refresh_token",
  "id_token",
]);

function cleanParameters(url: URL) {
  for (const key of [...url.searchParams.keys()]) {
    if (unusedParameters.has(key.toLowerCase())) url.searchParams.delete(key);
  }
  if (
    [...new URLSearchParams(url.hash.slice(1)).keys()].some((key) =>
      secretParameters.has(key.toLowerCase()),
    )
  )
    url.hash = "";
}

const pages = new Set([
  "/",
  "/feed",
  "/videos",
  "/club",
  "/interactive",
  "/quiz",
  "/library",
  "/library/about-me",
  "/library/aesthetics-guide",
  "/library/patterns",
  "/shop",
  "/profile",
  "/admin",
  "/legal",
  "/privacy",
]);
function appPage(path: string) {
  return (
    pages.has(path) ||
    /^\/(?:post|video)\/[1-9]\d*$/.test(path) ||
    /^\/library\/article\/[1-9]\d*$/.test(path) ||
    /^\/shop\/(?:book-[123]|digital-[12])$/.test(path) ||
    /^\/legal\/(?:offer|personal-data|personal-data-consent|user-agreement|payment-refund|cookies|requisites|music-license)$/.test(
      path,
    )
  );
}
function clubFlags(params: URLSearchParams): ClubNavigation {
  return {
    checkout: params.get("checkout") === "1",
    paymentReturn: params.get("paid") === "1",
  };
}

/** Only existing app pages and non-sensitive navigation flags may be retained. */
export function loginDestination(value: unknown): LoginDestination | null {
  const input = typeof value === "string" ? { pathname: value } : value;
  if (
    !input ||
    typeof input !== "object" ||
    !("pathname" in input) ||
    typeof input.pathname !== "string"
  )
    return null;
  const raw = safeNextPath(input.pathname);
  if (!raw) return null;
  const url = new URL(raw, "https://navigation.invalid");
  if (raw.split(/[?#]/)[0] !== url.pathname || !appPage(url.pathname))
    return null;
  const destination: LoginDestination = { pathname: url.pathname };
  if (url.pathname === "/club") {
    const explicit = "club" in input ? input.club : null;
    const flags =
      explicit && typeof explicit === "object"
        ? {
            checkout: "checkout" in explicit && explicit.checkout === true,
            paymentReturn:
              "paymentReturn" in explicit && explicit.paymentReturn === true,
          }
        : clubFlags(url.searchParams);
    if (flags.checkout || flags.paymentReturn) destination.club = flags;
  }
  return destination;
}

function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  const encoded = JSON.stringify(value);
  try {
    window.sessionStorage.setItem(key, encoded);
    memory.delete(key);
  } catch {
    memory.set(key, encoded);
    /* In-tab navigation still works without storage. */
  }
}
function read(key: string): unknown {
  if (typeof window === "undefined") return null;
  let encoded: string | null | undefined = memory.get(key);
  try {
    if (!memory.has(key)) encoded = window.sessionStorage.getItem(key);
  } catch {
    encoded = memory.get(key);
  }
  if (!encoded) return null;
  try {
    return JSON.parse(encoded);
  } catch {
    return null;
  }
}
function remove(key: string) {
  try {
    window.sessionStorage.removeItem(key);
    memory.delete(key);
  } catch {
    memory.set(key, null);
    /* Optional browser storage. */
  }
}
function unexpired(value: unknown): value is { expiresAt: number } {
  return Boolean(
    value &&
    typeof value === "object" &&
    "expiresAt" in value &&
    typeof value.expiresAt === "number" &&
    value.expiresAt > Date.now() &&
    value.expiresAt <= Date.now() + lifetime,
  );
}
function savedDestination(value: unknown): SavedDestination | null {
  if (!unexpired(value) || !("destination" in value)) return null;
  const destination = loginDestination(value.destination);
  return destination ? { destination, expiresAt: value.expiresAt } : null;
}

export function rememberLoginReturn(value: string | LoginDestination) {
  const destination = loginDestination(value);
  if (destination)
    write(loginKey, { destination, expiresAt: Date.now() + lifetime });
  else remove(loginKey);
}

/** Capture old links once, then remove their query/hash without a new history entry. */
export function prepareLoginPage(legacyNext?: string | string[]) {
  if (typeof window === "undefined" || window.location.pathname !== "/login")
    return;
  if (legacyNext !== undefined)
    rememberLoginReturn(
      Array.isArray(legacyNext) ? (legacyNext[0] ?? "") : legacyNext,
    );
  const saved =
    savedDestination(read(loginKey)) ??
    (legacyNext === undefined
      ? savedDestination(window.history.state?.[loginHistoryKey])
      : null);
  const state = { ...window.history.state };
  delete state[loginHistoryKey];
  if (saved) state[loginHistoryKey] = saved;
  window.history.replaceState(state, "", "/login");
}

export function consumeLoginReturn(): LoginDestination {
  const saved =
    savedDestination(read(loginKey)) ??
    (typeof window !== "undefined" && window.location.pathname === "/login"
      ? savedDestination(window.history.state?.[loginHistoryKey])
      : null);
  remove(loginKey);
  if (typeof window !== "undefined") {
    const state = { ...window.history.state };
    delete state[loginHistoryKey];
    window.history.replaceState(state, "");
  }
  return saved?.destination ?? { pathname: "/profile" };
}

export function rememberClubNavigation(flags: ClubNavigation) {
  write(clubKey, {
    ...flags,
    expiresAt: Date.now() + lifetime,
    key: crypto.randomUUID(),
  });
  window.dispatchEvent(new Event(navigationIntentEvent));
}
function savedClubNavigation(value: unknown): SavedClubNavigation | null {
  if (
    !unexpired(value) ||
    !("key" in value) ||
    typeof value.key !== "string" ||
    !("checkout" in value) ||
    typeof value.checkout !== "boolean" ||
    !("paymentReturn" in value) ||
    typeof value.paymentReturn !== "boolean"
  )
    return null;
  return {
    checkout: value.checkout,
    paymentReturn: value.paymentReturn,
    expiresAt: value.expiresAt,
    key: value.key,
  };
}

/** A return hint cannot grant access. Keep it in this entry so reload/back remain usable. */
export function captureClubNavigation(): SavedClubNavigation | null {
  if (window.location.pathname !== "/club") return null;
  const url = new URL(window.location.href);
  const legacy = clubFlags(url.searchParams);
  const explicitFlags =
    url.searchParams.has("checkout") || url.searchParams.has("paid");
  const pending = savedClubNavigation(read(clubKey));
  remove(clubKey);
  const saved =
    legacy.checkout || legacy.paymentReturn
      ? {
          ...legacy,
          expiresAt: Date.now() + lifetime,
          key: crypto.randomUUID(),
        }
      : explicitFlags
        ? null
        : (pending ??
          savedClubNavigation(window.history.state?.[clubHistoryKey]));
  const state = { ...window.history.state };
  delete state[clubHistoryKey];
  if (saved) state[clubHistoryKey] = saved;
  cleanParameters(url);
  window.history.replaceState(state, "", url.pathname + url.search + url.hash);
  return saved;
}

/** Next may carry custom history state forward; hints belong only to their page. */
export function clearOtherPageIntents() {
  const state = { ...window.history.state };
  const url = new URL(window.location.href);
  let changed = false;
  for (const [key, page] of [
    [loginHistoryKey, "/login"],
    [clubHistoryKey, "/club"],
  ]) {
    if (window.location.pathname !== page && key in state) {
      delete state[key];
      changed = true;
    }
  }
  // Login and club capture their recognized state in their own effects first.
  if (appPage(url.pathname) && !["/club", "/login"].includes(url.pathname))
    cleanParameters(url);
  if (url.href !== window.location.href)
    window.history.replaceState(
      state,
      "",
      url.pathname + url.search + url.hash,
    );
  else if (changed) window.history.replaceState(state, "");
}
