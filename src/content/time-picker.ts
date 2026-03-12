import type { CaretCoords } from './date-picker.ts';

const SLOTS: string[] = [];
for (let h = 6; h <= 22; h++) {
  SLOTS.push(`${String(h).padStart(2, '0')}:00`);
  if (h < 22) SLOTS.push(`${String(h).padStart(2, '0')}:30`);
}

export class TimePicker {
  private shadow: ShadowRoot;
  private container: HTMLDivElement | null = null;
  private selectedIdx = 0;
  private onPickCb: ((time: string) => void) | null = null;

  constructor(shadowHost: HTMLElement) {
    this.shadow = shadowHost.shadowRoot!;
  }

  show(coords: CaretCoords, initialValue: string, onPick: (time: string) => void) {
    this.hide();
    this.onPickCb = onPick;

    const matchIdx = SLOTS.indexOf(initialValue);
    this.selectedIdx = matchIdx >= 0 ? matchIdx : 0;

    this.render(coords);
  }

  private render(coords: CaretCoords) {
    this.container?.remove();

    const el = document.createElement('div');
    el.className = 'cb-timepicker';
    el.setAttribute('tabindex', '-1');
    el.style.position = 'fixed';
    el.style.left = `${coords.x}px`;

    el.innerHTML = SLOTS.map((t, i) =>
      `<div class="cb-tp-slot${i === this.selectedIdx ? ' cb-tp-selected' : ''}" data-idx="${i}">${t}</div>`
    ).join('');

    // Measure height before mounting
    document.documentElement.appendChild(el);
    const pickerH = el.offsetHeight || 200;
    document.documentElement.removeChild(el);

    // Position above the cursor line if room, otherwise below
    if (coords.y > pickerH + 8) {
      el.style.top = `${coords.y - pickerH - 8}px`;
    } else {
      el.style.top = `${coords.y + coords.height + 8}px`;
    }

    el.querySelectorAll<HTMLElement>('.cb-tp-slot').forEach((slot) => {
      slot.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = Number(slot.dataset['idx']);
        this.pick(idx);
      });
    });

    el.addEventListener('keydown', (e: KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === 'ArrowDown') { e.preventDefault(); this.selectedIdx = Math.min(this.selectedIdx + 1, SLOTS.length - 1); this.render(coords); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); this.selectedIdx = Math.max(this.selectedIdx - 1, 0); this.render(coords); }
      else if (e.key === 'Enter') { e.preventDefault(); this.pick(this.selectedIdx); }
      else if (e.key === 'Escape') { e.preventDefault(); this.hide(); }
    });

    this.container = el;
    this.shadow.appendChild(el);

    const selectedEl = el.querySelector<HTMLElement>('.cb-tp-selected');
    if (selectedEl) selectedEl.scrollIntoView({ block: 'nearest' });

    el.focus();
  }

  private pick(idx: number) {
    const time = SLOTS[idx];
    if (!time) return;
    this.hide();
    this.onPickCb?.(time);
  }

  hide() {
    this.container?.remove();
    this.container = null;
  }

  isVisible(): boolean {
    return this.container !== null && this.container.isConnected;
  }
}
