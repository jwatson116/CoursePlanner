
import React, { useMemo } from 'react';
import { CalendarEvent, EventType } from '../types';
import { getMonday, addDays, isSameDay, formatTime, getTermWeek } from '../utils/dateUtils';

interface CalendarWeekProps {
  currentDate: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
}

const START_HOUR = 8.5; // 8:30 AM
const END_HOUR = 18.5;  // 6:30 PM
const TOTAL_HOURS = END_HOUR - START_HOUR;

export const CalendarWeek: React.FC<CalendarWeekProps> = ({ currentDate, events, onEventClick }) => {
  const monday = useMemo(() => getMonday(currentDate), [currentDate]);

  // Strictly Monday to Friday (5 days)
  const weekDays = useMemo(() => {
    return Array.from({ length: 5 }, (_, i) => addDays(monday, i));
  }, [monday]);

  const today = new Date();

  // Generate grid lines for integer hours within the range (e.g. 9:00, 10:00... 18:00)
  const gridLines = useMemo(() => {
      const lines = [];
      for (let h = Math.ceil(START_HOUR); h <= Math.floor(END_HOUR); h++) {
          lines.push(h);
      }
      return lines;
  }, []);

  const getDayEvents = (day: Date) => {
    // Only include events that overlap with the view window
    const dayEvents = events.filter(e => {
        if (!isSameDay(e.start, day)) return false;
        const startH = e.start.getHours() + e.start.getMinutes() / 60;
        const endH = e.end.getHours() + e.end.getMinutes() / 60;
        return endH > START_HOUR && startH < END_HOUR;
    });
    
    dayEvents.sort((a, b) => {
        if (a.start.getTime() !== b.start.getTime()) return a.start.getTime() - b.start.getTime();
        return (b.end.getTime() - b.start.getTime()) - (a.end.getTime() - a.start.getTime());
    });

    const columns: CalendarEvent[][] = [];
    const eventPositions: Map<string, { col: number, maxCols: number }> = new Map();

    dayEvents.forEach(event => {
        let placed = false;
        for (let i = 0; i < columns.length; i++) {
            const col = columns[i];
            const lastInCol = col[col.length - 1];
            if (event.start >= lastInCol.end) {
                col.push(event);
                eventPositions.set(event.id, { col: i, maxCols: 1 });
                placed = true;
                break;
            }
        }
        if (!placed) {
            columns.push([event]);
            eventPositions.set(event.id, { col: columns.length - 1, maxCols: 1 });
        }
    });

    const layoutEvents = dayEvents.map(event => {
        let startH = event.start.getHours() + event.start.getMinutes() / 60;
        let endH = event.end.getHours() + event.end.getMinutes() / 60;
        
        // Clamp to view range
        const clampedStartH = Math.max(startH, START_HOUR);
        const clampedEndH = Math.min(endH, END_HOUR);

        const top = ((clampedStartH - START_HOUR) / TOTAL_HOURS) * 100;
        const height = ((clampedEndH - clampedStartH) / TOTAL_HOURS) * 100;

        const pos = eventPositions.get(event.id) || { col: 0, maxCols: 1 };
        const widthPercent = 100 / columns.length;
        const leftPercent = pos.col * widthPercent;

        return {
            event,
            style: {
                top: `${top}%`,
                height: `${height}%`,
                left: `${leftPercent}%`,
                width: `${widthPercent}%`,
                position: 'absolute' as const
            }
        };
    });

    return layoutEvents;
  };

  const typeStyles = {
    [EventType.LECTURE]: 'bg-blue-100 border-blue-200 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/60 dark:border-blue-700 dark:text-blue-100',
    [EventType.PRACTICAL]: 'bg-emerald-100 border-emerald-200 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-900/60 dark:border-emerald-700 dark:text-emerald-100',
    [EventType.CLASS]: 'bg-orange-100 border-orange-200 text-orange-800 hover:bg-orange-200 dark:bg-orange-900/60 dark:border-orange-700 dark:text-orange-100',
    [EventType.MATHS]: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/40 dark:text-purple-200 dark:border-purple-800',
    [EventType.OTHER]: 'bg-slate-100 border-slate-200 text-slate-800 hover:bg-slate-200 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200',
  };

  return (
    <div className="h-full bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col relative">
        {/* Day Header - Shared space Mon-Fri */}
        <div className="flex w-full sticky top-0 z-30 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm flex-none">
            <div className="w-10 md:w-14 flex-none border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"></div>
            {weekDays.map((date, i) => {
                const isToday = isSameDay(date, today);
                const weekNum = getTermWeek(date);
                return (
                    <div key={i} className={`flex-1 min-w-0 py-1.5 md:py-3 text-center border-r border-slate-200 dark:border-slate-700 last:border-r-0 relative ${isToday ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''}`}>
                        <div className={`hidden sm:block text-[8px] font-bold absolute top-1 left-1 ${isToday ? 'text-blue-400' : 'text-slate-400 opacity-60'}`}>
                            W{weekNum}
                        </div>
                        <div className={`text-[9px] md:text-xs font-semibold uppercase mb-0.5 ${isToday ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`}>
                            {date.toLocaleDateString('en-US', { weekday: 'short' })}
                        </div>
                        <div className={`text-xs md:text-lg font-bold w-5 h-5 md:w-8 md:h-8 rounded-full flex items-center justify-center mx-auto ${isToday ? 'bg-[#002147] text-white dark:bg-indigo-600' : 'text-slate-800 dark:text-slate-200'}`}>
                            {date.getDate()}
                        </div>
                    </div>
                );
            })}
        </div>

        {/* Time Grid - 8:30 to 18:30 Viewport */}
        <div className="flex w-full relative bg-white dark:bg-slate-900 flex-1 overflow-y-auto overflow-x-hidden">
            <div className="w-10 md:w-14 flex-none border-r border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/80 backdrop-blur-[2px] z-20 relative h-full">
                {/* Labels for integer hours */}
                {gridLines.map(hour => {
                    const top = ((hour - START_HOUR) / TOTAL_HOURS) * 100;
                    return (
                        <div key={hour} className="absolute w-full flex justify-end pr-1 md:pr-2" style={{ top: `${top}%`, transform: 'translateY(-50%)' }}>
                            <span className="text-[9px] md:text-xs text-slate-400 dark:text-slate-500 font-medium font-mono">
                                {hour}:00
                            </span>
                        </div>
                    );
                })}
                {/* Add 18:30 label at bottom */}
                <div className="absolute w-full flex justify-end pr-1 md:pr-2" style={{ top: '100%', transform: 'translateY(-100%)' }}>
                     <span className="text-[9px] md:text-xs text-slate-400 dark:text-slate-500 font-medium font-mono">
                        18:30
                     </span>
                </div>
            </div>

            {/* Day Columns */}
            {weekDays.map((date, i) => (
                <div key={i} className="flex-1 min-w-0 border-r border-slate-100 dark:border-slate-800 relative h-full last:border-r-0">
                    {/* Background Grid Lines */}
                    {gridLines.map(hour => {
                        const top = ((hour - START_HOUR) / TOTAL_HOURS) * 100;
                        return (
                            <div key={hour} className="absolute w-full border-b border-slate-100 dark:border-slate-800/50 pointer-events-none" style={{ top: `${top}%` }}></div>
                        );
                    })}
                    
                    {/* Events Layer */}
                    <div className="absolute inset-0 z-10 w-full h-full">
                        {getDayEvents(date).map(({ event, style }) => (
                            <div
                                key={event.id}
                                style={style}
                                onClick={() => onEventClick(event)}
                                title={`${event.title}${event.description ? '\n' + event.description : ''}${event.hasConflict ? '\n(Conflict)' : ''}`}
                                className={`
                                    absolute rounded border overflow-hidden cursor-pointer pointer-events-auto transition-all hover:z-20 hover:shadow-lg p-0.5 md:p-1 group
                                    ${typeStyles[event.type]}
                                    ${event.hasConflict ? 'ring-1 md:ring-2 ring-red-500 ring-offset-1 dark:ring-offset-slate-900' : ''}
                                `}
                            >
                                <div className="text-[7px] md:text-[10px] font-bold leading-tight truncate">{event.title}</div>
                                <div className="text-[6px] md:text-[9px] opacity-90 truncate mt-0.5 hidden sm:block">
                                    {formatTime(event.start)} - {formatTime(event.end)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    </div>
  );
};
