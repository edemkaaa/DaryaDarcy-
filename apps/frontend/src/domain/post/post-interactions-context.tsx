"use client";
/** Общие состояния лайков и сохранений живут выше карточек: размонтирование карточки не теряет выполняющуюся операцию. */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/domain/session/session-context";
import { OperationScope } from "@/shared/browser/operation-scope";
import { trpc } from "@/shared/api/trpc";
import { createPostInteractionReader } from "./post-interaction-reader";

type InteractionFailure = { message: string; blocked: boolean };

/** Храним batch-reader, scopes, optimistic overrides и ошибки выше карточек; cleanup отзывает все задачи владельца. */
function useInteractionState() {
  const utils = trpc.useUtils();
  const [reader] = useState(() =>
    createPostInteractionReader((postIds, signal) =>
      utils.client.feed.interactionsForPosts.query({ postIds }, { signal }),
    ),
  );
  const [scopes] = useState(() => new Map<string, OperationScope>());
  const [overrides, setOverrides] = useState(new Map<string, boolean>());
  const [pending, setPending] = useState(new Set<string>());
  const [failures, setFailures] = useState(
    new Map<string, InteractionFailure>(),
  );
  useEffect(
    () => () => {
      reader.cancel();
      for (const scope of scopes.values()) scope.cancel();
      scopes.clear();
    },
    [scopes, reader],
  );
  return {
    reader,
    scopes,
    overrides,
    setOverrides,
    pending,
    setPending,
    failures,
    setFailures,
  };
}

const Context = createContext<ReturnType<typeof useInteractionState> | null>(
  null,
);

/** Один экземпляр состояния взаимодействий обслуживает все карточки текущей личности. */
function InteractionStateProvider({ children }: { children: ReactNode }) {
  const state = useInteractionState();
  return <Context.Provider value={state}>{children}</Context.Provider>;
}

/** Смена пользователя пересоздаёт провайдер, а обычная навигация сохраняет текущие операции. */
export function PostInteractionsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { user } = useAuth();
  // Screen navigation preserves operations; changing the owner discards them.
  return (
    <InteractionStateProvider key={user?.id ?? "guest"}>
      {children}
    </InteractionStateProvider>
  );
}

/** Возвращаем общее состояние только внутри провайдера взаимодействий, не создавая независимый кеш карточки. */
export function usePostInteractionState() {
  const state = useContext(Context);
  if (!state) throw new Error("Post interactions provider is missing");
  return state;
}
