
import React from 'react';
import { CalendarEvent, EventType } from '../types';
import { getMonthData, DAYS_OF_WEEK, isSameDay, MONTH_NAMES, getTermWeek } from '../utils/dateUtils';

interface CalendarMonthProps {
  year: number;
  month: number;
  events: CalendarEvent[];
  onDayClick: (date: Date) => void;
  selectedDate: Date | null;
}

const EventDot: React.FC<{ event: CalendarEvent }> = ({ event }) => {
  const letters: Record<string, string> = {
    [EventType.LECTURE]: 'L',
    [EventType.PRACTICAL]: 'P',
    [EventType.CLASS]: 'C',
    [EventType.MATHS]: 'M',
    [EventType.OTHER]: 'O',
  };

  const colors = {
    [EventType.LECTURE]: 'bg-blue-500 dark:bg-blue-500',
    [EventType.PRACTICAL]: 'bg-emerald-500 dark:bg-emerald-500',
    [EventType.CLASS]: 'bg-orange-500 dark:bg-orange-500',
    [EventType.MATHS]: 'bg-purple-500 dark:bg-purple-500',
    [EventType.OTHER]: 'bg-slate-400 dark:bg-slate-500',
  };

  const bgClass = event.hasConflict ? 'bg-red-500 dark:bg-red-500' : (colors[event.type] || 'bg-slate-400 dark:bg-slate-500');
  const letter = letters[event.type] || 'O';
  const tooltip = `${event.title}${event.description ? '\n' + event.description : ''}${event.hasConflict ? '\n(Conflict)' : ''}`;

  return (
    <span 
      className={`h-3.5 w-3.5 rounded-[3px] flex items-center justify-center text-[9px] font-bold text-white shadow-sm leading-none ${bgClass}`} 
      title={tooltip}
    >
      {letter}
    </span>
  );
};

export const CalendarMonth: React.FC<CalendarMonthProps> = ({ 
  year, 
  month, 
  events, 
  onDayClick,
  selectedDate 
}) => {
  const days = getMonthData(year, month);
  
  // Ensure we always render 6 rows * 7 cols = 42 cells to maintain consistent row height
  // and grid structure across all months, filling the available height.
  const totalSlots = 42;
  const empties = Array.from({ length: Math.max(0, totalSlots - days.length) });
  
  // Correctly handle month overflow for display logic
  const displayDate = new Date(year, month);
  const monthLabel = `${MONTH_NAMES[displayDate.getMonth()]} ${displayDate.getFullYear()}`;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col h-full transition-colors duration-200">
      <div className="p-1 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700 text-center flex-none">
        <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100">{monthLabel}</h3>
      </div>
      
      <div className="grid grid-cols-7 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex-none">
        {DAYS_OF_WEEK.map(d => (
          <div key={d} className="py-0.5 text-center text-[9px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {d.substring(0, 1)}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 grid-rows-6 flex-1">
        {days.map((d, idx) => {
          const current = new Date(d.year, d.month, d.day);
          const isSelected = selectedDate && isSameDay(current, selectedDate);
          
          const dayEvents = events.filter(e => isSameDay(e.start, current));
          const hasConflict = dayEvents.some(e => e.hasConflict);
          const isWeekStart = idx % 7 === 0;
          const weekNum = getTermWeek(current);
          
          return (
            <div 
              key={idx}
              onClick={() => onDayClick(current)}
              className={`
                min-h-[30px] border-b border-r border-slate-50 dark:border-slate-700/50 p-0.5 cursor-pointer transition-all relative
                ${!d.isCurrentMonth ? 'bg-slate-50/50 dark:bg-slate-900/50 text-slate-300 dark:text-slate-700' : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200'}
                ${isSelected ? 'ring-1 ring-inset ring-[#002147] dark:ring-indigo-400 z-10' : 'hover:bg-slate-50 dark:hover:bg-slate-700'}
                ${hasConflict ? 'bg-red-50/50 dark:bg-red-900/20' : ''}
              `}
            >
              {isWeekStart && (
                <div className="absolute top-0 left-0 p-0 z-0 opacity-40 pointer-events-none">
                   <span className="text-[7px] font-bold text-slate-400 dark:text-slate-500 leading-none">W{weekNum}</span>
                </div>
              )}

              <div className="flex justify-between items-start">
                <span className={`text-[10px] font-medium h-4 w-4 flex items-center justify-center rounded-full ${isSelected ? 'bg-[#002147] dark:bg-indigo-600 text-white' : ''}`}>
                  {d.day}
                </span>
                {hasConflict && (
                  <span className="text-red-500 dark:text-red-400" title="Conflict Detected">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-2.5 h-2.5">
                      <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                  </span>
                )}
              </div>
              
              <div className="mt-0.5 flex flex-wrap gap-0.5 content-start justify-center">
                {dayEvents.slice(0, 6).map(ev => (
                  <EventDot key={ev.id} event={ev} />
                ))}
                {dayEvents.length > 6 && (
                  <span className="text-[7px] text-slate-400 dark:text-slate-500 leading-none self-center font-bold pl-0.5">+</span>
                )}
              </div>
            </div>
          );
        })}
        {/* Render empty cells to fill the grid to 6 rows */}
        {empties.map((_, idx) => (
           <div 
             key={`empty-${idx}`} 
             className="min-h-[30px] border-b border-r border-slate-50 dark:border-slate-700/50 bg-slate-50/30 dark:bg-slate-900/30"
           />
        ))}
      </div>
    </div>
  );
};
