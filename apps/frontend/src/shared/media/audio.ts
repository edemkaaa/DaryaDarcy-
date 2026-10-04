"use client";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { BrowserAudioPlayer } from "./browser-audio-player";
export function useAudioPlayer(source: string) {
  const player = useMemo(() => new BrowserAudioPlayer(source), [source]);
  useEffect(() => {
    player.connect();
    return () => player.release();
  }, [player]);
  return player;
}
export function useAudioPlayerState(player: BrowserAudioPlayer) {
  return useSyncExternalStore(
    player.subscribe,
    player.getSnapshot,
    player.getServerSnapshot,
  );
}
export async function setAudioModeAsync(_options: unknown) {}
