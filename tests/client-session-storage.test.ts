import { afterEach, beforeEach, expect, it, vi } from "vitest";

const device = vi.hoisted(() => ({ OS: "web" }));
const secure = vi.hoisted(() => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));
vi.mock("react-native", () => ({ Platform: device }));
vi.mock("expo-secure-store", () => secure);
vi.mock("../apps/frontend/constants/oauth", () => ({
  SESSION_TOKEN_KEY: "app_session_token",
  USER_INFO_KEY: "daryadarcy-user-info",
}));
import * as Auth from "../apps/frontend/lib/_core/auth";

const profile: Auth.User = {
  id: 1,
  openId: "PRIVATE_PROFILE",
  name: "Member",
  email: "private@example.test",
  phone: null,
  loginMethod: "email",
  gender: null,
  avatarUrl: null,
  lastSignedIn: new Date(),
  role: "user",
};
let values: Map<string, string>;
let storage: {
  getItem: ReturnType<typeof vi.fn>;
  setItem: ReturnType<typeof vi.fn>;
  removeItem: ReturnType<typeof vi.fn>;
};
beforeEach(async () => {
  device.OS = "web";
  values = new Map();
  storage = {
    getItem: vi.fn((key) => values.get(key) ?? null),
    setItem: vi.fn((key, value) => {
      values.set(key, value);
    }),
    removeItem: vi.fn((key) => {
      values.delete(key);
    }),
  };
  vi.stubGlobal("window", { localStorage: storage });
  vi.clearAllMocks();
  await Auth.clearUserInfo();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("does not reuse a legacy browser token as a Bearer credential", async () => {
  values.set("app_session_token", "PRIVATE_SESSION");
  expect(await Auth.getSessionToken()).toBeNull();
  expect(values.has("app_session_token")).toBe(false);
});
it("does not persist a newly issued browser token or invoke native storage", async () => {
  await Auth.setSessionToken("PRIVATE_SESSION");
  expect(values.has("app_session_token")).toBe(false);
  expect(storage.setItem).not.toHaveBeenCalled();
  expect(secure.setItemAsync).not.toHaveBeenCalled();
});
it("keeps the web profile in memory and removes legacy personal data", async () => {
  values.set("daryadarcy-user-info", JSON.stringify(profile));
  expect(await Auth.getUserInfo()).toBeNull();
  expect(values.has("daryadarcy-user-info")).toBe(false);
  await Auth.setUserInfo(profile);
  expect(await Auth.getUserInfo()).toEqual(profile);
  expect(storage.setItem).not.toHaveBeenCalled();
  await Auth.clearUserInfo();
  expect(await Auth.getUserInfo()).toBeNull();
});
it("continues cookie-only web auth if local storage is unavailable", async () => {
  storage.removeItem.mockImplementation(() => {
    throw new Error("PRIVATE_STORAGE_ERROR");
  });
  await expect(
    Auth.setSessionToken("PRIVATE_SESSION"),
  ).resolves.toBeUndefined();
  expect(await Auth.getSessionToken()).toBeNull();
});
it("preserves native SecureStore credentials and profile lifecycle", async () => {
  device.OS = "ios";
  secure.getItemAsync.mockImplementation(async (key: string) =>
    key === "app_session_token" ? "PRIVATE_SESSION" : JSON.stringify(profile),
  );
  await Auth.setSessionToken("PRIVATE_SESSION");
  expect(secure.setItemAsync).toHaveBeenCalledWith(
    "app_session_token",
    "PRIVATE_SESSION",
  );
  expect(await Auth.getSessionToken()).toBe("PRIVATE_SESSION");
  await Auth.setUserInfo(profile);
  expect(secure.setItemAsync).toHaveBeenCalledWith(
    "daryadarcy-user-info",
    JSON.stringify(profile),
  );
  expect((await Auth.getUserInfo())?.email).toBe(profile.email);
  await Auth.removeSessionToken();
  await Auth.clearUserInfo();
  expect(secure.deleteItemAsync).toHaveBeenCalledWith("app_session_token");
  expect(secure.deleteItemAsync).toHaveBeenCalledWith("daryadarcy-user-info");
});
it("does not log cached personal data or storage exception contents", async () => {
  const logs = vi.spyOn(console, "log").mockImplementation(() => {});
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  await Auth.setUserInfo(profile);
  await Auth.getUserInfo();
  device.OS = "android";
  secure.getItemAsync.mockRejectedValue(new Error("PRIVATE_STORAGE_ERROR"));
  expect(await Auth.getSessionToken()).toBeNull();
  expect(
    JSON.stringify([...logs.mock.calls, ...errors.mock.calls]),
  ).not.toMatch(/PRIVATE_|private@example/);
});
