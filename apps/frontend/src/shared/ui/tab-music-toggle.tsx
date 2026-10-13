"use client";
import classes from "./tab-music-toggle.module.scss";
import { Action } from "@/shared/ui/elements";
import { useEffect, useId, useState } from "react";
import { MaterialIcons } from "@/shared/ui/icons";
import { useAudioPlayer, useAudioPlayerState } from "@/shared/media/audio";
import { Spinner } from "./spinner";
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
  const [showLoading, setShowLoading] = useState(false);
  const [attemptedPlayer, setAttemptedPlayer] = useState<typeof player | null>(
    null,
  );
  const showError = Boolean(error && attemptedPlayer === player);
  const errorId = useId();
  useEffect(() => {
    setShowLoading(false);
    if (!starting) return;
    // Fast starts keep the familiar icon; only a noticeable wait shows a spinner.
    const timer = setTimeout(() => setShowLoading(true), 600);
    return () => clearTimeout(timer);
  }, [starting, player]);
  useEffect(() => {
    if (player) {
      player.loop = true;
      player.volume = volume;
    }
  }, [player, volume]);
  const toggle = () => {
    setAttemptedPlayer(player);
    if (isPlaying || starting) player.pause();
    else void player.play().catch(() => {});
  };
  const label = starting
    ? "Отменить загрузку музыки"
    : isPlaying
      ? "Выключить музыку"
      : showError
        ? "Повторить загрузку музыки"
        : "Включить музыку";
  return (
    <div className={classes.container}>
      <Action
        onClick={toggle}
        aria-label={label}
        aria-pressed={isPlaying}
        aria-busy={starting}
        aria-describedby={showError ? errorId : undefined}
        title={label}
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
        {starting && showLoading ? (
          <span aria-hidden="true">
            <Spinner size={18} color={iconColor} label="Загрузка музыки" />
          </span>
        ) : (
          <MaterialIcons
            name={isPlaying ? "music-note" : "music-off"}
            size={18}
            color={iconColor}
          />
        )}
      </Action>
      {showError && (
        <div id={errorId} role="alert" className={classes.notice}>
          Музыка не загрузилась. Нажмите ещё раз, чтобы повторить.
        </div>
      )}
    </div>
  );
}
