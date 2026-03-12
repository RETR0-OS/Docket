import type { WorkingHours } from './types.ts';

export const DEFAULT_WORKING_HOURS: WorkingHours = {
  Monday:    { start: '09:00', end: '17:00', enabled: true },
  Tuesday:   { start: '09:00', end: '17:00', enabled: true },
  Wednesday: { start: '09:00', end: '17:00', enabled: true },
  Thursday:  { start: '09:00', end: '17:00', enabled: true },
  Friday:    { start: '09:00', end: '17:00', enabled: true },
  Saturday:  { start: '09:00', end: '17:00', enabled: false },
  Sunday:    { start: '09:00', end: '17:00', enabled: false },
};

export interface StorageData {
  workingHours: WorkingHours;
  email?: string;
}

export function getStorage(): Promise<StorageData> {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['workingHours', 'email'], (result) => {
      resolve({
        workingHours: (result['workingHours'] as WorkingHours) ?? DEFAULT_WORKING_HOURS,
        email: result['email'] as string | undefined,
      });
    });
  });
}

export function setStorage(data: Partial<StorageData>): Promise<void> {
  return new Promise((resolve) => {
    chrome.storage.sync.set(data, resolve);
  });
}
