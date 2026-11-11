/** Локальное расписание не допускает наложения одной задачи и возвращает незавершённые работы для shutdown. */
export type JobName = "publication" | "billing" | "maintenance" | "backup";

export type IntervalJob = Readonly<{
  name: JobName;
  intervalMs: number;
  run: () => void | Promise<void>;
}>;

export type PendingJob = Readonly<{
  name: JobName;
  // Завершённый callback ещё не доказывает успешную доставку внешнего эффекта.
  settled: Promise<void>;
}>;

type JobState = {
  definition: IntervalJob;
  timer?: ReturnType<typeof setInterval>;
  pending?: Promise<void>;
};

const failureMessages: Record<JobName, string> = {
  publication: "[workers] publication failed",
  billing: "[workers] billing failed",
  maintenance: "[workers] maintenance failed",
  backup: "[workers] backup failed",
};

/** Только локальное расписание; распределённая блокировка и срок shutdown находятся выше. */
export class IntervalJobs {
  private phase: "idle" | "running" | "stopped" = "idle";
  private readonly jobs: JobState[];

  /** Создаём независимое локальное состояние каждого задания без запуска таймеров или доменных действий. */
  constructor(jobs: readonly IntervalJob[]) {
    this.jobs = jobs.map((definition) => ({ definition }));
  }

  /** Один раз включаем расписание и запускаем первый тик каждой задачи; повторный start после запуска или остановки ничего не создаёт. */
  start(): void {
    if (this.phase !== "idle") return;
    this.phase = "running";
    for (const job of this.jobs) {
      job.timer = setInterval(
        () => this.launch(job),
        job.definition.intervalMs,
      );
      this.launch(job);
    }
  }

  /** Сначала запрещаем новые запуски, затем возвращаем текущие Promise без отмены выполняемой работы. */
  stop(): readonly PendingJob[] {
    this.phase = "stopped";
    const pending: PendingJob[] = [];
    for (const job of this.jobs) {
      if (job.timer !== undefined) {
        clearInterval(job.timer);
        job.timer = undefined;
      }
      if (job.pending) {
        pending.push({ name: job.definition.name, settled: job.pending });
      }
    }
    return pending;
  }

  /** Не допускаем наложения одинаковой локальной задачи, сохраняем Promise до callback и очищаем его после безопасного логирования ошибки. */
  private launch(job: JobState): void {
    if (this.phase !== "running" || job.pending) return;
    // Запоминаем Promise до вызова кода задачи, чтобы повторный stop увидел и эту работу.
    job.pending = Promise.resolve()
      .then(() => {
        if (this.phase === "running") return job.definition.run();
      })
      .catch(() => console.warn(failureMessages[job.definition.name]))
      .finally(() => {
        job.pending = undefined;
      });
  }
}
