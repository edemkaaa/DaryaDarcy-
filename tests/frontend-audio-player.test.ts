/** Состояние BrowserAudioPlayer проверяется управляемым EventTarget Audio, без реального декодирования звука. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { BrowserAudioPlayer } from "../apps/frontend/src/shared/media/browser-audio-player";
class TestAudio extends EventTarget {
  paused = true;
  ended = false;
  currentTime = 0;
  duration = 10;
  volume = 1;
  loop = false;
  preload = "";
  play = vi.fn(async () => {
    this.paused = false;
    this.dispatchEvent(new Event("playing"));
  });
  pause = vi.fn(() => {
    this.paused = true;
    this.dispatchEvent(new Event("pause"));
  });
  removeAttribute = vi.fn();
  load = vi.fn();
}
let audio: TestAudio;
let player: BrowserAudioPlayer;
/** Соединяем новый player с отдельным синтетическим audio и стандартными событиями play/pause. */
beforeEach(() => {
  audio = new TestAudio();
  vi.stubGlobal("Audio", TestAudio);
  player = new BrowserAudioPlayer(
    "https://example.test/audio.mp3",
    () => audio as unknown as HTMLAudioElement,
  );
  player.connect();
});
/** Освобождаем player и глобальный Audio после сценария. */
afterEach(() => {
  player.release();
  vi.unstubAllGlobals();
});
/** Autoplay denial снимает starting/playing и показывает возможность повторной попытки. */
it("a rejected play promise leaves playback stopped and exposes a recoverable error", async () => {
  audio.play.mockRejectedValue(new Error("Autoplay denied"));
  await expect(player.play()).rejects.toThrow("Autoplay denied");
  expect(player.getSnapshot()).toMatchObject({
    playing: false,
    starting: false,
    error: expect.stringContaining("Не удалось воспроизвести"),
  });
});
/** Не обрываем последние доли секунды; reset позиции происходит только по ended. */
it("plays the final half-second and resets its real position only on ended", async () => {
  await player.play();
  audio.currentTime = 9.8;
  audio.dispatchEvent(new Event("timeupdate"));
  expect(player.getSnapshot()).toMatchObject({
    playing: true,
    currentTime: 9.8,
  });
  audio.ended = true;
  audio.dispatchEvent(new Event("ended"));
  expect(audio.currentTime).toBe(0);
  expect(player.getSnapshot()).toMatchObject({
    playing: false,
    currentTime: 0,
  });
});
/** Явный volume=0 не заменяется fallback-значением. */
it("preserves an explicitly muted volume", () => {
  player.volume = 0;
  expect(player.volume).toBe(0);
  expect(audio.volume).toBe(0);
});
/** Поздний resolve play после release не возобновляет звук и не возвращает src. */
it("a late play completion cannot revive a released player", async () => {
  let release!: () => void;
  audio.play.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  const playing = player.play();
  player.release();
  release();
  await playing;
  expect(player.getSnapshot()).toMatchObject({
    playing: false,
    starting: false,
  });
  expect(audio.removeAttribute).toHaveBeenCalledWith("src");
  expect(audio.load).toHaveBeenCalled();
});
/** Повторное connect использует новый audio; события старого экземпляра больше не меняют snapshot. */
it("Strict Mode cleanup allows a new connection and ignores events from the old audio", async () => {
  const old = audio;
  player.release();
  audio = new TestAudio();
  player.connect();
  old.currentTime = 7;
  old.dispatchEvent(new Event("timeupdate"));
  expect(player.currentTime).toBe(0);
  await player.play();
  expect(player.getSnapshot().playing).toBe(true);
});

/** Зависший play завершается по 15-секундному deadline, ставит pause и допускает явный новый play. */
it("a stalled play has a deadline and can be retried", async () => {
  vi.useFakeTimers();
  audio.play.mockImplementationOnce(() => new Promise<void>(() => {}));
  const pending = expect(player.play()).rejects.toThrow(
    "не загрузилось вовремя",
  );
  await vi.advanceTimersByTimeAsync(15_001);
  await pending;
  expect(player.getSnapshot()).toMatchObject({
    starting: false,
    playing: false,
    error: expect.any(String),
  });
  expect(audio.pause).toHaveBeenCalled();
  vi.useRealTimers();
  await player.play();
  expect(player.getSnapshot().playing).toBe(true);
});
