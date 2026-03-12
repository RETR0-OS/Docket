import { listEvents } from './api/calendar.ts';
import { getStorage } from '../shared/storage.ts';
import type { FreeSlot, WorkingHours, DayName } from '../shared/types.ts';

const DAY_NAMES: DayName[] = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

export function getWeekStart(offset: 0 | 1 = 0): Date {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7) + offset * 7);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function dateToString(d: Date): string {
  return d.toISOString().split('T')[0]!;
}

function getSlotsForDay(
  wh: WorkingHours,
  dayName: DayName,
  busyIntervals: Array<[number, number]>,
): Array<[number, number]> {
  const day = wh[dayName];
  if (!day.enabled) return [];

  const workStart = toMinutes(day.start);
  const workEnd = toMinutes(day.end);
  if (workStart >= workEnd) return [];

  // Clip busy intervals to working window and sort
  const clipped = busyIntervals
    .map(([s, e]): [number, number] => [Math.max(s, workStart), Math.min(e, workEnd)])
    .filter(([s, e]) => s < e)
    .sort((a, b) => a[0] - b[0]);

  // Merge overlapping
  const merged: Array<[number, number]> = [];
  for (const [s, e] of clipped) {
    if (merged.length === 0 || s > (merged[merged.length - 1]![1])) {
      merged.push([s, e]);
    } else {
      merged[merged.length - 1]![1] = Math.max(merged[merged.length - 1]![1], e);
    }
  }

  // Gaps ≥ 15 min are free slots
  const free: Array<[number, number]> = [];
  let cursor = workStart;
  for (const [s, e] of merged) {
    if (s - cursor >= 15) free.push([cursor, s]);
    cursor = Math.max(cursor, e);
  }
  if (workEnd - cursor >= 15) free.push([cursor, workEnd]);
  return free;
}

export async function getAvailability(): Promise<FreeSlot[]> {
  const { workingHours } = await getStorage();
  const weekStart = getWeekStart(0);
  const twoWeeksEnd = new Date(weekStart);
  twoWeeksEnd.setDate(weekStart.getDate() + 14);

  const events = await listEvents(weekStart.toISOString(), twoWeeksEnd.toISOString());

  const slots: FreeSlot[] = [];

  for (let i = 0; i < 14; i++) {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + i);
    const dateStr = dateToString(day);
    const dayName = DAY_NAMES[day.getDay()]!;

    // Collect busy intervals for this day in minutes
    const busy: Array<[number, number]> = [];
    for (const ev of events) {
      const evDateStr = (ev.start.dateTime ?? ev.start.date ?? '').slice(0, 10);
      if (evDateStr !== dateStr) continue;
      if (!ev.start.dateTime || !ev.end.dateTime) continue;
      const s = new Date(ev.start.dateTime);
      const e = new Date(ev.end.dateTime);
      busy.push([s.getHours() * 60 + s.getMinutes(), e.getHours() * 60 + e.getMinutes()]);
    }

    const free = getSlotsForDay(workingHours, dayName, busy);
    for (const [s, e] of free) {
      slots.push({ date: dateStr, start: formatTime(s), end: formatTime(e) });
    }
  }

  return slots;
}

export function formatAvailabilityText(slots: FreeSlot[]): string {
  if (slots.length === 0) return 'No free slots found in the next two weeks.';

  const byDate: Record<string, FreeSlot[]> = {};
  for (const slot of slots) {
    (byDate[slot.date] ??= []).push(slot);
  }

  const lines: string[] = ['Available slots (next 2 weeks):'];
  for (const [date, daySlots] of Object.entries(byDate)) {
    const d = new Date(`${date}T12:00:00`);
    const label = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const times = daySlots.map((s) => `${s.start}–${s.end}`).join(', ');
    lines.push(`  ${label}: ${times}`);
  }
  return lines.join('\n');
}
