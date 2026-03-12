export class ResultOverlay {
  private shadow: ShadowRoot;
  private container: HTMLDivElement | null = null;

  constructor(shadowHost: HTMLElement) {
    this.shadow = shadowHost.shadowRoot!;
  }

  showLoading(title: string) {
    this.render(title, '<span class="cb-spinner"></span> Working…', false, null, undefined, true);
  }

  showResult(title: string, body: string, targetEl: HTMLElement | null, commandText?: string) {
    this.render(title, body, true, targetEl, commandText);
  }

  showError(msg: string) {
    this.render('Error', msg, false);
  }

  private render(
    title: string,
    body: string,
    showInsert: boolean,
    targetEl: HTMLElement | null = null,
    commandText?: string,
    bodyIsHtml = false,
  ) {
    this.hide();
    const overlay = document.createElement('div');
    overlay.className = 'cb-overlay';
    overlay.style.top = '80px';
    overlay.style.left = '50%';
    overlay.style.transform = 'translateX(-50%)';

    overlay.innerHTML = `
      <div class="cb-overlay-header">
        <span>${escapeHtml(title)}</span>
        <button class="cb-overlay-close" title="Close">✕</button>
      </div>
      <div class="cb-overlay-body"></div>
      ${showInsert ? `
      <div class="cb-overlay-footer">
        <button class="cb-btn cb-btn-secondary" data-action="dismiss">Dismiss</button>
        <button class="cb-btn cb-btn-primary" data-action="insert">Insert into text box</button>
      </div>` : ''}
    `;

    // Set body content — use innerHTML only for internal trusted HTML (e.g. spinner)
    const bodyEl = overlay.querySelector('.cb-overlay-body') as HTMLElement;
    if (bodyIsHtml) {
      bodyEl.innerHTML = body;
    } else {
      bodyEl.style.whiteSpace = 'pre-wrap';
      bodyEl.textContent = body;
    }

    overlay.querySelector('.cb-overlay-close')?.addEventListener('click', () => this.hide());
    overlay.querySelector('[data-action="dismiss"]')?.addEventListener('click', () => this.hide());
    overlay.querySelector('[data-action="insert"]')?.addEventListener('click', () => {
      if (targetEl) {
        if (commandText) removeCommandFromElement(targetEl, commandText);
        insertTextIntoElement(targetEl, body);
      }
      this.hide();
    });

    this.container = overlay;
    this.shadow.appendChild(overlay);
  }

  hide() {
    this.container?.remove();
    this.container = null;
  }

  isVisible(): boolean {
    return this.container !== null && this.container.isConnected;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function removeCommandFromElement(el: HTMLElement, commandText: string): void {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    const idx = el.value.lastIndexOf(commandText);
    if (idx === -1) return;
    el.value = el.value.slice(0, idx) + el.value.slice(idx + commandText.length);
    el.selectionStart = el.selectionEnd = idx;
  } else if (el.isContentEditable) {
    el.focus();
    const range = findTextRange(el, commandText);
    if (range) {
      range.deleteContents();
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }
}

function findTextRange(container: HTMLElement, searchText: string): Range | null {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const nodes: Array<{ node: Text; start: number }> = [];
  let fullText = '';
  let node: Text | null;

  while ((node = walker.nextNode() as Text | null)) {
    nodes.push({ node, start: fullText.length });
    fullText += node.textContent ?? '';
  }

  const idx = fullText.lastIndexOf(searchText);
  if (idx === -1) return null;
  const endIdx = idx + searchText.length;

  let startNode: Text | null = null, startOffset = 0;
  let endNode: Text | null = null, endOffset = 0;

  for (const { node: n, start } of nodes) {
    const len = n.textContent?.length ?? 0;
    if (!startNode && idx >= start && idx < start + len) {
      startNode = n; startOffset = idx - start;
    }
    if (!endNode && endIdx > start && endIdx <= start + len) {
      endNode = n; endOffset = endIdx - start;
    }
  }

  if (!startNode || !endNode) return null;
  const range = document.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  return range;
}

export function insertTextIntoElement(el: HTMLElement, text: string): void {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    const start = el.selectionStart ?? el.value.length;
    const end   = el.selectionEnd   ?? el.value.length;
    el.focus();
    el.value = el.value.slice(0, start) + text + el.value.slice(end);
    el.selectionStart = el.selectionEnd = start + text.length;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  } else if (el.isContentEditable) {
    el.focus();
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(buildContentEditableFragment(text));
      range.collapse(false);
    } else {
      el.appendChild(buildContentEditableFragment(text));
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

function buildContentEditableFragment(text: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    fragment.appendChild(document.createTextNode(line));
    if (i < lines.length - 1) fragment.appendChild(document.createElement('br'));
  });
  return fragment;
}
