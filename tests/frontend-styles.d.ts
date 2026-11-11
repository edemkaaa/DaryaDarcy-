/** Test-only тип CSS-модуля: позволяет компилировать UI assertions; не задаёт реальные стили или bundler loader. */
// Root SSR tests need only CSS module types, not Next's global Node environment.
declare module "*.module.scss" {
  const classes: { readonly [key: string]: string };
  export default classes;
}
