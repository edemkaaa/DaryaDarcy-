"use client";
import classes from "./legal-documents-footer.module.scss";
import { type CSSProperties, mergeStyles } from "@/shared/ui/css";
import { Action, Typography } from "@/shared/ui/elements";
import { Picture } from "@/shared/media/image";
import { useRouter } from "@/shared/navigation/router";
import { FOLDER_IMAGE } from "./legal-documents-footer.content";
type Props = {
  style?: CSSProperties;
  className?: string;
};
export function LegalDocumentsFooter({ style, className = "" }: Props) {
  const router = useRouter();
  return (
    <div
      style={mergeStyles(style)}
      className={["ui-stack ", classes.div, className]
        .filter(Boolean)
        .join(" ")}
    >
      <div className={["ui-stack ", classes.div2].filter(Boolean).join(" ")}>
        <Picture
          source={FOLDER_IMAGE}
          contentFit="contain"
          className={classes.picture}
        />
        <div
          className={["ui-stack ", classes.textOverlay]
            .filter(Boolean)
            .join(" ")}
        >
          <Action
            onClick={() => router.push("/legal")}
            className={({ pressed }) =>
              [classes.linkPressed, pressed ? classes.opacityState : ""]
                .filter(Boolean)
                .join(" ")
            }
          >
            <Typography className={classes.linkLine}>Юридические</Typography>
            <Typography className={classes.linkLine}>документы →</Typography>
          </Action>
          <Action
            onClick={() => router.push("/privacy")}
            className={({ pressed }) =>
              [classes.linkPressed, pressed ? classes.opacityState2 : ""]
                .filter(Boolean)
                .join(" ")
            }
          >
            <Typography className={classes.linkLine}>Политика</Typography>
            <Typography className={classes.linkLine}>
              конфиденциальности →
            </Typography>
          </Action>
        </div>
      </div>
    </div>
  );
}
