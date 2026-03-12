import type { GCalEvent } from '../shared/types.ts';

export type PickCallback = (event: GCalEvent) => void;

export class ConflictPicker {
  private shadow: ShadowRoot;
  private container: HTMLDivElement | null = null;

  constructor(shadowHost: HTMLElement) {
    this.shadow = shadowHost.shadowRoot!;
  }

  show(events: GCalEvent[], title: string, onPick: PickCallback) {
    this.hide();

    const overlay = document.createElement('div');
    overlay.className = 'cb-overlay';
    overlay.style.top = '80px';
    overlay.style.left = '50%';
    overlay.style.transform = 'translateX(-50%)';

    const header = document.createElement('div');
    header.className = 'cb-overlay-header';
    header.innerHTML = `<span>${title}</span><button class="cb-overlay-close">✕</button>`;
    header.querySelector('.cb-overlay-close')?.addEventListener('click', () => this.hide());

    overlay.appendChild(header);

    for (const ev of events) {
      const item = document.createElement('div');
      item.className = 'cb-picker-item';
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
    }

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
