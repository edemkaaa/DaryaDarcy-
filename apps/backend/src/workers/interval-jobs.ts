export type JobName = "publication" | "billing" | "maintenance" | "backup";

export type IntervalJob = Readonly<{
  name: JobName;
  intervalMs: number;
  run: () => void | Promise<void>;
}>;

export type PendingJob = Readonly<{
  name: JobName;
  // Settlement of the callback is not evidence of a successful remote effect.
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

/** Local scheduling only: no distributed lock, retries or shutdown deadline. */
export class IntervalJobs {
  private phase: "idle" | "running" | "stopped" = "idle";
  private readonly jobs: JobState[];

  constructor(jobs: readonly IntervalJob[]) {
    this.jobs = jobs.map((definition) => ({ definition }));
  }

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

  /** Fence timers first, then expose a snapshot; do not cancel in-flight work. */
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

  private launch(job: JobState): void {
    if (this.phase !== "running" || job.pending) return;
    // Own the promise before invoking user code, including a reentrant stop.
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
