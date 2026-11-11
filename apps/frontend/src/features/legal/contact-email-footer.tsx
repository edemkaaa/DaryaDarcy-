"use client";
/** Контакт поддержки открывается явным mailto-действием; подсказка о письме не подтверждает доставку. */
import classes from "./contact-email-footer.module.scss";
import { type CSSProperties, mergeStyles } from "@/shared/ui/css";
import { Typography, Action } from "@/shared/ui/elements";
import { openExternalUrl } from "@/shared/browser/actions";
import { PUBLIC_CONTACT_EMAIL } from "@/shared/config/contact";
type Props = {
  hint?: string;
  style?: CSSProperties;
  className?: string;
};
export function ContactEmailFooter({
  hint = "Если письмо не пришло в течение 15 минут или нужна помощь — напишите нам:",
  style,
  className = "",
}: Props) {
  return (
    <div
      style={mergeStyles(style)}
      className={["ui-stack ", classes.div, className]
        .filter(Boolean)
        .join(" ")}
    >
      <Typography className={classes.hint}>{hint}</Typography>
      <Action
        onClick={() => void openExternalUrl(`mailto:${PUBLIC_CONTACT_EMAIL}`)}
      >
        <Typography className={classes.email}>
          {PUBLIC_CONTACT_EMAIL}
        </Typography>
      </Action>
    </div>
  );
}
