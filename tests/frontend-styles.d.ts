// Root SSR tests need only CSS module types, not Next's global Node environment.
declare module "*.module.scss" {
  const classes: { readonly [key: string]: string };
  export default classes;
}
