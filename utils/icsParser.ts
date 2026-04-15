import { CalendarEvent, EventType } from '../types';

// Helper to parse ICS date string (e.g., 20230901T090000Z)
const parseICSDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  const match = /(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?/.exec(dateStr);
  if (match) {
    const [, year, month, day, hour, min, sec, utc] = match;
    const y = parseInt(year);
    const m = parseInt(month) - 1;
    const d = parseInt(day);
    const h = parseInt(hour);
    const mn = parseInt(min);
    const s = parseInt(sec);

    if (utc) {
      // If Z is present, it is strict UTC
      return new Date(Date.UTC(y, m, d, h, mn, s));
    } else {
      // If Z is missing, it is "Floating" or Local time.
      // We construct it using the browser's local timezone (new Date(...))
      // This ensures 10:00 local stays 10:00 local, regardless of UTC offset (BST vs GMT)
      return new Date(y, m, d, h, mn, s);
    }
  }
  // Handle simpler YYYYMMDD format (all day)
  const matchDateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(dateStr);
  if (matchDateOnly) {
     const [, year, month, day] = matchDateOnly;
     return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }
  return null;
};

const determineEventType = (summary: string, description: string = ''): EventType => {
  const text = (summary + ' ' + description).toLowerCase();
  if (text.includes('lecture') || text.includes('lec')) return EventType.LECTURE;
  if (text.includes('practical') || text.includes('lab') || text.includes('workshop')) return EventType.PRACTICAL;
  if (text.includes('tutorial') || text.includes('seminar') || text.includes('class')) return EventType.CLASS;
  return EventType.OTHER;
};

export const parseICS = (content: string, fileName: string, forcedType?: EventType): CalendarEvent[] => {
  const events: CalendarEvent[] = [];
  const lines = content.split(/\r\n|\n|\r/);
  
  let inEvent = false;
  let currentEvent: Partial<CalendarEvent> = {};
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.startsWith('BEGIN:VEVENT')) {
      inEvent = true;
      currentEvent = { sourceFile: fileName, id: Math.random().toString(36).substr(2, 9) };
    } else if (line.startsWith('END:VEVENT')) {
      inEvent = false;
      if (currentEvent.start && currentEvent.end && currentEvent.title) {
        // Use forced type if provided, otherwise auto-detect
        currentEvent.type = forcedType || determineEventType(currentEvent.title, currentEvent.description);
        events.push(currentEvent as CalendarEvent);
      }
      currentEvent = {};
    } else if (inEvent) {
      if (line.startsWith('SUMMARY:')) {
        currentEvent.title = line.substring(8);
      } else if (line.startsWith('DTSTART')) {
        // Handle DTSTART;TZID=...: or DTSTART:
        const parts = line.split(':');
        currentEvent.start = parseICSDate(parts[parts.length - 1]);
      } else if (line.startsWith('DTEND')) {
        const parts = line.split(':');
        currentEvent.end = parseICSDate(parts[parts.length - 1]);
      } else if (line.startsWith('DESCRIPTION:')) {
        currentEvent.description = line.substring(12);
      } else if (line.startsWith('LOCATION:')) {
        currentEvent.location = line.substring(9);
      }
    }
  }
  return events;
};

export const detectConflicts = (events: CalendarEvent[]): CalendarEvent[] => {
  // Sort by start time
  const sorted = [...events].sort((a, b) => a.start.getTime() - b.start.getTime());
  
  // Reset conflicts
  const result = sorted.map(e => ({ ...e, hasConflict: false }));

  for (let i = 0; i < result.length; i++) {
    for (let j = i + 1; j < result.length; j++) {
      const e1 = result[i];
      const e2 = result[j];

      // If e2 starts after e1 ends, no more overlaps possible for e1 (since sorted)
      
      if (e1.end > e2.start && e1.start < e2.end) {
        result[i].hasConflict = true;
        result[j].hasConflict = true;
      }
    }
  }
  return result;
};