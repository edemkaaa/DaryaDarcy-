"use client";
/** Строка контакта использует общий адрес проекта и сохраняет обычное поведение почтовой ссылки. */
import classes from "./contact-email-line.module.scss";
import { type CSSProperties, mergeStyles } from "@/shared/ui/css";
import { Typography, Action } from "@/shared/ui/elements";
import { openExternalUrl } from "@/shared/browser/actions";
import { PUBLIC_CONTACT_EMAIL } from "@/shared/config/contact";
type Props = {
  prefix?: string;
  style?: CSSProperties;
  className?: string;
  linkStyle?: CSSProperties;
};
/** Встраиваем единый контакт поддержки с необязательным префиксом, не дублируя сам email по экранам. */
export function ContactEmailLine({
  prefix = "Вопросы и поддержка:",
  style,
  className = "",
  linkStyle,
}: Props) {
  return (
    <Typography
      style={mergeStyles(style)}
      className={[className, classes.typography].filter(Boolean).join(" ")}
    >
      {prefix}{" "}
      <Action
        onClick={() => void openExternalUrl(`mailto:${PUBLIC_CONTACT_EMAIL}`)}
      >
        <Typography
          style={mergeStyles(linkStyle)}
          className={classes.typography2}
        >
          {PUBLIC_CONTACT_EMAIL}
        </Typography>
      </Action>
    </Typography>
  );
}
