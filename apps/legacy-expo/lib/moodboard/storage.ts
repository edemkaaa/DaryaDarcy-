// Архив Expo. Создаёт локальную метку доски, не криптографический идентификатор доступа.
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { MoodboardDoc, MoodboardSeason } from "@/lib/moodboard/types";
import { MOODBOARD_FREE_LIMIT } from "@/lib/moodboard/constants";

const STORAGE_KEY = "dd_moodboards_v1";

function newId(): string {
  // Создаёт локальную метку доски, не криптографический идентификатор доступа.

  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

async function readAll(): Promise<MoodboardDoc[]> {
  // Читает общий ключ устройства; повреждённый JSON трактуется как пустой список без привязки к аккаунту.

  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as MoodboardDoc[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeAll(boards: MoodboardDoc[]): Promise<void> {
  // Перезаписывает список целиком в AsyncStorage; конкурирующие изменения не объединяются транзакционно.

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(boards));
}

export async function listMoodboards(): Promise<MoodboardDoc[]> {
  // Возвращает локальные доски от самой поздней даты обновления.

  const boards = await readAll();
  return boards.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getMoodboard(id: string): Promise<MoodboardDoc | null> {
  // Ищет одну доску в общем локальном списке по её id.

  const boards = await readAll();
  return boards.find((b) => b.id === id) ?? null;
}

export async function saveMoodboard(board: MoodboardDoc): Promise<void> {
  // Заменяет или добавляет доску и обновляет ISO-дату перед полной записью списка.

  const boards = await readAll();
  const idx = boards.findIndex((b) => b.id === board.id);
  const next = { ...board, updatedAt: new Date().toISOString() };
  if (idx >= 0) boards[idx] = next;
  else boards.push(next);
  await writeAll(boards);
}

export async function deleteMoodboard(id: string): Promise<void> {
  // Удаляет только совпавший id из локального списка, затем сохраняет оставшиеся доски.

  const boards = await readAll();
  await writeAll(boards.filter((b) => b.id !== id));
}

export async function canCreateMoodboard(isClubMember: boolean): Promise<boolean> {
  // Применяет клиентский бесплатный лимит; boolean клуба не является серверной проверкой прав.

  if (isClubMember) return true;
  const boards = await readAll();
  return boards.length < MOODBOARD_FREE_LIMIT;
}

export async function createMoodboard(
  season: MoodboardSeason,
  isClubMember: boolean,
): Promise<MoodboardDoc | "limit"> {
  // Проверяет локальный лимит и создаёт пустую доску с заданным сезоном.

  const allowed = await canCreateMoodboard(isClubMember);
  if (!allowed) return "limit";
  const board: MoodboardDoc = {
    id: newId(),
    season,
    title: "Название мудборда",
    items: [],
    updatedAt: new Date().toISOString(),
  };
  await saveMoodboard(board);
  return board;
}

export async function findLatestBoardForSeason(season: MoodboardSeason): Promise<MoodboardDoc | null> {
  // Находит первую доску сезона после сортировки по времени изменения.

  const boards = await listMoodboards();
  return boards.find((b) => b.season === season) ?? null;
}
