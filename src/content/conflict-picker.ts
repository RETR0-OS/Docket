import type { GCalEvent } from '../shared/types.ts';

export type PickCallback = (event: GCalEvent) => void;

export class ConflictPicker {
  private shadow: ShadowRoot;
  private container: HTMLDivElement | null = null;
  private selectedIndex = 0;

  constructor(shadowHost: HTMLElement) {
    this.shadow = shadowHost.shadowRoot!;
  }

  show(events: GCalEvent[], title: string, onPick: PickCallback) {
    this.hide();
    this.selectedIndex = 0;

    const overlay = document.createElement('div');
    overlay.className = 'cb-overlay';
    overlay.style.top = '80px';
    overlay.style.left = '50%';
    overlay.style.transform = 'translateX(-50%)';
    overlay.setAttribute('tabindex', '-1');

    const header = document.createElement('div');
    header.className = 'cb-overlay-header';
    header.innerHTML = `<span>${escapeHtml(title)}</span><button class="cb-overlay-close">✕</button>`;
    header.querySelector('.cb-overlay-close')?.addEventListener('click', () => this.hide());

    overlay.appendChild(header);

    events.forEach((ev, idx) => {
      const item = document.createElement('div');
      item.className = 'cb-picker-item' + (idx === 0 ? ' cb-picker-item--selected' : '');
      item.dataset['idx'] = String(idx);
      const start = ev.start.dateTime ? formatDateTime(ev.start.dateTime) : (ev.start.date ?? '');
      const end   = ev.end.dateTime   ? formatDateTime(ev.end.dateTime)   : (ev.end.date ?? '');
      item.innerHTML = `
        <div class="ev-title">${escapeHtml(ev.summary)}</div>
        <div class="ev-time">${start} → ${end}</div>
      `;
      item.addEventListener('click', () => {
        this.hide();
        onPick(ev);
      });
      overlay.appendChild(item);
    });

    overlay.addEventListener('keydown', (e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.selectedIndex = Math.min(this.selectedIndex + 1, events.length - 1);
        this.updateSelection(overlay);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
        this.updateSelection(overlay);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const ev = events[this.selectedIndex];
        if (ev) { this.hide(); onPick(ev); }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.hide();
      }
    });

    this.container = overlay;
    this.shadow.appendChild(overlay);
    overlay.focus();
  }

  private updateSelection(overlay: HTMLDivElement) {
    overlay.querySelectorAll<HTMLElement>('.cb-picker-item').forEach((el, i) => {
      el.classList.toggle('cb-picker-item--selected', i === this.selectedIndex);
    });
  }

  hide() {
    this.container?.remove();
    this.container = null;
  }

  isVisible(): boolean {
    return this.container !== null && this.container.isConnected;
  }
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
