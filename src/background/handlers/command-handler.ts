import { signIn, signOut, getAuthStatus } from '../api/auth.ts';
import { createEvent, searchEventsByName, patchEventTime, deleteEvent, listEvents } from '../api/calendar.ts';
import { getAvailability, formatAvailabilityText } from '../availability.ts';
import type { ExtensionRequest } from '../../shared/message-types.ts';

type SendResponse = (response: unknown) => void;

function ok<T>(data: T) { return { ok: true, data }; }
function err(error: string) { return { ok: false, error }; }

function localIso(date: string, time: string): string {
  return `${date}T${time}:00`;
}

export async function handleMessage(
  request: ExtensionRequest,
  sendResponse: SendResponse,
): Promise<void> {
  try {
    switch (request.type) {
      case 'AUTH_GET_STATUS': {
        const status = await getAuthStatus();
        sendResponse(ok(status));
        break;
      }

      case 'AUTH_SIGN_IN': {
        const email = await signIn();
        sendResponse(ok({ signedIn: true, email }));
        break;
      }

      case 'AUTH_SIGN_OUT': {
        await signOut();
        sendResponse(ok({ signedIn: false }));
        break;
      }

      case 'GET_AVAILABILITY': {
        const slots = await getAvailability();
        const text = formatAvailabilityText(slots);
        sendResponse(ok({ slots, text }));
        break;
      }

      case 'SCHEDULE_EVENT': {
        const { title, date, startTime, endTime } = request;
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const event = await createEvent({
          summary: title,
          start: { dateTime: localIso(date, startTime), timeZone: tz },
          end:   { dateTime: localIso(date, endTime),   timeZone: tz },
        });
        sendResponse(ok({ eventId: event.id }));
        break;
      }

      case 'GET_APPOINTMENTS': {
        const { date } = request;
        // Use local midnight (no Z) so toISOString() converts to the correct UTC range
        const timeMin = new Date(`${date}T00:00:00`).toISOString();
        const timeMax = new Date(`${date}T23:59:59`).toISOString();
        const events = await listEvents(timeMin, timeMax);
        sendResponse(ok({ events }));
        break;
      }

      case 'FIND_EVENTS': {
        const { eventName, date } = request;
        const events = await searchEventsByName(eventName, date);
        sendResponse(ok({ events }));
        break;
      }

      case 'RESCHEDULE_EVENT': {
        const { eventId, newDate, newStartTime, newEndTime } = request;
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const event = await patchEventTime(
          eventId,
          { dateTime: localIso(newDate, newStartTime), timeZone: tz },
          { dateTime: localIso(newDate, newEndTime),   timeZone: tz },
        );
        sendResponse(ok({ eventId: event.id }));
        break;
      }

      case 'CANCEL_EVENT': {
        await deleteEvent(request.eventId);
        sendResponse(ok({}));
        break;
      }

      default:
        sendResponse(err('Unknown message type'));
    }
  } catch (e) {
    sendResponse(err(e instanceof Error ? e.message : String(e)));
  }
}
