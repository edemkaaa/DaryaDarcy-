import classes from "./legal-screen.module.scss";

import { ScrollArea } from "@/shared/ui/elements";
import Link from "next/link";
import { ScreenContainer } from "@/shared/ui/screen-container";
import { LEGAL_HUB_LINKS } from "@/features/legal/legal-documents";
export default function LegalHubScreen() {
  return (
    <ScreenContainer backgroundColor="#FDF8F0">
      <ScrollArea contentClassName={classes.scroll}>
        <span className={`ui-text ${classes.kicker}`}>DARYADARCY</span>
        <h1 className={`ui-text ${classes.title}`}>Юридические документы</h1>
        <span className={`ui-text ${classes.subtitle}`}>
          Клуб Darcy · daryadarcy.com
        </span>
        <Link href="/privacy" className={`ui-action ${classes.linkRow}`}>
          <span className={`ui-text ${classes.linkText}`}>
            Политика конфиденциальности
          </span>
          <span className={`ui-text ${classes.arrow}`}>→</span>
        </Link>
        {LEGAL_HUB_LINKS.map((item) => (
          <Link
            key={item.slug}
            href={`/legal/${item.slug}`}
            className={`ui-action ${classes.linkRow}`}
          >
            <span className={`ui-text ${classes.linkText}`}>{item.label}</span>
            <span className={`ui-text ${classes.arrow}`}>→</span>
          </Link>
        ))}
      </ScrollArea>
    </ScreenContainer>
  );
}
