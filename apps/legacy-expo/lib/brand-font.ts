/** Licensed Woolen webfont — DARYADARCY wordmark only. */
export const WOOLEN_FONT = "Woolen-Regular";

/** Shop title and author display name. */
export const GOGOL_FONT = "Gogol-Regular";

/** Post/button italic — EB Garamond italic cut (not browser synthetic slant). */
export const READABLE_ITALIC_FONT = "EBGaramond-Italic";

/** Use with READABLE_ITALIC_FONT; font file is already italic — avoid double-slant on web. */
export const READABLE_ITALIC_STYLE = {
  fontFamily: READABLE_ITALIC_FONT,
  fontStyle: "normal" as const,
};
