/** Индикатор локальной операции использует общую геометрию и доступную текстовую подпись. */
import { Spinner } from "./spinner";

/** Согласуем размер индикатора и подпись: диктор читает label из Spinner, видимый текст помечен как декоративный. Группа предназначена для проверки доступа и локальных операций списка. */
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
