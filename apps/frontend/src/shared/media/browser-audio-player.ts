/** Состояние аудио следует событиям HTMLAudioElement и результату play; отмена ожидания не должна оживлять старый запуск. */
export type AudioSnapshot = {
  playing: boolean;
  starting: boolean;
  currentTime: number;
  duration: number;
  error: string | null;
};
const initial: AudioSnapshot = {
  playing: false,
  starting: false,
  currentTime: 0,
  duration: 0,
  error: null,
};
/** Playback state follows browser events and the play promise, including rejected autoplay. */
export class BrowserAudioPlayer {
  private audio: HTMLAudioElement | null = null;
  private snapshot = initial;
  private listeners = new Set<() => void>();
  private generation = 0;
  private playTimer: ReturnType<typeof setTimeout> | null = null;
  private volumeValue = 1;
  private loopValue = false;
  constructor(
    private source: string,
    private createAudio = (source: string) => new Audio(source),
  ) {}
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getSnapshot = () => this.snapshot;
  getServerSnapshot = () => initial;
  private update(patch: Partial<AudioSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const listener of this.listeners) listener();
  }
  private onChange = () => {
    const audio = this.audio;
    if (!audio) return;
    this.update({
      playing: !audio.paused && !audio.ended,
      currentTime: audio.currentTime || 0,
      duration: Number.isFinite(audio.duration) ? audio.duration : 0,
    });
  };
  private onError = () => {
    this.update({
      playing: false,
      starting: false,
      error:
        "Не удалось воспроизвести аудио. Проверьте соединение и попробуйте ещё раз.",
    });
  };
  private onEnded = () => {
    if (this.audio) this.audio.currentTime = 0;
    this.update({ playing: false, starting: false, currentTime: 0 });
  };
  connect = () => {
    if (this.audio || typeof Audio === "undefined") return;
    const audio = this.createAudio(this.source);
    this.audio = audio;
    audio.volume = this.volumeValue;
    audio.loop = this.loopValue;
    audio.preload = "metadata";
    for (const event of [
      "playing",
      "pause",
      "timeupdate",
      "loadedmetadata",
      "durationchange",
    ])
      audio.addEventListener(event, this.onChange);
    audio.addEventListener("error", this.onError);
    audio.addEventListener("ended", this.onEnded);
  };
  get duration() {
    return this.snapshot.duration;
  }
  get currentTime() {
    return this.snapshot.currentTime;
  }
  get volume() {
    return this.audio?.volume ?? this.volumeValue;
  }
  set volume(value: number) {
    this.volumeValue = Math.max(0, Math.min(1, value));
    if (this.audio) this.audio.volume = this.volumeValue;
  }
  get loop() {
    return this.audio?.loop ?? this.loopValue;
  }
  set loop(value: boolean) {
    this.loopValue = value;
    if (this.audio) this.audio.loop = value;
  }
  async play(): Promise<void> {
    this.connect();
    if (!this.audio) throw new Error("Аудио недоступно");
    if (this.snapshot.starting) return;
    // Позднее завершение play относится к своему запуску и не должно вернуть звук после pause или release.
    const generation = ++this.generation;
    const audio = this.audio;
    // play() alone cannot recover a source left in a native media-error state.
    if (audio.error) audio.load();
    this.update({ starting: true, error: null });
    let timer!: ReturnType<typeof setTimeout>;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error("Аудио не загрузилось вовремя")),
        15_000,
      );
      this.playTimer = timer;
    });
    try {
      await Promise.race([audio.play(), deadline]);
      if (generation !== this.generation || audio !== this.audio) return;
      this.update({ starting: false });
      this.onChange();
    } catch (error) {
      if (generation === this.generation && audio === this.audio) {
        audio.pause();
        this.onError();
      }
      throw error;
    } finally {
      clearTimeout(timer);
      if (this.playTimer === timer) this.playTimer = null;
    }
  }
  pause() {
    if (this.playTimer) clearTimeout(this.playTimer);
    this.playTimer = null;
    this.generation++;
    this.audio?.pause();
    this.update({ playing: false, starting: false });
  }
  seekTo(value: number) {
    if (this.audio) {
      this.audio.currentTime = Math.max(0, value);
      this.onChange();
    }
  }
  // Убираем и обработчики, и src: одного pause недостаточно для освобождения сетевого ресурса.
  release = () => {
    if (this.playTimer) clearTimeout(this.playTimer);
    this.playTimer = null;
    this.generation++;
    const audio = this.audio;
    this.audio = null;
    if (audio) {
      for (const event of [
        "playing",
        "pause",
        "timeupdate",
        "loadedmetadata",
        "durationchange",
      ])
        audio.removeEventListener(event, this.onChange);
      audio.removeEventListener("error", this.onError);
      audio.removeEventListener("ended", this.onEnded);
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    this.update(initial);
  };
}
