
import React from 'react';
import { CalendarEvent, EventType } from '../types';
import { formatTime } from '../utils/dateUtils';

interface AgendaViewProps {
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
}

export const AgendaView: React.FC<AgendaViewProps> = ({ events, onEventClick }) => {
  // Sort events chronologically
  const sortedEvents = [...events].sort((a, b) => a.start.getTime() - b.start.getTime());

  // Group by Date string
  const grouped: Record<string, CalendarEvent[]> = {};
  sortedEvents.forEach(e => {
    const dateKey = e.start.toDateString();
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(e);
  });

  if (sortedEvents.length === 0) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12 mb-3 text-slate-300 dark:text-slate-600">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
            </svg>
            <p className="font-medium">No events to display</p>
            <p className="text-xs mt-1 text-slate-400">Adjust your filters or select a different date range.</p>
        </div>
    )
  }

  const typeColors = {
    [EventType.LECTURE]: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-200 dark:border-blue-800',
    [EventType.PRACTICAL]: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-800',
    [EventType.CLASS]: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/40 dark:text-orange-200 dark:border-orange-800',
    [EventType.MATHS]: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/40 dark:text-purple-200 dark:border-purple-800',
    [EventType.OTHER]: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-700/50 dark:text-slate-300 dark:border-slate-600',
  };

  return (
    <div className="h-full overflow-y-auto p-4 space-y-6 bg-slate-50 dark:bg-slate-900 pb-24 md:pb-4 transition-colors duration-200">
      {Object.entries(grouped).map(([dateStr, dayEvents]) => (
        <div key={dateStr} className="space-y-2">
          <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase sticky top-0 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-sm py-3 z-10 border-b border-slate-100 dark:border-slate-800">
            {new Date(dateStr).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </h3>
          <div className="space-y-2">
            {dayEvents.map(event => (
              <div 
                key={event.id} 
                onClick={() => onEventClick(event)}
                className={`bg-white dark:bg-slate-800 p-3 rounded-lg border shadow-sm cursor-pointer hover:shadow-md dark:hover:bg-slate-750 transition-all flex gap-3 items-start ${event.hasConflict ? 'border-red-300 ring-1 ring-red-100 dark:border-red-800 dark:ring-red-900/50' : 'border-slate-200 dark:border-slate-700'}`}
              >
                 <div className="flex flex-col items-center min-w-[60px] border-r border-slate-100 dark:border-slate-700 pr-3">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{formatTime(event.start)}</span>
                    <span className="text-[10px] text-slate-400">{formatTime(event.end)}</span>
                 </div>
                 <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${typeColors[event.type]}`}>
                            {event.type}
                        </span>
                        {event.hasConflict && (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-1.5 py-0.5 rounded">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                Conflict
                            </span>
                        )}
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight mb-0.5">{event.title}</h4>
                    {event.location && (
                        <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                <path fillRule="evenodd" d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 00.281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 14.988 17 12.493 17 9A7 7 0 103 9c0 3.492 1.698 5.988 3.355 7.625a19.055 19.055 0 002.274 1.765c.311.193.571.337.757.433.092.047.186.094.281.14l.018.008.006.003.002.001zM10 11.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" clipRule="evenodd" />
                            </svg>
                            <span className="truncate">{event.location}</span>
                        </div>
                    )}
                 </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
