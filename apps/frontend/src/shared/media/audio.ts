"use client";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { BrowserAudioPlayer } from "./browser-audio-player";
import { useScreenActive } from "@/shared/navigation/screen-activity";
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
export function useAudioPlayerState(player: BrowserAudioPlayer) {
  return useSyncExternalStore(
    player.subscribe,
    player.getSnapshot,
    player.getServerSnapshot,
  );
}
export async function setAudioModeAsync(_options: unknown) {}
