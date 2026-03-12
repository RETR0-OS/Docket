import type { CommandMeta } from '../shared/commands.ts';
import { COMMANDS } from '../shared/commands.ts';
import { getCaretCoords } from './command-detector.ts';

export type SelectCallback = (command: CommandMeta) => void;

export class AutocompleteDropdown {
  private shadow: ShadowRoot;
  private container: HTMLDivElement | null = null;
  private items: CommandMeta[] = [];
  private selectedIndex = 0;
  private onSelect: SelectCallback;

  constructor(shadowHost: HTMLElement, onSelect: SelectCallback) {
    this.shadow = shadowHost.shadowRoot!;
    this.onSelect = onSelect;
  }

  update(partial: string, anchorEl: HTMLElement) {
    const query = partial.replace(/^::/, '').toLowerCase();
    this.items = COMMANDS.filter((c) => c.name.startsWith(query));
    this.selectedIndex = 0;

    if (this.items.length === 0) {
      this.hide();
      return;
    }

    const coords = getCaretCoords(anchorEl);
    this.render(coords.x, coords.y + coords.height + 4);
  }

  private render(x: number, y: number) {
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.className = 'cb-dropdown';
      this.shadow.appendChild(this.container);
    }
    this.container.style.left = `${Math.min(x, window.innerWidth - 300)}px`;
    this.container.style.top = `${Math.min(y, window.innerHeight - 200)}px`;
    this.container.innerHTML = '';

    this.items.forEach((cmd, i) => {
      const item = document.createElement('div');
      item.className = 'cb-dropdown-item' + (i === this.selectedIndex ? ' selected' : '');
      item.innerHTML = `<span class="name">::${cmd.name}::</span><span class="hint">${cmd.hint}</span>`;
      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this.onSelect(cmd);
      });
      this.container!.appendChild(item);
    });
  }

  moveSelection(delta: 1 | -1) {
    if (this.items.length === 0) return;
    this.selectedIndex = (this.selectedIndex + delta + this.items.length) % this.items.length;
    const divs = this.container?.querySelectorAll('.cb-dropdown-item');
    divs?.forEach((d, i) => d.classList.toggle('selected', i === this.selectedIndex));
  }

  confirmSelection(): CommandMeta | null {
    return this.items[this.selectedIndex] ?? null;
  }

  isVisible(): boolean {
    return this.container !== null && this.container.isConnected;
  }

  hide() {
    this.container?.remove();
    this.container = null;
    this.items = [];
  }
}
