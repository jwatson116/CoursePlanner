
import React, { useState, useEffect, useMemo } from 'react';
import { Anomaly } from '../utils/csvParser';
import { CalendarEvent, EventType } from '../types';
import { Button } from './Button';
import { getTermStartDate } from '../utils/dateUtils';

interface AnomalyModalProps {
  isOpen: boolean;
  anomaly: Anomaly | null;
  existingLocations: string[];
  onResolve: (events: CalendarEvent[]) => void;
  onSkip: () => void;
  onClose: () => void;
}

interface WeekRow {
  id: string;
  weekNum: number;
  enabled: boolean;
  day: number;
  startTime: string;
  endTime: string;
  location: string;
}

const DAY_OPTIONS = [
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
  { label: 'Sun', value: 0 },
];

const WEEK_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8];

export const AnomalyModal: React.FC<AnomalyModalProps> = ({
  isOpen,
  anomaly,
  existingLocations,
  onResolve,
  onSkip,
  onClose
}) => {
  const [rows, setRows] = useState<WeekRow[]>([]);
  const [title, setTitle] = useState('');

  useEffect(() => {
    if (anomaly && isOpen) {
      setTitle(anomaly.suggestedTitle || 'Manual Entry');
      const desc = anomaly.cols[0] || '';
      const weeksRaw = anomaly.cols[1] || '';
      
      let detectedDay = 1;
      const dayMatch = desc.match(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/i);
      if (dayMatch) {
         const found = DAY_OPTIONS.find(o => o.label.toLowerCase() === dayMatch[1].toLowerCase());
         if (found) detectedDay = found.value;
      }

      let detectedStart = '10:00';
      let detectedEnd = '11:00';
      const timeMatch = desc.match(/(\d{1,2}(?:am|pm))\s*-\s*(\d{1,2}(?:am|pm))/i);
      if (timeMatch) {
          const parseTime = (s: string) => {
              const m = s.match(/(\d{1,2})(am|pm)/i);
              if (!m) return 10;
              let h = parseInt(m[1]);
              if (m[2].toLowerCase() === 'pm' && h !== 12) h += 12;
              if (m[2].toLowerCase() === 'am' && h === 12) h = 0;
              return h;
          };
          detectedStart = `${parseTime(timeMatch[1]).toString().padStart(2, '0')}:00`;
          detectedEnd = `${parseTime(timeMatch[2]).toString().padStart(2, '0')}:00`;
      }

      const weekSet = new Set<number>();
      const cleanWeeks = weeksRaw.replace(/^Weeks?\s*/i, '');
      cleanWeeks.split(',').forEach(p => {
          const trimmed = p.trim();
          if (trimmed.includes('-')) {
              const [s, e] = trimmed.split('-').map(Number);
              if (!isNaN(s) && !isNaN(e)) {
                  for (let i = s; i <= e; i++) if (i >= 1 && i <= 8) weekSet.add(i);
              }
          } else {
              const n = parseInt(trimmed);
              if (!isNaN(n) && n >= 1 && n <= 8) weekSet.add(n);
          }
      });

      // Default to 8 rows for convenience, enabling detected ones
      setRows(WEEK_OPTIONS.map(w => ({
          id: Math.random().toString(36).substr(2, 9),
          weekNum: w,
          enabled: weekSet.has(w),
          day: detectedDay,
          startTime: detectedStart,
          endTime: detectedEnd,
          location: ''
      })));
    }
  }, [anomaly, isOpen]);

  // Dynamically build the list of locations to include any custom ones typed in the current session
  const availableLocations = useMemo(() => {
    const currentSessionLocs = rows
        .map(r => r.location)
        .filter(l => l && l.trim().length > 0);
    // Merge with existing, deduplicate, and sort
    return Array.from(new Set([...existingLocations, ...currentSessionLocs])).sort();
  }, [existingLocations, rows]);

  if (!isOpen || !anomaly) return null;

  const updateRow = (index: number, updates: Partial<WeekRow>) => {
    setRows(prev => prev.map((r, i) => i === index ? { ...r, ...updates } : r));
  };

  const addRow = () => {
    const lastRow = rows[rows.length - 1];
    setRows(prev => [...prev, {
        id: Math.random().toString(36).substr(2, 9),
        weekNum: lastRow ? lastRow.weekNum : 1,
        enabled: true,
        day: lastRow ? lastRow.day : 1,
        startTime: lastRow ? lastRow.startTime : '10:00',
        endTime: lastRow ? lastRow.endTime : '11:00',
        location: lastRow ? lastRow.location : ''
    }]);
  };

  const removeRow = (index: number) => {
    setRows(prev => prev.filter((_, i) => i !== index));
  };

  const handleBulkApply = (field: 'startTime' | 'endTime' | 'location' | 'day', value: any) => {
    setRows(prev => prev.map(r => ({ ...r, [field]: value })));
  };

  const handleConfirm = () => {
    const events: CalendarEvent[] = [];
    
    // Construct description from raw columns to match automatic parser behavior
    const descRaw = anomaly.cols[0]?.replace(/"/g, '').trim() || '';
    let weeksRaw = anomaly.cols[1]?.replace(/"/g, '').trim() || '';
    
    // Simple heuristic: if col 1 doesn't look like weeks and we have a col 2, check col 2
    if (weeksRaw && !/^Weeks?/i.test(weeksRaw) && !/^[\d,\s-]+$/.test(weeksRaw) && anomaly.cols.length > 2) {
         const col2 = anomaly.cols[2]?.replace(/"/g, '').trim();
         if (/^Weeks?/i.test(col2) || /^[\d,\s-]+$/.test(col2)) {
             weeksRaw = col2; // Use col 2 as weeks if col 1 looks like text
         }
    }
    
    const staticDescription = `${descRaw}\n${weeksRaw}`.trim();

    rows.forEach((row) => {
      if (!row.enabled) return;
      const [sh, sm] = row.startTime.split(':').map(Number);
      const [eh, em] = row.endTime.split(':').map(Number);
      const termStartDate = getTermStartDate();
      const weekStart = new Date(termStartDate);
      weekStart.setDate(termStartDate.getDate() + (row.weekNum - 1) * 7);
      const eventDate = new Date(weekStart);
      const offset = row.day === 0 ? 6 : row.day - 1;
      eventDate.setDate(weekStart.getDate() + offset);
      const start = new Date(eventDate); start.setHours(sh, sm, 0, 0);
      const end = new Date(eventDate); end.setHours(eh, em, 0, 0);
      
      events.push({
        id: Math.random().toString(36).substr(2, 9),
        title: title,
        location: row.location,
        start,
        end,
        description: staticDescription,
        type: anomaly.type || EventType.PRACTICAL,
        sourceFile: title,
        hasConflict: false
      });
    });
    onResolve(events);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4 bg-slate-900/90 backdrop-blur-md animate-fade-in">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col h-full max-h-[96vh] border border-slate-200 dark:border-slate-700 overflow-hidden">
        
        {/* Header - Compact Data Review */}
        <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-700 bg-red-50 dark:bg-red-900/10 shrink-0">
          <div className="flex justify-between items-start mb-3">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-red-700 dark:text-red-400 flex items-center gap-2 leading-none">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 sm:w-6 h-6">
                  <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
                </svg>
                Manual Schedule Resolution
              </h2>
              <p className="text-[10px] font-bold text-red-600/80 dark:text-red-300/80 mt-1 uppercase tracking-wider">
                Automatic processing failed. Use the data below to manually fill the form.
              </p>
            </div>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-white dark:bg-slate-900 rounded-full shadow-sm border border-slate-200 dark:border-slate-700">âœ•</button>
          </div>
          
          <div className="space-y-3">
             <div className="space-y-1.5">
               <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Event Name / Group (This appears in the filter list)</label>
               <input 
                 type="text" 
                 value={title} 
                 onChange={e => setTitle(e.target.value)}
                 className="w-full text-sm font-bold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-950 p-2.5 rounded-xl border border-red-200/50 dark:border-red-900/30 shadow-inner focus:ring-2 focus:ring-red-500/50 outline-none"
                 placeholder="e.g. Computer Graphics - Group A"
               />
             </div>

             <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-1">Raw CSV Content</label>
                <div className="bg-white dark:bg-slate-950 p-3 rounded-xl border border-red-200/50 dark:border-red-900/30 font-mono text-xs text-slate-700 dark:text-slate-300 max-h-24 overflow-y-auto break-words leading-relaxed shadow-inner">
                  {anomaly.lineRaw}
                </div>
             </div>
          </div>
        </div>

        {/* Content - Scrollable Weekly Form Rows */}
        <div className="flex-1 overflow-x-auto overflow-y-auto min-h-0 bg-white dark:bg-slate-800">
          <div className="min-w-[1000px] pb-10">
            {/* Table Header */}
            <div className="grid grid-cols-[100px_80px_120px_140px_140px_1fr_60px] gap-4 px-6 py-3 bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-700 sticky top-0 z-10 shadow-sm">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Week</div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Enable</div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Day</div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Start Time</div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">End Time</div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Location</div>
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Del</div>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {rows.map((row, i) => (
                <div 
                  key={row.id} 
                  className={`grid grid-cols-[100px_80px_120px_140px_140px_1fr_60px] gap-4 px-6 py-3.5 items-center transition-colors
                    ${row.enabled ? 'bg-indigo-50/40 dark:bg-indigo-900/10' : 'bg-transparent opacity-60'}
                  `}
                >
                  <div>
                    <select 
                        value={row.weekNum}
                        onChange={e => updateRow(i, { weekNum: Number(e.target.value) })}
                        className="w-full p-2 text-xs font-bold rounded-lg border border-slate-300 bg-white text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                        {WEEK_OPTIONS.map(w => <option key={w} value={w}>Week {w}</option>)}
                    </select>
                  </div>
                  <div className="flex justify-center">
                    <input 
                      type="checkbox" 
                      checked={row.enabled} 
                      onChange={e => updateRow(i, { enabled: e.target.checked })}
                      className="w-5 h-5 rounded border-slate-300 bg-white dark:bg-slate-700 dark:border-slate-600 accent-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </div>
                  <div>
                    <select 
                      disabled={!row.enabled}
                      value={row.day} 
                      onChange={e => updateRow(i, { day: Number(e.target.value) })}
                      className="w-full p-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white disabled:opacity-50 focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      {DAY_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <input 
                      type="time" 
                      disabled={!row.enabled}
                      value={row.startTime} 
                      onChange={e => updateRow(i, { startTime: e.target.value })}
                      className="w-full p-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white disabled:opacity-50 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <input 
                      type="time" 
                      disabled={!row.enabled}
                      value={row.endTime} 
                      onChange={e => updateRow(i, { endTime: e.target.value })}
                      className="w-full p-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white disabled:opacity-50 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div className="flex gap-2 items-center">
                    <input 
                      type="text" 
                      list="locations"
                      disabled={!row.enabled}
                      value={row.location} 
                      placeholder="Type or select location..."
                      onChange={e => updateRow(i, { location: e.target.value })}
                      className="w-full p-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white disabled:opacity-50 focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    {i === 0 && (
                      <button 
                        onClick={() => {
                          handleBulkApply('startTime', row.startTime);
                          handleBulkApply('endTime', row.endTime);
                          handleBulkApply('location', row.location);
                          handleBulkApply('day', row.day);
                        }}
                        className="p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors shrink-0 border border-indigo-100 dark:border-indigo-800"
                        title="Copy these values to all sessions"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.25a.75.75 0 00-1.5 0v2.5h-2.5a.75.75 0 000 1.5h2.5v2.5a.75.75 0 001.5 0v-2.5h2.5a.75.75 0 000-1.5h-2.5v-2.5z" clipRule="evenodd" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <div className="flex justify-center">
                    <button 
                        onClick={() => removeRow(i)}
                        className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                        title="Remove session"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                            <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75V4H5a2 2 0 00-2 2v.041c0 .121.013.24.038.354l.842 3.786A3.75 3.75 0 007.5 13h5a3.75 3.75 0 003.62-2.819l.842-3.786c.025-.114.038-.233.038-.354V6a2 2 0 00-2-2h-1V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 3a1.25 1.25 0 011.25 1.25V4h-2.5V3.75A1.25 1.25 0 0110 3zm2.25 8a.75.75 0 000-1.5h-4.5a.75.75 0 000 1.5h4.5z" clipRule="evenodd" />
                        </svg>
                    </button>
                  </div>
                </div>
              ))}
              <div className="p-4 flex justify-center bg-slate-50/30 dark:bg-slate-900/10">
                <button 
                    onClick={addRow}
                    className="flex items-center gap-2 px-6 py-2 rounded-xl border-2 border-dashed border-indigo-200 dark:border-indigo-900 text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors text-xs font-bold uppercase tracking-widest"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                        <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                    </svg>
                    Add Another Session
                </button>
              </div>
            </div>
          </div>
          <datalist id="locations">
            {availableLocations.map((loc, i) => <option key={i} value={loc} />)}
          </datalist>
        </div>

        {/* Footer - Fixed */}
        <div className="p-4 sm:p-6 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0">
            <button 
              onClick={onSkip} 
              className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 text-[10px] font-bold uppercase tracking-widest px-4 py-2 transition-colors order-2 sm:order-1"
            >
              Skip entry & continue
            </button>
            
            <div className="flex gap-3 w-full sm:w-auto order-1 sm:order-2">
                <Button onClick={onClose} variant="ghost" className="flex-1 sm:flex-none">Cancel</Button>
                <Button 
                  onClick={handleConfirm} 
                  disabled={!rows.some(r => r.enabled) || !title.trim()}
                  className="flex-1 sm:flex-none px-8 shadow-xl shadow-indigo-200/50 dark:shadow-none"
                >
                  Save & Resolve Next
                </Button>
            </div>
        </div>
      </div>
    </div>
  );
};
