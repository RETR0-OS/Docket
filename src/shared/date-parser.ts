const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export function parseNaturalDate(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // ISO passthrough YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  if (trimmed === 'today') return formatDate(today);
  if (trimmed === 'tomorrow') {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return formatDate(d);
  }
  if (trimmed === 'yesterday') {
    const d = new Date(today);
    d.setDate(d.getDate() - 1);
    return formatDate(d);
  }

  // "next <weekday>"
  const nextMatch = /^next\s+(\w+)$/.exec(trimmed);
  if (nextMatch) {
    const idx = WEEKDAYS.indexOf(nextMatch[1]!);
    if (idx !== -1) {
      const d = new Date(today);
      const diff = ((idx - d.getDay() + 7) % 7) || 7;
      d.setDate(d.getDate() + diff);
      return formatDate(d);
    }
  }

  // "this <weekday>"
  const thisMatch = /^this\s+(\w+)$/.exec(trimmed);
  if (thisMatch) {
    const idx = WEEKDAYS.indexOf(thisMatch[1]!);
    if (idx !== -1) {
      const d = new Date(today);
      const diff = (idx - d.getDay() + 7) % 7;
      d.setDate(d.getDate() + diff);
      return formatDate(d);
    }
  }

  return null;
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
