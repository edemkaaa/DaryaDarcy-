/** Положение главы измеряем относительно прокручиваемой области: загрузка предыдущих иллюстраций может сдвинуть цель. */
export function scrollToGuideSection(
  container: HTMLDivElement,
  section: HTMLDivElement,
) {
  // Earlier chapters can move without changing this section's own size.
  const top =
    container.scrollTop +
    section.getBoundingClientRect().top -
    container.getBoundingClientRect().top -
    container.clientTop -
    20;
  container.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
}
