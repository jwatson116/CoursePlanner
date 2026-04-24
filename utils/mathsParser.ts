
import { CalendarEvent, EventType } from '../types';
import { getTermStartDate } from './dateUtils';

const DAY_MAP: Record<string, number> = {
  'Monday': 0, 'Tuesday': 1, 'Wednesday': 2, 'Thursday': 3, 'Friday': 4, 'Saturday': 5, 'Sunday': 6
};

// Handles '9:00' or '10:00' formats
const parseTimeHM = (timeStr: string): { hour: number, min: number } | null => {
  if (!timeStr) return null;
  const parts = timeStr.trim().split(':');
  if (parts.length < 2) return null;
  
  return {
    hour: parseInt(parts[0]),
    min: parseInt(parts[1])
  };
};

// Robust CSV parser that handles newlines inside quotes
const parseCSVRows = (content: string): string[][] => {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (currentCell || currentRow.length > 0) {
        currentRow.push(currentCell.trim());
        rows.push(currentRow);
        currentRow = [];
        currentCell = '';
      }
      // Skip next char if it's \n after \r
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
    } else {
      currentCell += char;
    }
  }
  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    rows.push(currentRow);
  }
  return rows;
};

export const parseMathsCSV = (content: string, fileName: string): CalendarEvent[] => {
  const events: CalendarEvent[] = [];
  const rows = parseCSVRows(content);

  // Skip header if first row looks like header (contains 'cohort' or 'course')
  const startIndex = (rows[0] && (rows[0][0]?.toLowerCase().includes('cohort') || rows[0][1]?.toLowerCase().includes('course'))) ? 1 : 0;

  for (let i = startIndex; i < rows.length; i++) {
    const cols = rows[i];
    // Expected structure:
    // 0: Cohort
    // 1: Course Name
    // 2: Day
    // 3: Start Time
    // 4: End Time
    // 5: Weeks
    // 6: Room (Optional/New)
    if (cols.length < 6) continue;

    const cohort = cols[0].replace(/^"|"$/g, '').trim();
    const course = cols[1].replace(/^"|"$/g, '').trim();
    const dayRaw = cols[2].replace(/^"|"$/g, '').trim();
    const startTimeRaw = cols[3].replace(/^"|"$/g, '').trim();
    const endTimeRaw = cols[4].replace(/^"|"$/g, '').trim();
    const weeksRaw = cols[5].replace(/^"|"$/g, '').trim();
    const roomRaw = cols.length > 6 ? cols[6].replace(/^"|"$/g, '').trim() : '';

    // Clean Day (e.g. "Wednesday.1" -> "Wednesday")
    const dayStr = dayRaw.split('.')[0].trim(); 
    const dayOffset = DAY_MAP[dayStr];
    
    if (dayOffset === undefined) continue;

    const startHM = parseTimeHM(startTimeRaw);
    const endHM = parseTimeHM(endTimeRaw);
    if (!startHM || !endHM) continue;

    // Parse Weeks
    const weekNums: number[] = [];
    weeksRaw.split(',').forEach(w => {
      const part = w.trim();
      if (part.includes('-')) {
        const [start, end] = part.split('-').map(n => parseInt(n));
        for (let j = start; j <= end; j++) weekNums.push(j);
      } else {
        const n = parseInt(part);
        if (!isNaN(n)) weekNums.push(n);
      }
    });

    weekNums.forEach(weekNum => {
      const termStartDate = getTermStartDate();
      const weekStartDate = new Date(termStartDate);
      weekStartDate.setDate(termStartDate.getDate() + (weekNum - 1) * 7);
      
      const eventDate = new Date(weekStartDate);
      eventDate.setDate(weekStartDate.getDate() + dayOffset);

      const start = new Date(eventDate);
      start.setHours(startHM.hour, startHM.min, 0, 0);

      const end = new Date(eventDate);
      end.setHours(endHM.hour, endHM.min, 0, 0);

      events.push({
        id: Math.random().toString(36).substr(2, 9),
        title: course,
        location: roomRaw ? `Maths Dept - ${roomRaw}` : 'Maths Dept',
        start: start,
        end: end,
        description: `Maths Lecture for ${cohort} (Week ${weekNum})`,
        type: EventType.MATHS,
        sourceFile: `${course} (${cohort})`, 
        cohort: cohort,
        hasConflict: false
      });
    });
  }

  return events;
};
