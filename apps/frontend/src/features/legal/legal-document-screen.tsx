/** Универсальная страница выводит разделы выбранного документа React-элементами и отдельно показывает приложенную иллюстрацию. */
import classes from "./legal-document-screen.module.scss";

import { ScrollArea } from "@/shared/ui/elements";
import { Picture } from "@/shared/media/image";
import { ScreenContainer } from "@/shared/ui/screen-container";
import type { LegalDocument } from "@/features/legal/legal-documents";
type Props = {
  document: LegalDocument;
};
/** Отображаем статический документ и необязательную иллюстрацию структурированными React-элементами без исполнения HTML. */
export function LegalDocumentScreen({ document }: Props) {
  return (
    <ScreenContainer backgroundColor="#FDF8F0">
      <ScrollArea contentClassName={classes.scroll}>
        <span className={`ui-text ${classes.kicker}`}>DARYADARCY</span>
        <h1 className={`ui-text ${classes.title}`}>{document.title}</h1>
        <span className={`ui-text ${classes.date}`}>
          Клуб Darcy · {document.date}
        </span>
        {document.imageUrl ? (
          <Picture
            source={{ uri: document.imageUrl }}
            style={{ width: "100%", maxWidth: 480, aspectRatio: "1 / 1.35" }}
            contentFit="contain"
            aria-label={document.title}
            className={classes.picture}
          />
        ) : null}
        {document.sections.map((section) => (
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
