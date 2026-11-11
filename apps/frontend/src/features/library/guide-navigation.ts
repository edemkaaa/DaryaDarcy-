/** Переходы между разделами гайда используют ограниченный набор ключей эстетик вместо произвольного адреса материала. */
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
