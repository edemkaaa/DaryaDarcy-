import { useState } from "react";
import {
  Text,
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  Dimensions,
  Linking,
  FlatList,
  Modal,
  ImageBackground,
  Platform,
} from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialIcons } from "@expo/vector-icons";
import { useAuth } from "@/hooks/use-auth";
import { ContactEmailLine } from "@/components/contact-email-line";
import { LegalDocumentsFooter } from "@/components/legal-documents-footer";
import { trpc } from "@/lib/trpc";

// ─── Constants ───────────────────────────────────────────────────────────────

const PAPER_TEXTURE_URI =
  "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/d0db18ed8f2e-MasrlKbgCBdeyOhE.jpg";

const BROWN = "#3D2B1F";
const BROWN_MUTED = "#8B7355";
const BROWN_LIGHT = "#D4C4A8";
const CREAM = "#FDF8F0";

// ─── Product Data ────────────────────────────────────────────────────────────

interface Product {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  price: string;
  coverUrl: string;
  imageUrl: string;
  type: "book" | "digital";
  links: { name: string; url: string; size?: "primary" | "secondary" }[];
  details?: string[];
  aboutTitle?: string;
  gallery?: string[];
  reviews?: { text: string; author?: string }[];
  reviewImages?: string[];
}

const PRODUCTS: Product[] = [
  {
    id: "book-1",
    title: "Книга Вдохновения",
    subtitle: "Сезонные рецепты, стиль и идеи домашнего декора",
    aboutTitle: "О чём эта книга?",
    description:
      "Конечно же, о вдохновении! На атмосферную, эстетичную и немного сказочную повседневность, на поиск радости и красоты в простых вещах. Содержание разделено на 4 части по временам года, и в каждой собраны сезонные рецепты, мастер-классы по вышивке и декору дома, главы о стиле, уютных делах, подготовке к праздникам...\n\nЯ мечтала создать такую книгу, к которой хотелось бы возвращаться каждый месяц за небольшой порцией вдохновения и напоминанием, что счастье в простом и очень близком. Это не художественное произведение по своему жанру, но, мне кажется, что именно таким оно получилось — очень художественным. С поэтичными описаниями и образами, с медовыми фотографиями, рисованными рамочками на состаренных страницах.\n\nЭта книга наполнена теплом и любовью, и поселилась уже в 40000 домах. Пусть она согреет и вас!",
    price: "",
    coverUrl:
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-1/cover.webp",
    imageUrl:
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/b8106c44719f-tlMfbAYBCxFjOQfm.webp",
    type: "book",
    links: [
      { name: "Ozon", url: "https://ozon.ru/t/1fcfQng", size: "primary" },
      { name: "Wildberries", url: "https://www.wildberries.ru/catalog/41571054/detail.aspx?size=83497342", size: "primary" },
      { name: "Купить в Европе", url: "https://kniga.lv/shop/kniga-vdohnovenija-sezonnye-recepty-stil-i-idei-domashnego-dekora-na-kazhdoe-vremja-goda", size: "secondary" },
      { name: "На сайте издательства", url: "https://shop.kp.ru/Kniga-vdohnoveniya-Sezonnie-recepti-stil-i-idei-domashnego-dekora-na-kajdoe-vremy-goda-797194.html", size: "secondary" },
    ],
    details: [
      "Автор: Дарья Левина",
      "Формат: 25.5 × 19.7 см",
      "192 страницы",
      "Твёрдая обложка",
      "Мелованная бумага",
      "Полноцветная печать",
    ],
    gallery: [
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-1/img-6129.jpg",
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-1/img-6133.jpg",
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-1/img-6130.jpg",
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-1/img-6127.jpg",
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-1/img-6131.jpg",
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-1/img-6132.jpg",
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-1/img-6126.jpg",
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-1/img-6128.jpg",
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-1/img-6125.jpg",
    ],
  },
  {
    id: "book-2",
    title: "Тропинка к Творчеству",
    subtitle: "Рукотворная уютная жизнь",
    description:
      "О чём же эта книга? Я описываю её как подорожник для каждой творческой души. В ней переплетается как психологическая часть творчества, так и практические идеи, мастер-классы, рецепты, упражнения! Вместе мы будем искать вдохновение, набираться уверенности, чтобы начать делиться своими творениями, я постараюсь помочь справиться с трудными моментами и не опускать руки!\n\nСезонное вдохновение пронизывает всю книгу, и вы чётко будете различать его от разворота к развороту, но в этот раз она не разбита на 4 части по сезонам, как предыдущие. Она действительно как извилистая тропинка с непредсказуемыми поворотами, которая в итоге приведет вас к совершенно новому взгляду на творчество и реализацию себя!\n\nЧто касается оформления, то вас ждёт самое тёплое и уютное издание, которое ощущается как лоскутное одеяло. Акварельные иллюстрации и рамочки на каждом развороте, огромное количество элементов, которые можно рассматривать часами, насыщенная, но приятная глазу цветовая гамма.\n\nМой личный фаворит из всех трёх книг!",
    price: "",
    coverUrl:
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-2/cover.webp",
    imageUrl:
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/13d6a513f39b-nJGBnjSsHvYTlKyD.webp",
    type: "book",
    links: [
      { name: "Ozon", url: "https://ozon.ru/t/7GNGr2o", size: "primary" },
      { name: "Wildberries", url: "https://www.wildberries.ru/catalog/583300940/detail.aspx?size=797386247", size: "primary" },
      { name: "Купить в Европе", url: "https://kniga.lv/shop/tropinka-k-tvorchestvu-rukotvornaja-ujutnaja-zhizn", size: "secondary" },
      { name: "На сайте издательства", url: "https://shop.kp.ru/Kniga-Tropinka-k-tvorchestvu-Rukotvornaya-uyutnaya-jizn-797872.html", size: "secondary" },
    ],
    details: [
      "Автор: Дарья Левина",
      "Формат: 24.0 × 19.7 см",
      "192 страницы",
      "Твёрдая обложка",
      "Мелованная бумага",
      "Акварельные иллюстрации",
      "Мастер-классы, рецепты, упражнения",
    ],
    gallery: [
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-2/cover-shelf.jpg",
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-2/toc.jpg",
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-2/autumn.jpg",
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-2/crafts.jpg",
    ],
  },
  {
    id: "book-3",
    title: "Романтика Дачи",
    subtitle: "Традиции, воспоминания, вдохновение",
    aboutTitle: "Что вы найдёте на состаренных страницах этой книги?",
    description:
      "~ эстетику дореволюционной России и главы об истории возникновения дач, архитектуре, традициях, досуге, гардеробе первых дачников и многое, многое другое.\n\n~ личные главы с моими дачными воспоминаниями: душевные рассказы о моём детстве, любимых щитовых домиках на шести сотках и дорогих людях.\n\n~ главы о переделке нашей сказочной дачи, советы по обустройству, дизайну, сочетанию цветов и стилей. Всё о том, как сохранить или создать с нуля ту самую неповторимую дачную атмосферу!\n\n~ Сезонное вдохновение: как провести каждое время года на даче волшебно и уютно. Здесь вы встретите и мои советы по дачному гардеробу, и списки дел, и секреты «медленной» жизни.\n\nКонечно же, в каждой главе спрятаны рецепты! Простые, вкусные, красивые. А ещё мастер-классы по декору, коллажи, акварельные иллюстрации и скетчи, рисованные от руки рамочки и тёплые фотографии.\n\nЭто очень личная и душевная книга станет украшением дачи или загородного дома, подарит вдохновение и ощущение летнего отдыха.",
    price: "",
    coverUrl:
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-3/cover.webp",
    imageUrl:
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/94b5bebfd7f4-IbTlGDtcIAJBcJAR.webp",
    type: "book",
    links: [
      { name: "Ozon", url: "https://ozon.ru/t/j7o7PNl", size: "primary" },
      { name: "Wildberries", url: "https://www.wildberries.ru/catalog/149198904/detail.aspx?size=250442622", size: "primary" },
      { name: "Купить в Европе", url: "https://kniga.lv/shop/romantika-dachi", size: "secondary" },
      { name: "На сайте издательства", url: "https://shop.kp.ru/Kniga-Romantika-dachi-Tradicii-proshlogo-detskie-vospominaniya-i-uyutnaya-zagorodnaya-zhizn-nastoyashchego-797521.html", size: "secondary" },
    ],
    details: [
      "Автор: Дарья Левина",
      "Формат: 25.5 × 19.7 см",
      "192 страницы",
      "Твёрдая обложка",
      "Мелованная бумага",
      "Рецепты, мастер-классы, акварельные иллюстрации",
    ],
    gallery: [
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-3/cover-shelf.jpg",
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-3/toc.jpg",
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-3/book-desk.jpg",
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-3/spread-life.jpg",
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-3/spread-pokoy.jpg",
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-3/spread-makeover.jpg",
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-3/book-open.jpg",
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-3/spread-wardrobe.jpg",
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/book-3/spread-clothes.jpg",
    ],
  },
  {
    id: "digital-1",
    title: "Пособие по атмосферной фотографии",
    subtitle: "Электронная книга-курс в формате PDF",
    description:
      "Это электронная книга-курс (в формате PDF), в которой я делюсь всеми своими секретами и приёмами; очень простым языком объясняю техническую сторону и теорию фотографии; вдохновляю на творчество и смелое выражение себя.\n\nВсего в пособии 8 глав:\n\n~ Техническая сторона фотографии (обещаю, что вы за несколько минут раз и навсегда разберётесь со всеми настройками и ручным режимом съёмки)\n~ Свет (каким бывает свет, как с ним работать, его влияние на атмосферу)\n~ Цвет (гармоничные сочетания цветов и цветовые схемы)\n~ Композиция (лучшие композиционные приёмы и ракурсы с подробным разбором на примерах)\n~ Реквизит (где искать и хранить реквизит для съёмок, как создавать его самому и сочетать в кадре)\n~ Психологические аспекты фотографии (что ещё влияет на атмосферность и душевность кадров?)\n~ Обработка (описание каждой настройки и подробный алгоритм действий, мои любимые приложения и секреты тёплых, медовых фотографий)\n~ Собственный стиль (моя личная история поиска собственного стиля, разбор эстетик и советы по созданию собственной, а также список фильмов, развивающих эстетический вкус)\n\nПособие оформлено как старинная книга: с фактурной обложкой, ботаническими иллюстрациями и сокровищами на пожелтевших страницах: винтажными ножницами, ключами, медальонами... Чтобы листая его, вы могли вдохновиться на творчество и создание собственной красоты!",
    price: "50 \u20bd",
    coverUrl:
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/vjdQHvFhVxKjVyWq.webp",
    imageUrl:
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/76751795802b-cvPWAEJjkmXMKPjM.webp",
    type: "digital",
    links: [
      { name: "Оплатить", url: "prodamus:digital-1", size: "primary" },
    ],
    details: [
      "Автор: Дарья Левина",
      "Формат: PDF",
      "8 глав",
      "136+ страниц",
      "Ботанические иллюстрации",
      "Цифровой продукт — мгновенная доставка",
    ],
    gallery: [
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/PBfYGmrZAiWpzHvD.JPG",
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/aaDcJuCLOeCrHfxk.JPG",
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/nZoznAbRePJnvALl.JPG",
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/VTdmWRaePLfvfgrq.JPG",
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/aNIPzDLqCSCRrrKT.JPG",
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/mltnKcpNhCFwXkYN.JPG",
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/KmoncPQbMmceOtFu.jpeg",
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/OpGQZMvzgVXxbwhN.jpeg",
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/moLPhaYtFBzPVhrp.jpeg",
    ],
    reviews: [
      { text: "Хочу поблагодарить Вас за прекрасное пособие по атмосферной фотографии. Я прочитала его с огромным удовольствием и пользуюсь полученными знаниями. Отдельно хотелось бы остановится на оформлении. Очень красивая книга с особой аурой, как и все что вы делаете. Приятный цвет страниц, чудесные иллюстрации вашими фотографиями. Сам материал шикарно изложен, даже новичку все понятно. Особенно понравилась глава про эстетику. Книга не похожа на сухую методичку, как многие другие книги по фотографии, она больше напоминает художественную литературу. Спасибо большое за то что поделились своими знаниями:)" },
      { text: "Это Пособие способно изменить взгляд на фотографию! Кроме того, что техническая сторона теперь не кажется такой пугающе сложной, а знания о свете, цвете и композиции наконец разложены по полочкам в голове, самое ценное — это бесконечная вера автора в нас, читателей. Она верит, что каждый из нас уже имеет свой собственный стиль и может творить, главное — делать это регулярно. А для того, чтобы развить свой потенциал быстрее, интереснее и проще, Пособие подходит как нельзя лучше!" },
      { text: "Очень благодарна за ваше пособие, оно волшебное! Его так легко и приятно изучать, невероятно вдохновляет, а главное, в нём собрано именно то, что нужно! Оттягивала изучение настроек фотоаппарата, казалось, что сейчас не готова столько много сложной информации усвоить. Но с вашим пособием всё оказалось очень просто. Визуальное оформление пособия — отдельное удовольствие, я в восторге!" },
      { text: "Я в восторге от пособия. Отозвалось и ответило на те вопросы, которые волновали именно меня. Спасибо!!!" },
      { text: "Огромное Вам спасибо за пособие! Читается как художественная книга. Читаю и не хочется останавливаться. Первый раз прочла залпом. Просто было очень интересно. Как в детективе — а что же дальше? Написано очень доступно и понятно. А примеры фото просто завораживают. Многое хочется сразу повторить." },
      { text: "Вы не думаете об издании печатного варианта? Очень хочется именно полистать, перечитать, положить на прикроватную тумбочку это волшебство." },
      { text: "Я в восторге от вашего Пособия по созданию атмосферных фотографий! Очень много ценной информации и по настройке камеры, и по композиции, по свету, по подбору реквизита, с подробным объяснением его применения. А оформление Пособия — это просто нереальная красота, получаешь не только ценные знания, но и истинное эстетическое удовольствие. Спасибо огромное, за такую замечательную возможность прикоснуться к прекрасному и получить новый стимул для творчества!" },
      { text: "Читая пособие я прыгала от радости! Потому что нашла ответы на все свои вопросы, поняла в каком стиле хочу фотографировать и получила кучу вдохновения. Ваше пособие это лучшее что я читала на тему фотографии. Простой и полезный текст и потрясающее оформление." },
      { text: "Спасибо огромное за чудесное Пособие! Великолепные фотографии, которые можно рассматривать бесконечно, отличные рекомендации по техническим вопросам. Информация подана совершенно по-новому, искренне и с душой. Ничего общего с обычной сухостью учебников по фото. Я в восторге, и очень хотела бы купить такую печатную книгу." },
      { text: "Это самое доступное для понимания и самое полезное пособие, которое я когда-либо видела. Все настолько легко и понятно написано, что все само моментально запоминается. Кроме того, в нем очень много фотографий, что придаёт пособию ещё больше атмосферы уюта и тепла. После прочтения появляется столько вдохновения, что руки сами тянутся что-нибудь поснимать.", author: "rudyuk_anastasia" },
      { text: "Даша, добрый день! Мой отзыв о Вашем пособии по фотографии будет длинным, но сказать кратко я не смогу, потому что переполнена эмоциями и благодарностью! Я влюбилась в Ваши фотоработы с первого взгляда. Будучи преданным поклонником истории, я просто не могла пройти мимо той атмосферы, которой пронизана Ваша страница. Вы тонкая, изящная, вдохновляющая. И все это отражено в Ваших работах. Я читала пособие на одном дыхании, и знаете, о чем думала? Как бы я хотела вживую учиться у такого мастера, как Вы!" },
      { text: "Ознакомилась с вашим пособием. Оно прекрасно!!! Столько много полезной информации, неочевидных мелочей, которые превращают обычное фото в иллюстрацию сказки! Все написано очень доступно, тепло, как-будто не просто прочитал инструкцию, а поговорил с хорошим другом. А самое главное, что вы очень вдохновляете! Спасибо вам за ваше творчество!" },
      { text: "Ваше пособие невероятно вдохновляющее. И спасибо, что выделили самое главное, без воды и пафоса! Я впервые перевела камеру в режим М. Раньше это было настолько боязно, что я боялась даже начать разобраться, ибо понимала, какой объем специфической информации нужно переработать, чтобы найти всего несколько нужных мне опций! Благодарю!", author: "galina_kykolkina" },
      { text: "Дарья, вы моё вдохновение! Именно встретившись с вашим творчеством я увидела вектор своего развития. А благодаря вашему пособию теперь знаю как воплотить свои творческие задумки! Огромное вам спасибо!", author: "galina_kykolkina" },
      { text: "Огромная моя сердечная благодарность, дорогая Дарья, за ваше увлекательное, вдохновляющее и познавательное пособие по атмосферной предметной фотографии!!! 100 страниц сплошного удовольствия! Все сложные для меня технические характеристики изложены максимально доступно. Прибегаю к вашему пособию каждый раз для вдохновения и отдохновения. Так приятно полистать страницы, созданные с такой эстетикой, стилем и любовью к фотографии. Всё ваше пособие пропитано теплом и уютным светом." },
    ],
  },
  {
    id: "digital-2",
    title: "Винтажные книги и открытки",
    subtitle: "Мастер-класс по дизайну обложек",
    description:
      "В мастер-класс входит:\n\n~ пошаговая инструкция по созданию «старинных» книг\n~ более 200(!) книжных обложек для скачивания\n~ секреты печати винтажных открыток\n~ более 200(!) винтажных открыток для печати\n~ идеи использования книг и открыток в декоре и на фотографиях\n~ бесконечное вдохновение!\n\nЯ очень старалась сделать его эстетичным и вдохновляющим. Чтобы листая его, вы словно переворачивали пожелтевшие от времени страницы книги, встречая на них цветочный гербарий, почтовые марки и нежные крылья бабочек. Чтобы иллюстрации хотелось разглядывать, а после прочтения появлялось желание творить!",
    price: "50 \u20bd",
    coverUrl:
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/eWHYEgFyQkkTVIac.webp",
    imageUrl:
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/b573a5cea177-nNMSLpNDmzQdnfqe.webp",
    type: "digital",
    links: [
      { name: "Оплатить", url: "prodamus:digital-2", size: "primary" },
    ],
    details: [
      "Формат: PDF",
      "Цифровой продукт",
      "Мгновенная доставка",
      "Шаблоны и материалы",
    ],
    gallery: [
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/fHBiLIdoOBjhvOYB.JPG", // Содержание
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/SposdtLMcZWpTsyM.JPG", // Фото винтажных книг
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/xGKrarMYfeycHdkb.JPG", // Что входит в мастер-класс
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/GyoFVkxRZaWzdOws.JPG", // Фото с перьями и книгами
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/bqfYlZTjwUTYkjTU.JPG", // Отрывки мастер-класса 1
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/duefjXzIoLGcxdSk.JPG", // Фото с чаем на книгах
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/shop/luiZwEIyLvSFPdXH.JPG", // Отрывки мастер-класса 2
    ],
    reviewImages: [
      "https://s3.twcstorage.ru/daryadarcy-s3/app-assets/manus/fd2a40d2d655-odfxOAxwqkixLoZd.jpeg",
    ],
  },
];

// ─── Layout Constants ────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CAROUSEL_ITEM_WIDTH = SCREEN_WIDTH * 0.58;
const CAROUSEL_ITEM_HEIGHT = CAROUSEL_ITEM_WIDTH * (5 / 4);

const SHOP_MISSING_FILES = new Set([
  "veXysoFDZMKZaCDB.PNG",
  "koLmphlWqhNfBNNV.jpeg",
  "sVhxDQBKkyhDDdnM.jpeg",
  "qqJOhCdOtezhXgRL.jpeg",
  "cQOxsMCmqBHNodJb.jpeg",
  "acowSIYLDimbpFaU.jpeg",
  "agcZRQuPqqUIkbfg.jpeg",
  "kIvlvGffqWCvSlth.PNG",
  "UouzQSOhhezBWDeT.webp",
  "cDggMTjJaSHKEpui.webp",
  "ewxmaFgszedwfCDc.webp",
  "wOGcBVuJHDvZVMSb.webp",
  "SAzFHKXBjPlpSODC.webp",
  "xECVAhnvSMZUDvKV.webp",
  "duefjXzIoLGcxdSk.JPG",
  "luiZwEIyLvSFPdXH.JPG",
]);

function isPublicShopAsset(url: string): boolean {
  if (!url.includes("/app-assets/shop/")) return true;
  const file = url.split("/").pop() || "";
  return !SHOP_MISSING_FILES.has(file);
}

// ─── Screen Component ────────────────────────────────────────────────────────

export default function ProductDetailScreen() {
  const { id: idParam, paid } = useLocalSearchParams<{ id: string; paid?: string }>();
  const id = Array.isArray(idParam) ? idParam[0] : idParam;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const checkout = trpc.shop.createCheckout.useMutation();
  const ownedQuery = trpc.shop.owned.useQuery(
    { productId: String(id || "") },
    { enabled: Boolean(id) },
  );
  const [zoomVisible, setZoomVisible] = useState(false);
  const [zoomImageUri, setZoomImageUri] = useState("");
  const [zoomIndex, setZoomIndex] = useState(0);
  const [payError, setPayError] = useState<string | null>(null);

  const product = PRODUCTS.find((p) => p.id === id);

  if (!product) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>Товар не найден</Text>
      </View>
    );
  }

  const coverUrl = isPublicShopAsset(product.coverUrl) ? product.coverUrl : product.imageUrl;
  const gallery = (product.gallery || []).filter(isPublicShopAsset);
  const reviewImages = (product.reviewImages || []).filter(isPublicShopAsset);
  const owned = Boolean(ownedQuery.data?.owned) || (product.type === "digital" && paid === "1");

  const handleBuyPress = (url: string) => {
    if (url.startsWith("prodamus:")) {
      void (async () => {
        setPayError(null);
        if (!isAuthenticated) {
          router.push(`/login?next=/shop/${product.id}` as any);
          return;
        }
        try {
          const result = await checkout.mutateAsync({ productId: product.id });
          if (Platform.OS === "web" && typeof window !== "undefined") {
            window.location.assign(result.url);
            return;
          }
          await Linking.openURL(result.url);
        } catch (error) {
          setPayError(error instanceof Error ? error.message : "Не удалось открыть оплату");
        }
      })();
      return;
    }
    Linking.openURL(url);
  };

  const openZoom = (uri: string, index: number) => {
    setZoomImageUri(uri);
    setZoomIndex(index);
    setZoomVisible(true);
  };

  const zoomPrev = () => {
    if (zoomIndex > 0) {
      const newIdx = zoomIndex - 1;
      setZoomIndex(newIdx);
      setZoomImageUri(gallery[newIdx]);
    }
  };

  const zoomNext = () => {
    if (zoomIndex < gallery.length - 1) {
      const newIdx = zoomIndex + 1;
      setZoomIndex(newIdx);
      setZoomImageUri(gallery[newIdx]);
    }
  };

  return (
    <ImageBackground
      source={{ uri: PAPER_TEXTURE_URI }}
      style={styles.container}
      resizeMode="cover"
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 80 }}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backButton,
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <MaterialIcons name="arrow-back" size={20} color={BROWN} />
          </Pressable>
          <View style={{ flex: 1 }} />
        </View>

        {/* Cover Image */}
        <View style={styles.coverSection}>
          <Image
            source={{ uri: coverUrl }}
            style={[
              styles.coverImage,
              product.type === "book" && styles.coverImagePng,
            ]}
            contentFit={product.type === "book" ? "contain" : "cover"}
            transition={300}
          />
        </View>

        {/* Title Section */}
        <View style={styles.titleSection}>
          <Text style={styles.productTitle}>{product.title.toLocaleUpperCase("ru-RU")}</Text>
          <Text style={styles.productSubtitle}>{product.subtitle}</Text>
        </View>

        {/* Gallery Carousel — smooth scroll, no pagination dots */}
        {gallery.length > 0 && (
          <View style={styles.gallerySection}>
            <FlatList
              data={gallery}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(_, i) => `gallery-${i}`}
              contentContainerStyle={styles.carouselList}
              renderItem={({ item, index }) => (
                <Pressable
                  onPress={() => openZoom(item, index)}
                  style={({ pressed }) => [
                    styles.carouselItem,
                    { opacity: pressed ? 0.9 : 1 },
                  ]}
                >
                  <Image
                    source={{ uri: item }}
                    style={styles.carouselImage}
                    contentFit="cover"
                    transition={200}
                  />
                </Pressable>
              )}
            />
          </View>
        )}

        {/* Buy Buttons */}
        {product.links.length > 0 && (
          <View style={styles.buySection}>
            {product.links
              .filter((l) => !l.size || l.size === "primary")
              .map((link, index) => (
                <Pressable
                  key={`primary-${index}`}
                  style={({ pressed }) => [
                    styles.buyButton,
                    { opacity: pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] },
                  ]}
                  onPress={() => {
                    if (product.type === "digital" && owned) return;
                    handleBuyPress(link.url);
                  }}
                >
                  <MaterialIcons name="shopping-cart" size={16} color={CREAM} />
                  <Text style={styles.buyButtonText}>
                    {product.type === "digital"
                      ? owned
                        ? "Оплачено"
                        : checkout.isPending
                          ? "Открываем…"
                          : `${link.name} →`
                      : `Купить на ${link.name} →`}
                  </Text>
                </Pressable>
              ))}
            {product.links.filter((l) => l.size === "secondary").length > 0 && (
              <View style={styles.secondaryRow}>
                {product.links
                  .filter((l) => l.size === "secondary")
                  .map((link, index) => (
                    <Pressable
                      key={`secondary-${index}`}
                      style={({ pressed }) => [
                        styles.secondaryButton,
                        { opacity: pressed ? 0.85 : 1 },
                      ]}
                      onPress={() => handleBuyPress(link.url)}
                    >
                      <Text style={styles.secondaryButtonText}>
                        {link.name}
                      </Text>
                    </Pressable>
                  ))}
              </View>
            )}
            {product.type === "digital" ? (
              owned ? (
                <Text style={[styles.comingSoonText, { marginTop: 10, textAlign: "center" }]}>
                  Оплата получена. Файл отправим на почту, указанную при оплате.
                </Text>
              ) : (
                <Text style={[styles.comingSoonText, { marginTop: 10, textAlign: "center" }]}>
                  {payError || (checkout.isPending || authLoading ? "Открываем оплату…" : "Оплата через Prodamus. После оплаты файл придёт на почту.")}
                </Text>
              )
            ) : null}
            {product.type === "digital" ? (
              <View style={{ marginTop: 8 }}>
                <ContactEmailLine prefix="Если письмо не пришло в течение 15 минут:" />
              </View>
            ) : null}
          </View>
        )}

        {product.links.length === 0 && (
          <View style={styles.buySection}>
            <View style={styles.comingSoonBadge}>
              <MaterialIcons name="schedule" size={15} color={BROWN_MUTED} />
              <Text style={styles.comingSoonText}>
                Ссылка на покупку скоро появится
              </Text>
            </View>
          </View>
        )}

        {/* Description */}
        <View style={styles.descriptionSection}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="auto-stories" size={18} color={BROWN_MUTED} />
            <Text style={styles.sectionTitle}>{product.aboutTitle || "О книге"}</Text>
          </View>
          <Text style={styles.descriptionText}>{product.description}</Text>
        </View>

        {/* Details / Characteristics */}
        {product.details && product.details.length > 0 && (
          <View style={styles.detailsSection}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="info-outline" size={18} color={BROWN_MUTED} />
              <Text style={styles.sectionTitle}>Характеристики</Text>
            </View>
            {product.details.map((detail, index) => (
              <View key={index} style={styles.detailRow}>
                <MaterialIcons name="check" size={14} color={BROWN_LIGHT} />
                <Text style={styles.detailText}>{detail}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Reviews Section */}
        {((product.reviews && product.reviews.length > 0) || reviewImages.length > 0) && (
          <View style={styles.reviewsSection}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="format-quote" size={18} color={BROWN_MUTED} />
              <Text style={styles.sectionTitle}>Отзывы</Text>
            </View>

            {/* Review Images (tappable for fullscreen) */}
            {reviewImages.map((imgUri, idx) => (
              <Pressable
                key={`review-img-${idx}`}
                onPress={() => {
                  setZoomImageUri(imgUri);
                  setZoomVisible(true);
                }}
                style={({ pressed }) => [styles.reviewImageWrapper, pressed && { opacity: 0.85 }]}
              >
                <Image
                  source={{ uri: imgUri }}
                  style={styles.reviewImage}
                  contentFit="contain"
                />
              </Pressable>
            ))}

            {/* Text Reviews */}
            {product.reviews && product.reviews.map((review, idx) => (
              <View key={`review-${idx}`} style={styles.reviewCard}>
                <View style={styles.reviewQuoteIcon}>
                  <MaterialIcons name="format-quote" size={16} color={BROWN_LIGHT} />
                </View>
                <Text style={styles.reviewText}>{review.text}</Text>
                {review.author && (
                  <Text style={styles.reviewAuthor}>@{review.author}</Text>
                )}
              </View>
            ))}
          </View>
        )}


        {/* Decorative footer */}
        <View style={styles.footerDecor}>
          <View style={styles.dividerLine} />
          <MaterialIcons name="eco" size={14} color={BROWN_LIGHT} />
          <View style={styles.dividerLine} />
        </View>
        <LegalDocumentsFooter style={{ paddingBottom: 24 }} />
      </ScrollView>

      {/* Fullscreen Zoom Modal */}
      <Modal
        visible={zoomVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setZoomVisible(false)}
      >
        <View style={styles.zoomOverlay}>
          <Pressable
            onPress={() => setZoomVisible(false)}
            style={[styles.zoomCloseButton, { top: insets.top + 16 }]}
          >
            <MaterialIcons name="close" size={28} color="#fff" />
          </Pressable>

          <Image
            source={{ uri: zoomImageUri }}
            style={styles.zoomImage}
            contentFit="contain"
            transition={200}
          />

          <View style={styles.zoomNavRow}>
            <Pressable
              onPress={zoomPrev}
              style={({ pressed }) => [
                styles.zoomNavButton,
                { opacity: zoomIndex === 0 ? 0.3 : pressed ? 0.6 : 1 },
              ]}
              disabled={zoomIndex === 0}
            >
              <MaterialIcons name="chevron-left" size={36} color="#fff" />
            </Pressable>
            <Text style={styles.zoomCounter}>
              {zoomIndex + 1} / {gallery.length}
            </Text>
            <Pressable
              onPress={zoomNext}
              style={({ pressed }) => [
                styles.zoomNavButton,
                { opacity: zoomIndex === gallery.length - 1 ? 0.3 : pressed ? 0.6 : 1 },
              ]}
              disabled={zoomIndex === gallery.length - 1}
            >
              <MaterialIcons name="chevron-right" size={36} color="#fff" />
            </Pressable>
          </View>
        </View>
      </Modal>
    </ImageBackground>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CREAM,
  },
  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(253, 248, 240, 0.85)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: BROWN_LIGHT + "60",
  },
  // Cover
  coverSection: {
    alignItems: "center",
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
  },
  coverImage: {
    width: SCREEN_WIDTH * 0.88,
    aspectRatio: 0.85,
    borderRadius: 4,
    backgroundColor: "transparent",
  },
  coverImagePng: {
    width: SCREEN_WIDTH * 0.72,
    aspectRatio: 0.77,
    borderRadius: 0,
    backgroundColor: "transparent",
  },
  titleSection: {
    paddingHorizontal: 20,
    alignItems: "center",
    marginTop: 8,
    marginBottom: 8,
  },
  productTitle: {
    fontFamily: "EBGaramond-Regular",
    fontSize: 22,
    fontWeight: "400",
    color: BROWN,
    textAlign: "center",
    letterSpacing: 1.4,
  },
  productSubtitle: {
    fontFamily: "EBGaramond-Italic",
    fontSize: 15,
    color: BROWN_MUTED,
    marginTop: 4,
    textAlign: "center",
    lineHeight: 20,
  },
  // Gallery carousel (like interactive test — smooth scroll, no dots)
  gallerySection: {
    marginBottom: 10,
  },
  carouselList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  carouselItem: {
    width: CAROUSEL_ITEM_WIDTH,
    height: CAROUSEL_ITEM_HEIGHT,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#EDE6DA",
  },
  carouselImage: {
    width: "100%",
    height: "100%",
  },
  // Buy
  buySection: {
    paddingHorizontal: 24,
    gap: 8,
    marginBottom: 12,
  },
  buyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BROWN_MUTED,
    paddingVertical: 13,
    borderRadius: 12,
    gap: 8,
  },
  buyButtonText: {
    fontFamily: "EBGaramond-Regular",
    fontSize: 16,
    color: CREAM,
  },
  secondaryRow: {
    flexDirection: "row",
    gap: 8,
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: BROWN_LIGHT,
    backgroundColor: "rgba(253, 248, 240, 0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    fontFamily: "EBGaramond-Regular",
    fontSize: 14,
    color: BROWN,
    textAlign: "center",
  },
  comingSoonBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(139, 115, 85, 0.08)",
    paddingVertical: 11,
    borderRadius: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: BROWN_LIGHT,
    borderStyle: "dashed",
  },
  comingSoonText: {
    fontFamily: "EBGaramond-Italic",
    fontSize: 14,
    color: BROWN_MUTED,
  },
  // Description
  descriptionSection: {
    paddingHorizontal: 24,
    marginBottom: 12,
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 6,
  },
  sectionTitle: {
    fontFamily: "EBGaramond-Bold",
    fontSize: 17,
    color: BROWN,
    letterSpacing: 0.5,
    flex: 1,
    flexShrink: 1,
  },
  descriptionText: {
    fontFamily: "EBGaramond-Regular",
    fontSize: 15,
    color: "#4A3728",
    lineHeight: 23,
  },
  // Details
  detailsSection: {
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    gap: 8,
  },
  detailText: {
    fontFamily: "EBGaramond-Regular",
    fontSize: 14,
    color: "#4A3728",
    flex: 1,
  },
  // Reviews
  reviewsSection: {
    paddingHorizontal: 24,
    marginBottom: 16,
    marginTop: 28,
  },
  reviewImageWrapper: {
    marginBottom: 16,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: BROWN_LIGHT + "40",
  },
  reviewImage: {
    width: "100%" as any,
    aspectRatio: 0.75,
    borderRadius: 12,
  },
  reviewCard: {
    backgroundColor: "rgba(253, 248, 240, 0.7)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: BROWN_LIGHT + "40",
    position: "relative" as any,
  },
  reviewQuoteIcon: {
    position: "absolute" as any,
    top: 8,
    right: 12,
    opacity: 0.4,
  },
  reviewText: {
    fontFamily: "EBGaramond-Regular",
    fontSize: 14,
    color: "#4A3728",
    lineHeight: 21,
  },
  reviewAuthor: {
    fontFamily: "EBGaramond-Italic",
    fontSize: 13,
    color: BROWN_MUTED,
    marginTop: 8,
    textAlign: "right" as any,
  },

  // Footer
  footerDecor: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 60,
    gap: 10,
    marginTop: 8,
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: BROWN_LIGHT,
  },
  // Error
  errorText: {
    fontFamily: "EBGaramond-Regular",
    fontSize: 18,
    color: BROWN,
    textAlign: "center",
    marginTop: 100,
  },
  // Zoom modal
  zoomOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  zoomCloseButton: {
    position: "absolute",
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  zoomImage: {
    width: SCREEN_WIDTH - 32,
    height: SCREEN_WIDTH * 1.2,
  },
  zoomNavRow: {
    position: "absolute",
    bottom: 60,
    flexDirection: "row",
    alignItems: "center",
    gap: 24,
  },
  zoomNavButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  zoomCounter: {
    fontFamily: "EBGaramond-Regular",
    fontSize: 16,
    color: "#fff",
  },
});
