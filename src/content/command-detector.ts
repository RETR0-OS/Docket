export interface CommandMatch {
  partial: string;       // text from opening `:` to cursor
  closed: boolean;       // true when closing `:` was typed
  element: HTMLElement;
}

function getDeepActiveElement(): Element | null {
  let el: Element | null = document.activeElement;
  while (el?.shadowRoot) {
    const inner = el.shadowRoot.activeElement;
    if (!inner) break;
    el = inner;
  }
  return el;
}

function getTextBeforeCursor(el: Element): string {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    const pos = el.selectionStart ?? 0;
    return el.value.slice(0, pos);
  }
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return '';
  const range = sel.getRangeAt(0).cloneRange();
  range.collapse(true);
  const preRange = document.createRange();
  preRange.selectNodeContents(el);
  preRange.setEnd(range.startContainer, range.startOffset);
  return preRange.toString();
}

// Matches ::word or ::word with args (no closing ::) at end of text
const PARTIAL_RE = /::([\w](?:(?!::).)*)$/i;
// Matches ::command args:: at end of text (args may contain single colons e.g. 14:00)
const CLOSED_RE  = /::([\w](?:(?!::).)*)::$/i;

export function extractCommandAtCursor(): CommandMatch | null {
  const el = getDeepActiveElement();
  if (!el) return null;

  const isEditable =
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    (el instanceof HTMLElement && el.isContentEditable);

  if (!isEditable) return null;

  const text = getTextBeforeCursor(el);

  const closedMatch = CLOSED_RE.exec(text);
  if (closedMatch) {
    return { partial: closedMatch[0], closed: true, element: el as HTMLElement };
  }

  const partialMatch = PARTIAL_RE.exec(text);
  if (partialMatch) {
    return { partial: partialMatch[0], closed: false, element: el as HTMLElement };
  }

  return null;
}

export function getCaretCoords(el: HTMLElement): { x: number; y: number; height: number } {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    // Mirror-div technique
    const mirror = document.createElement('div');
    const style = window.getComputedStyle(el);
    for (const prop of style) {
      try { (mirror.style as unknown as Record<string, string>)[prop] = style.getPropertyValue(prop); } catch { /* skip */ }
    }
    mirror.style.position = 'fixed';
    mirror.style.top = '-9999px';
    mirror.style.left = '-9999px';
    mirror.style.whiteSpace = 'pre-wrap';
    mirror.style.overflow = 'hidden';
    mirror.style.visibility = 'hidden';

    const pos = el.selectionStart ?? 0;
    const textBefore = el.value.slice(0, pos);
    mirror.textContent = textBefore;
    const span = document.createElement('span');
    span.textContent = '|';
    mirror.appendChild(span);

    document.body.appendChild(mirror);
    const spanRect = span.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    document.body.removeChild(mirror);

    return {
      x: elRect.left + (spanRect.left - mirror.getBoundingClientRect().left),
      y: elRect.top + (spanRect.top - mirror.getBoundingClientRect().top),
      height: spanRect.height || parseInt(style.lineHeight) || 18,
    };
  }

  // contenteditable
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) {
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    if (rect.width > 0 || rect.height > 0) {
      return { x: rect.left, y: rect.top, height: rect.height || 18 };
    }
  }
  const elRect = el.getBoundingClientRect();
  return { x: elRect.left, y: elRect.top, height: 18 };
}
