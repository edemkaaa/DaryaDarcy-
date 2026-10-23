import classes from "./privacy-screen.module.scss";

import { ScrollArea } from "@/shared/ui/elements";
import Link from "next/link";
import { ScreenContainer } from "@/shared/ui/screen-container";
import { SECTIONS } from "./privacy-screen.content";
export default function PrivacyScreen() {
  return (
    <ScreenContainer backgroundColor="#FDF8F0">
      <ScrollArea contentClassName={classes.scroll}>
        <span className={`ui-text ${classes.kicker}`}>DARYADARCY</span>
        <h1 className={`ui-text ${classes.title}`}>
          Политика конфиденциальности{"\n"}и Условия использования
        </h1>
        <span className={`ui-text ${classes.date}`}>
          Клуб Darcy · 17 августа 2026 г.
        </span>
        <Link
          href="/legal"
          prefetch={false}
          className={`ui-action ${classes.legalLink}`}
        >
          <span className={`ui-text ${classes.legalLinkText}`}>
            Все юридические документы →
          </span>
        </Link>
        {SECTIONS.map((section) => (
          <div
            key={section.title}
            className={["ui-stack ", classes.block].filter(Boolean).join(" ")}
          >
            <span className={`ui-text ${classes.heading}`}>
              {section.title}
            </span>
            {section.body.map((paragraph) => (
              <span key={paragraph} className={`ui-text ${classes.body}`}>
                {paragraph}
              </span>
            ))}
          </div>
        ))}
      </ScrollArea>
    </ScreenContainer>
  );
}
