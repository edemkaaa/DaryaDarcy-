// Архив Expo. Совмещает короткое название с прозрачной рамкой, сохраняя геометрию торца полки.
import { useEffect } from "react";
import {
  Text,
  View,
  Pressable,
  StyleSheet,
  Dimensions,
  Platform,
  ImageBackground,
} from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  useAnimatedScrollHandler,
  interpolate,
  Extrapolation,
  type SharedValue,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { TabFocusGate } from "@/components/tab-focus-gate";
import { ContactEmailFooter } from "@/components/contact-email-footer";
import { LegalDocumentsFooter } from "@/components/legal-documents-footer";
import { GOGOL_FONT, READABLE_ITALIC_FONT } from "@/lib/brand-font";
import { pressableProps } from "@/lib/ios-web-press";
import * as Haptics from "expo-haptics";

const PAPER_TEXTURE_URI =
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/d0db18ed8f2e-MasrlKbgCBdeyOhE.jpg";
const SHOP_BROWN = "#5C4033";

// ─── Product Data ───────────────────────────────────────────────────────────

interface Product {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  price: string;
  imageUrl: string;
  type: "book" | "digital";
  links: { name: string; url: string }[];
}

const PRODUCTS: Product[] = [
  {
    id: "book-1",
    title: "Книга Вдохновения",
    subtitle: "Сезонные рецепты, стиль и идеи домашнего декора",
    description:
      "Путеводитель по миру Slow Living. Сезонные рецепты, стиль, идеи домашнего декора и вдохновение на каждый день.",
    price: "",
    imageUrl:
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/24c37be76c6e-lURmCnSESVWSORUh.webp",
    type: "book",
    links: [
      {
        name: "Wildberries",
        url: "https://www.wildberries.ru/catalog/41571054/detail.aspx?size=83497342",
      },
    ],
  },
  {
    id: "book-2",
    title: "Тропинка к Творчеству",
    subtitle: "Рукотворная уютная жизнь",
    description:
      "Новая книга от Дарьи Дарси о рукотворной уютной жизни. Вдохновение, творчество и красота в каждом дне.",
    price: "",
    imageUrl:
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/02ac70f42cc6-RleAncWBrOTmRsWP.webp",
    type: "book",
    links: [
      {
        name: "Wildberries",
        url: "https://www.wildberries.ru/catalog/583300940/detail.aspx?size=797386247",
      },
    ],
  },
  {
    id: "book-3",
    title: "Романтика Дачи",
    subtitle: "Традиции прошлого и уютная загородная жизнь",
    description:
      "Книга о загородной жизни, традициях прошлого, детских воспоминаниях и уютной загородной жизни настоящего.",
    price: "",
    imageUrl:
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/61940224ff85-PbhSAqAqJmSvelQW.webp",
    type: "book",
    links: [
      {
        name: "Wildberries",
        url: "https://www.wildberries.ru/catalog/149198904/detail.aspx?size=250442622",
      },
    ],
  },
  {
    id: "digital-1",
    title: "Пособие по атмосферной фотографии",
    subtitle: "Создаём атмосферные фотографии",
    description:
      "Подробное пособие о том, как создавать атмосферные, тёплые фотографии в стиле cottagecore. Обработка, свет, композиция.",
    price: "",
    imageUrl:
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/f74380dbb7e5-LhJhOevOxDNnKdkT.webp",
    type: "digital",
    links: [],
  },
  {
    id: "digital-2",
    title: "Винтажные книги и открытки",
    subtitle: "Мастер-класс по дизайну обложек",
    description:
      "Мастер-класс по созданию винтажных обложек для книг и открыток. Дизайн, типографика, иллюстрации в стиле daryadarcy.",
    price: "",
    imageUrl:
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/78b61d3f13ad-ecZVWefzXRwRboPv.webp",
    type: "digital",
    links: [],
  },
];

// ─── Asset URLs ─────────────────────────────────────────────────────────────

const ASSETS = {
  // User's Photoshop shelf background (1021x3118)
  shelfBg:
    "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/ed5c0d6e67b1-XTxEeqUQaizDpkGL.jpg",
  // Decorative Tudor house figurine (transparent bg)
  house:
    "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/b010b81b5866-rvMvDhDknWfcKisy.webp",
  // Metal label frame for shelf edge (wide version)
  labelFrame:
    "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/cloudfront/afae02aa817a-shelf-label-frame-wide-iUo6pePUPBamyiM9D5NVtE.webp",
  // Price tags (user-provided with transparent bg)
  priceTag2000:
    "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/e197a59fb5c3-qFGLTXCnSORlpLhB.webp",
  priceTag1000:
    "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/98ab8fafc475-UumiPOEfgzXJXOMx.webp",
};

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Keep every cover fully inside the wood posts, sitting on the plank.
const SHELF_SIDE = Math.round(SCREEN_WIDTH * 0.072);
const BOOK_GAP = 8;
const BOOK_WIDTH = Math.floor((SCREEN_WIDTH - SHELF_SIDE * 2 - BOOK_GAP * 2) / 3);
const BOOK_HEIGHT = BOOK_WIDTH * 1.36;
const DIGITAL_SIDE = Math.round(SCREEN_WIDTH * 0.18);

// House sizing
const HOUSE_WIDTH = SCREEN_WIDTH * 0.42;
const HOUSE_HEIGHT = HOUSE_WIDTH * 0.75;

// Label sizing for shelf edge (frame image aspect 2688:1152 ~ 2.33:1)
const LABEL_WIDTH = SCREEN_WIDTH * 0.21;
const LABEL_HEIGHT = LABEL_WIDTH / 2.33;

// ─── Shelf Label Component ─────────────────────────────────────────────────

function ShelfLabel({ text, style }: { text: string; style?: any }) {
  // Совмещает короткое название с прозрачной рамкой, сохраняя геометрию торца полки.

  return (
    <View
      style={[
        {
          width: LABEL_WIDTH,
          height: LABEL_HEIGHT,
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      <Image
        source={{ uri: ASSETS.labelFrame }}
        style={StyleSheet.absoluteFillObject}
        contentFit="fill"
      />
      <Text
        style={{
          fontFamily: "EBGaramond-Regular",
          fontSize: 7,
          color: "#5C3D2E",
          textAlign: "center",
          paddingHorizontal: 2,
        }}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.4}
      >
        {text}
      </Text>
    </View>
  );
}

// ─── Layout constants for new shelf (1021x3118) ─────────────────────────────
// Top section (herbs/basket/pouches): 0% - ~20%
// Shelf 1 plank bottom: ~20%
// Shelf 2 back wall (printed books): ~20% - ~41%
// Shelf 2 plank bottom: ~41%
// Shelf 3 back wall (digital products): ~41% - ~61.5%
// Shelf 3 plank bottom: ~61.5%
// Shelf 4 back wall (house): ~61.5% - ~78.5%
// Shelf 4 plank bottom: ~78.5%
// Drawers: ~78.5% - 100%

// ─── Animated Book Item ─────────────────────────────────────────────────────

function ShelfItem({
  product,
  onPress,
  width,
  height,
  style,
}: {
  product: Product;
  onPress: () => void;
  width?: number;
  height?: number;
  style?: any;
}) {
  // Показывает книгу без обрезки, добавляет press-анимацию и Apple-web fallback перехода.

  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    // Уменьшает книгу при нажатии и даёт native haptic.

    scale.value = withTiming(0.93, { duration: 100 });
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const handlePressOut = () => {
    // Возвращает исходный масштаб книги после отпускания.

    scale.value = withTiming(1, { duration: 150 });
  };

  return (
    <Pressable
      {...pressableProps(onPress)}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[{ alignItems: "center" }, style]}
    >
      <Animated.View style={[animatedStyle, { alignItems: "center" }]}>
        <Image
          source={{ uri: product.imageUrl }}
          style={{
            width: width || BOOK_WIDTH,
            height: height || BOOK_HEIGHT,
          }}
          contentFit="contain"
          transition={300}
        />
      </Animated.View>
    </Pressable>
  );
}

// ─── Main Screen ────────────────────────────────────────────────────────────

function ShopScreenInner() {
  // Располагает статические товары по измеренным долям фоновой полки; свет/пылинки декоративны и не перехватывают жесты.

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const books = PRODUCTS.filter((p) => p.type === "book");
  const digitals = PRODUCTS.filter((p) => p.type === "digital");

  const handleProductPress = (product: Product) => {
    // Открывает карточку выбранного товара по стабильному строковому id.

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push(`/shop/${product.id}` as any);
  };


  // ─── Scroll-reactive cinematic dust & light beam ────────────────────────────
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      // Передаёт scroll offset в shared value для свечения, пыли и качания ценников на UI-потоке.

      scrollY.value = event.contentOffset.y;
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

  useEffect(() => {
    // Запускает постоянные UI-анимации пульса света и 16 разных циклов пыли; отдельный cancelAnimation cleanup в архиве отсутствует.

    // Light beam slow pulse
    lightPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 6000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 6000, easing: Easing.inOut(Easing.ease) })
      ), -1, false
    );

    // Autonomous gentle loops for each mote (base drift when not scrolling)
    dustLoop1.value = withRepeat(withTiming(1, { duration: 8000, easing: Easing.inOut(Easing.ease) }), -1, true);
    dustLoop2.value = withRepeat(withTiming(1, { duration: 10000, easing: Easing.inOut(Easing.ease) }), -1, true);
    dustLoop3.value = withRepeat(withTiming(1, { duration: 7000, easing: Easing.inOut(Easing.ease) }), -1, true);
    dustLoop4.value = withRepeat(withTiming(1, { duration: 9000, easing: Easing.inOut(Easing.ease) }), -1, true);
    dustLoop5.value = withRepeat(withTiming(1, { duration: 11000, easing: Easing.inOut(Easing.ease) }), -1, true);
    dustLoop6.value = withRepeat(withTiming(1, { duration: 7500, easing: Easing.inOut(Easing.ease) }), -1, true);
    dustLoop7.value = withRepeat(withTiming(1, { duration: 9500, easing: Easing.inOut(Easing.ease) }), -1, true);
    dustLoop8.value = withRepeat(withTiming(1, { duration: 12000, easing: Easing.inOut(Easing.ease) }), -1, true);
    dustLoop9.value = withRepeat(withTiming(1, { duration: 8500, easing: Easing.inOut(Easing.ease) }), -1, true);
    dustLoop10.value = withRepeat(withTiming(1, { duration: 10500, easing: Easing.inOut(Easing.ease) }), -1, true);
    dustLoop11.value = withRepeat(withTiming(1, { duration: 9200, easing: Easing.inOut(Easing.ease) }), -1, true);
    dustLoop12.value = withRepeat(withTiming(1, { duration: 7800, easing: Easing.inOut(Easing.ease) }), -1, true);
    dustLoop13.value = withRepeat(withTiming(1, { duration: 11500, easing: Easing.inOut(Easing.ease) }), -1, true);
    dustLoop14.value = withRepeat(withTiming(1, { duration: 8800, easing: Easing.inOut(Easing.ease) }), -1, true);
    dustLoop15.value = withRepeat(withTiming(1, { duration: 10200, easing: Easing.inOut(Easing.ease) }), -1, true);
    dustLoop16.value = withRepeat(withTiming(1, { duration: 6800, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, []);

  // Light beam reacts to scroll - gets brighter AND shifts position when scrolling
  // Общая яркость света складывается из автономной пульсации и ограниченного scroll boost.
const lightBeamStyle = useAnimatedStyle(() => {
    const baseOpacity = interpolate(lightPulse.value, [0, 1], [0.10, 0.22]);
    const scrollBoost = interpolate(scrollY.value, [0, 200, 500], [0, 0.08, 0.12], Extrapolation.CLAMP);
    // Beam gently shifts right and down as user scrolls (like sunlight moving)
    const beamShiftX = interpolate(scrollY.value, [0, 500, 1500], [0, 15, 40], Extrapolation.CLAMP);
    const beamShiftY = interpolate(scrollY.value, [0, 500, 1500], [0, 10, 25], Extrapolation.CLAMP);
    return {
      opacity: baseOpacity + scrollBoost,
      transform: [
        { translateX: beamShiftX },
        { translateY: beamShiftY },
      ],
    };
  });

  // Helper: each mote combines autonomous loop + scroll-driven displacement
  const makeDustStyle = (loop: SharedValue<number>, baseY: number, baseX: number, scrollMult: number, opacityRange: [number, number]) => {
    // Для фиксированного числа пылинок объединяет автономный drift и смещение от scroll; вызовы hook идут в постоянном порядке.

    return useAnimatedStyle(() => {
      const loopY = loop.value * baseY;
      const loopX = loop.value * baseX;
      const scrollDisplace = scrollY.value * scrollMult;
      const opacity = interpolate(loop.value, [0, 0.3, 0.7, 1], [opacityRange[0], opacityRange[1], opacityRange[1], opacityRange[0]]);
      return {
        opacity,
        transform: [
          { translateY: loopY + scrollDisplace },
          { translateX: loopX + scrollDisplace * 0.3 },
        ],
      };
    });
  };

  const dustStyle1 = makeDustStyle(dustLoop1, 30, 15, 0.08, [0.3, 0.9]);
  const dustStyle2 = makeDustStyle(dustLoop2, 40, 20, 0.06, [0.2, 0.8]);
  const dustStyle3 = makeDustStyle(dustLoop3, 25, 18, 0.10, [0.25, 0.85]);
  const dustStyle4 = makeDustStyle(dustLoop4, 35, 12, 0.07, [0.2, 0.75]);
  const dustStyle5 = makeDustStyle(dustLoop5, 45, 22, 0.05, [0.15, 0.7]);
  const dustStyle6 = makeDustStyle(dustLoop6, 28, 16, 0.09, [0.3, 0.85]);
  const dustStyle7 = makeDustStyle(dustLoop7, 38, 14, 0.07, [0.2, 0.8]);
  const dustStyle8 = makeDustStyle(dustLoop8, 50, 25, 0.04, [0.15, 0.65]);
  const dustStyle9 = makeDustStyle(dustLoop9, 32, 19, 0.08, [0.25, 0.9]);
  const dustStyle10 = makeDustStyle(dustLoop10, 42, 21, 0.06, [0.2, 0.75]);
  const dustStyle11 = makeDustStyle(dustLoop11, 33, 17, 0.07, [0.2, 0.8]);
  const dustStyle12 = makeDustStyle(dustLoop12, 27, 22, 0.09, [0.25, 0.85]);
  const dustStyle13 = makeDustStyle(dustLoop13, 48, 13, 0.05, [0.15, 0.7]);
  const dustStyle14 = makeDustStyle(dustLoop14, 36, 20, 0.08, [0.3, 0.9]);
  const dustStyle15 = makeDustStyle(dustLoop15, 29, 16, 0.06, [0.2, 0.75]);
  const dustStyle16 = makeDustStyle(dustLoop16, 22, 24, 0.10, [0.25, 0.85]);

  const TAG_W = SCREEN_WIDTH * 0.24;
  const TAG_H = TAG_W * 0.72;
  // Pivot at string hole near top of tag artwork
  const PIVOT_OFFSET = TAG_H * 0.1;

  // Два ценника качаются встречно вокруг верхнего отверстия, сохраняя постоянный базовый наклон.
const priceTag2000Style = useAnimatedStyle(() => {
    const swing = interpolate(
      scrollY.value % 600,
      [0, 150, 300, 450, 600],
      [0, 1.5, 0, -1.5, 0],
      Extrapolation.CLAMP
    );
    return {
      transform: [
        { translateY: PIVOT_OFFSET },
        { rotate: `${17 + swing}deg` },
        { translateY: -PIVOT_OFFSET },
      ],
    };
  });

  const priceTag1000Style = useAnimatedStyle(() => {
    const swing = interpolate(
      scrollY.value % 600,
      [0, 150, 300, 450, 600],
      [0, -1.5, 0, 1.5, 0],
      Extrapolation.CLAMP
    );
    return {
      transform: [
        { translateY: PIVOT_OFFSET },
        { rotate: `${-17 + swing}deg` },
        { translateY: -PIVOT_OFFSET },
      ],
    };
  });

  // New shelf image aspect ratio: 1021:3118
  // Все позиции полок выводятся из одной высоты фона, чтобы обложки стояли на досках при изменении ширины.
const SHELF_ASPECT = 1021 / 3118;
  const shelfImageHeight = SCREEN_WIDTH / SHELF_ASPECT;

  // Shelf plank positions (as fraction of new image height 3118px):
  const SHELF2_PLANK_BOTTOM = shelfImageHeight * 0.395;
  const SHELF3_PLANK_BOTTOM = shelfImageHeight * 0.585;
  const SHELF4_PLANK_BOTTOM = shelfImageHeight * 0.785;
  const DIGITAL_ROW_BOTTOM = SHELF3_PLANK_BOTTOM - 4;

  // Metal nameplates sit on the shelf front edge (торец), not below it
  // Front lip of the shelf plank (below book bottoms), not on the book spines
  const shelfLabelTop = (plankBottom: number) =>
    /* Ставит табличку на передний край полки относительно её нижней кромки. */ plankBottom - LABEL_HEIGHT * 0.05;

  const digitalInner = SCREEN_WIDTH - DIGITAL_SIDE * 2;
  const digitalGap = (digitalInner - BOOK_WIDTH * 2) / 3;
  const digitalCenter0 = DIGITAL_SIDE + digitalGap + BOOK_WIDTH / 2;
  const digitalCenter1 = DIGITAL_SIDE + digitalGap * 2 + BOOK_WIDTH + BOOK_WIDTH / 2;
  const shelf3LabelTop = shelfLabelTop(SHELF3_PLANK_BOTTOM);

  // Price tags on left/right edges of nameplates (see shop mockup)
  const nameplateLeft = (cx: number) => /* Переводит центр таблички в левую границу для подвешенного ценника. */ cx - LABEL_WIDTH / 2;
  const nameplateRight = (cx: number) => /* Переводит центр таблички в правую границу для встречного ценника. */ cx + LABEL_WIDTH / 2;
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
    <View style={styles.container}>
      {/* Header overlay - fixed at top */}
      <View style={[styles.headerOverlay, { paddingTop: insets.top + 4 }]}>
        <Pressable
          {...pressableProps(() => router.navigate("/(tabs)" as any))}
          style={({ pressed }) => ({
            padding: 6,
            opacity: pressed ? 0.5 : 1,
          })}
        >
          <MaterialIcons name="home" size={22} color="#FDF8F0" />
        </Pressable>

        <Pressable
          {...pressableProps(() => router.push("/(tabs)/profile" as any))}
          style={({ pressed }) => ({
            padding: 6,
            opacity: pressed ? 0.5 : 1,
          })}
        >
          <MaterialIcons name="person-outline" size={22} color="#FDF8F0" />
        </Pressable>
      </View>

      {/* Scrollable shelf with books positioned on planks */}
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 0 }}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        {/* Shelf background image with books overlaid */}
        <View
          style={{
            width: SCREEN_WIDTH,
            height: shelfImageHeight,
            overflow: "hidden",
          }}
        >
          <Image
            source={{ uri: ASSETS.shelfBg }}
            style={StyleSheet.absoluteFillObject}
            contentFit="cover"
            transition={400}
          />

          {/* Cinematic light beam from top-left corner - scroll-reactive */}
          <Animated.View style={[{ ...StyleSheet.absoluteFillObject, zIndex: 2, pointerEvents: "none" }, lightBeamStyle]}>
            <LinearGradient
              colors={["rgba(218, 185, 130, 0.45)", "rgba(200, 170, 110, 0.18)", "rgba(180, 150, 90, 0.06)", "transparent"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0.65, y: 0.5 }}
              style={StyleSheet.absoluteFillObject}
            />
          </Animated.View>

          {/* 10 floating dust motes - scroll-reactive, in the light beam zone */}
          <View style={{ ...StyleSheet.absoluteFillObject, zIndex: 4, pointerEvents: "none" }}>
            {/* Mote 1 - large, warm amber */}
            <Animated.View
              style={[{
                position: "absolute",
                top: "5%",
                left: "12%",
                width: 1.5,
                height: 1.5,
                borderRadius: 0.75,
                backgroundColor: "rgba(215, 180, 115, 0.9)",
              }, dustStyle1]}
            />
            {/* Mote 2 - medium, golden */}
            <Animated.View
              style={[{
                position: "absolute",
                top: "9%",
                left: "28%",
                width: 1.2,
                height: 1.2,
                borderRadius: 0.6,
                backgroundColor: "rgba(200, 168, 100, 0.85)",
              }, dustStyle2]}
            />
            {/* Mote 3 - small, warm ochre */}
            <Animated.View
              style={[{
                position: "absolute",
                top: "13%",
                left: "6%",
                width: 1,
                height: 1,
                borderRadius: 0.5,
                backgroundColor: "rgba(225, 190, 125, 0.8)",
              }, dustStyle3]}
            />
            {/* Mote 4 - deep gold, upper area */}
            <Animated.View
              style={[{
                position: "absolute",
                top: "3%",
                left: "38%",
                width: 1.2,
                height: 1.2,
                borderRadius: 0.6,
                backgroundColor: "rgba(190, 158, 92, 0.75)",
              }, dustStyle4]}
            />
            {/* Mote 5 - honey, mid-beam */}
            <Animated.View
              style={[{
                position: "absolute",
                top: "16%",
                left: "20%",
                width: 1.5,
                height: 1.5,
                borderRadius: 0.75,
                backgroundColor: "rgba(205, 172, 108, 0.7)",
              }, dustStyle5]}
            />
            {/* Mote 6 - near basket, bright */}
            <Animated.View
              style={[{
                position: "absolute",
                top: "11%",
                left: "3%",
                width: 1,
                height: 1,
                borderRadius: 0.5,
                backgroundColor: "rgba(220, 185, 120, 0.85)",
              }, dustStyle6]}
            />
            {/* Mote 7 - drifts in mid zone */}
            <Animated.View
              style={[{
                position: "absolute",
                top: "19%",
                left: "33%",
                width: 1.2,
                height: 1.2,
                borderRadius: 0.6,
                backgroundColor: "rgba(195, 162, 98, 0.65)",
              }, dustStyle7]}
            />
            {/* Mote 8 - large, lower beam edge */}
            <Animated.View
              style={[{
                position: "absolute",
                top: "22%",
                left: "15%",
                width: 1.5,
                height: 1.5,
                borderRadius: 0.75,
                backgroundColor: "rgba(210, 175, 110, 0.6)",
              }, dustStyle8]}
            />
            {/* Mote 9 - tiny, high in beam */}
            <Animated.View
              style={[{
                position: "absolute",
                top: "2%",
                left: "22%",
                width: 1,
                height: 1,
                borderRadius: 0.5,
                backgroundColor: "rgba(218, 182, 118, 0.8)",
              }, dustStyle9]}
            />
            {/* Mote 10 - accent, mid-left */}
            <Animated.View
              style={[{
                position: "absolute",
                top: "7%",
                left: "42%",
                width: 1.2,
                height: 1.2,
                borderRadius: 0.6,
                backgroundColor: "rgba(200, 165, 102, 0.7)",
              }, dustStyle10]}
            />
            {/* Mote 11 - upper right zone */}
            <Animated.View
              style={[{
                position: "absolute",
                top: "4%",
                left: "55%",
                width: 1,
                height: 1,
                borderRadius: 0.5,
                backgroundColor: "rgba(215, 180, 115, 0.75)",
              }, dustStyle11]}
            />
            {/* Mote 12 - near beam center */}
            <Animated.View
              style={[{
                position: "absolute",
                top: "14%",
                left: "18%",
                width: 1.3,
                height: 1.3,
                borderRadius: 0.65,
                backgroundColor: "rgba(225, 190, 130, 0.8)",
              }, dustStyle12]}
            />
            {/* Mote 13 - lower left drift */}
            <Animated.View
              style={[{
                position: "absolute",
                top: "22%",
                left: "8%",
                width: 1,
                height: 1,
                borderRadius: 0.5,
                backgroundColor: "rgba(190, 155, 95, 0.65)",
              }, dustStyle13]}
            />
            {/* Mote 14 - bright tiny near top */}
            <Animated.View
              style={[{
                position: "absolute",
                top: "1%",
                left: "35%",
                width: 1.1,
                height: 1.1,
                borderRadius: 0.55,
                backgroundColor: "rgba(230, 200, 140, 0.85)",
              }, dustStyle14]}
            />
            {/* Mote 15 - mid beam, subtle */}
            <Animated.View
              style={[{
                position: "absolute",
                top: "9%",
                left: "28%",
                width: 1,
                height: 1,
                borderRadius: 0.5,
                backgroundColor: "rgba(205, 170, 108, 0.7)",
              }, dustStyle15]}
            />
            {/* Mote 16 - far edge, faint */}
            <Animated.View
              style={[{
                position: "absolute",
                top: "17%",
                left: "48%",
                width: 1.2,
                height: 1.2,
                borderRadius: 0.6,
                backgroundColor: "rgba(195, 160, 100, 0.6)",
              }, dustStyle16]}
            />
          </View>

          {/* "МАГАЗИН" title text - replaces old sign image */}
          <View
            style={{
              position: "absolute",
              top: TITLE_TOP,
              left: 0,
              right: 0,
              alignItems: "center",
              zIndex: 5,
            }}
          >
            <Text
              style={{
                fontFamily: GOGOL_FONT,
                fontSize: 28,
                fontStyle: "normal",
                color: "#FDF8F0",
                letterSpacing: 4,
                textTransform: "uppercase",
                textShadowColor: "rgba(0, 0, 0, 0.6)",
                textShadowOffset: { width: 1, height: 1 },
                textShadowRadius: 3,
              }}
            >
              МАГАЗИН
            </Text>
          </View>

          {/* Section label "Печатные книги" on shelf 2 back wall */}
          <View
            style={{
              position: "absolute",
              top: SECTION_LABEL_SHELF2_TOP,
              left: 0,
              right: 0,
              alignItems: "center",
              zIndex: 3,
            }}
          >
            <Text
              style={{
                fontFamily: "EBGaramond-Italic",
                fontSize: 16,
                color: "#F5ECD7",
                letterSpacing: 2,
                textShadowColor: "rgba(0, 0, 0, 0.5)",
                textShadowOffset: { width: 0.5, height: 0.5 },
                textShadowRadius: 2,
                opacity: 0.85,
              }}
            >
              Печатные книги
            </Text>
          </View>

          {/* Section label "Электронные продукты" on shelf 3 back wall */}
          <View
            style={{
              position: "absolute",
              top: SECTION_LABEL_SHELF3_TOP,
              left: 0,
              right: 0,
              alignItems: "center",
              zIndex: 3,
            }}
          >
            <Text
              style={{
                fontFamily: "EBGaramond-Italic",
                fontSize: 16,
                color: "#F5ECD7",
                letterSpacing: 2,
                textShadowColor: "rgba(0, 0, 0, 0.5)",
                textShadowOffset: { width: 0.5, height: 0.5 },
                textShadowRadius: 2,
                opacity: 0.85,
              }}
            >
              Электронные продукты
            </Text>
          </View>

          {/* Books row - 3 printed books on shelf 2 */}
          <View
            style={[
              styles.booksRow,
              {
                position: "absolute",
                bottom: shelfImageHeight - SHELF2_PLANK_BOTTOM,
                left: 0,
                right: 0,
                paddingHorizontal: SHELF_SIDE,
                gap: BOOK_GAP,
              },
            ]}
          >
            {books.map((book) => (
              <ShelfItem
                key={book.id}
                product={book}
                onPress={() => handleProductPress(book)}
              />
            ))}
          </View>

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
                <View
                  key={text}
                  style={{
                    position: "absolute",
                    top: labelTop,
                    left: center - labelW / 2,
                  }}
                >
                  <ShelfLabel text={text} style={isMiddle ? { width: labelW } : undefined} />
                </View>
              );
            });
          })()}

          {/* Digital products row - 2 items on shelf 3 */}
          <View
            style={[
              styles.booksRow,
              {
                position: "absolute",
                bottom: shelfImageHeight - SHELF3_PLANK_BOTTOM + 4,
                left: 0,
                right: 0,
                justifyContent: "space-evenly",
                paddingHorizontal: DIGITAL_SIDE,
              },
            ]}
          >
            {digitals.map((digital) => (
              <ShelfItem
                key={digital.id}
                product={digital}
                onPress={() => handleProductPress(digital)}
              />
            ))}
          </View>

          {/* Labels on shelf 3 plank edge */}
          {[
            { text: "Пособие", cx: digitalCenter0 },
            { text: "Мастер-класс", cx: digitalCenter1 },
          ].map((label) => (
            <View
              key={label.text}
              style={{
                position: "absolute",
                top: shelf3LabelTop,
                left: label.cx - LABEL_WIDTH / 2,
                zIndex: 12,
              }}
            >
              <ShelfLabel text={label.text} />
            </View>
          ))}

          {/* Price tags on shelf 3 — flank nameplate left/right edges */}
          <Pressable
            {...pressableProps(() => {
              if (digitals[0]) handleProductPress(digitals[0]);
            })}
            onPressIn={() => {
              if (Platform.OS !== "web") {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }
            }}
            style={{
              position: "absolute",
              top: PRICE_TAG_TOP,
              left: PRICE_TAG_LEFT_0,
              zIndex: 13,
            }}
          >
            <Animated.View style={priceTag2000Style}>
              <Image
                source={{ uri: ASSETS.priceTag2000 }}
                style={{
                  width: TAG_W,
                  height: TAG_H,
                }}
                contentFit="contain"
              />
            </Animated.View>
          </Pressable>
          <Pressable
            {...pressableProps(() => {
              if (digitals[1]) handleProductPress(digitals[1]);
            })}
            onPressIn={() => {
              if (Platform.OS !== "web") {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }
            }}
            style={{
              position: "absolute",
              top: PRICE_TAG_TOP,
              left: PRICE_TAG_LEFT_1,
              zIndex: 13,
            }}
          >
            <Animated.View style={priceTag1000Style}>
              <Image
                source={{ uri: ASSETS.priceTag1000 }}
                style={{
                  width: TAG_W,
                  height: TAG_H,
                }}
                contentFit="contain"
              />
            </Animated.View>
          </Pressable>

          {/* Decorative house on shelf 4 - positioned to the right */}
          <View
            style={{
              position: "absolute",
              bottom: shelfImageHeight - SHELF4_PLANK_BOTTOM + 10,
              right: SCREEN_WIDTH * 0.08,
              alignItems: "center",
            }}
          >
            <Image
              source={{ uri: ASSETS.house }}
              style={{
                width: HOUSE_WIDTH,
                height: HOUSE_HEIGHT,
              }}
              contentFit="contain"
              transition={300}
            />
          </View>
        </View>

        {/* Footer — paper background to match the rest of the app */}
        <ImageBackground source={{ uri: PAPER_TEXTURE_URI }} resizeMode="cover" style={styles.footerPaper}>
          <View style={styles.footerNote}>
            <MaterialIcons name="local-shipping" size={15} color={SHOP_BROWN} />
            <Text style={styles.footerNoteText}>
              Доставка по всей России через маркетплейсы
            </Text>
          </View>
          <ContactEmailFooter style={{ paddingBottom: 8 }} />
          <LegalDocumentsFooter style={{ paddingBottom: 24 }} />
        </ImageBackground>
      </Animated.ScrollView>
    </View>
  );
}

export default function ShopScreen() {
  // Сохраняет совместимую обёртку tab-сцены вокруг Магазина.

  return (
    <TabFocusGate>
      <ShopScreenInner />
    </TabFocusGate>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

// Координаты товаров и табличек считаются от одного фонового изображения; декоративные свет/пыль имеют pointerEvents none.
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FDF8F0",
  },
  headerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  booksRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  footerPaper: {
    backgroundColor: "#FDF8F0",
    paddingTop: 20,
    paddingBottom: 100,
  },
  footerNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 20,
  },
  footerNoteText: {
    fontFamily: READABLE_ITALIC_FONT,
    fontSize: 14,
    color: SHOP_BROWN,
  },
});
