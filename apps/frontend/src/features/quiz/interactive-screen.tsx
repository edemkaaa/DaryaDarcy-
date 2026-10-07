"use client";
import { InteractiveBanner } from "./interactive-banner";
import classes from "./interactive-screen.module.scss";
import {
  Background,
  ScrollArea,
  Typography,
  Action,
} from "@/shared/ui/elements";
import { Picture } from "@/shared/media/image";
import { MaterialIcons } from "@/shared/ui/icons";
import { ScreenContainer } from "@/shared/ui/screen-container";

import { useRouter } from "@/shared/navigation/router";
import Animated, { FadeInDown } from "@/shared/browser/motion";
import { PAPER_TEXTURE_URI } from "./interactive-screen.content";
const quizCover = { uri: "/assets/interactive/quiz-cover.jpg" };
export default function InteractiveScreen() {
  const router = useRouter();
  return (
    <ScreenContainer>
      <Background
        source={{ uri: PAPER_TEXTURE_URI }}
        fit="cover"
        className={classes.background}
      >
        <ScrollArea hideScrollbar contentClassName={classes.scrollContent}>
          {/* Header: key + title + subtitle + ivy */}
          <InteractiveBanner />

          {/* Cards - elevated zIndex so they cover ivy tails */}
          <div
            className={["ui-stack ", classes.cardsContainer]
              .filter(Boolean)
              .join(" ")}
          >
            {/* Card 1: Тест-путешествие */}
            <Animated.div
              entering={FadeInDown.duration(500).delay(200)}
              className={classes.card}
            >
              <Action
                onClick={() => router.push("/quiz")}
                className={({ pressed }) =>
                  [classes.action, pressed ? classes.opacityState : ""]
                    .filter(Boolean)
                    .join(" ")
                }
              >
                <Picture
                  source={quizCover}
                  contentFit="cover"
                  className={classes.cardImage}
                />
                {/* Icon + Title on bottom-left */}
                <div
                  className={["ui-stack ", classes.cardBottomLeft]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <MaterialIcons
                    name="auto-stories"
                    size={20}
                    color="#FFFFFF"
                  />
                  <Typography className={classes.cardTitle}>
                    ТЕСТ-ПУТЕШЕСТВИЕ
                  </Typography>
                </div>
                {/* Button on bottom-right */}
                <div
                  className={["ui-stack ", classes.cardBottomRight]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <div
                    className={["ui-stack ", classes.cardButton]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <Typography className={classes.cardButtonText}>
                      Начать →
                    </Typography>
                  </div>
                </div>
              </Action>
              {/* Description below image */}
              <div
                className={["ui-stack ", classes.cardDescriptionContainer]
                  .filter(Boolean)
                  .join(" ")}
              >
                <Typography className={classes.cardDescription}>
                  Узнай свою эстетику через атмосферное путешествие по сказочным
                  мирам
                </Typography>
              </div>
            </Animated.div>
          </div>
        </ScrollArea>
      </Background>
    </ScreenContainer>
  );
}
