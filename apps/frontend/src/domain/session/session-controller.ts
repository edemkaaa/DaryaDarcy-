import * as Api from "@/shared/api/auth";
import {
  ApiError,
  getRequestErrorMessage,
  isTemporaryRequestError,
} from "@/shared/api/errors";

export type SessionStatus =
  | "checking"
  | "authenticated"
  | "guest"
  | "error"
  | "logging-out"
  | "logout-error";
export type SessionState = {
  status: SessionStatus;
  user: Api.AuthUser | null;
  error: Error | null;
  refreshError: Error | null;
  scope: number;
};
type Dependencies = {
  getMe: typeof Api.getMe;
  logout: typeof Api.logout;
  resetIdentity: (userId: number | null) => void;
  broadcast: () => void;
  setLogoutPending: (pending: boolean) => void;
};

/** Owns ordering of identity operations independently of screen mounting and query refetches. */
export class SessionController {
  private state: SessionState = {
    status: "checking",
    user: null,
    error: null,
    refreshError: null,
    scope: 0,
  };
  private listeners = new Set<() => void>();
  private operation = 0;
  private pending: AbortController | null = null;
  private authenticating = false;
  private refreshing = false;
  private confirmedIdentity: string | null = null;
  constructor(private dependencies: Dependencies) {}
  getSnapshot = (): SessionState => this.state;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(state: SessionState): void {
    this.state = state;
    for (const listener of this.listeners) listener();
  }
  private begin() {
    this.pending?.abort();
    this.pending = new AbortController();
    return { version: ++this.operation, signal: this.pending.signal };
  }
  private commit(
    user: Api.AuthUser | null,
    status: SessionStatus,
    error: Error | null = null,
  ): void {
    const nextId = status === "authenticated" ? user?.id : null;
    const confirmed = status === "authenticated" || status === "guest";
    const nextIdentity =
      status === "authenticated" && user ? `${user.id}:${user.role}` : null;
    const changed = confirmed && this.confirmedIdentity !== nextIdentity;
    if (
      changed ||
      ((status === "error" || status === "checking") &&
        this.state.user !== null) ||
      (status === "authenticated" && this.state.status !== "authenticated")
    )
      this.dependencies.resetIdentity(nextId ?? null);
    if (confirmed) this.confirmedIdentity = nextIdentity;
    this.publish({
      user,
      status,
      error,
      refreshError: null,
      scope: this.state.scope + (changed ? 1 : 0),
    });
  }
  refresh = async (force = false): Promise<void> => {
    if (
      this.state.status === "logging-out" ||
      this.state.status === "logout-error"
    )
      return;
    if (!force && (this.authenticating || this.refreshing)) return;
    const background =
      this.state.status === "guest" || this.state.status === "authenticated";
    const task = this.begin();
    this.refreshing = true;
    if (force) this.authenticating = false;
    // Retrying an already closed session must not replace its error screen or
    // clear public queries. Access is reset only when an identity is lost.
    if (!background && this.state.status !== "error")
      this.publish({ ...this.state, status: "checking", error: null });
    try {
      const user = await this.dependencies.getMe(task.signal);
      if (task.version !== this.operation) return;
      this.commit(user, user ? "authenticated" : "guest");
    } catch (error) {
      if (task.version !== this.operation) return;
      if (error instanceof ApiError && [401, 403].includes(error.status))
        this.commit(null, "guest");
      else if (background && isTemporaryRequestError(error))
        this.publish({
          ...this.state,
          refreshError: new Error(getRequestErrorMessage(error)),
        });
      else this.commit(null, "error", new Error(getRequestErrorMessage(error)));
    } finally {
      if (task.version === this.operation) {
        this.pending = null;
        this.refreshing = false;
      }
    }
  };
  /** Re-read after an acknowledged write, superseding only older reads for its owner. */
  refreshAfterMutation = async (ownerId: number): Promise<void> => {
    // A write must not deduplicate against a pre-write read, but it also must
    // never cancel a login or revive an owner whose access has already closed.
    if (
      this.authenticating ||
      this.state.status !== "authenticated" ||
      this.state.user?.id !== ownerId
    )
      return;
    await this.refresh(true);
  };
  authenticate = async (
    request: (signal: AbortSignal) => Promise<{ user: Api.AuthUser }>,
  ): Promise<boolean> => {
    if (this.authenticating) return false;
    if (["logging-out", "logout-error"].includes(this.state.status))
      throw new Error("Сначала подтвердите выход из предыдущего аккаунта.");
    const task = this.begin();
    this.authenticating = true;
    this.refreshing = false;
    try {
      const result = await request(task.signal);
      if (task.version !== this.operation) return false;
      this.commit(Api.parseAuthUser(result.user), "authenticated");
      this.dependencies.broadcast();
      return true;
    } catch (error) {
      if (task.version !== this.operation) return false;
      if (this.state.status === "checking") this.commit(null, "guest");
      throw error;
    } finally {
      if (task.version === this.operation) {
        this.pending = null;
        this.authenticating = false;
      }
    }
  };
  applySession = async (user: Api.AuthUser | null): Promise<void> => {
    if (["logging-out", "logout-error"].includes(this.state.status)) return;
    this.begin();
    this.authenticating = false;
    this.refreshing = false;
    this.commit(
      user ? Api.parseAuthUser(user) : null,
      user ? "authenticated" : "guest",
    );
  };
  invalidateAccess = (resetScreens = true): void => {
    if (this.state.status !== "authenticated") return;
    this.dependencies.resetIdentity(this.state.user?.id ?? null);
    if (resetScreens)
      this.publish({ ...this.state, scope: this.state.scope + 1 });
  };
  verifyAfterAccessError = (status: 401 | 403): void => {
    if (this.state.status !== "authenticated") return;
    // A 403 can mean insufficient permission while the session remains valid.
    if (status === 403) {
      void this.refresh();
      return;
    }
    this.commit(null, "checking");
    void this.refresh(true);
  };
  completeExternalLogout = (): void => {
    if (
      this.state.status !== "logging-out" &&
      this.state.status !== "logout-error"
    )
      return;
    this.begin();
    this.publish({
      ...this.state,
      status: "guest",
      user: null,
      error: null,
      refreshError: null,
    });
  };
  logout = async (): Promise<void> => {
    if (this.state.status === "logging-out") return;
    const task = this.begin();
    this.authenticating = false;
    this.refreshing = false;
    this.dependencies.setLogoutPending(true);
    this.confirmedIdentity = null;
    // Clear local identity immediately. Server completion remains a separate state.
    this.dependencies.resetIdentity(null);
    this.publish({
      user: null,
      status: "logging-out",
      error: null,
      refreshError: null,
      scope: this.state.scope + 1,
    });
    this.dependencies.broadcast();
    try {
      await this.dependencies.logout(task.signal);
      if (task.version !== this.operation) return;
      this.dependencies.setLogoutPending(false);
      this.publish({ ...this.state, status: "guest" });
      this.dependencies.broadcast();
    } catch {
      if (task.version !== this.operation) return;
      this.publish({
        ...this.state,
        status: "logout-error",
        error: new Error(
          "Локальный доступ закрыт. Не удалось подтвердить выход на сервере. Повторите выход.",
        ),
      });
    } finally {
      if (task.version === this.operation) this.pending = null;
    }
  };
  dispose = (): void => {
    this.operation++;
    this.pending?.abort();
    this.pending = null;
    this.refreshing = false;
    this.authenticating = false;
  };
}
