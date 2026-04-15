
import React from 'react';
import { CalendarEvent, EventType } from '../types';
import { formatTime, formatDateFull } from '../utils/dateUtils';
import { Button } from './Button';

interface EventModalProps {
  date: Date | null;
  events: CalendarEvent[];
  isOpen: boolean;
  onClose: () => void;
  onRemoveSource?: (source: string) => void;
  sourceUrls?: Map<string, string>;
}

export const EventModal: React.FC<EventModalProps> = ({ date, events, isOpen, onClose, onRemoveSource, sourceUrls }) => {
  if (!isOpen || !date) return null;

  // Group events by conflict status to highlight issues
  const conflicts = events.filter(e => e.hasConflict);
  const regular = events.filter(e => !e.hasConflict);

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-white dark:bg-slate-800 shadow-2xl transform transition-transform duration-300 ease-in-out z-50 flex flex-col border-l border-slate-200 dark:border-slate-700">
      <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{formatDateFull(date)}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{events.length} Events Scheduled</p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {events.length === 0 && (
          <div className="text-center py-10">
            <p className="text-slate-400 italic">No classes scheduled for this day.</p>
          </div>
        )}

        {conflicts.length > 0 && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
            <h3 className="text-red-800 dark:text-red-300 font-bold mb-3 flex items-center gap-2 text-sm uppercase tracking-tight">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                 <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
              Scheduling Conflicts
            </h3>
            <div className="space-y-3">
              {conflicts.map(event => (
                <EventCard key={event.id} event={event} onRemoveSource={onRemoveSource} sourceUrls={sourceUrls} />
              ))}
            </div>
          </div>
        )}

        {regular.length > 0 && (
          <div>
            <h3 className="text-slate-500 dark:text-slate-400 font-bold mb-3 text-xs uppercase tracking-widest">Day Schedule</h3>
            <div className="space-y-3">
              {regular.map(event => (
                <EventCard key={event.id} event={event} onRemoveSource={onRemoveSource} sourceUrls={sourceUrls} />
              ))}
            </div>
          </div>
        )}
      </div>
      
      <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
        <Button onClick={onClose} variant="secondary" className="w-full">Close Details</Button>
      </div>
    </div>
  );
};

const EventCard: React.FC<{ event: CalendarEvent; onRemoveSource?: (source: string) => void; sourceUrls?: Map<string, string> }> = ({ event, onRemoveSource, sourceUrls }) => {
  const typeColors = {
    [EventType.LECTURE]: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-200 dark:border-blue-800',
    [EventType.PRACTICAL]: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-200 dark:border-emerald-800',
    [EventType.CLASS]: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/40 dark:text-orange-200 dark:border-orange-800',
    [EventType.MATHS]: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/40 dark:text-purple-200 dark:border-purple-800',
    [EventType.OTHER]: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600',
  };

  const getUrl = () => {
      if (!sourceUrls) return null;
      let courseName = event.sourceFile;
      if (courseName.includes(' - ')) {
          courseName = courseName.split(' - ')[0];
      } else if (courseName.includes(' (')) {
          courseName = courseName.split(' (')[0];
      }
      
      if (sourceUrls.has(courseName)) return sourceUrls.get(courseName);
      const norm = courseName.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
      if (sourceUrls.has(norm)) return sourceUrls.get(norm);
      return null;
  };

  const url = getUrl();

  return (
    <div className={`group relative p-4 rounded-lg border transition-all ${event.hasConflict ? 'border-red-300 bg-white ring-2 ring-red-100 dark:bg-slate-800 dark:border-red-800 dark:ring-red-900/50 shadow-sm' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md'}`}>
      
      {onRemoveSource && (
        <button 
          onClick={() => onRemoveSource(event.sourceFile)}
          className={`absolute -top-2 -right-2 p-1 rounded-full shadow-md transition-opacity duration-200 flex items-center justify-center
            ${event.hasConflict 
              ? 'bg-red-500 text-white opacity-100 scale-110 hover:bg-red-600' 
              : 'bg-slate-200 text-slate-600 opacity-0 group-hover:opacity-100 hover:bg-slate-300 dark:bg-slate-600 dark:text-slate-200 dark:hover:bg-slate-500'
            }`}
          title={`Unselect course: ${event.sourceFile}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
            <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
          </svg>
        </button>
      )}

      <div className="flex justify-between items-start mb-2 pr-4">
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${typeColors[event.type]}`}>
          {event.type}
        </span>
        <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500 whitespace-nowrap">
          {formatTime(event.start)} - {formatTime(event.end)}
        </span>
      </div>
      
      <div className="flex items-start gap-2 mb-1">
          <h4 className="font-bold text-slate-900 dark:text-slate-100 leading-tight text-sm flex-1">{event.title}</h4>
          {url && (
            <a href={url} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-indigo-600 transition-colors shrink-0 pt-0.5" title="View Course Page" onClick={e => e.stopPropagation()}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5z" clipRule="evenodd" /><path fillRule="evenodd" d="M6.194 12.753a.75.75 0 001.06.053L16.5 4.44v2.81a.75.75 0 001.5 0v-4.5a.75.75 0 00-.75-.75h-4.5a.75.75 0 000 1.5h2.553l-9.056 8.194a.75.75 0 00-.053 1.06z" clipRule="evenodd" /></svg>
            </a>
          )}
      </div>
      
      {event.location && (
        <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-1 italic">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 flex-shrink-0">
            <path fillRule="evenodd" d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 00.281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 14.988 17 12.493 17 9A7 7 0 103 9c0 3.492 1.698 5.988 3.355 7.625a19.055 19.055 0 002.274 1.765c.311.193.571.337.757.433.092.047.186.094.281.14l.018.008.006.003.002.001zM10 11.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" clipRule="evenodd" />
          </svg>
          {event.location}
        </p>
      )}
      
      {event.description && (
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 line-clamp-2 leading-relaxed bg-slate-50/50 dark:bg-slate-900/30 p-1.5 rounded">{event.description}</p>
      )}
    </div>
  );
};