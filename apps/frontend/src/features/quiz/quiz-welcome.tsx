"use client";
import { useViewport } from "@/shared/browser/viewport";

import { getQuizWelcomeLayout } from "./quiz-welcome.layout";
import classes from "./quiz-welcome.module.scss";

import {
  Background,
  ScrollArea,
  Action,
  Typography,
} from "@/shared/ui/elements";
import { Picture } from "@/shared/media/image";
import { ScreenContainer } from "@/shared/ui/screen-container";
import { useQuiz } from "@/domain/quiz/quiz-state";

import { useRouter } from "@/shared/navigation/router";
import { PAPER_TEXTURE_URI } from "./quiz-welcome.content";
export function QuizWelcome() {
  const router = useRouter();
  const viewport = useViewport();
  const { stylesLayout } = getQuizWelcomeLayout(viewport);

  const { dispatch } = useQuiz();
  const handleStart = () => {
    dispatch({ type: "START_QUIZ" });
  };
  return (
    <ScreenContainer edges={["top", "left", "right", "bottom"]}>
      <Background
        source={{ uri: PAPER_TEXTURE_URI }}
        fit="cover"
        className={classes.background}
      >
        <ScrollArea hideScrollbar contentClassName={classes.scrollContent}>
          {/* Back link — above collage, left aligned */}
          <Action
            onClick={() => router.back()}
            activeOpacity={0.7}
            className={classes.backButton}
          >
            <Typography className={classes.backText}>← Назад</Typography>
          </Action>

          {/* Floating collage on app background */}
          <div
            style={{
              width: stylesLayout.collageContainer.width,
              height: stylesLayout.collageContainer.height,
            }}
            className={["ui-stack ", classes.collageContainer]
              .filter(Boolean)
              .join(" ")}
          >
            <Picture
              source={{ uri: "/assets/quiz/start-collage.webp" }}
              contentFit="contain"
              className={classes.collageImage}
            />
          </div>

          {/* Title — EB Garamond Bold, brown, caps */}
          <Typography className={classes.title}>ТЕСТ-ПУТЕШЕСТВИЕ:</Typography>
          <Typography className={classes.subtitle}>
            найди свою эстетику
          </Typography>

          {/* Description */}
          <div
            className={["ui-stack ", classes.descriptionContainer]
              .filter(Boolean)
              .join(" ")}
          >
            <Typography className={classes.typography}>
              Закрой глаза. Представь: ты лежишь на мягкой траве, сквозь ветви
              пробивается свет. Просыпаешься, и начинается странствие.
            </Typography>
            <Typography className={classes.typography}>
              Семь миров будут открываться перед тобой. Пейзажи, текстуры,
              существа, артефакты — выбирай то, что зовёт.
            </Typography>
            <Typography className={classes.typography}>
              В конце ты узнаешь свою эстетику — не просто название, а глубокий
              портрет: к чему тянется твоя душа и как проявлять это в жизни
              каждый день.
            </Typography>

            {/* Info cards */}
            <div
              className={["ui-stack ", classes.infoRow]
                .filter(Boolean)
                .join(" ")}
            >
              <div
                className={["ui-stack ", classes.div].filter(Boolean).join(" ")}
              >
                <Typography className={classes.typography2}>10</Typography>
                <Typography className={classes.typography3}>
                  вопросов
                </Typography>
              </div>
              <div
                className={["ui-stack ", classes.div].filter(Boolean).join(" ")}
              >
                <Typography className={classes.typography2}>7</Typography>
                <Typography className={classes.typography3}>эстетик</Typography>
              </div>
              <div
                className={["ui-stack ", classes.div].filter(Boolean).join(" ")}
              >
                <Typography className={classes.typography2}>5</Typography>
                <Typography className={classes.typography3}>мин</Typography>
              </div>
            </div>
          </div>

          {/* Start Button */}
          <Action
            onClick={handleStart}
            activeOpacity={0.8}
            className={classes.action}
          >
            <Typography className={classes.startButtonText}>
              Начать путешествие
            </Typography>
          </Action>
        </ScrollArea>
      </Background>
    </ScreenContainer>
  );
}
