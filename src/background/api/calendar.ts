import { getToken } from './auth.ts';
import type { GCalEvent } from '../../shared/types.ts';

const BASE = 'https://www.googleapis.com/calendar/v3';

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getToken(false);
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export async function listEvents(timeMin: string, timeMax: string): Promise<GCalEvent[]> {
  const headers = await authHeaders();
  const params = new URLSearchParams({
    calendarId: 'primary',
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  });
  const resp = await fetch(`${BASE}/calendars/primary/events?${params}`, { headers });
  if (!resp.ok) throw new Error(`listEvents failed: ${resp.status}`);
  const data = await resp.json() as { items?: GCalEvent[] };
  return data.items ?? [];
}

export async function createEvent(event: {
  summary: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
}): Promise<GCalEvent> {
  const headers = await authHeaders();
  const resp = await fetch(`${BASE}/calendars/primary/events`, {
    method: 'POST',
    headers,
    body: JSON.stringify(event),
  });
  if (!resp.ok) throw new Error(`createEvent failed: ${resp.status}`);
  return resp.json() as Promise<GCalEvent>;
}

export async function searchEventsByName(name: string, date?: string): Promise<GCalEvent[]> {
  const headers = await authHeaders();
  const now = new Date();
  let timeMin: string;
  let timeMax: string;

  if (date) {
    // Use local midnight (no Z) to get correct UTC range for the user's timezone.
    // Expand by 1 day on each side to catch timezone edge cases.
    const dayBefore = new Date(`${date}T00:00:00`);
    dayBefore.setDate(dayBefore.getDate() - 1);
    const dayAfter = new Date(`${date}T23:59:59`);
    dayAfter.setDate(dayAfter.getDate() + 1);
    timeMin = dayBefore.toISOString();
    timeMax = dayAfter.toISOString();
  } else {
    timeMin = now.toISOString();
    timeMax = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
  }

  const params = new URLSearchParams({
    q: name,
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '50',
  });
  const resp = await fetch(`${BASE}/calendars/primary/events?${params}`, { headers });
  if (!resp.ok) throw new Error(`searchEvents failed: ${resp.status}`);
  const data = await resp.json() as { items?: GCalEvent[] };
  return data.items ?? [];
}

export async function patchEventTime(
  eventId: string,
  start: { dateTime: string; timeZone: string },
  end: { dateTime: string; timeZone: string },
): Promise<GCalEvent> {
  const headers = await authHeaders();
  const resp = await fetch(`${BASE}/calendars/primary/events/${eventId}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ start, end }),
  });
  if (!resp.ok) throw new Error(`patchEvent failed: ${resp.status}`);
  return resp.json() as Promise<GCalEvent>;
}

export async function deleteEvent(eventId: string): Promise<void> {
  const headers = await authHeaders();
  const resp = await fetch(`${BASE}/calendars/primary/events/${eventId}`, {
    method: 'DELETE',
    headers,
  });
  if (!resp.ok && resp.status !== 204) throw new Error(`deleteEvent failed: ${resp.status}`);
}
