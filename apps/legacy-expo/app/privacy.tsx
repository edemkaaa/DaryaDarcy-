import { ScrollView, Text, Pressable, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { WOOLEN_FONT } from "@/lib/brand-font";
import { PUBLIC_CONTACT_EMAIL } from "@shared/contact";

const BROWN = "#5C4033";
const BROWN_MUTED = "#8B7355";

const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: "1. Общие положения",
    body: [
      "Настоящая Политика конфиденциальности описывает порядок сбора, хранения, использования и защиты персональных данных пользователей веб-приложения «Клуб Darcy» (далее — «Приложение»), расположенного по адресу daryadarcy.com и принадлежащего ИП Левина Дарья Сергеевна (далее — «Администратор»).",
      "Используя Приложение, вы соглашаетесь с условиями настоящей Политики. Если вы не согласны с какими-либо положениями, пожалуйста, воздержитесь от использования Приложения.",
    ],
  },
  {
    title: "2. Какие данные мы собираем",
    body: [
      "2.1. При регистрации: имя (или никнейм), фотография профиля, пол, номер телефона (для входа по SMS) и адрес электронной почты.",
      "2.2. При использовании раздела «Почтовое отделение» (по желанию): город, интересы, почтовый адрес.",
      "2.3. При оформлении подписки (через сервис Prodamus): номер телефона и адрес электронной почты. Администратор не собирает и не хранит данные банковских карт — их обрабатывает Prodamus.",
      "2.4. Автоматически: тип устройства и браузера, дата и время посещения, действия внутри Приложения.",
    ],
  },
  {
    title: "3. Как мы используем ваши данные",
    body: [
      "Данные используются для входа в аккаунт (в том числе по SMS-коду), доступа к Приложению, подбора друга по переписке, связи по вопросам подписки и улучшения сервиса.",
      "Мы не используем данные для рекламы третьих лиц, продажи третьим лицам или рассылок без согласия.",
    ],
  },
  {
    title: "4. Защита данных",
    body: [
      "Персональные данные хранятся на защищённых серверах. Доступ есть только у Администратора и технического специалиста. Почтовый адрес виден только другу по переписке.",
    ],
  },
  {
    title: "5. Передача данных третьим лицам",
    body: [
      "Мы не передаём персональные данные третьим лицам, за исключением сервиса Prodamus для обработки платежей, сервиса SMS.ru для отправки кода входа и случаев, предусмотренных законодательством.",
    ],
  },
  {
    title: "6. Ваши права",
    body: [
      "Вы можете просматривать и редактировать данные в профиле, удалить анкету из «Почтового отделения», запросить полное удаление аккаунта у Администратора и отказаться от подписки в любое время.",
    ],
  },
  {
    title: "7. Хранение данных",
    body: [
      "Данные хранятся, пока существует аккаунт. После окончания подписки на Клуб аккаунт сохраняется в бесплатном режиме — данные не удаляются автоматически. Полное удаление или обезличивание — только по вашему запросу в профиле (не ранее чем через 30 дней после окончания оплаченного периода Клуба, если подписка была). Резервные копии БД: на сервере до 14 суток, в S3 — до 90 суток.",
    ],
  },
  {
    title: "8. Интеллектуальная собственность",
    body: [
      "Весь контент Приложения — интеллектуальная собственность Администратора. Копирование, скриншоты для распространения, передача доступа и коммерческое использование запрещены. Нарушение влечёт блокировку без возврата средств, неустойку 100 000 ₽ за каждый факт и ответственность по ст. 1301 ГК РФ.",
    ],
  },
  {
    title: "9. Правила поведения в Клубе",
    body: [
      "Запрещены оскорбления, политика и религия, дискриминация, спам, реклама и нецензурная лексика. Нарушение влечёт блокировку без возврата средств.",
    ],
  },
  {
    title: "10–12. Cookie, изменения, контакты",
    body: [
      "Приложение может использовать cookie для авторизации и настроек.",
      "Актуальная версия Политики всегда доступна в Приложении.",
      `Администратор: ИП Левина Дарья Сергеевна. Сайт: daryadarcy.com. Email: ${PUBLIC_CONTACT_EMAIL}.`,
    ],
  },
];

export default function PrivacyScreen() {
  return (
    <ScreenContainer containerClassName="bg-[#FDF8F0]">
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Назад</Text>
        </Pressable>
        <Text style={styles.kicker}>DARYADARCY</Text>
        <Text style={styles.title}>Политика конфиденциальности{"\n"}и Условия использования</Text>
        <Text style={styles.date}>Клуб Darcy · 17 августа 2026 г.</Text>
        <Pressable onPress={() => router.push("/legal" as any)} style={styles.legalLink}>
          <Text style={styles.legalLinkText}>Все юридические документы →</Text>
        </Pressable>
        {SECTIONS.map((section) => (
          <View key={section.title} style={styles.block}>
            <Text style={styles.heading}>{section.title}</Text>
            {section.body.map((paragraph) => (
              <Text key={paragraph} style={styles.body}>{paragraph}</Text>
            ))}
          </View>
        ))}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 24,
    paddingBottom: 48,
    paddingTop: 8,
  },
  back: {
    alignSelf: "flex-start",
    paddingVertical: 8,
  },
  backText: {
    fontFamily: "EBGaramond-Regular",
    color: BROWN_MUTED,
    fontSize: 15,
  },
  kicker: {
    letterSpacing: 2,
    textAlign: "center",
    color: BROWN_MUTED,
    fontFamily: WOOLEN_FONT,
    fontSize: 22,
    marginTop: 8,
  },
  title: {
    fontFamily: "EBGaramond-Regular",
    fontSize: 26,
    color: BROWN,
    textAlign: "center",
    marginTop: 10,
    lineHeight: 32,
  },
  date: {
    fontFamily: "EBGaramond-Italic",
    fontSize: 14,
    color: BROWN_MUTED,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 12,
  },
  legalLink: {
    alignSelf: "center",
    marginBottom: 20,
  },
  legalLinkText: {
    fontFamily: "EBGaramond-Regular",
    fontSize: 15,
    color: BROWN,
    textDecorationLine: "underline",
  },
  block: {
    marginBottom: 18,
    gap: 8,
  },
  heading: {
    fontFamily: "EBGaramond-SemiBold",
    fontSize: 17,
    color: BROWN,
  },
  body: {
    fontFamily: "EBGaramond-Regular",
    fontSize: 15,
    color: BROWN,
    lineHeight: 22,
  },
});
