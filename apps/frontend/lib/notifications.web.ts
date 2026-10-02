export async function requestNotificationPermissions(): Promise<boolean> {
  return false;
}

export async function schedulePostReminder(
  _postId: number | string,
  _scheduledAt: Date,
  _postPreview: string,
): Promise<string | null> {
  return null;
}

export async function cancelPostReminder(_identifier: string): Promise<void> {}

export async function cancelAllPostReminders(): Promise<void> {}

export async function getScheduledReminders() {
  return [];
}
