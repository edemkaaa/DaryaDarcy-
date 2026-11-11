"use client";
/** Вопросы, ответы и подсчёт результата составляют общую модель теста; экран использует её вместо собственного алгоритма. */
/**
 * Quiz Data Layer — "Тест: Какая твоя сказка?"
 *
 * 10 questions, 7 answer options each (one per aesthetic).
 * Visual questions show images without text descriptions.
 * Layout: 3 top + 4 bottom grid.
 */
// ─── Types ───────────────────────────────────────────────────────────────────
export type AestheticKey =
  | "cottagecore"
  | "goblincore"
  | "witchcore"
  | "castlecore"
  | "fairycore"
  | "darkAcademia"
  | "lightAcademia";
export type QuestionType = "text" | "visual";
export interface ScoreEntry {
  aesthetic: AestheticKey;
  points: number;
}
export interface Answer {
  id: string;
  text: string;
  /** Local image require() — only for visual questions */
  image?: { uri: string };
  scores: ScoreEntry[];
}
export interface Question {
  id: number;
  title: string;
  narrative: string;
  type: QuestionType;
  /** Optional header image (e.g. chest for Q5) */
  headerImage?: { uri: string };
  /** Custom grid layout: array of row sizes, e.g. [3,1,3] */
  gridLayout?: number[];
  answers: Answer[];
}
export interface AestheticResult {
  key: AestheticKey;
  title: string;
  fairyTale: string;
  archetype: string;
  roleModels: string;
  depth: string;
  values: string;
  superpower: string;
  aestheticInLife: {
    wardrobe: string;
    space: string;
    photography: string;
    music: string;
  };
}
export interface QuizResult {
  primary: AestheticResult;
  secondary?: AestheticResult;
  isBlend: boolean;
  scores: Record<AestheticKey, number>;
}
// ─── Image Imports ───────────────────────────────────────────────────────────
const IMAGES = {
  landscapes: {
    cottagecore: { uri: "/assets/quiz/landscapes/cottagecore.webp" },
    goblincore: { uri: "/assets/quiz/landscapes/goblincore.webp" },
    witchcore: { uri: "/assets/quiz/landscapes/witchcore.webp" },
    castlecore: { uri: "/assets/quiz/landscapes/castlecore.webp" },
    fairycore: { uri: "/assets/quiz/landscapes/fairycore.webp" },
    darkAcademia: { uri: "/assets/quiz/landscapes/dark-academia.webp" },
    lightAcademia: { uri: "/assets/quiz/landscapes/light-academia.webp" },
  },
  shelters: {
    cottagecore: { uri: "/assets/quiz/shelters/cottagecore.webp" },
    goblincore: { uri: "/assets/quiz/shelters/goblincore.webp" },
    witchcore: { uri: "/assets/quiz/shelters/witchcore.webp" },
    castlecore: { uri: "/assets/quiz/shelters/castlecore.webp" },
    fairycore: { uri: "/assets/quiz/shelters/fairycore.webp" },
    darkAcademia: { uri: "/assets/quiz/shelters/dark-academia.webp" },
    lightAcademia: { uri: "/assets/quiz/shelters/light-academia.webp" },
  },
  outfits: {
    cottagecore: { uri: "/assets/quiz/outfits/cottagecore.webp" },
    goblincore: { uri: "/assets/quiz/outfits/goblincore.webp" },
    witchcore: { uri: "/assets/quiz/outfits/witchcore.webp" },
    castlecore: { uri: "/assets/quiz/outfits/castlecore.webp" },
    fairycore: { uri: "/assets/quiz/outfits/fairycore.webp" },
    darkAcademia: { uri: "/assets/quiz/outfits/dark-academia.webp" },
    lightAcademia: { uri: "/assets/quiz/outfits/light-academia.webp" },
  },
  animals: {
    cottagecore: { uri: "/assets/quiz/animals/cottagecore.webp" },
    goblincore: { uri: "/assets/quiz/animals/goblincore.webp" },
    witchcore: { uri: "/assets/quiz/animals/witchcore.webp" },
    castlecore: { uri: "/assets/quiz/animals/castlecore.webp" },
    fairycore: { uri: "/assets/quiz/animals/fairycore.webp" },
    darkAcademia: { uri: "/assets/quiz/animals/dark-academia.webp" },
    lightAcademia: { uri: "/assets/quiz/animals/light-academia.webp" },
  },
  artifacts: {
    cottagecore: { uri: "/assets/quiz/artifacts/cottagecore.webp" },
    goblincore: { uri: "/assets/quiz/artifacts/goblincore.webp" },
    witchcore: { uri: "/assets/quiz/artifacts/witchcore.webp" },
    castlecore: { uri: "/assets/quiz/artifacts/castlecore.webp" },
    fairycore: { uri: "/assets/quiz/artifacts/fairycore.webp" },
    darkAcademia: { uri: "/assets/quiz/artifacts/dark-academia.webp" },
    lightAcademia: { uri: "/assets/quiz/artifacts/light-academia.webp" },
  },
  houses: {
    cottagecore: { uri: "/assets/quiz/houses/cottagecore.webp" },
    goblincore: { uri: "/assets/quiz/houses/goblincore.webp" },
    witchcore: { uri: "/assets/quiz/houses/witchcore.webp" },
    castlecore: { uri: "/assets/quiz/houses/castlecore.webp" },
    fairycore: { uri: "/assets/quiz/houses/fairycore.webp" },
    darkAcademia: { uri: "/assets/quiz/houses/dark-academia.webp" },
    lightAcademia: { uri: "/assets/quiz/houses/light-academia.webp" },
  },
  chest: { uri: "/assets/quiz/chest.webp" },
};
// ─── Questions ───────────────────────────────────────────────────────────────
export const QUESTIONS: Question[] = [
  // Q1: Что ты чувствуешь? (Text)
  {
    id: 1,
    title: "Что ты чувствуешь?",
    narrative: "Открываешь глаза в незнакомом мире. Что чувствуешь первым?",
    type: "text",
    answers: [
      {
        id: "1a",
        text: "Тёплое **спокойствие** — _будто вернулась домой после долгого пути_",
        scores: [{ aesthetic: "cottagecore", points: 2 }],
      },
      {
        id: "1b",
        text: "Жгучее **любопытство** — _хочется всё потрогать, понюхать, рассмотреть_",
        scores: [{ aesthetic: "goblincore", points: 2 }],
      },
      {
        id: "1c",
        text: "Настороженную **внимательность** — _мир полон знаков, нужно читать их правильно_",
        scores: [{ aesthetic: "witchcore", points: 2 }],
      },
      {
        id: "1d",
        text: "Торжественную **тишину** — _что-то важное должно произойти_",
        scores: [{ aesthetic: "castlecore", points: 2 }],
      },
      {
        id: "1e",
        text: "**Восторг и лёгкость** — _будто весишь меньше пёрышка_",
        scores: [{ aesthetic: "fairycore", points: 2 }],
      },
      {
        id: "1f",
        text: "Острое **желание понять** — _по каким законам устроен этот мир_",
        scores: [{ aesthetic: "darkAcademia", points: 2 }],
      },
      {
        id: "1g",
        text: "**Радость и вдохновение** — _хочется немедленно что-то создать_",
        scores: [{ aesthetic: "lightAcademia", points: 2 }],
      },
    ],
  },
  // Q2: Пейзаж (Visual)
  {
    id: 2,
    title: "Что ты видишь?",
    narrative: "Осматриваешься. Какой пейзаж расстилается перед тобой?",
    type: "visual",
    answers: [
      {
        id: "2a",
        text: "",
        image: IMAGES.landscapes.cottagecore,
        scores: [{ aesthetic: "cottagecore", points: 2 }],
      },
      {
        id: "2b",
        text: "",
        image: IMAGES.landscapes.witchcore,
        scores: [{ aesthetic: "witchcore", points: 2 }],
      },
      {
        id: "2c",
        text: "",
        image: IMAGES.landscapes.goblincore,
        scores: [{ aesthetic: "goblincore", points: 2 }],
      },
      {
        id: "2f",
        text: "",
        image: IMAGES.landscapes.darkAcademia,
        scores: [{ aesthetic: "darkAcademia", points: 2 }],
      },
      {
        id: "2e",
        text: "",
        image: IMAGES.landscapes.fairycore,
        scores: [{ aesthetic: "fairycore", points: 2 }],
      },
      {
        id: "2d",
        text: "",
        image: IMAGES.landscapes.castlecore,
        scores: [{ aesthetic: "castlecore", points: 2 }],
      },
      {
        id: "2g",
        text: "",
        image: IMAGES.landscapes.lightAcademia,
        scores: [{ aesthetic: "lightAcademia", points: 2 }],
      },
    ],
  },
  // Q3: Наряд (Visual)
  {
    id: 3,
    title: "Встреча с торговцем",
    narrative: "На лесной дороге ты встречаешь торговца. Какой наряд выберешь?",
    type: "visual",
    answers: [
      {
        id: "3a",
        text: "",
        image: IMAGES.outfits.cottagecore,
        scores: [{ aesthetic: "cottagecore", points: 2 }],
      },
      {
        id: "3b",
        text: "",
        image: IMAGES.outfits.goblincore,
        scores: [{ aesthetic: "goblincore", points: 2 }],
      },
      {
        id: "3c",
        text: "",
        image: IMAGES.outfits.witchcore,
        scores: [{ aesthetic: "witchcore", points: 2 }],
      },
      {
        id: "3d",
        text: "",
        image: IMAGES.outfits.castlecore,
        scores: [{ aesthetic: "castlecore", points: 2 }],
      },
      {
        id: "3e",
        text: "",
        image: IMAGES.outfits.fairycore,
        scores: [{ aesthetic: "fairycore", points: 2 }],
      },
      {
        id: "3f",
        text: "",
        image: IMAGES.outfits.darkAcademia,
        scores: [{ aesthetic: "darkAcademia", points: 2 }],
      },
      {
        id: "3g",
        text: "",
        image: IMAGES.outfits.lightAcademia,
        scores: [{ aesthetic: "lightAcademia", points: 2 }],
      },
    ],
  },
  // Q4: Укрытие (Visual)
  {
    id: 4,
    title: "Укрытие от дождя",
    narrative: "Начинается дождь. Куда ты спрячешься?",
    type: "visual",
    gridLayout: [3, 1, 3],
    answers: [
      // Row 1: 3 squares
      {
        id: "4a",
        text: "",
        image: IMAGES.shelters.cottagecore,
        scores: [{ aesthetic: "cottagecore", points: 2 }],
      },
      {
        id: "4b",
        text: "",
        image: IMAGES.shelters.lightAcademia,
        scores: [{ aesthetic: "lightAcademia", points: 2 }],
      },
      {
        id: "4c",
        text: "",
        image: IMAGES.shelters.goblincore,
        scores: [{ aesthetic: "goblincore", points: 2 }],
      },
      // Row 2: 1 wide tavern
      {
        id: "4d",
        text: "",
        image: IMAGES.shelters.castlecore,
        scores: [{ aesthetic: "castlecore", points: 2 }],
      },
      // Row 3: 3 squares
      {
        id: "4e",
        text: "",
        image: IMAGES.shelters.witchcore,
        scores: [{ aesthetic: "witchcore", points: 2 }],
      },
      {
        id: "4f",
        text: "",
        image: IMAGES.shelters.fairycore,
        scores: [{ aesthetic: "fairycore", points: 2 }],
      },
      {
        id: "4g",
        text: "",
        image: IMAGES.shelters.darkAcademia,
        scores: [{ aesthetic: "darkAcademia", points: 2 }],
      },
    ],
  },
  // Q5: Сундук (Visual — artifacts)
  {
    id: 5,
    title: "Твои артефакты",
    narrative: "В укрытии ты находишь старый сундук. Что в нём?",
    type: "visual",
    answers: [
      {
        id: "5a",
        text: "",
        image: IMAGES.artifacts.cottagecore,
        scores: [{ aesthetic: "cottagecore", points: 2 }],
      },
      {
        id: "5b",
        text: "",
        image: IMAGES.artifacts.goblincore,
        scores: [{ aesthetic: "goblincore", points: 2 }],
      },
      {
        id: "5c",
        text: "",
        image: IMAGES.artifacts.witchcore,
        scores: [{ aesthetic: "witchcore", points: 2 }],
      },
      {
        id: "5d",
        text: "",
        image: IMAGES.artifacts.castlecore,
        scores: [{ aesthetic: "castlecore", points: 2 }],
      },
      {
        id: "5e",
        text: "",
        image: IMAGES.artifacts.fairycore,
        scores: [{ aesthetic: "fairycore", points: 2 }],
      },
      {
        id: "5f",
        text: "",
        image: IMAGES.artifacts.darkAcademia,
        scores: [{ aesthetic: "darkAcademia", points: 2 }],
      },
      {
        id: "5g",
        text: "",
        image: IMAGES.artifacts.lightAcademia,
        scores: [{ aesthetic: "lightAcademia", points: 2 }],
      },
    ],
  },
  // Q6: Занятие (Text)
  {
    id: 6,
    title: "Занятие",
    narrative: "Дождь закончился. У тебя есть целый день. Чем ты займёшься?",
    type: "text",
    answers: [
      {
        id: "6a",
        text: "Испеку хлеб, соберу букет полевых цветов, повешу сушиться травы у окна",
        scores: [{ aesthetic: "cottagecore", points: 2 }],
      },
      {
        id: "6b",
        text: "Пойду исследовать ручей, собирать камни и наблюдать за жабой",
        scores: [{ aesthetic: "goblincore", points: 2 }],
      },
      {
        id: "6c",
        text: "Пойду собирать травы на опушке, определяя каждую по запаху и форме листа",
        scores: [{ aesthetic: "witchcore", points: 2 }],
      },
      {
        id: "6d",
        text: "Поднимусь на самую высокую башню, чтобы увидеть всё королевство",
        scores: [{ aesthetic: "castlecore", points: 2 }],
      },
      {
        id: "6e",
        text: "Буду плести венок из росистых цветов и танцевать со светлячками",
        scores: [{ aesthetic: "fairycore", points: 2 }],
      },
      {
        id: "6f",
        text: "Сяду с книгой у окна, делая заметки на полях, потом буду бродить по городу",
        scores: [{ aesthetic: "darkAcademia", points: 2 }],
      },
      {
        id: "6g",
        text: "Сяду на террасе кафе, буду рисовать прохожих и писать стихи на салфетке",
        scores: [{ aesthetic: "lightAcademia", points: 2 }],
      },
    ],
  },
  // Q7: Спутник (Visual — animals)
  {
    id: 7,
    title: "Спутник",
    narrative:
      "Из леса выходит существо и смотрит на тебя без страха. Кто это?",
    type: "visual",
    gridLayout: [2, 3, 2],
    answers: [
      {
        id: "7a",
        text: "",
        image: IMAGES.animals.cottagecore,
        scores: [{ aesthetic: "cottagecore", points: 2 }],
      },
      {
        id: "7d",
        text: "",
        image: IMAGES.animals.castlecore,
        scores: [{ aesthetic: "castlecore", points: 2 }],
      },
      {
        id: "7b",
        text: "",
        image: IMAGES.animals.goblincore,
        scores: [{ aesthetic: "goblincore", points: 2 }],
      },
      {
        id: "7f",
        text: "",
        image: IMAGES.animals.darkAcademia,
        scores: [{ aesthetic: "darkAcademia", points: 2 }],
      },
      {
        id: "7c",
        text: "",
        image: IMAGES.animals.witchcore,
        scores: [{ aesthetic: "witchcore", points: 2 }],
      },
      {
        id: "7g",
        text: "",
        image: IMAGES.animals.lightAcademia,
        scores: [{ aesthetic: "lightAcademia", points: 2 }],
      },
      {
        id: "7e",
        text: "",
        image: IMAGES.animals.fairycore,
        scores: [{ aesthetic: "fairycore", points: 2 }],
      },
    ],
  },
  // Q8: Испытание (Text)
  {
    id: 8,
    title: "Испытание",
    narrative:
      "На пути — заколдованный мост. Чтобы пройти, нужно с чем-то расстаться. Что готова отдать?",
    type: "text",
    answers: [
      {
        id: "8a",
        text: "Одну **слезу** — она упадёт в землю, и с тех пор все посаженные мной растения будут **цвести** и плодоносить",
        scores: [{ aesthetic: "cottagecore", points: 2 }],
      },
      {
        id: "8b",
        text: "Свой **голос** на один день — в обмен на **понимание языка животных**",
        scores: [{ aesthetic: "goblincore", points: 2 }],
      },
      {
        id: "8c",
        text: "**Воспоминание** о безмятежном дне — в обмен на знание о том, что **скрыто под поверхностью вещей**",
        scores: [{ aesthetic: "witchcore", points: 2 }],
      },
      {
        id: "8d",
        text: "Свой **страх** — и почувствую, как внутри раскрывается спокойная, несгибаемая **сила**",
        scores: [{ aesthetic: "castlecore", points: 2 }],
      },
      {
        id: "8e",
        text: "Своё **имя** — и стану частью этого мира, неотличимой от его **магии**",
        scores: [{ aesthetic: "fairycore", points: 2 }],
      },
      {
        id: "8f",
        text: "Любимую **книгу** — в обмен на **знание всех языков**",
        scores: [{ aesthetic: "darkAcademia", points: 2 }],
      },
      {
        id: "8g",
        text: "**Ничего** — найду другой путь, потому что верю, что всегда есть решение **без жертв**",
        scores: [{ aesthetic: "lightAcademia", points: 2 }],
      },
    ],
  },
  // Q9: Вечер (Text)
  {
    id: 9,
    title: "Вечер",
    narrative: "Наступает вечер. Как ты проведёшь его в этом мире?",
    type: "text",
    answers: [
      {
        id: "9a",
        text: "Приготовлю ужин из того, что выросло в саду, зажгу свечу и буду слушать камин",
        scores: [{ aesthetic: "cottagecore", points: 2 }],
      },
      {
        id: "9b",
        text: "Разложу все находки дня на мху и буду рисовать их в блокноте при свете светлячков",
        scores: [{ aesthetic: "goblincore", points: 2 }],
      },
      {
        id: "9c",
        text: "Буду варить отвар из собранных трав при свете луны и гадать на пламени свечи",
        scores: [{ aesthetic: "witchcore", points: 2 }],
      },
      {
        id: "9d",
        text: "Поднимусь на башню, зажгу свечи в канделябре и напишу письмо тому, кого ещё не встретила",
        scores: [{ aesthetic: "castlecore", points: 2 }],
      },
      {
        id: "9e",
        text: "Заберусь на удобную ветку старого дуба и буду смотреть на звёзды. Буду подпевать кузнечикам и сверчкам",
        scores: [{ aesthetic: "fairycore", points: 2 }],
      },
      {
        id: "9f",
        text: "Зажгу свечи и буду писать до рассвета — мысли текут, как никогда раньше",
        scores: [{ aesthetic: "darkAcademia", points: 2 }],
      },
      {
        id: "9g",
        text: "Послушаю уличных музыкантов и усну с книгой стихов",
        scores: [{ aesthetic: "lightAcademia", points: 2 }],
      },
    ],
  },
  // Q10: Дом (Visual — houses, higher weight +3)
  {
    id: 10,
    title: "Дом",
    narrative:
      "Утром ты понимаешь: ты можешь остаться навсегда. Где будет твой дом?",
    type: "visual",
    answers: [
      {
        id: "10a",
        text: "",
        image: IMAGES.houses.cottagecore,
        scores: [{ aesthetic: "cottagecore", points: 3 }],
      },
      {
        id: "10b",
        text: "",
        image: IMAGES.houses.goblincore,
        scores: [{ aesthetic: "goblincore", points: 3 }],
      },
      {
        id: "10c",
        text: "",
        image: IMAGES.houses.witchcore,
        scores: [{ aesthetic: "witchcore", points: 3 }],
      },
      {
        id: "10d",
        text: "",
        image: IMAGES.houses.castlecore,
        scores: [{ aesthetic: "castlecore", points: 3 }],
      },
      {
        id: "10e",
        text: "",
        image: IMAGES.houses.fairycore,
        scores: [{ aesthetic: "fairycore", points: 3 }],
      },
      {
        id: "10f",
        text: "",
        image: IMAGES.houses.darkAcademia,
        scores: [{ aesthetic: "darkAcademia", points: 3 }],
      },
      {
        id: "10g",
        text: "",
        image: IMAGES.houses.lightAcademia,
        scores: [{ aesthetic: "lightAcademia", points: 3 }],
      },
    ],
  },
];
// ─── Result Descriptions ─────────────────────────────────────────────────────
export const AESTHETIC_RESULTS: Record<AestheticKey, AestheticResult> = {
  cottagecore: {
    key: "cottagecore",
    title: "Девушка, вернувшая жизнь заброшенному саду",
    fairyTale:
      "Однажды она нашла заброшенный дом на краю деревни — с покрытой пылью дубовой мебелью, заросшим садом и кованной калиткой, которую давно никто не открывал. Месяц за месяцем она возвращала ему жизнь: чинила ставни, сажала розы под окном, вешала занавески на окна. Соседи сначала приходили просто посмотреть из любопытства, затем предлагали помощь, а после и вовсе оставались на чай до позднего вечера. И когда однажды утром она вышла на порог с чашкой в руках и увидела цветущий сад, полный птиц и новых друзей, — поняла, что восстанавливала не только дом. Она восстанавливала себя.",
    archetype: "Хранительница очага",
    roleModels:
      "Таша Тюдор, Беатрис Поттер, Мэри Леннокс, миссис Уизли, Сэм Гэмджи",
    depth:
      "Ты обладаешь уникальной способностью: преображать пространство не магией, а вниманием, трудолюбием и любовью ко всему, к чему прикасаешься. Иметь свой дом, сад с огородом, привычные любимые места вроде маленького субботнего рынка, уютной кофейни, конюшни и места для пикника у реки — вот настоящая жизнь мечты. Тонкий вкус и стремление к эстетике сочетаются с уважением к неидеальности: ты ценишь фактуры, отпечатки времени, историю. Находишь красоту, очарование и, главное — потенциал там, где другие увидели бы лишь заросли сорняков, пыль и ветхие стены.\n\nТебе важно чувствовать лёгкую усталость в конце дня — от проделанной работы, от того, что мир вокруг стал чуть лучше. Созерцание плодов своего труда, даже самых маленьких изменений в своём доме и в саду — лучшая награда! Ты умеешь напитывать «собой» пространство, создавать уют из мелочей и превращать обычный день в сказку. А всё благодаря особенному взгляду, вниманию к деталям и хозяйственности. И речь тут не столько про быт — сколько про умение управлять течением своей жизни, брать дело в свои руки и преображать всё вокруг.\n\nТвой вызов: позволь иногда жизни вести тебя. Наслаждайся внутренним спокойствием без желания всё улучшить — иногда мир уже достаточно хорош.",
    values: "Забота, тепло, простота, связь с землёй, создание уюта",
    superpower:
      "Ты умеешь превращать обычное в волшебное. Чашка чая в твоих руках становится ритуалом, а простой букет полевых цветов — произведением искусства.",
    aestheticInLife: {
      wardrobe:
        "Льняные платья, мягкие кардиганы, цветочные принты, соломенные шляпы",
      space:
        "Сухоцветы, керамика ручной работы, тёплый свет, натуральные ткани",
      photography: "Золотой час, мягкий фокус, натюрморты с цветами и выпечкой",
      music: "Акустическая гитара, звуки природы, нежный фолк",
    },
  },
  goblincore: {
    key: "goblincore",
    title: "Девушка, чьи карманы полны лесных сокровищ",
    fairyTale:
      "Говорят, в лесу за деревней жил особенный человек, к которому приходили, когда было тяжело. Не за советом — просто побыть рядом. В его доме пахло сухими травами и яблочным пирогом, на полках лежали странные сокровища – разноцветные камни, шишки, перья птиц… Из окна было видно, как густой туман поднимается над рекой, и, будто стараясь повторить его величие, вырывался пар из носика медного чайника. Удивительно, как становилось хорошо и спокойно в стенах этого домика, хотя дело было, конечно, совсем не в нём. А в необыкновенном хозяине этого жилища. Он и сам когда-то забрёл сюда и остался, наполняя дни долгими прогулками, а кладовую — запасами. Пока однажды не осознал, что покой, который он так долго искал, всегда был в нём самом.",
    archetype: "Собиратель",
    roleModels:
      "Бильбо Бэггинс, Хагрид, Снусмумрик, Джеральд Даррелл, Ньют Скамандер, Хелена Бонем Картер",
    depth:
      "Сложно представить человека более доброго и любознательного! Но твоё любопытство — не тяга к знаниям ради знаний, а желание потрогать мир руками. Тебе не нужны стопки книг и стены библиотеки — а лишь поход к лесному ручью, горсть разноцветных камней и альбом для зарисовок. Ты живёшь в своём ритме — не против людей, а просто в согласии с собой. Удивительно, что одним лишь своим присутствием ты даришь людям ощущение комфорта, ведь оно сопровождает тебя всюду. Тебе одинаково хорошо в чаще леса и в уютной гостиной, в одиночестве и в шумной компании. Одним словом — ты несёшь в себе гармонию и делишься ей с миром, даже не замечая этого.\n\nКоллекционируешь не вещи, а впечатления — просто они иногда помещаются в карман. Любишь простую сытную еду, заполненную кладовую и вечера в собственном домике, когда снаружи дождь, а внутри — тепло и все сокровища на своих местах.\n\nТвой вызов: помни, что твоя гармония — не данность, а выбор. Цени это в себе, но не бойся иногда выходить за привычные границы.",
    values:
      "Подлинность, свобода от правил, красота в несовершенном, связь с дикой природой",
    superpower:
      "Ты видишь красоту там, где другие видят хаос. Ты не боишься быть странной — и именно это делает тебя магнитом для настоящих людей.",
    aestheticInLife: {
      wardrobe:
        "Многослойность, земляные тона, карманы для находок, удобная обувь",
      space:
        "Коллекции камней и перьев, растения, природные текстуры, уютный хаос",
      photography: "Макросъёмка природы, грибы, мох, текстуры коры и камней",
      music: "Фолк с необычными инструментами, звуки леса, этника",
    },
  },
  witchcore: {
    key: "witchcore",
    title: "Та, чьи руки пахнут травами и дождем",
    fairyTale:
      "На окраине, где холодное море подступало к самому лесу, стояла сторожка из тёмного дерева. В ней жила удивительной силы и мудрости женщина, к которой приходили с тем, о чём не говорят вслух. Она говорила мало, просто заваривала травы, садилась напротив и ждала. И люди открывались ей, будто оставляя часть тяжести и горя в стенах её тихого дома. Годами она несла чужое, не жалуясь, ежедневно очищая пространство шалфеем и солью. Пока однажды к ней не забрёл странник, готовый выслушать её историю. В этот раз он заварил ей чай и позволил почувствовать себя не слабее, нет… Но мягче. Не только целительницей, но и той, кто тоже нуждается в исцелении.",
    archetype: "Целительница / Мудрая женщина",
    roleModels:
      "Клэр из «Чужестранки», Florence Welch, Мария Оуэнс, Тильда Суинтон, Кирка (Мадлен Миллер)",
    depth:
      "Ты говоришь мало, но каждое слово попадает в самую суть. Люди тянутся к тебе за мудрым советом, за внутренней силой — она как тихий огонь, что дарит ощущение защищённости и спокойствия. И ты готова помогать, направлять, поддерживать — это твой дар. Но в то же время он может угаснуть без тишины и уединения — тебе необходимо время наедине с собой, чтобы слышать, чувствовать, восстанавливаться.\n\nТы живёшь по природным циклам и чтишь их законы. Тебя наполняют смена времён года, праздники колеса года, традиции прошлого, связанные со сбором урожая и трав. Твой день начинается с ритуала — будь то чашка травяного чая, записи в дневнике или купание в туманном озере. Ты замечаешь знаки там, где другие видят совпадения, и доверяешь внутреннему голосу. Мистика и природа в тебе сплетаются воедино: ты не разделяешь интуицию и знание, чувство и факт.\n\nТы подпускаешь к себе близко немногих, ведь впустив однажды — отдаёшь всё: время, внимание, исцеление. Мало кто знает, какая ты на самом деле, когда остаёшься одна — без роли мудрой женщины, просто наедине с собой и лунным светом.\n\nТвой вызов: позволь себе иногда тоже быть хрупкой и нуждающейся в заботе. Твоя ценность не только в силе и мудрости — ты нужна миру и без своего дара.",
    values: "Интуиция, глубина, связь с циклами природы, внутренняя сила",
    superpower:
      "Ты чувствуешь то, что скрыто. Твоя интуиция — твой компас, и она никогда не подводит. Ты умеешь видеть суть вещей.",
    aestheticInLife: {
      wardrobe:
        "Тёмные тона, бархат, серебро, травяные мотивы, плащи и накидки",
      space:
        "Свечи, сушёные травы, кристаллы, старинные книги, запах благовоний",
      photography:
        "Тёмные тона, дым, свечи, травы, лунный свет, мистическая атмосфера",
      music: "Ambient, неоклассика, звуки природы ночью, медитативные мелодии",
    },
  },
  castlecore: {
    key: "castlecore",
    title: "Девушка, пишущая свою легенду от руки",
    fairyTale:
      "В замке на холме жила девушка, что днём облачалась в расшитые золотой нитью платья, а ночью тренировалась стрелять из лука и владеть мечом. Она мечтала вырваться на свободу, увидеть мир, проявить себя и найти настоящую любовь. Разрываясь между тем, кем была рождена и тем, чего желала, не могла найти покоя. Однажды, накинув капюшон мантии на непокорные кудри, она переступила границы замка и начала свой путь. Прошла через леса и города, сражалась и влюблялась, теряла и находила. И уже зная себя вернулась домой. Ей больше не нужно выбирать между традициями и свободой, любовью и долгом, между хрупкостью и силой. Она вольна быть всем и писать свою собственную историю.",
    archetype: "Принцесса / Воин",
    roleModels: "Рапунцель, Люси Певенси, Бриенна Тарт, Заколдованная Элла",
    depth:
      "В тебе живёт контраст: женственная хрупкость, стремление к любви и красоте встречаются с внутренним огнём и стойкостью настоящего воина. Мятежный дух живёт в тебе, даже когда ты следуешь традициям — ты чтишь красоту ритуалов, но не позволяешь им стать золотой клеткой. Стремишься к свободе и справедливости, но в то же время — к романтике, мечте о большой и чистой любви. Этот контраст делает тебя настоящей главной героиней своей жизни! О таких как ты слагают истории, пишут книги и снимают фильмы.\n\nТы не полностью отдана природе: тебе нравится город с его рыночными площадями, шумными праздниками, уличными музыкантами и вечерними огнями. Ты социальна и самостоятельна одновременно — и в этом нет противоречия. Важно то, что у тебя всегда есть выбор, какую жизнь прожить. Природная стать, красота, великодушие и смелость открывают перед тобой все двери.\n\nТвой вызов: не торопись принимать решения наперекор обществу — не всё требует борьбы. Действуй исходя из истинного желания своего сердца.",
    values: "Достоинство, верность, внутренняя сила, красота в величии",
    superpower:
      "Ты умеешь держать удар с грацией. Твоя сила — не в громкости, а в несгибаемости. Ты вдохновляешь одним присутствием.",
    aestheticInLife: {
      wardrobe: "Бархат, золото, корсеты, длинные юбки, украшения с историей",
      space: "Гобелены, свечи в канделябрах, тяжёлые ткани, антиквариат",
      photography:
        "Замки, арки, витражи, драматический свет, портреты в интерьерах",
      music:
        "Средневековая музыка, арфа, хоралы, кинематографические саундтреки",
    },
  },
  fairycore: {
    key: "fairycore",
    title: "Танцующая босиком на рассвете",
    fairyTale:
      "Она всегда видела больше, чем другие: перелив оттенков на лепестках цветов, танец пылинок в луче закатного солнца, кружево паутинок туманным утром. Ей говорили: «Повзрослей. Перестань выдумывать.» Она кивала — и продолжала. Плела венки из полевых цветов, разговаривала с деревьями, строила домики для фей. И лишь они знали правду: волшебство, которое она видела повсюду, — исходило от неё самой, она была его источником.",
    archetype: "Дитя / Муза",
    roleModels: "Луна Лавгуд, Дюймовочка, Ариэтти, AURORA",
    depth:
      "Ты видишь волшебство в изгибе ветки, в танце цветов на ветру, в переливах оттенков заката — природа для тебя как художник, у которого ты учишься каждый день. Ты стремишься к красоте и изяществу не ради формы. Красота — это твой язык, твой способ говорить с миром. Ты очень тонкая творческая натура, которая напоминает окружающим: чудеса существуют, если не разучиться их видеть.\n\nТвоя лёгкость — не инфантильность, а взрослый осознанный выбор: замечать хорошее и отдавать его ещё больше в мир. И только тебе известно, насколько это бывает парадоксально тяжело.\n\nТы любишь быстро переходить от идеи к реализации, мысли летят вслед за вдохновением, и всё в твоих руках преображается! Люди видят тебя искрящейся жизнью, восхищаются красотой и внутренней энергией.\n\nТвой вызов: не стоит переделывать себя, если кто-то не сумел разглядеть твой свет или глубину. Ты похожа на чистейшее озеро: из-за кристальности воды может показаться, что дно совсем близко, но это не так.",
    values: "Чудо, лёгкость, красота в мелочах, связь с невидимым",
    superpower:
      "Ты умеешь видеть волшебство в обычном. Рядом с тобой мир становится ярче, а люди — мягче. Ты напоминаешь им о том, что чудеса существуют.",
    aestheticInLife: {
      wardrobe:
        "Пастельные тона, прозрачные ткани, блёстки, цветочные венки, крылышки",
      space: "Гирлянды, кристаллы, цветы, мерцающие огоньки, нежные текстуры",
      photography:
        "Мягкий свет, блики, макро цветов и росы, сказочная обработка",
      music: "Эмбиент, арфа, колокольчики, звуки природы, мечтательные мелодии",
    },
  },
  darkAcademia: {
    key: "darkAcademia",
    title: "Девушка, влюблённая в тишину старых библиотек",
    fairyTale:
      "Она читала запоем — в библиотеках, в кафе, в поездах, при свете фонаря на ночной улице. Каждая книга была дверью, за которой ждал новый мир, новый голос. Она писала эссе при свечах, спорила с профессорами до хрипоты и верила, что на каждый вопрос можно найти логичный ответ. Пока однажды не встретила того, кто спрашивал, а не отвечал. И на вопросы эти не было ответа ни в одной библиотеке. Ей пришлось прислушиваться к внутреннему голосу, строить предположения и что-то вовсе оставлять без ответа, доверившись течению жизни и самой себе.",
    archetype: "Мудрец / Искатель",
    roleModels: "Гермиона Грейнджер, Джейн Эйр, Джо Марч, Донна Тартт",
    depth:
      "Твой аналитический ум — не холодность, а способ любить этот мир: через глубинное понимание его устройства. Тебя тянет к глубине — будь то книга, фильм, разговор или город с историей. Тебе важно понимать, а не просто видеть. Знания наполняют твою душу светом и добавляют блеска глазам. А таинственная атмосфера мощёных улиц, библиотеки, книжной лавки на углу или антикварного магазина делает по-настоящему счастливой.\n\nТы очень самодостаточна, с книгами тебе никогда не бывает одиноко, но в то же время, ты тянешься к близким, хочешь делиться открытиями, спорить до рассвета, а иногда — просто почувствовать себя лёгкой и беззаботной. Сочетание ума, дисциплины и невероятной жизненной энергии делает тебя по-настоящему притягательной натурой. Ты всегда будешь оставаться заметной, даже спрятавшись за книгой.\n\nТвой вызов: помни, что лёгкость — тоже форма глубины. Не всё ценное должно быть сложным.",
    values: "Знание, глубина, эстетика мысли, поиск истины",
    superpower:
      "Ты умеешь находить смысл там, где другие видят хаос. Твой разум — твоё оружие, а любопытство — двигатель. Ты вдохновляешь других думать глубже.",
    aestheticInLife: {
      wardrobe: "Твид, шерсть, тёмные тона, кожаные аксессуары, винтажные очки",
      space: "Книги, свечи, тёмное дерево, карты, глобусы, перьевые ручки",
      photography: "Тёмные тона, библиотеки, старинные здания, осенние пейзажи",
      music: "Классика, джаз, пост-рок, саундтреки к фильмам",
    },
  },
  lightAcademia: {
    key: "lightAcademia",
    title: "Девушка, для которой красота – родной язык",
    fairyTale:
      "Она коллекционировала красоту: фреску в заброшенной церкви, закат над черепичными крышами, голос уличного скрипача в переулке. Записывала, зарисовывала, запоминала — жадно, будто мир мог исчезнуть. И всегда чувствовала себя лишь ценителем, зрителем, слушателем. Но никогда — творцом. Пока однажды не оставила на столике блокнот с множеством впечатлений, пропущенных через себя. Хозяин кофейни, давно с восторгом наблюдавший за удивительной гостьей, бережно превратил её эскизы в большие фотографии, и развесил на стенах. Первые минуты девушка не нашлась что сказать: её охватило смущение и даже раздражение за вмешательство. Но увидев себя в завороженных посетителях кафе вдруг поняла, что сама может быть источником красоты и вдохновения для других.",
    archetype: "Творец",
    roleModels: "Эми Марч, Джо Марч, Сесили (Комната с видом), Клара Шуман",
    depth:
      "Ты тонко чувствуешь мир и хочешь красиво, объёмно отвечать ему — словом, кистью, мелодией, движением. Тебе интересны все классические виды искусства, и всегда мало часов в сутках: хочется успеть научиться петь, рисовать, играть на музыкальных инструментах... Не ради карьеры или признания, а потому что творчество для тебя — источник радости и глубинного счастья.\n\nТы любишь светлые, наполненные воздухом пространства: музеи с высокими потолками, театры с бархатными креслами, залитые солнцем кафе. Тебя вдохновляют путешествия по великим городам, винтажные вещи с историей, возможность разделить восторг от произведения с кем-то, кто поймёт. Разговоры об искусстве, о палитре вечернего неба, об игре слов в известной песне для тебя всегда будут самыми глубокими и ценными. Именно тогда ты чувствуешь себя собой.\n\nТвоя энергия — светлая и заразительная. Рядом с тобой люди начинают замечать красоту, которую раньше просто упускали в суете дней. Ты не просто потребляешь искусство — ты сама становишься его частью, преображая всё, к чему прикасаешься, своим взглядом и глубоким чувством.\n\nТвой вызов: граница между тем, кто любуется, и тем, кто создаёт — тоньше, чем кажется. Ты уже по ту сторону. Осталось лишь поверить.",
    values: "Вдохновение, красота, созидание, свет, оптимизм",
    superpower:
      "Ты умеешь превращать идеи в реальность. Твоя энергия заразительна, а твой взгляд на мир делает его красивее для всех вокруг.",
    aestheticInLife: {
      wardrobe:
        "Светлые тона, лён, хлопок, золотые аксессуары, элегантная простота",
      space:
        "Большие окна, свет, искусство на стенах, живые цветы, минимализм с душой",
      photography:
        "Золотой час, архитектура, натюрморты, мягкие тени, тёплые тона",
      music: "Классика, инди-фолк, джаз, фортепиано, вдохновляющие саундтреки",
    },
  },
};
// ─── Scoring Logic ───────────────────────────────────────────────────────────
export function createEmptyScores(): Record<AestheticKey, number> {
  return {
    cottagecore: 0,
    goblincore: 0,
    witchcore: 0,
    castlecore: 0,
    fairycore: 0,
    darkAcademia: 0,
    lightAcademia: 0,
  };
}
export function calculateResult(
  selectedAnswers: (string | null)[],
): QuizResult {
  const scores = createEmptyScores();
  // Accumulate scores from all answered questions
  for (let i = 0; i < QUESTIONS.length; i++) {
    const answerId = selectedAnswers[i];
    if (!answerId) continue;
    const question = QUESTIONS[i];
    const answer = question.answers.find((a) => a.id === answerId);
    if (!answer) continue;
    for (const entry of answer.scores) {
      scores[entry.aesthetic] += entry.points;
    }
  }
  // Sort aesthetics by score descending
  const sorted = (Object.keys(scores) as AestheticKey[]).sort(
    (a, b) => scores[b] - scores[a],
  );
  const primaryKey = sorted[0];
  const secondaryKey = sorted[1];
  const primaryResult = AESTHETIC_RESULTS[primaryKey];
  const secondaryResult = AESTHETIC_RESULTS[secondaryKey];
  const diff = scores[primaryKey] - scores[secondaryKey];
  const isBlend = diff <= 3;
  return {
    primary: primaryResult,
    secondary: isBlend ? secondaryResult : undefined,
    isBlend,
    scores,
  };
}
// ─── Aesthetic Display Names (Russian) ───────────────────────────────────────
export const AESTHETIC_NAMES: Record<AestheticKey, string> = {
  cottagecore: "Cottagecore",
  goblincore: "Goblincore",
  witchcore: "Witchcore",
  castlecore: "Castlecore",
  fairycore: "Fairycore",
  darkAcademia: "Dark Academia",
  lightAcademia: "Light Academia",
};
