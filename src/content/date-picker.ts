export interface CaretCoords { x: number; y: number; height: number; }

export class DatePicker {
  private shadow: ShadowRoot;
  private container: HTMLDivElement | null = null;
  private viewYear = 0;
  private viewMonth = 0;
  private selectedDate = '';
  private onPickCb: ((date: string) => void) | null = null;
  private focusedDay = 1;

  constructor(shadowHost: HTMLElement) {
    this.shadow = shadowHost.shadowRoot!;
  }

  show(coords: CaretCoords, initialValue: string, onPick: (date: string) => void) {
    this.hide();
    this.onPickCb = onPick;

    const now = new Date();
    if (/^\d{4}-\d{2}-\d{2}$/.test(initialValue)) {
      const d = new Date(initialValue);
      this.viewYear = d.getFullYear();
      this.viewMonth = d.getMonth();
      this.selectedDate = initialValue;
      this.focusedDay = d.getDate();
    } else {
      this.viewYear = now.getFullYear();
      this.viewMonth = now.getMonth();
      this.selectedDate = '';
      this.focusedDay = now.getDate();
    }

    this.render(coords);
  }

  private render(coords: CaretCoords) {
    this.container?.remove();

    const el = document.createElement('div');
    el.className = 'cb-datepicker';
    el.setAttribute('tabindex', '-1');
    el.style.position = 'fixed';
    el.style.left = `${coords.x}px`;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = formatDate(today);

    const firstDay = new Date(this.viewYear, this.viewMonth, 1).getDay();
    const daysInMonth = new Date(this.viewYear, this.viewMonth + 1, 0).getDate();
    const monthName = new Date(this.viewYear, this.viewMonth, 1).toLocaleString('en-US', { month: 'long' });

    let gridHtml = '';
    const rows = Math.ceil((firstDay + daysInMonth) / 7);

    for (let r = 0; r < rows; r++) {
      gridHtml += '<div class="cb-dp-row">';
      for (let c = 0; c < 7; c++) {
        const dayNum = r * 7 + c - firstDay + 1;
        if (dayNum < 1 || dayNum > daysInMonth) {
          gridHtml += '<div class="cb-dp-cell cb-dp-empty"></div>';
        } else {
          const dateStr = formatDate(new Date(this.viewYear, this.viewMonth, dayNum));
          const classes = ['cb-dp-cell'];
          if (dateStr === todayStr) classes.push('cb-dp-today');
          if (dateStr === this.selectedDate) classes.push('cb-dp-selected');
          if (dayNum === this.focusedDay) classes.push('cb-dp-focused');
          gridHtml += `<div class="${classes.join(' ')}" data-date="${dateStr}" data-day="${dayNum}">${dayNum}</div>`;
        }
      }
      gridHtml += '</div>';
    }

    el.innerHTML = `
      <div class="cb-dp-header">
        <button class="cb-dp-nav" data-dir="-1">‹</button>
        <span class="cb-dp-title">${monthName} ${this.viewYear}</span>
        <button class="cb-dp-nav" data-dir="1">›</button>
      </div>
      <div class="cb-dp-weekdays">
        <div>Su</div><div>Mo</div><div>Tu</div><div>We</div><div>Th</div><div>Fr</div><div>Sa</div>
      </div>
      <div class="cb-dp-grid">${gridHtml}</div>
    `;

    // Measure height before mounting in shadow DOM
    document.documentElement.appendChild(el);
    const pickerH = el.offsetHeight || 240;
    document.documentElement.removeChild(el);

    // Position above the cursor line if room, otherwise below
    if (coords.y > pickerH + 8) {
      el.style.top = `${coords.y - pickerH - 8}px`;
    } else {
      el.style.top = `${coords.y + coords.height + 8}px`;
    }

    el.querySelector('.cb-dp-nav[data-dir="-1"]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.viewMonth--;
      if (this.viewMonth < 0) { this.viewMonth = 11; this.viewYear--; }
      this.focusedDay = 1;
      this.render(coords);
    });
    el.querySelector('.cb-dp-nav[data-dir="1"]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.viewMonth++;
      if (this.viewMonth > 11) { this.viewMonth = 0; this.viewYear++; }
      this.focusedDay = 1;
      this.render(coords);
    });

    el.querySelectorAll<HTMLElement>('.cb-dp-cell:not(.cb-dp-empty)').forEach((cell) => {
      cell.addEventListener('click', (e) => {
        e.stopPropagation();
        const date = cell.dataset['date'];
        if (date) this.pick(date);
      });
    });

    el.addEventListener('keydown', (e: KeyboardEvent) => {
      e.stopPropagation();
      const daysInM = new Date(this.viewYear, this.viewMonth + 1, 0).getDate();
      if (e.key === 'ArrowRight') { e.preventDefault(); this.focusedDay = Math.min(this.focusedDay + 1, daysInM); this.render(coords); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); this.focusedDay = Math.max(this.focusedDay - 1, 1); this.render(coords); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); const nd = this.focusedDay + 7; this.focusedDay = nd > daysInM ? daysInM : nd; this.render(coords); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); const nd = this.focusedDay - 7; this.focusedDay = nd < 1 ? 1 : nd; this.render(coords); }
      else if (e.key === 'Enter') { e.preventDefault(); this.pick(formatDate(new Date(this.viewYear, this.viewMonth, this.focusedDay))); }
      else if (e.key === 'Escape') { e.preventDefault(); this.hide(); }
    });

    this.container = el;
    this.shadow.appendChild(el);
    el.focus();
  }

  private pick(date: string) {
    this.selectedDate = date;
    this.hide();
    this.onPickCb?.(date);
  }

  hide() {
    this.container?.remove();
    this.container = null;
  }

  isVisible(): boolean {
    return this.container !== null && this.container.isConnected;
  }
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
