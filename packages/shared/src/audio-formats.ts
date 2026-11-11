/** Единый перечень поддерживаемых аудиоформатов и сообщение об ограничениях загрузки. */
/** Browser-playable containers; AAC is accepted in M4A/MP4 rather than raw ADTS. */
export const AUDIO_TYPES: Readonly<Record<string, string>> = {
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  mp4: "audio/mp4",
  wav: "audio/wav",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  opus: "audio/ogg",
  webm: "audio/webm",
  flac: "audio/flac",
};
export const AUDIO_MIMES = [
  ...new Set([...Object.values(AUDIO_TYPES), "audio/x-wav", "audio/x-flac"]),
];
export const AUDIO_FORMAT_MESSAGE =
  "Выберите MP3, M4A, WAV, OGG/Opus, WebM или FLAC. AAC сохраните в M4A.";
