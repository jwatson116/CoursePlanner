
import React, { useEffect, useRef } from 'react';
import { ChangeLogEntry } from '../types';
import { Button } from './Button';

interface ChangeLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  logs: ChangeLogEntry[];
  isAdminMode?: boolean;
  onEdit?: (log: ChangeLogEntry) => void;
  onDelete?: (id: string) => void;
  onSave?: (date: string, description: string) => void;
  logFormDesc: string;
  setLogFormDesc: (val: string) => void;
  logFormDate: string;
  setLogFormDate: (val: string) => void;
  editingLogId: string | null;
  onCancelEdit?: () => void;
}

export const ChangeLogModal: React.FC<ChangeLogModalProps> = ({ 
  isOpen, 
  onClose, 
  logs, 
  isAdminMode = false, 
  onEdit, 
  onDelete,
  onSave,
  logFormDesc,
  setLogFormDesc,
  logFormDate,
  setLogFormDate,
  editingLogId,
  onCancelEdit
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  // Effect for setting focus when modal opens
  useEffect(() => {
    if (isOpen) {
      // Focus modal for keyboard accessibility
      modalRef.current?.focus();
    }
  }, [isOpen]);

  // Effect for keyboard event listeners (Escape/Space to close)
  useEffect(() => {
    if (isOpen) {
      const handleKeyDown = (e: KeyboardEvent) => {
        // Prevent closing if user is interacting with form inputs in admin mode
        const target = e.target as HTMLElement;
        const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
        if (isInput) return;

        if (e.key === 'Escape') {
          onClose();
        }
        
        // Use space to close as requested
        if (e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault(); // Prevent scrolling
          onClose();
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSave) onSave(logFormDate, logFormDesc);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div 
        ref={modalRef}
        tabIndex={-1}
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700 outline-none"
      >
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-2">
            <div className="text-indigo-600 dark:text-indigo-400">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 6a.75.75 0 0 0-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 0 0 0-1.5h-3.75V6Z" clipRule="evenodd" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-white">Timetable Change Log</h2>
          </div>
          <button type="button" onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isAdminMode && (
            <div className="p-6 bg-slate-50 dark:bg-slate-900/30 border-b border-slate-100 dark:border-slate-700">
                <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-4">
                    {editingLogId ? 'Edit Entry' : 'Add New Entry'}
                </h3>
                <form onSubmit={handleSubmit} className="space-y-3">
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Effective Date</label>
                        <input 
                            type="date" 
                            value={logFormDate}
                            onChange={(e) => setLogFormDate(e.target.value)}
                            className="w-full text-xs p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                            required
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Description</label>
                        <textarea 
                            value={logFormDesc}
                            onChange={(e) => setLogFormDesc(e.target.value)}
                            placeholder="Describe the timetable update..."
                            className="w-full text-xs p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none min-h-[80px] resize-none"
                            required
                        />
                    </div>
                    <div className="flex gap-2 pt-1">
                        <Button type="submit" size="sm" className="flex-1">
                            {editingLogId ? 'Update Entry' : 'Post Entry'}
                        </Button>
                        {editingLogId && (
                            <Button type="button" variant="ghost" size="sm" onClick={onCancelEdit}>
                                Cancel
                            </Button>
                        )}
                    </div>
                </form>
            </div>
          )}

          <div className="p-6 space-y-6">
            {logs.length === 0 ? (
              <div className="text-center py-12 text-slate-400 italic">No changes recorded yet.</div>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="relative pl-8 border-l-2 border-slate-100 dark:border-slate-700 last:border-l-0">
                  <div className={`absolute left-[-9px] top-0 w-4 h-4 rounded-full border-4 border-white dark:border-slate-800 shadow-sm ${editingLogId === log.id ? 'bg-amber-500 animate-pulse' : 'bg-indigo-500'}`} />
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                          {new Date(log.date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                      </span>
                      {isAdminMode && (
                          <div className="flex gap-2">
                              <button 
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); onEdit?.(log); }} 
                                  className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors bg-slate-100 dark:bg-slate-700 rounded-md"
                                  title="Edit Entry"
                              >
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                      <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.341.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
                                      <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" />
                                  </svg>
                              </button>
                              <button 
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); onDelete?.(log.id); }} 
                                  className="p-1.5 text-slate-400 hover:text-white hover:bg-red-500 transition-colors bg-slate-100 dark:bg-slate-700 rounded-md"
                                  title="Delete Entry"
                              >
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                      <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75V4H5a2 2 0 00-2 2v.041c0 .121.013.24.038.354l.842 3.786A3.75 3.75 0 007.5 13h5a3.75 3.75 0 003.62-2.819l.842-3.786c.025-.114.038-.233.038-.354V6a2 2 0 00-2-2h-1V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 3a1.25 1.25 0 011.25 1.25V4h-2.5V3.75A1.25 1.25 0 0110 3zm2.25 8a.75.75 0 000-1.5h-4.5a.75.75 0 000 1.5h4.5z" clipRule="evenodd" />
                                  </svg>
                              </button>
                          </div>
                      )}
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-600 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                      {log.description}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <Button onClick={onClose} variant="secondary" className="w-full">Close View</Button>
        </div>
      </div>
    </div>
  );
};
