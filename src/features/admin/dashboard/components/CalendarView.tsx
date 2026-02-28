'use client';

import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/shared/components/base/Button';
import { useLanguage } from '@/shared/hooks/useLanguage';

const localeMap = { es: 'es-ES', en: 'en-US' } as const;

export function CalendarView() {
  const { language, translate } = useLanguage();
  const locale = localeMap[language === 'es' ? 'es' : 'en'];
  const [viewDate, setViewDate] = useState(() => new Date());

  const { monthName, year, weekDayLabels, weeks } = useMemo(() => {
    const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
    const monthName = d.toLocaleDateString(locale, { month: 'long' });
    const year = d.getFullYear();
    const firstDay = d.getDay();
    const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();

    const weekDayLabels: string[] = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(2024, 0, i + 1);
      weekDayLabels.push(day.toLocaleDateString(locale, { weekday: 'short' }));
    }

    const weeks: (number | null)[][] = [];
    let week: (number | null)[] = [];
    const startPadding = firstDay;
    for (let i = 0; i < startPadding; i++) week.push(null);
    for (let day = 1; day <= daysInMonth; day++) {
      week.push(day);
      if (week.length === 7) {
        weeks.push(week);
        week = [];
      }
    }
    if (week.length) {
      while (week.length < 7) week.push(null);
      weeks.push(week);
    }

    return { monthName, year, weekDayLabels, weeks };
  }, [viewDate, locale]);

  const today = new Date();
  const isToday = (day: number | null) =>
    day !== null &&
    viewDate.getMonth() === today.getMonth() &&
    viewDate.getFullYear() === today.getFullYear() &&
    day === today.getDate();

  const goPrev = () => {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1));
  };
  const goNext = () => {
    setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1));
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <Button type="button" variant="outline" size="sm" onClick={goPrev} aria-label={translate('calendarPrevMonth')}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h3 className="text-lg font-semibold capitalize text-gray-900">
          {monthName} {year}
        </h3>
        <Button type="button" variant="outline" size="sm" onClick={goNext} aria-label={translate('calendarNextMonth')}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <table className="w-full table-fixed border-collapse">
        <thead>
          <tr>
            {weekDayLabels.map((label, i) => (
              <th
                key={i}
                className="border border-gray-200 py-2 text-center text-xs font-medium text-gray-600 bg-gray-50"
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((row, wi) => (
            <tr key={wi}>
              {row.map((day, di) => (
                <td
                  key={di}
                  className="border border-gray-200 p-1 text-center align-middle"
                >
                  {day !== null ? (
                    <span
                      className={`inline-flex h-8 w-8 items-center justify-center rounded text-sm ${
                        isToday(day)
                          ? 'bg-indigo-600 text-white font-semibold'
                          : 'text-gray-900 hover:bg-gray-100'
                      }`}
                    >
                      {day}
                    </span>
                  ) : (
                    <span className="inline-block h-8 w-8 text-gray-300">—</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
