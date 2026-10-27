"use client";
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

function InteractionStateProvider({ children }: { children: ReactNode }) {
  const state = useInteractionState();
  return <Context.Provider value={state}>{children}</Context.Provider>;
}

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

export function usePostInteractionState() {
  const state = useContext(Context);
  if (!state) throw new Error("Post interactions provider is missing");
  return state;
}
