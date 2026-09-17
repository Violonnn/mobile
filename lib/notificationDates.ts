export type NotificationDateGroup = 'today' | 'thisWeek' | 'earlier';

export type NotificationDateSection<T> = {
  key: NotificationDateGroup;
  title: 'Today' | 'This Week' | 'Earlier';
  items: T[];
};

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Sunday 00:00 through the following Sunday 00:00 is the current week. */
export function getNotificationDateGroup(
  createdAt: string,
  now: Date = new Date(),
): NotificationDateGroup {
  const notificationDate = new Date(createdAt);
  if (Number.isNaN(notificationDate.getTime())) return 'earlier';

  const todayStart = startOfLocalDay(now);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  if (notificationDate >= todayStart && notificationDate < tomorrowStart) {
    return 'today';
  }

  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const nextWeekStart = new Date(weekStart);
  nextWeekStart.setDate(nextWeekStart.getDate() + 7);

  if (notificationDate >= weekStart && notificationDate < nextWeekStart) {
    return 'thisWeek';
  }

  return 'earlier';
}

export function groupNotificationsByDate<T extends { createdAt: string }>(
  items: T[],
  now: Date = new Date(),
): NotificationDateSection<T>[] {
  const grouped: Record<NotificationDateGroup, T[]> = {
    today: [],
    thisWeek: [],
    earlier: [],
  };

  items.forEach((item) => {
    grouped[getNotificationDateGroup(item.createdAt, now)].push(item);
  });

  const sections: NotificationDateSection<T>[] = [
    { key: 'today', title: 'Today', items: grouped.today },
    { key: 'thisWeek', title: 'This Week', items: grouped.thisWeek },
    { key: 'earlier', title: 'Earlier', items: grouped.earlier },
  ];

  return sections.filter((section) => section.items.length > 0);
}

