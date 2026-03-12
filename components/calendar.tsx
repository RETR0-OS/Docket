import { useState } from 'react';
import Calendar from 'react-calendar';
import './styles/calendar.css';

type ValuePiece = Date | null;
type Value = ValuePiece | [ValuePiece, ValuePiece];


const daysOfWeek = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'
] as const;
type Day = typeof daysOfWeek[number];

export default function CalendarComponent() {
  const [dateRange, setDateRange] = useState<Value>([new Date(), new Date()]);
  const [workingHours, setWorkingHours] = useState<Record<Day, { start: string; end: string; notWorking: boolean }>>({
    Monday: { start: '09:00', end: '17:00', notWorking: false },
    Tuesday: { start: '09:00', end: '17:00', notWorking: false },
    Wednesday: { start: '09:00', end: '17:00', notWorking: false },
    Thursday: { start: '09:00', end: '17:00', notWorking: false },
    Friday: { start: '09:00', end: '17:00', notWorking: false },
    Saturday: { start: '00:00', end: '00:00', notWorking: true },
    Sunday: { start: '00:00', end: '00:00', notWorking: true },
  });

  // Today's date in yyyy-mm-dd format for input min
  const todayStr = new Date().toISOString().split('T')[0];

  // Helper to check if a date is in the selected range
  const isInRange = (date: Date) => {
    if (Array.isArray(dateRange) && dateRange[0] && dateRange[1]) {
      const start = dateRange[0];
      const end = dateRange[1];
      return date >= start && date <= end;
    }
    return false;
  };

  // Handlers for manual date input
  const handleDateChange = (idx: 0 | 1, value: string) => {
    if (!Array.isArray(dateRange)) return;
    const newDate = new Date(value);
    const newRange: [Date, Date] = [...dateRange] as [Date, Date];
    newRange[idx] = newDate;
    setDateRange(newRange);
  };

  // Handlers for working hours input
  const handleHoursChange = (day: Day, field: 'start' | 'end', value: string) => {
    setWorkingHours(prev => ({
      ...prev,
      [day]: { ...prev[day], [field]: value, notWorking: false }
    }));
  };

  const handleNotWorkingToggle = (day: Day) => {
    setWorkingHours(prev => {
      const wasNotWorking = prev[day].notWorking;
      return {
        ...prev,
        [day]: wasNotWorking
          ? { ...prev[day], notWorking: false, start: '09:00', end: '17:00' }
          : { ...prev[day], notWorking: true, start: '00:00', end: '00:00' }
      };
    });
  };

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="w-full flex flex-col items-center">
        <Calendar
          selectRange={true}
          onChange={setDateRange}
          value={dateRange}
          minDate={new Date()}
          tileClassName={({ date, view }) =>
            view === 'month' && isInRange(date) ? 'in-range' : undefined
          }
        />
        <div className="flex gap-4 mt-4 items-center">
          <label className="flex flex-col text-sm">
            Start Date
            <input
              type="date"
              className="rounded border px-2 py-1 mt-1"
              min={todayStr}
              value={
                Array.isArray(dateRange) && dateRange[0]
                  ? dateRange[0].toISOString().split('T')[0]
                  : ''
              }
              onChange={e => handleDateChange(0, e.target.value)}
            />
          </label>
          <label className="flex flex-col text-sm">
            End Date
            <input
              type="date"
              className="rounded border px-2 py-1 mt-1"
              min={todayStr}
              value={
                Array.isArray(dateRange) && dateRange[1]
                  ? dateRange[1].toISOString().split('T')[0]
                  : ''
              }
              onChange={e => handleDateChange(1, e.target.value)}
            />
          </label>
        </div>
      </div>

      <div className="w-full max-w-xl">
        <h2 className="text-lg font-semibold mb-2">Working Hours</h2>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border-b py-2 text-left">Day</th>
              <th className="border-b py-2 text-left">Start</th>
              <th className="border-b py-2 text-left">End</th>
              <th className="border-b py-2 text-center">Not working</th>
            </tr>
          </thead>
          <tbody>
            {daysOfWeek.map(day => {
              const wh = workingHours[day];
              return (
                <tr key={day} className={wh.notWorking ? 'opacity-60 bg-gray-100' : ''}>
                  <td className={"py-2 " + (wh.notWorking ? 'line-through text-gray-400' : '')}>{day}</td>
                  <td>
                    <input
                      type="time"
                      className="rounded border px-2 py-1"
                      value={wh.start}
                      onChange={e => handleHoursChange(day, 'start', e.target.value)}
                      disabled={wh.notWorking}
                    />
                  </td>
                  <td>
                    <input
                      type="time"
                      className="rounded border px-2 py-1"
                      value={wh.end}
                      onChange={e => handleHoursChange(day, 'end', e.target.value)}
                      disabled={wh.notWorking}
                    />
                  </td>
                  <td className="text-center">
                    <button
                      type="button"
                      className={`text-lg px-2 py-1 rounded-full border ${wh.notWorking ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-600'}`}
                      title={wh.notWorking ? 'Working' : 'Not working'}
                      onClick={() => handleNotWorkingToggle(day)}
                    >
                      &#10005;
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="mt-4 text-xs text-gray-400">
          Set your working hours for each day. These will apply to all dates in the selected range.
        </div>
      </div>
    </div>
  );
}