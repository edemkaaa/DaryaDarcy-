"use client";
/** Хук владеет экземпляром браузерного плеера и освобождает его при завершении жизни соответствующего экрана. */
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { BrowserAudioPlayer } from "./browser-audio-player";
import { useScreenActive } from "@/shared/navigation/screen-activity";
/** Создаём плеер на источник; эффект подключает DOM-аудио и освобождает его при смене URL или размонтировании, скрытый экран ставит на паузу. */
export function useAudioPlayer(source: string) {
  const active = useScreenActive();
  const player = useMemo(() => new BrowserAudioPlayer(source), [source]);
  useEffect(() => {
    player.connect();
    return () => player.release();
  }, [player]);
  useEffect(() => {
    if (!active) player.pause();
  }, [active, player]);
  return player;
}
/** Подписываем React на согласованный snapshot плеера, используя пустое стабильное состояние при серверном рендеринге. */
export function useAudioPlayerState(player: BrowserAudioPlayer) {
  return useSyncExternalStore(
    player.subscribe,
    player.getSnapshot,
    player.getServerSnapshot,
  );
}
/** Сохраняем совместимый вызов настройки аудио; в браузере дополнительных глобальных режимов здесь не устанавливаем. */
export async function setAudioModeAsync(_options: unknown) {}
