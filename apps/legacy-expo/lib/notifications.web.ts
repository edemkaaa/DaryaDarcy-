// Архив Expo. Web-заглушка явно сообщает, что локальные native уведомления здесь недоступны.
export async function requestNotificationPermissions(): Promise<boolean> {
  // Web-заглушка явно сообщает, что локальные native уведомления здесь недоступны.

  return false;
}

export async function schedulePostReminder(
  _postId: number | string,
  _scheduledAt: Date,
  _postPreview: string,
): Promise<string | null> {
  // Web-заглушка не создаёт расписания и возвращает null.

  return null;
}

export async function cancelPostReminder(_identifier: string): Promise<void> {
  // Сохраняет общий API платформ без попытки отменить native уведомление в браузере.
}

export async function cancelAllPostReminders(): Promise<void> {
  // На web нет native расписаний, поэтому совместимый вызов ничего не делает.
}

export async function getScheduledReminders() {
  // Возвращает пустой web-список без обращения к native модулю.

  return [];
}
