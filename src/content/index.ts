import contentStyles from './content.css?inline';
import { extractCommandAtCursor, getCaretCoords } from './command-detector.ts';
import { AutocompleteDropdown } from './autocomplete-dropdown.ts';
import { ResultOverlay } from './result-overlay.ts';
import { ConflictPicker } from './conflict-picker.ts';
import { DatePicker } from './date-picker.ts';
import { TimePicker } from './time-picker.ts';
import type { CommandMeta } from '../shared/commands.ts';
import { COMMAND_NAMES } from '../shared/commands.ts';
import { parseNaturalDate } from '../shared/date-parser.ts';
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
wrapperStyle.textContent = ':host { pointer-events: none; } .cb-dropdown, .cb-overlay, .cb-picker-item, .cb-datepicker, .cb-timepicker { pointer-events: all; }';
shadow.appendChild(wrapperStyle);

document.documentElement.appendChild(shadowHost);

// ── UI instances ─────────────────────────────────────────────────────────────

const dropdown   = new AutocompleteDropdown(shadowHost, onCommandSelected);
const overlay    = new ResultOverlay(shadowHost);
const picker     = new ConflictPicker(shadowHost);
const datePicker = new DatePicker(shadowHost);
const timePicker = new TimePicker(shadowHost);

let lastActiveEl: HTMLElement | null = null;

// ── Message helper ────────────────────────────────────────────────────────────

function sendMessage<T>(msg: object): Promise<T> {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(msg, (response: T) => {
        if (chrome.runtime.lastError) {
          const errMsg = chrome.runtime.lastError.message ?? '';
          if (errMsg.includes('Extension context invalidated') || errMsg.includes('context invalidated')) {
            reject(new Error('Extension was updated — please refresh this page.'));
          } else {
            reject(new Error(errMsg));
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

// ── Quoted-arg parser ─────────────────────────────────────────────────────────

function parseArgs(raw: string): string[] {
  const args: string[] = [];
  const re = /(?:"([^"]*)")|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) args.push(m[1] ?? m[2]!);
  return args;
}

// ── Command parsing ───────────────────────────────────────────────────────────

const FULL_CMD_RE = /^::([\w]+)((?:\s[\s\S]*)?)::$/;

async function executeCommand(raw: string, targetEl: HTMLElement | null) {
  const match = FULL_CMD_RE.exec(raw.trim());
  if (!match) return;

  const cmdName = match[1]!.toLowerCase();
  if (!COMMAND_NAMES.includes(cmdName)) return;

  const rawArgs = (match[2] ?? '').trim();

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
        // ::schedule <title> <date> <HH:MM> <HH:MM>::
        // Title may be quoted for multi-word: ::schedule "Team Standup" today 09:00 10:00::
        const args = parseArgs(rawArgs);
        const [title, rawDate, startTime, endTime] = args;
        if (!title || !rawDate || !startTime || !endTime) {
          overlay.showError('Usage: ::schedule <title> <YYYY-MM-DD> <HH:MM> <HH:MM>::');
          return;
        }
        const date = parseNaturalDate(rawDate);
        if (!date) {
          overlay.showError(`Unrecognized date: "${rawDate}". Use YYYY-MM-DD or words like "today", "tomorrow", "next monday".`);
          return;
        }
        const res = await sendMessage<ScheduleEventResponse>({
          type: 'SCHEDULE_EVENT', title, date, startTime, endTime,
        });
        if (!res.ok) { overlay.showError(res.error); return; }
        overlay.showResult('Scheduled', `Event "${title}" created on ${date} ${startTime}–${endTime}.`, targetEl, raw);
        break;
      }

      case 'appointments': {
        const simpleArgs = rawArgs.trim().split(/\s+/).filter(Boolean);
        const [rawDate] = simpleArgs;
        if (!rawDate) { overlay.showError('Usage: ::appointments <YYYY-MM-DD>::'); return; }
        const date = parseNaturalDate(rawDate) ?? rawDate;
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
        const simpleArgs = rawArgs.trim().split(/\s+/).filter(Boolean);
        const [name, rawDate, startTime, endTime] = simpleArgs;
        if (!name || !rawDate || !startTime || !endTime) {
          overlay.showError('Usage: ::reschedule <name> <YYYY-MM-DD> <HH:MM> <HH:MM>::');
          return;
        }
        const date = parseNaturalDate(rawDate) ?? rawDate;
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
        // Syntax: ::cancel <date>:: — fetch all events for that day, let user pick
        const simpleArgs = rawArgs.trim().split(/\s+/).filter(Boolean);
        const [rawDate] = simpleArgs;
        if (!rawDate) {
          overlay.showError('Usage: ::cancel <YYYY-MM-DD>::');
          return;
        }
        const date = parseNaturalDate(rawDate);
        if (!date) {
          overlay.showError(`Unrecognized date: "${rawDate}". Use YYYY-MM-DD or words like "today", "tomorrow", "next monday".`);
          return;
        }
        const findRes = await sendMessage<AppointmentsResponse>({ type: 'GET_APPOINTMENTS', date });
        if (!findRes.ok) { overlay.showError(findRes.error); return; }

        const found = findRes.data.events;
        if (found.length === 0) {
          overlay.showError(`No events on ${date}.`);
          return;
        }

        overlay.hide();
        picker.show(found, 'Which event to cancel?', (ev) => {
          overlay.showConfirm(
            'Cancel event?',
            `Delete "${ev.summary}"?\nThis cannot be undone.`,
            async () => { await doCancel(ev.id, ev.summary, targetEl, raw); },
            () => { /* user kept the event */ },
          );
        });
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

// ── Picker sequence (triggered when a template is inserted from dropdown) ─────

/**
 * Advance the cursor past the closing `::` of the current command block, then
 * fire an `input` event so `extractCommandAtCursor` detects the completed command
 * and calls `executeCommand`.
 */
function finishSequence(el: HTMLElement) {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    // Find the last :: in the value — that is the closing :: of our command.
    const text = el.value;
    const closeIdx = text.lastIndexOf('::');
    // Focus first so extractCommandAtCursor can find the element, then set
    // cursor after the closing :: so the input handler detects a closed command.
    el.focus();
    el.selectionStart = el.selectionEnd = closeIdx !== -1 ? closeIdx + 2 : text.length;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  } else if (el.isContentEditable) {
    el.focus();
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

function openTimePickerChain(el: HTMLElement, total: number, current: number, onAllDone: () => void) {
  if (current >= total) { onAllDone(); return; }
  // Briefly restore focus to el so the cursor is visible at the new position,
  // then open the picker (which takes focus itself).
  el.focus();
  const coords = getCaretCoords(el);
  timePicker.show(coords, '', (time) => {
    replaceTokenInElement(el, 'HH:MM', time);
    openTimePickerChain(el, total, current + 1, onAllDone);
  });
}

/**
 * Automatically open date picker then time picker(s) in sequence after a
 * template is inserted from the dropdown.  When all placeholders are filled,
 * the command fires automatically.
 */
function startPickerSequence(el: HTMLElement, template: string) {
  const hasDate  = template.includes('YYYY-MM-DD');
  const timeCnt  = (template.match(/HH:MM/g) ?? []).length;
  const onAllDone = () => finishSequence(el);

  dropdown.hide();

  if (hasDate) {
    el.focus();
    const coords = getCaretCoords(el);
    datePicker.show(coords, '', (date) => {
      replaceTokenInElement(el, 'YYYY-MM-DD', date);
      openTimePickerChain(el, timeCnt, 0, onAllDone);
    });
  } else if (timeCnt > 0) {
    openTimePickerChain(el, timeCnt, 0, onAllDone);
  }
}

// ── Command selected from dropdown ───────────────────────────────────────────

function onCommandSelected(cmd: CommandMeta) {
  dropdown.hide();
  if (!lastActiveEl) return;

  replacePartialWithTemplate(lastActiveEl, cmd.template);

  if (cmd.name === 'availability') {
    // No placeholders — execute immediately
    executeCommand(cmd.template, lastActiveEl);
    return;
  }

  // Open pickers one by one to fill in each placeholder
  startPickerSequence(lastActiveEl, cmd.template);
}

function replacePartialWithTemplate(el: HTMLElement, template: string) {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    const pos = el.selectionStart ?? 0;
    const text = el.value;
    const colonIdx = text.lastIndexOf('::', pos - 1);
    if (colonIdx === -1) return;
    el.value = text.slice(0, colonIdx) + template + text.slice(pos);
    // Position cursor just before the closing `::` so the input event does NOT
    // detect a closed command and fire executeCommand prematurely.
    el.selectionStart = el.selectionEnd = colonIdx + template.length - 2;
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
    const newRange = document.createRange();
    // Position before closing `::` as well
    newRange.setStart(range.startContainer, colonIdx + template.length - 2);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

// ── Placeholder detection ─────────────────────────────────────────────────────

function getPlaceholderAtCursor(el: HTMLElement): 'date' | 'time' | null {
  let text = '';
  let cursor = 0;

  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    text = el.value;
    cursor = el.selectionStart ?? 0;
  } else if (el.isContentEditable) {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    text = range.startContainer.textContent ?? '';
    cursor = range.startOffset;
  } else {
    return null;
  }

  // Find the opening :: that the cursor is *inside* — use cursor-1 so that if
  // the cursor is sitting exactly on the closing :: we don't mistake it for the
  // opening one.
  const openIdx = text.lastIndexOf('::', cursor - 1);
  if (openIdx === -1) return null;

  // Find the matching closing :: and make sure cursor hasn't gone past it
  const closeIdx = text.indexOf('::', openIdx + 2);
  const blockEnd = closeIdx !== -1 ? closeIdx : text.length;
  if (cursor > blockEnd) return null;

  // Search the full block text (not sliced at cursor) so tokens near the end
  // of the block are still found completely.
  const blockText = text.slice(openIdx, blockEnd + 2);

  // YYYY-MM-DD
  const dateIdx = blockText.indexOf('YYYY-MM-DD');
  if (dateIdx !== -1) {
    const absStart = openIdx + dateIdx;
    const absEnd   = absStart + 10; // exclusive
    if (cursor >= absStart && cursor < absEnd) return 'date';
  }

  // HH:MM (may appear more than once)
  const timeRe = /HH:MM/g;
  let m: RegExpExecArray | null;
  while ((m = timeRe.exec(blockText)) !== null) {
    const absStart = openIdx + m.index;
    const absEnd   = absStart + 5; // exclusive
    if (cursor >= absStart && cursor < absEnd) return 'time';
  }

  return null;
}

function replaceTokenInElement(el: HTMLElement, token: string, replacement: string) {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    // Avoid reading selectionStart (unreliable on blurred inputs in some browsers).
    // Just find the first remaining occurrence of the token in the value.
    const text = el.value;
    const idx = text.indexOf(token);
    if (idx === -1) return;
    el.value = text.slice(0, idx) + replacement + text.slice(idx + token.length);
    // Set cursor after the inserted value so subsequent calls find the *next* token.
    el.selectionStart = el.selectionEnd = idx + replacement.length;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  } else if (el.isContentEditable) {
    // Walk text nodes to find the one containing the token.
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      const text = node.textContent ?? '';
      const idx = text.indexOf(token);
      if (idx === -1) continue;
      node.textContent = text.slice(0, idx) + replacement + text.slice(idx + token.length);
      const range = document.createRange();
      range.setStart(node, idx + replacement.length);
      range.collapse(true);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }
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

  // Close overlay / pickers on Escape
  if (e.key === 'Escape') {
    if (datePicker.isVisible()) { datePicker.hide(); return; }
    if (timePicker.isVisible()) { timePicker.hide(); return; }
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
    datePicker.hide();
    timePicker.hide();
    executeCommand(match.partial, match.element);
    return;
  }

  dropdown.update(match.partial, match.element);

  // When cursor is manually placed on a placeholder, open the appropriate picker.
  // (The sequence started by onCommandSelected handles automatic chaining;
  //  this handles the case where the user navigates manually.)
  const placeholder = getPlaceholderAtCursor(match.element);
  if (placeholder === 'date') {
    timePicker.hide();
    datePicker.show(getCaretCoords(match.element), '', (date) => {
      replaceTokenInElement(match.element, 'YYYY-MM-DD', date);
    });
  } else if (placeholder === 'time') {
    datePicker.hide();
    timePicker.show(getCaretCoords(match.element), '', (time) => {
      replaceTokenInElement(match.element, 'HH:MM', time);
    });
  } else {
    datePicker.hide();
    timePicker.hide();
  }
}, true);

document.addEventListener('selectionchange', () => {
  // When one of our pickers is focused, document.activeElement resolves to
  // shadowHost (shadow DOM boundary).  Ignore these events to prevent the
  // handler from immediately closing the picker that just received focus.
  if (document.activeElement === shadowHost) return;

  const active = document.activeElement as HTMLElement | null;
  if (!active) return;

  const placeholder = getPlaceholderAtCursor(active);
  if (placeholder === 'date') {
    timePicker.hide();
    datePicker.show(getCaretCoords(active), '', (date) => {
      replaceTokenInElement(active, 'YYYY-MM-DD', date);
    });
  } else if (placeholder === 'time') {
    datePicker.hide();
    timePicker.show(getCaretCoords(active), '', (time) => {
      replaceTokenInElement(active, 'HH:MM', time);
    });
  } else {
    datePicker.hide();
    timePicker.hide();
  }
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
