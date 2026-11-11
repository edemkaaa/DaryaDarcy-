/** Типы форматированных фрагментов, диапазонов и выделения, общие для редактора и сервера. */
export interface RichTextInline {
  text: string;
  bold?: boolean;
  italic?: boolean;
  link?: string;
}

export interface RichTextBlock {
  type: "paragraph" | "heading";
  children: RichTextInline[];
}
