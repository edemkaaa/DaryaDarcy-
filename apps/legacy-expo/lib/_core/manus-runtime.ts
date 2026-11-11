// Архив Expo. Пишет только диагностический текст с меткой времени при DEBUG; секреты через этот helper передавать нельзя.
/**
 * Manus Runtime - Communication layer between Expo web app and parent container (next-agent-webapp)
 *
 * Simplified flow:
 * 1. initManusRuntime() called
 * 2. Send 'appDevServerReady' to parent to signal app is ready
 *
 * User will manually login via the app's login page - no automatic cookie injection.
 */

import { Platform } from "react-native";
import type { Metrics } from "react-native-safe-area-context";

// Debug logging with timestamps
const DEBUG = true;
const log = (msg: string) => {
  // Пишет только диагностический текст с меткой времени при DEBUG; секреты через этот helper передавать нельзя.

  if (!DEBUG) return;
  const ts = new Date().toISOString();
  console.log(`[ManusRuntime ${ts}] ${msg}`);
};

type MessageType = "appDevServerReady";
type SafeAreaInsets = { top: number; right: number; bottom: number; left: number };
type SafeAreaCallback = (metrics: Metrics) => void;

interface SpacePreviewerMessage {
  type: "SpacePreviewerChannel";
  payload: {
    type: string;
    from: "container" | "content";
    to: "container" | "content";
    payload: Record<string, unknown>;
  };
}

function isInIframe(): boolean {
  // Определяет вложенный web-контекст с безопасным fallback при cross-origin доступе.

  if (Platform.OS !== "web") return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function isWeb(): boolean {
  // Отделяет браузерный канал postMessage от native runtime.

  return Platform.OS === "web";
}

function sendToParent(type: MessageType, payload: Record<string, unknown> = {}): void {
  // Посылает только служебный ready-payload в исторический preview; wildcard origin не подходит для передачи секретов.

  // NOTE: Validate parent origin if we need to transfer sensitive data
  if (!isWeb() || !isInIframe()) return;

  const message: SpacePreviewerMessage = {
    type: "SpacePreviewerChannel",
    payload: { type, from: "content", to: "container", payload },
  };
  window.parent.postMessage(message, "*");
  log(`Sent to parent: ${type}`);
}

let initialized = false;
let safeAreaCallback: SafeAreaCallback | null = null;

function isValidInsets(payload: Record<string, unknown>): payload is SafeAreaInsets {
  // Проверяет числовую форму четырёх полей inset, не удостоверяя отправителя сообщения.

  return (
    typeof payload.top === "number" &&
    typeof payload.bottom === "number" &&
    typeof payload.left === "number" &&
    typeof payload.right === "number"
  );
}

function handleMessage(event: MessageEvent<unknown>): void {
  // Принимает старое сообщение safe-area и уведомляет подписчика; origin/source здесь исторически не проверяются.

  // NOTE: Validate event.origin if we need to transfer sensitive data
  const data = event.data as SpacePreviewerMessage | undefined;
  if (!data || data.type !== "SpacePreviewerChannel") return;

  const { payload } = data;
  if (!payload || payload.to !== "content") return;

  if (payload.type === "setSafeAreaInsets" && isValidInsets(payload.payload) && safeAreaCallback) {
    const insets = payload.payload;
    const frame = { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };
    safeAreaCallback({ insets, frame });
    log(
      `Received safe area insets from parent: top=${insets.top}, bottom=${insets.bottom}, left=${insets.left}, right=${insets.right}`,
    );
  }
}

/**
 * Subscribe to safe area updates from the parent container.
 */
export function subscribeSafeAreaInsets(callback: SafeAreaCallback): () => void {
  // Сохраняет единственного подписчика и снимает только собственную подписку при cleanup.

  safeAreaCallback = callback;
  return () => {
    if (safeAreaCallback === callback) {
      safeAreaCallback = null;
    }
  };
}

/**
 * Initialize Manus Runtime - just notifies parent that app is ready
 */
export function initManusRuntime(): void {
  // Регистрирует обработчик один раз и сообщает parent готовность, не подставляя cookie автоматически.

  if (!isWeb() || !isInIframe()) return;
  if (initialized) return;
  initialized = true;

  log("initManusRuntime called");
  window.addEventListener("message", handleMessage);
  sendToParent("appDevServerReady", {});
}

/**
 * Check if running inside preview iframe
 */
export function isRunningInPreviewIframe(): boolean {
  // Совмещает платформенную и iframe-проверки для старого режима preview.

  return isWeb() && isInIframe();
}
