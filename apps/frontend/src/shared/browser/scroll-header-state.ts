/** Направление прокрутки определяем по пройденным пикселям, чтобы частота событий не меняла поведение шапки. */
export class ScrollHeaderState {
  hidden = false;
  private previousY = 0;
  private travel = 0;

  /** Явное раскрытие сбрасывает накопленный путь: восстановленная позиция экрана становится новой базой, а не командой спрятать шапку. */
  reveal(y = 0) {
    this.hidden = false;
    this.previousY = Math.max(0, y);
    this.travel = 0;
  }

  /** Обрезаем Safari rubber-band к границам и накапливаем движение одного направления; разные пороги скрытия/возврата уменьшают дрожание. */
  update(rawY: number, maxY: number): boolean {
    const max = Math.max(0, maxY);
    // Safari reports positions outside both boundaries during rubber-banding.
    const y = Math.min(max, Math.max(0, rawY));
    const delta = y - Math.min(this.previousY, max);
    this.previousY = y;
    if (y <= 8) {
      this.reveal(y);
      return false;
    }
    if (delta === 0) return this.hidden;
    this.travel =
      Math.sign(delta) === Math.sign(this.travel) ? this.travel + delta : delta;
    if (!this.hidden && this.travel >= 12) {
      this.hidden = true;
      this.travel = 0;
    } else if (this.hidden && this.travel <= -8) {
      this.hidden = false;
      this.travel = 0;
    }
    return this.hidden;
  }
}
