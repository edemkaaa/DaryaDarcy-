/** Расширение типов cookie для используемой сервером библиотеки; исполняемого кода нет. */
declare module "cookie" {
  export function parse(str: string, options?: Record<string, unknown>): Record<string, string>;
}
