"use client";
import { Action, Typography } from "@/shared/ui/elements";
export function PostInteractionStatus({
  error,
  retry,
}: {
  error: string | null;
  retry: () => Promise<void>;
}) {
  if (!error) return null;
  return (
    <div role="alert">
      <Typography>{error}</Typography>
      <Action onClick={() => void retry()}>Обновить отметки</Action>
    </div>
  );
}
