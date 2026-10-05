"use client";
import classes from "./audio-player.module.scss";
import { Action, Typography } from "@/shared/ui/elements";
import { useMemo } from "react";
import { useAudioPlayer, useAudioPlayerState } from "@/shared/media/audio";
import MaterialIcons from "@/shared/ui/material-icon";
import { friendlyMediaName } from "@/shared/media/media-label";
const CREAM_BG = "#FDF8F0";
const ACCENT = "#8B7355";
interface AudioPlayerProps {
  url: string;
  filename?: string;
  duration?: number; // seconds
}
// Generate pseudo-random waveform bars for visual effect
function generateWaveform(count: number, seed: string): number[] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  const bars: number[] = [];
  for (let i = 0; i < count; i++) {
    hash = (hash * 1103515245 + 12345) & 0x7fffffff;
    bars.push(0.2 + (hash % 80) / 100); // 0.2 to 1.0
  }
  return bars;
}
export function AudioPlayerCard({ url, filename, duration }: AudioPlayerProps) {
  const player = useAudioPlayer(url);
  const {
    playing: isPlaying,
    starting,
    currentTime,
    duration: actualDuration,
    error,
  } = useAudioPlayerState(player);
  const progress = actualDuration > 0 ? currentTime / actualDuration : 0;
  const WAVEFORM_BARS = 30;
  const waveform = useMemo(() => generateWaveform(WAVEFORM_BARS, url), [url]);
  const togglePlay = () => {
    if (isPlaying || starting) player.pause();
    else void player.play().catch(() => {}); // Player exposes the failure through its event state.
  };
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };
  const displayDuration = duration || (player.duration ? player.duration : 0);
  const displayName = friendlyMediaName(filename, "audio") || "Аудио";
  const activeBarIndex = Math.floor(progress * WAVEFORM_BARS);
  return (
    <div className={["ui-stack ", classes.container].filter(Boolean).join(" ")}>
      <Action
        onClick={togglePlay}
        aria-label={
          starting
            ? "Отменить загрузку аудио"
            : isPlaying
              ? "Приостановить аудио"
              : "Воспроизвести аудио"
        }
        className={({ pressed }) =>
          [
            classes.playButtonActive,
            pressed ? classes.opacityState : "",
            isPlaying
              ? classes.backgroundColorState
              : classes.backgroundColorState2,
          ]
            .filter(Boolean)
            .join(" ")
        }
      >
        <MaterialIcons
          name={isPlaying ? "pause" : "play-arrow"}
          size={22}
          color={CREAM_BG}
        />
      </Action>

      <div className={["ui-stack ", classes.info].filter(Boolean).join(" ")}>
        <Typography lines={1} className={classes.filename}>
          {displayName}
        </Typography>
        {error ? <Typography role="alert">{error}</Typography> : null}
        {/* Waveform visualization */}
        <div
          className={["ui-stack ", classes.waveformContainer]
            .filter(Boolean)
            .join(" ")}
        >
          {waveform.map((height, i) => (
            <div
              key={i}
              style={{
                height: height * 20,
                backgroundColor: i <= activeBarIndex ? ACCENT : "#D8D0C6",
              }}
              className={["ui-stack ", classes.div].filter(Boolean).join(" ")}
            />
          ))}
        </div>
        <div
          className={["ui-stack ", classes.timeRow].filter(Boolean).join(" ")}
        >
          <Typography className={classes.time}>
            {formatTime(currentTime)}
          </Typography>
          <Typography className={classes.time}>
            {formatTime(displayDuration)}
          </Typography>
        </div>
      </div>
    </div>
  );
}
