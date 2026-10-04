"use client";
import classes from "./tab-music-toggle.module.scss";
import { Action } from "@/shared/ui/elements";
import { useEffect } from "react";
import { MaterialIcons } from "@/shared/ui/icons";
import { useAudioPlayer, useAudioPlayerState } from "@/shared/media/audio";
interface TabMusicToggleProps {
  url: string;
  iconColor?: string;
  volume?: number;
}
export function TabMusicToggle({
  url,
  iconColor = "#FFFFFF",
  volume = 0.3,
}: TabMusicToggleProps) {
  const player = useAudioPlayer(url);
  const { playing: isPlaying, starting, error } = useAudioPlayerState(player);
  useEffect(() => {
    if (player) {
      player.loop = true;
      player.volume = volume;
    }
  }, [player, volume]);
  const toggle = () => {
    if (isPlaying || starting) player.pause();
    else void player.play().catch(() => {});
  };
  return (
    <Action
      onClick={toggle}
      aria-label={error ?? (isPlaying ? "Выключить музыку" : "Включить музыку")}
      title={error ?? undefined}
      className={({ pressed }) =>
        [
          classes.buttonActive,
          isPlaying ? classes.appearanceState : classes.appearanceState2,
          pressed ? classes.opacityState : classes.opacityState2,
        ]
          .filter(Boolean)
          .join(" ")
      }
    >
      <MaterialIcons
        name={isPlaying ? "music-note" : "music-off"}
        size={18}
        color={iconColor}
      />
    </Action>
  );
}
