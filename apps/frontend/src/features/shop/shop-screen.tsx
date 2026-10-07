"use client";
import { useViewport } from "@/shared/browser/viewport";

import classes from "./shop-screen.module.scss";
import { cssTransform } from "@/shared/ui/css";
import { Action, Typography, Background } from "@/shared/ui/elements";
import { ShelfLabel } from "./shelf-label";
import { ShelfItem } from "./shelf-item";
import { Picture } from "@/shared/media/image";
import { useRouter, useFocusEffect } from "@/shared/navigation/router";
import { useCallback } from "react";
import { MaterialIcons } from "@/shared/ui/icons";
import Animated, {
  useSharedValue,
  cancelAnimation,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  useAnimatedScrollHandler,
  interpolate,
  Extrapolation,
  type SharedValue,
} from "@/shared/browser/motion";
import { LinearGradient } from "@/shared/ui/gradient";
import { ContactEmailFooter } from "@/features/legal/contact-email-footer";
import { LegalDocumentsFooter } from "@/features/legal/legal-documents-footer";
import { pressableProps } from "@/shared/browser/press";
import {
  PAPER_TEXTURE_URI,
  SHOP_BROWN,
  PRODUCTS,
  ASSETS,
  BOOK_GAP,
} from "./shop-screen.content";
import { getShopScreenContent } from "./shop-screen.content";
import type { Product } from "./shop-screen.content";
function ShopScreenInner() {
  const viewport = useViewport();
  const {
    SCREEN_WIDTH,
    SHELF_SIDE,
    BOOK_WIDTH,
    DIGITAL_SIDE,
    HOUSE_WIDTH,
    HOUSE_HEIGHT,
    LABEL_WIDTH,
    LABEL_HEIGHT,
  } = getShopScreenContent(viewport);

  const router = useRouter();
  const books = PRODUCTS.filter((p) => p.type === "book");
  const digitals = PRODUCTS.filter((p) => p.type === "digital");
  const handleProductPress = (product: Product) => {
    router.push(`/shop/${product.id}`);
  };
  // ─── Scroll-reactive cinematic dust & light beam ────────────────────────────
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.currentTarget.scrollTop;
    },
  });
  // Autonomous looping values for base drift (16 motes total)
  const dustLoop1 = useSharedValue(0);
  const dustLoop2 = useSharedValue(0);
  const dustLoop3 = useSharedValue(0);
  const dustLoop4 = useSharedValue(0);
  const dustLoop5 = useSharedValue(0);
  const dustLoop6 = useSharedValue(0);
  const dustLoop7 = useSharedValue(0);
  const dustLoop8 = useSharedValue(0);
  const dustLoop9 = useSharedValue(0);
  const dustLoop10 = useSharedValue(0);
  const dustLoop11 = useSharedValue(0);
  const dustLoop12 = useSharedValue(0);
  const dustLoop13 = useSharedValue(0);
  const dustLoop14 = useSharedValue(0);
  const dustLoop15 = useSharedValue(0);
  const dustLoop16 = useSharedValue(0);
  const lightPulse = useSharedValue(0);
  useFocusEffect(
    useCallback(() => {
      // Light beam slow pulse
      lightPulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 6000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 6000, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false,
      );
      // Autonomous gentle loops for each mote (base drift when not scrolling)
      dustLoop1.value = withRepeat(
        withTiming(1, { duration: 8000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
      dustLoop2.value = withRepeat(
        withTiming(1, { duration: 10000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
      dustLoop3.value = withRepeat(
        withTiming(1, { duration: 7000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
      dustLoop4.value = withRepeat(
        withTiming(1, { duration: 9000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
      dustLoop5.value = withRepeat(
        withTiming(1, { duration: 11000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
      dustLoop6.value = withRepeat(
        withTiming(1, { duration: 7500, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
      dustLoop7.value = withRepeat(
        withTiming(1, { duration: 9500, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
      dustLoop8.value = withRepeat(
        withTiming(1, { duration: 12000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
      dustLoop9.value = withRepeat(
        withTiming(1, { duration: 8500, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
      dustLoop10.value = withRepeat(
        withTiming(1, { duration: 10500, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
      dustLoop11.value = withRepeat(
        withTiming(1, { duration: 9200, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
      dustLoop12.value = withRepeat(
        withTiming(1, { duration: 7800, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
      dustLoop13.value = withRepeat(
        withTiming(1, { duration: 11500, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
      dustLoop14.value = withRepeat(
        withTiming(1, { duration: 8800, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
      dustLoop15.value = withRepeat(
        withTiming(1, { duration: 10200, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
      dustLoop16.value = withRepeat(
        withTiming(1, { duration: 6800, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
      return () =>
        [
          lightPulse,
          dustLoop1,
          dustLoop2,
          dustLoop3,
          dustLoop4,
          dustLoop5,
          dustLoop6,
          dustLoop7,
          dustLoop8,
          dustLoop9,
          dustLoop10,
          dustLoop11,
          dustLoop12,
          dustLoop13,
          dustLoop14,
          dustLoop15,
          dustLoop16,
        ].forEach(cancelAnimation);
    }, [
      lightPulse,
      dustLoop1,
      dustLoop2,
      dustLoop3,
      dustLoop4,
      dustLoop5,
      dustLoop6,
      dustLoop7,
      dustLoop8,
      dustLoop9,
      dustLoop10,
      dustLoop11,
      dustLoop12,
      dustLoop13,
      dustLoop14,
      dustLoop15,
      dustLoop16,
    ]),
  );
  // Light beam reacts to scroll - gets brighter AND shifts position when scrolling
  const lightBeamStyle = useAnimatedStyle(() => {
    const baseOpacity = interpolate(lightPulse.value, [0, 1], [0.1, 0.22]);
    const scrollBoost = interpolate(
      scrollY.value,
      [0, 200, 500],
      [0, 0.08, 0.12],
      Extrapolation.CLAMP,
    );
    // Beam gently shifts right and down as user scrolls (like sunlight moving)
    const beamShiftX = interpolate(
      scrollY.value,
      [0, 500, 1500],
      [0, 15, 40],
      Extrapolation.CLAMP,
    );
    const beamShiftY = interpolate(
      scrollY.value,
      [0, 500, 1500],
      [0, 10, 25],
      Extrapolation.CLAMP,
    );
    return {
      opacity: baseOpacity + scrollBoost,
      transform: cssTransform([
        { translateX: beamShiftX },
        { translateY: beamShiftY },
      ]),
    };
  });
  // Helper: each mote combines autonomous loop + scroll-driven displacement
  const useDustStyle = (
    loop: SharedValue<number>,
    baseY: number,
    baseX: number,
    scrollMult: number,
    opacityRange: [number, number],
  ) => {
    return useAnimatedStyle(() => {
      const loopY = loop.value * baseY;
      const loopX = loop.value * baseX;
      const scrollDisplace = scrollY.value * scrollMult;
      const opacity = interpolate(
        loop.value,
        [0, 0.3, 0.7, 1],
        [opacityRange[0], opacityRange[1], opacityRange[1], opacityRange[0]],
      );
      return {
        opacity,
        transform: cssTransform([
          { translateY: loopY + scrollDisplace },
          { translateX: loopX + scrollDisplace * 0.3 },
        ]),
      };
    });
  };
  const dustStyle1 = useDustStyle(dustLoop1, 30, 15, 0.08, [0.3, 0.9]);
  const dustStyle2 = useDustStyle(dustLoop2, 40, 20, 0.06, [0.2, 0.8]);
  const dustStyle3 = useDustStyle(dustLoop3, 25, 18, 0.1, [0.25, 0.85]);
  const dustStyle4 = useDustStyle(dustLoop4, 35, 12, 0.07, [0.2, 0.75]);
  const dustStyle5 = useDustStyle(dustLoop5, 45, 22, 0.05, [0.15, 0.7]);
  const dustStyle6 = useDustStyle(dustLoop6, 28, 16, 0.09, [0.3, 0.85]);
  const dustStyle7 = useDustStyle(dustLoop7, 38, 14, 0.07, [0.2, 0.8]);
  const dustStyle8 = useDustStyle(dustLoop8, 50, 25, 0.04, [0.15, 0.65]);
  const dustStyle9 = useDustStyle(dustLoop9, 32, 19, 0.08, [0.25, 0.9]);
  const dustStyle10 = useDustStyle(dustLoop10, 42, 21, 0.06, [0.2, 0.75]);
  const dustStyle11 = useDustStyle(dustLoop11, 33, 17, 0.07, [0.2, 0.8]);
  const dustStyle12 = useDustStyle(dustLoop12, 27, 22, 0.09, [0.25, 0.85]);
  const dustStyle13 = useDustStyle(dustLoop13, 48, 13, 0.05, [0.15, 0.7]);
  const dustStyle14 = useDustStyle(dustLoop14, 36, 20, 0.08, [0.3, 0.9]);
  const dustStyle15 = useDustStyle(dustLoop15, 29, 16, 0.06, [0.2, 0.75]);
  const dustStyle16 = useDustStyle(dustLoop16, 22, 24, 0.1, [0.25, 0.85]);
  const TAG_W = SCREEN_WIDTH * 0.24;
  const TAG_H = TAG_W * 0.72;
  // Pivot at string hole near top of tag artwork
  const PIVOT_OFFSET = TAG_H * 0.1;
  const priceTag2000Style = useAnimatedStyle(() => {
    const swing = interpolate(
      scrollY.value % 600,
      [0, 150, 300, 450, 600],
      [0, 1.5, 0, -1.5, 0],
      Extrapolation.CLAMP,
    );
    return {
      transform: cssTransform([
        { translateY: PIVOT_OFFSET },
        { rotate: `${17 + swing}deg` },
        { translateY: -PIVOT_OFFSET },
      ]),
    };
  });
  const priceTag1000Style = useAnimatedStyle(() => {
    const swing = interpolate(
      scrollY.value % 600,
      [0, 150, 300, 450, 600],
      [0, -1.5, 0, 1.5, 0],
      Extrapolation.CLAMP,
    );
    return {
      transform: cssTransform([
        { translateY: PIVOT_OFFSET },
        { rotate: `${-17 + swing}deg` },
        { translateY: -PIVOT_OFFSET },
      ]),
    };
  });
  // New shelf image aspect ratio: 1021:3118
  const SHELF_ASPECT = 1021 / 3118;
  const shelfImageHeight = SCREEN_WIDTH / SHELF_ASPECT;
  // Shelf plank positions (as fraction of new image height 3118px):
  const SHELF2_PLANK_BOTTOM = shelfImageHeight * 0.395;
  const SHELF3_PLANK_BOTTOM = shelfImageHeight * 0.585;
  const SHELF4_PLANK_BOTTOM = shelfImageHeight * 0.785;
  // Metal nameplates sit on the shelf front edge (торец), not below it
  // Front lip of the shelf plank (below book bottoms), not on the book spines
  const shelfLabelTop = (plankBottom: number) =>
    plankBottom - LABEL_HEIGHT * 0.05;
  const digitalInner = SCREEN_WIDTH - DIGITAL_SIDE * 2;
  const digitalGap = (digitalInner - BOOK_WIDTH * 2) / 3;
  const digitalCenter0 = DIGITAL_SIDE + digitalGap + BOOK_WIDTH / 2;
  const digitalCenter1 =
    DIGITAL_SIDE + digitalGap * 2 + BOOK_WIDTH + BOOK_WIDTH / 2;
  const shelf3LabelTop = shelfLabelTop(SHELF3_PLANK_BOTTOM);
  // Price tags on left/right edges of nameplates (see shop mockup)
  const nameplateLeft = (cx: number) => cx - LABEL_WIDTH / 2;
  const nameplateRight = (cx: number) => cx + LABEL_WIDTH / 2;
  const PRICE_TAG_EDGE_OVERLAP = TAG_W * 0.2;
  const PRICE_TAG_TOP = shelf3LabelTop + LABEL_HEIGHT - TAG_H * 0.72;
  const PRICE_TAG_LEFT_0 =
    nameplateLeft(digitalCenter0) - TAG_W + PRICE_TAG_EDGE_OVERLAP;
  const PRICE_TAG_LEFT_1 =
    nameplateRight(digitalCenter1) - PRICE_TAG_EDGE_OVERLAP;
  // Section label positions (on back wall, above items):
  const SECTION_LABEL_SHELF2_TOP = shelfImageHeight * 0.23;
  const SECTION_LABEL_SHELF3_TOP = shelfImageHeight * 0.44;
  // Title position - in the herbs area at top
  const TITLE_TOP = shelfImageHeight * 0.04;
  return (
    <div className={["ui-stack ", classes.container].filter(Boolean).join(" ")}>
      {/* Scrollable shelf with books positioned on planks */}
      <Animated.ScrollArea
        aria-label="Магазин"
        hideScrollbar
        onScroll={scrollHandler}
        contentClassName={classes.scrollAreacontent}
      >
        {/* Shelf background image with books overlaid */}
        <div
          style={{ width: SCREEN_WIDTH, height: shelfImageHeight }}
          className={["ui-stack ", classes.div2].filter(Boolean).join(" ")}
        >
          <Picture
            source={{ uri: ASSETS.shelfBg }}
            contentFit="cover"
            transition={400}
            className={classes.picture}
          />

          {/* Cinematic light beam from top-left corner - scroll-reactive */}
          <Animated.div style={lightBeamStyle} className={classes.div3}>
            <LinearGradient
              colors={[
                "rgba(218, 185, 130, 0.45)",
                "rgba(200, 170, 110, 0.18)",
                "rgba(180, 150, 90, 0.06)",
                "transparent",
              ]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0.65, y: 0.5 }}
              className={classes.picture}
            />
          </Animated.div>

          {/* 10 floating dust motes - scroll-reactive, in the light beam zone */}
          <div
            className={["ui-stack ", classes.div4].filter(Boolean).join(" ")}
          >
            {/* Mote 1 - large, warm amber */}
            <Animated.div style={dustStyle1} className={classes.div5} />
            {/* Mote 2 - medium, golden */}
            <Animated.div style={dustStyle2} className={classes.div6} />
            {/* Mote 3 - small, warm ochre */}
            <Animated.div style={dustStyle3} className={classes.div7} />
            {/* Mote 4 - deep gold, upper area */}
            <Animated.div style={dustStyle4} className={classes.div8} />
            {/* Mote 5 - honey, mid-beam */}
            <Animated.div style={dustStyle5} className={classes.div9} />
            {/* Mote 6 - near basket, bright */}
            <Animated.div style={dustStyle6} className={classes.div10} />
            {/* Mote 7 - drifts in mid zone */}
            <Animated.div style={dustStyle7} className={classes.div11} />
            {/* Mote 8 - large, lower beam edge */}
            <Animated.div style={dustStyle8} className={classes.div12} />
            {/* Mote 9 - tiny, high in beam */}
            <Animated.div style={dustStyle9} className={classes.div13} />
            {/* Mote 10 - accent, mid-left */}
            <Animated.div style={dustStyle10} className={classes.div14} />
            {/* Mote 11 - upper right zone */}
            <Animated.div style={dustStyle11} className={classes.div15} />
            {/* Mote 12 - near beam center */}
            <Animated.div style={dustStyle12} className={classes.div16} />
            {/* Mote 13 - lower left drift */}
            <Animated.div style={dustStyle13} className={classes.div17} />
            {/* Mote 14 - bright tiny near top */}
            <Animated.div style={dustStyle14} className={classes.div18} />
            {/* Mote 15 - mid beam, subtle */}
            <Animated.div style={dustStyle15} className={classes.div19} />
            {/* Mote 16 - far edge, faint */}
            <Animated.div style={dustStyle16} className={classes.div20} />
          </div>

          {/* "МАГАЗИН" title text - replaces old sign image */}
          <div
            style={{ top: TITLE_TOP }}
            className={["ui-stack ", classes.div21].filter(Boolean).join(" ")}
          >
            <Typography className={classes.typography}>МАГАЗИН</Typography>
          </div>

          {/* Section label "Печатные книги" on shelf 2 back wall */}
          <div
            style={{ top: SECTION_LABEL_SHELF2_TOP }}
            className={["ui-stack ", classes.div22].filter(Boolean).join(" ")}
          >
            <Typography className={classes.typography2}>
              Печатные книги
            </Typography>
          </div>

          {/* Section label "Электронные продукты" on shelf 3 back wall */}
          <div
            style={{ top: SECTION_LABEL_SHELF3_TOP }}
            className={["ui-stack ", classes.div22].filter(Boolean).join(" ")}
          >
            <Typography className={classes.typography2}>
              Электронные продукты
            </Typography>
          </div>

          {/* Books row - 3 printed books on shelf 2 */}
          <div
            style={{
              bottom: shelfImageHeight - SHELF2_PLANK_BOTTOM,
              paddingLeft: SHELF_SIDE,
              paddingRight: SHELF_SIDE,
            }}
            className={["ui-stack ", classes.div23].filter(Boolean).join(" ")}
          >
            {books.map((book) => (
              <ShelfItem
                key={book.id}
                product={book}
                onClick={() => handleProductPress(book)}
              />
            ))}
          </div>

          {/* Labels on shelf 2 plank edge */}
          {(() => {
            const labels = [
              "Книга Вдохновения",
              "Тропинка к Творчеству",
              "Романтика Дачи",
            ];
            const labelTop = shelfLabelTop(SHELF2_PLANK_BOTTOM);
            return labels.map((text, i) => {
              const isMiddle = i === 1;
              const labelW = isMiddle ? LABEL_WIDTH * 1.12 : LABEL_WIDTH;
              const center =
                SHELF_SIDE + i * (BOOK_WIDTH + BOOK_GAP) + BOOK_WIDTH / 2;
              return (
                <div
                  key={text}
                  style={{ top: labelTop, left: center - labelW / 2 }}
                  className={["ui-stack ", classes.div24]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <ShelfLabel
                    text={text}
                    style={{
                      ...((isMiddle ? true : false)
                        ? { width: isMiddle ? labelW : undefined }
                        : {}),
                    }}
                  />
                </div>
              );
            });
          })()}

          {/* Digital products row - 2 items on shelf 3 */}
          <div
            style={{
              bottom: shelfImageHeight - SHELF3_PLANK_BOTTOM + 4,
              paddingLeft: DIGITAL_SIDE,
              paddingRight: DIGITAL_SIDE,
            }}
            className={["ui-stack ", classes.div25].filter(Boolean).join(" ")}
          >
            {digitals.map((digital) => (
              <ShelfItem
                key={digital.id}
                product={digital}
                onClick={() => handleProductPress(digital)}
              />
            ))}
          </div>

          {/* Labels on shelf 3 plank edge */}
          {[
            { text: "Пособие", cx: digitalCenter0 },
            { text: "Мастер-класс", cx: digitalCenter1 },
          ].map((label) => (
            <div
              key={label.text}
              style={{ top: shelf3LabelTop, left: label.cx - LABEL_WIDTH / 2 }}
              className={["ui-stack ", classes.div26].filter(Boolean).join(" ")}
            >
              <ShelfLabel text={label.text} />
            </div>
          ))}

          {/* Price tags on shelf 3 — flank nameplate left/right edges */}
          <Action
            aria-label="Открыть пособие"
            disabled={!digitals[0]}
            {...pressableProps(() => {
              if (digitals[0]) handleProductPress(digitals[0]);
            })}
            onPointerDown={() => {}}
            style={{ top: PRICE_TAG_TOP, left: PRICE_TAG_LEFT_0 }}
            className={classes.action2}
          >
            <Animated.div style={priceTag2000Style}>
              <Picture
                source={{ uri: ASSETS.priceTag2000 }}
                style={{ width: TAG_W, height: TAG_H }}
                contentFit="contain"
              />
            </Animated.div>
          </Action>
          <Action
            aria-label="Открыть мастер-класс"
            disabled={!digitals[1]}
            {...pressableProps(() => {
              if (digitals[1]) handleProductPress(digitals[1]);
            })}
            onPointerDown={() => {}}
            style={{ top: PRICE_TAG_TOP, left: PRICE_TAG_LEFT_1 }}
            className={classes.action2}
          >
            <Animated.div style={priceTag1000Style}>
              <Picture
                source={{ uri: ASSETS.priceTag1000 }}
                style={{ width: TAG_W, height: TAG_H }}
                contentFit="contain"
              />
            </Animated.div>
          </Action>

          {/* Decorative house on shelf 4 - positioned to the right */}
          <div
            style={{
              bottom: shelfImageHeight - SHELF4_PLANK_BOTTOM + 10,
              right: SCREEN_WIDTH * 0.08,
            }}
            className={["ui-stack ", classes.div27].filter(Boolean).join(" ")}
          >
            <Picture
              source={{ uri: ASSETS.house }}
              style={{ width: HOUSE_WIDTH, height: HOUSE_HEIGHT }}
              contentFit="contain"
              transition={300}
            />
          </div>
        </div>

        {/* Footer — paper background to match the rest of the app */}
        <Background
          source={{ uri: PAPER_TEXTURE_URI }}
          fit="cover"
          className={classes.footerPaper}
        >
          <div
            className={["ui-stack ", classes.footerNote]
              .filter(Boolean)
              .join(" ")}
          >
            <MaterialIcons name="local-shipping" size={15} color={SHOP_BROWN} />
            <Typography className={classes.footerNoteText}>
              Доставка по всей России через маркетплейсы
            </Typography>
          </div>
          <ContactEmailFooter className={classes.contactEmailFooter} />
          <LegalDocumentsFooter className={classes.legalDocumentsFooter} />
        </Background>
      </Animated.ScrollArea>
    </div>
  );
}
export default function ShopScreen() {
  return (
    <div className="ui-stack ">
      <ShopScreenInner />
    </div>
  );
}
