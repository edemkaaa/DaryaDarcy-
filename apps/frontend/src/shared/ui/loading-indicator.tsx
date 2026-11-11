/** Индикатор локальной операции использует общую геометрию и доступную текстовую подпись. */
import { Spinner } from "./spinner";

/** One fixed group for access checks and local list operations. */
export function LoadingIndicator({
  size = "large",
  label = "Загрузка…",
}: {
  size?: "small" | "large";
  label?: string;
}) {
  return (
    <div className={`ui-loading-indicator ui-loading-indicator-${size}`}>
      <Spinner size={size} label={label} />
      <span aria-hidden="true">{label}</span>
    </div>
  );
}
