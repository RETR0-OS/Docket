export interface GCalDateTime {
  dateTime?: string;
  date?: string;
  timeZone?: string;
}

export interface GCalEvent {
  id: string;
  summary: string;
  start: GCalDateTime;
  end: GCalDateTime;
  status?: string;
}

export interface WorkingHoursDay {
  start: string;   // "HH:MM"
  end: string;     // "HH:MM"
  enabled: boolean;
}

export type DayName = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

export type WorkingHours = Record<DayName, WorkingHoursDay>;

export interface FreeSlot {
  date: string;       // "YYYY-MM-DD"
  start: string;      // "HH:MM"
  end: string;        // "HH:MM"
}
