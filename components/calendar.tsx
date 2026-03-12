import { useState, useEffect } from 'react';
import type { WorkingHours, DayName } from '../src/shared/types.ts';
import { DEFAULT_WORKING_HOURS, getStorage, setStorage } from '../src/shared/storage.ts';

const daysOfWeek: DayName[] = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
];

interface Props {
  onSaved?: () => void;
}

export default function CalendarComponent({ onSaved }: Props) {
  const [workingHours, setWorkingHours] = useState<WorkingHours>(DEFAULT_WORKING_HOURS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getStorage().then(({ workingHours: wh }) => setWorkingHours(wh));
  }, []);

  const handleHoursChange = (day: DayName, field: 'start' | 'end', value: string) => {
    setWorkingHours(prev => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  };

  const handleToggle = (day: DayName) => {
    setWorkingHours(prev => ({
      ...prev,
      [day]: { ...prev[day], enabled: !prev[day].enabled },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    await setStorage({ workingHours });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onSaved?.();
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <h2 className="text-lg font-semibold">Working Hours</h2>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border-b py-2 text-left">Day</th>
            <th className="border-b py-2 text-left">Start</th>
            <th className="border-b py-2 text-left">End</th>
            <th className="border-b py-2 text-center">Off</th>
          </tr>
        </thead>
        <tbody>
          {daysOfWeek.map(day => {
            const wh = workingHours[day];
            return (
              <tr key={day} className={!wh.enabled ? 'opacity-50' : ''}>
                <td className={'py-1 ' + (!wh.enabled ? 'line-through text-gray-400' : '')}>{day}</td>
                <td>
                  <input
                    type="time"
                    className="rounded border px-1 py-0.5 text-xs"
                    value={wh.start}
                    disabled={!wh.enabled}
                    onChange={e => handleHoursChange(day, 'start', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="time"
                    className="rounded border px-1 py-0.5 text-xs"
                    value={wh.end}
                    disabled={!wh.enabled}
                    onChange={e => handleHoursChange(day, 'end', e.target.value)}
                  />
                </td>
                <td className="text-center">
                  <button
                    type="button"
                    className={`text-sm px-2 py-0.5 rounded border ${!wh.enabled ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-600'}`}
                    onClick={() => handleToggle(day)}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="flex items-center gap-3 mt-2">
        <button
          type="button"
          className="px-4 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        {saved && <span className="text-green-600 text-sm">Saved!</span>}
      </div>
      <p className="text-xs text-gray-400">
        These hours define your availability for Docket commands.
      </p>
    </div>
  );
}
