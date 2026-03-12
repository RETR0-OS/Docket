import contentStyles from './content.css?inline';
import { extractCommandAtCursor } from './command-detector.ts';
import { AutocompleteDropdown } from './autocomplete-dropdown.ts';
import { ResultOverlay } from './result-overlay.ts';
import { ConflictPicker } from './conflict-picker.ts';
import type { CommandMeta } from '../shared/commands.ts';
import { COMMAND_NAMES } from '../shared/commands.ts';
import type { GCalEvent } from '../shared/types.ts';
import type {
  AvailabilityResponse,
  AppointmentsResponse,
  FindEventsResponse,
  ScheduleEventResponse,
  RescheduleResponse,
  CancelResponse,
} from '../shared/message-types.ts';

// ── Shadow DOM host ──────────────────────────────────────────────────────────

const shadowHost = document.createElement('div');
shadowHost.id = 'calendar-buddy-root';
shadowHost.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;z-index:2147483647;pointer-events:none;';
const shadow = shadowHost.attachShadow({ mode: 'open' });
const styleEl = document.createElement('style');
styleEl.textContent = contentStyles;
shadow.appendChild(styleEl);

// Make overlays inside shadow DOM receive pointer events
const wrapperStyle = document.createElement('style');
wrapperStyle.textContent = ':host { pointer-events: none; } .cb-dropdown, .cb-overlay, .cb-picker-item { pointer-events: all; }';
shadow.appendChild(wrapperStyle);

document.documentElement.appendChild(shadowHost);

// ── UI instances ─────────────────────────────────────────────────────────────

const dropdown = new AutocompleteDropdown(shadowHost, onCommandSelected);
const overlay  = new ResultOverlay(shadowHost);
const picker   = new ConflictPicker(shadowHost);

let lastActiveEl: HTMLElement | null = null;

// ── Message helper ────────────────────────────────────────────────────────────

function sendMessage<T>(msg: object): Promise<T> {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(msg, (response: T) => {
        if (chrome.runtime.lastError) {
          const msg = chrome.runtime.lastError.message ?? '';
          if (msg.includes('Extension context invalidated') || msg.includes('context invalidated')) {
            reject(new Error('Extension was updated — please refresh this page.'));
          } else {
            reject(new Error(msg));
          }
        } else {
          resolve(response);
        }
      });
    } catch (e) {
      if (e instanceof Error && e.message.includes('Extension context invalidated')) {
        reject(new Error('Extension was updated — please refresh this page.'));
      } else {
        reject(e);
      }
    }
  });
}

// ── Command parsing ───────────────────────────────────────────────────────────

// `:availability:`
// `:schedule <type> <title> <date> <start> <end>:`
// `:appointments <date>:`
// `:reschedule <name> <date> <start> <end>:`
// `:cancel <name> <date> <start> <end>:`
const FULL_CMD_RE = /^::([\w]+)((?:\s+\S+)*)::$/;

async function executeCommand(raw: string, targetEl: HTMLElement | null) {
  const match = FULL_CMD_RE.exec(raw.trim());
  if (!match) return;

  const cmdName = match[1]!.toLowerCase();
  if (!COMMAND_NAMES.includes(cmdName)) return;

  const args = (match[2] ?? '').trim().split(/\s+/).filter(Boolean);

  overlay.showLoading(cmdName);

  try {
    switch (cmdName) {
      case 'availability': {
        const res = await sendMessage<AvailabilityResponse>({ type: 'GET_AVAILABILITY' });
        if (!res.ok) { overlay.showError(res.error); return; }
        const text = (res.data as { slots: unknown[]; text: string }).text;
        overlay.showResult('Availability', text, targetEl, raw);
        break;
      }

      case 'schedule': {
        // :schedule <type> <title> <YYYY-MM-DD> <HH:MM> <HH:MM>:
        const [calendarType, title, date, startTime, endTime] = args;
        if (!calendarType || !title || !date || !startTime || !endTime) {
          overlay.showError('Usage: :schedule <type> <title> <YYYY-MM-DD> <HH:MM> <HH:MM>:');
          return;
        }
        const res = await sendMessage<ScheduleEventResponse>({
          type: 'SCHEDULE_EVENT', calendarType, title, date, startTime, endTime,
        });
        if (!res.ok) { overlay.showError(res.error); return; }
        overlay.showResult('Scheduled', `Event "${title}" created on ${date} ${startTime}–${endTime}.`, targetEl, raw);
        break;
      }

      case 'appointments': {
        const [date] = args;
        if (!date) { overlay.showError('Usage: :appointments <YYYY-MM-DD>:'); return; }
        const res = await sendMessage<AppointmentsResponse>({ type: 'GET_APPOINTMENTS', date });
        if (!res.ok) { overlay.showError(res.error); return; }
        const events = res.data.events;
        const body = events.length === 0
          ? `No events on ${date}.`
          : events.map((e: GCalEvent) => {
              const s = e.start.dateTime ? new Date(e.start.dateTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';
              const en = e.end.dateTime   ? new Date(e.end.dateTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';
              return `• ${e.summary}${s ? ` (${s}–${en})` : ''}`;
            }).join('\n');
        overlay.showResult(`Appointments — ${date}`, body, targetEl, raw);
        break;
      }

      case 'reschedule': {
        const [name, date, startTime, endTime] = args;
        if (!name || !date || !startTime || !endTime) {
          overlay.showError('Usage: :reschedule <name> <YYYY-MM-DD> <HH:MM> <HH:MM>:');
          return;
        }
        const findRes = await sendMessage<FindEventsResponse>({ type: 'FIND_EVENTS', eventName: name, date });
        if (!findRes.ok) { overlay.showError(findRes.error); return; }

        const found = findRes.data.events;
        if (found.length === 0) {
          overlay.showError(`No events matching "${name}" on ${date}.`);
          return;
        }
        if (found.length === 1) {
          await doReschedule(found[0]!.id, date, startTime, endTime, targetEl, raw);
        } else {
          overlay.hide();
          picker.show(found, 'Which event to reschedule?', async (ev) => {
            await doReschedule(ev.id, date, startTime, endTime, targetEl, raw);
          });
        }
        break;
      }

      case 'cancel': {
        const [name, date, startTime, endTime] = args;
        if (!name || !date || !startTime || !endTime) {
          overlay.showError('Usage: :cancel <name> <YYYY-MM-DD> <HH:MM> <HH:MM>:');
          return;
        }
        const findRes = await sendMessage<FindEventsResponse>({ type: 'FIND_EVENTS', eventName: name, date });
        if (!findRes.ok) { overlay.showError(findRes.error); return; }

        const found = findRes.data.events;
        if (found.length === 0) {
          overlay.showError(`No events matching "${name}" on ${date}.`);
          return;
        }
        if (found.length === 1) {
          await doCancel(found[0]!.id, found[0]!.summary, targetEl, raw);
        } else {
          overlay.hide();
          picker.show(found, 'Which event to cancel?', async (ev) => {
            await doCancel(ev.id, ev.summary, targetEl, raw);
          });
        }
        break;
      }

      default:
        break;
    }
  } catch (e) {
    overlay.showError(e instanceof Error ? e.message : String(e));
  }
}

async function doReschedule(
  eventId: string,
  newDate: string,
  newStartTime: string,
  newEndTime: string,
  targetEl: HTMLElement | null,
  commandText: string,
) {
  const res = await sendMessage<RescheduleResponse>({
    type: 'RESCHEDULE_EVENT', eventId, newDate, newStartTime, newEndTime,
  });
  if (!res.ok) { overlay.showError(res.error); return; }
  overlay.showResult('Rescheduled', `Event moved to ${newDate} ${newStartTime}–${newEndTime}.`, targetEl, commandText);
}

async function doCancel(eventId: string, title: string, targetEl: HTMLElement | null, commandText: string) {
  const res = await sendMessage<CancelResponse>({ type: 'CANCEL_EVENT', eventId });
  if (!res.ok) { overlay.showError(res.error); return; }
  overlay.showResult('Cancelled', `"${title}" was deleted.`, targetEl, commandText);
}

// ── Command selected from dropdown ───────────────────────────────────────────

function onCommandSelected(cmd: CommandMeta) {
  dropdown.hide();
  if (!lastActiveEl) return;

  // For simple no-arg commands, execute immediately
  if (cmd.name === 'availability') {
    // Replace the partial text and execute
    replacePartialWithTemplate(lastActiveEl, cmd.template);
    executeCommand(cmd.template, lastActiveEl);
    return;
  }

  // For parametric commands, insert the template for user to fill in
  replacePartialWithTemplate(lastActiveEl, cmd.template);
}

function replacePartialWithTemplate(el: HTMLElement, template: string) {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    const pos = el.selectionStart ?? 0;
    const text = el.value;
    // Find the opening '::' before cursor
    const colonIdx = text.lastIndexOf('::', pos - 1);
    if (colonIdx === -1) return;
    el.value = text.slice(0, colonIdx) + template + text.slice(pos);
    el.selectionStart = el.selectionEnd = colonIdx + template.length;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  } else if (el.isContentEditable) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const text = range.startContainer.textContent ?? '';
    const offset = range.startOffset;
    const colonIdx = text.lastIndexOf('::', offset - 1);
    if (colonIdx === -1) return;
    range.startContainer.textContent =
      text.slice(0, colonIdx) + template + text.slice(offset);
    // Move cursor to end of template
    const newRange = document.createRange();
    newRange.setStart(range.startContainer, colonIdx + template.length);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);
  }
}

// ── Event listeners ───────────────────────────────────────────────────────────

document.addEventListener('keydown', (e: KeyboardEvent) => {
  // Handle dropdown navigation
  if (dropdown.isVisible()) {
    if (e.key === 'ArrowDown')  { e.preventDefault(); dropdown.moveSelection(1); return; }
    if (e.key === 'ArrowUp')    { e.preventDefault(); dropdown.moveSelection(-1); return; }
    if (e.key === 'Tab' || e.key === 'Enter') {
      const cmd = dropdown.confirmSelection();
      if (cmd) { e.preventDefault(); onCommandSelected(cmd); return; }
    }
    if (e.key === 'Escape') { dropdown.hide(); return; }
  }

  // Close overlay on Escape
  if (e.key === 'Escape') {
    if (overlay.isVisible()) { overlay.hide(); return; }
    if (picker.isVisible())  { picker.hide(); return; }
  }
}, true);

document.addEventListener('input', () => {
  const match = extractCommandAtCursor();

  if (!match) {
    dropdown.hide();
    return;
  }

  lastActiveEl = match.element;

  if (match.closed) {
    dropdown.hide();
    executeCommand(match.partial, match.element);
    return;
  }

  dropdown.update(match.partial, match.element);
}, true);

// Hide dropdown on blur
document.addEventListener('focusout', () => {
  setTimeout(() => dropdown.hide(), 150);
}, true);

// Observe for dynamic shadow roots (e.g. sites that mount components after load)
const observer = new MutationObserver(() => {
  // Re-check: nothing to do since we listen on document capture
});
observer.observe(document.body, { childList: true, subtree: true });
