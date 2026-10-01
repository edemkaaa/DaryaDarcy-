import { useEffect, useRef, useState } from "react";

import { ImageBackground, Pressable, StyleSheet, View, Dimensions } from "react-native";

import { Image } from "expo-image";

import { useRouter } from "expo-router";

import Animated, {

  useSharedValue,

  useAnimatedStyle,

  withTiming,

  Easing,

} from "react-native-reanimated";

import { HOME_PROMO_ASPECT, HOME_PROMO_SLIDES } from "@/shared/home-promo-slides";



const PAPER_TEXTURE_URI =

  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/d0db18ed8f2e-MasrlKbgCBdeyOhE.jpg";



const { width: SCREEN_WIDTH } = Dimensions.get("window");

const CARD_WIDTH = SCREEN_WIDTH - 48;

const CARD_HEIGHT = Math.round(CARD_WIDTH * HOME_PROMO_ASPECT);

/** Pause on each slide before the next crossfade. */

const INTERVAL_MS = 6000;

/** Full crossfade duration (out + in). */

const FADE_MS = 2400;



export function HomePromoCarousel() {

  const router = useRouter();

  const [index, setIndex] = useState(0);

  const opacity = useSharedValue(1);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);



  const slide = HOME_PROMO_SLIDES[index];



  useEffect(() => {

    timerRef.current = setInterval(() => {

      opacity.value = withTiming(0, {

        duration: FADE_MS / 2,

        easing: Easing.inOut(Easing.ease),

      });

      setTimeout(() => {

        setIndex((prev) => (prev + 1) % HOME_PROMO_SLIDES.length);

        opacity.value = withTiming(1, {

          duration: FADE_MS / 2,

          easing: Easing.inOut(Easing.ease),

        });

      }, FADE_MS / 2);

    }, INTERVAL_MS);

    return () => {

      if (timerRef.current) clearInterval(timerRef.current);

    };

  }, [opacity]);



  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));



  return (

    <View style={styles.wrap}>

      <Pressable

        onPress={() => router.push(slide.route as any)}

        style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}

        accessibilityRole="button"

        accessibilityLabel={`Перейти: ${slide.label}`}

      >

        <ImageBackground

          source={{ uri: PAPER_TEXTURE_URI }}

          resizeMode="cover"

          style={styles.card}

          imageStyle={styles.cardPaper}

        >

          <Animated.View style={[styles.imageWrap, fadeStyle]}>

            <Image

              key={slide.id}

              source={slide.image}

              style={styles.image}

              contentFit="contain"

            />

          </Animated.View>

        </ImageBackground>

      </Pressable>

      <View style={styles.dots}>

        {HOME_PROMO_SLIDES.map((item, i) => (

          <View key={item.id} style={[styles.dot, i === index && styles.dotActive]} />

        ))}

      </View>

    </View>

  );

}



const styles = StyleSheet.create({

  wrap: {

    marginHorizontal: 24,

    marginTop: 32,

    marginBottom: 20,

  },

  pressable: {

    alignSelf: "center",

  },

  pressed: {

    opacity: 0.96,

  },

  card: {

    width: CARD_WIDTH,

    height: CARD_HEIGHT,

    overflow: "hidden",

    backgroundColor: "#FDF8F0",

  },

  cardPaper: {

    borderRadius: 0,

  },

  imageWrap: {

    flex: 1,

  },

  image: {

    width: "100%",

    height: "100%",

  },

  dots: {

    flexDirection: "row",

    justifyContent: "center",

    gap: 8,

    marginTop: 12,

  },

  dot: {

    width: 6,

    height: 6,

    borderRadius: 3,

    backgroundColor: "rgba(92, 64, 51, 0.25)",

  },

  dotActive: {

    backgroundColor: "rgba(92, 64, 51, 0.65)",

  },

});


