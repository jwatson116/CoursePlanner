
import { CalendarEvent, EventType } from '../types';
import { TERM_START_DATE } from './dateUtils';

const DAY_MAP: Record<string, number> = {
  'Mon': 0, 'Tue': 1, 'Wed': 2, 'Thu': 3, 'Fri': 4, 'Sat': 5, 'Sun': 6
};

export interface Anomaly {
  lineRaw: string;
  fileName: string;
  cols: string[];
  suggestedTitle?: string;
  suggestedGroup?: string;
  type?: EventType;
}

export interface CSVParseResult {
  events: CalendarEvent[];
  anomalies: Anomaly[];
}

// Helper to parse time string like "2pm" or "10am" into hours (24h format)
const parseTime = (timeStr: string): number => {
  const match = timeStr.trim().match(/(\d{1,2})(am|pm)/i);
  if (!match) return 0;
  let hour = parseInt(match[1]);
  const meridiem = match[2].toLowerCase();
  
  if (meridiem === 'pm' && hour !== 12) hour += 12;
  if (meridiem === 'am' && hour === 12) hour = 0;
  return hour;
};

// Robust CSV line splitter that handles quotes correctly
const splitCSVLine = (line: string): string[] => {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
};

export const parseCSV = (content: string, fileName: string, eventType: EventType = EventType.PRACTICAL): CSVParseResult => {
  const events: CalendarEvent[] = [];
  const anomalies: Anomaly[] = [];
  
  // 1. Split into physical lines
  const physicalLines = content.split(/\r\n|\n|\r/).filter(l => l.trim());
  
  // 2. Requirement: Ignore the first row (header row)
  if (physicalLines.length <= 1) return { events: [], anomalies: [] };
  const dataLines = physicalLines.slice(1);

  // 3. Requirement: Every logical record should start with "Class Group", "Practical Group", or "Lab-based ...".
  // If a row doesn't start with it, it's a continuation of the previous row.
  const logicalRecords: string[] = [];
  let recordBuffer = "";

  dataLines.forEach(line => {
    const trimmed = line.trim();
    // Check if it starts with Class Group or Practical Group (allowing optional leading quote and Lab-based prefix)
    const isNewRecord = /^"?(?:Lab-based\s+"?)?(?:Class Group|Practical Group)/i.test(trimmed);

    if (isNewRecord) {
      if (recordBuffer) logicalRecords.push(recordBuffer);
      recordBuffer = line;
    } else {
      // It's a continuation. Append with newline to maintain separation and preserve data.
      recordBuffer += "\n" + line;
    }
  });
  // Push the final buffer
  if (recordBuffer) logicalRecords.push(recordBuffer);

  // 4. Process the logical records
  logicalRecords.forEach(recordStr => {
    const cols = splitCSVLine(recordStr);
    if (cols.length < 2) return;

    let descriptionRaw = cols[0].replace(/"/g, '').trim();
    let weeksRaw = '';
    let courseCode = '';
    let extraDescription = '';

    // Detect format: Check if col[1] looks like "Weeks" or is empty/numeric
    const col1 = cols[1].replace(/"/g, '').trim();
    // Heuristic: If it starts with 'Week' or is just digits/ranges/commas, it's weeks.
    // Otherwise it's the description field.
    const isWeeks = /^Weeks?/i.test(col1) || /^[\d,\s-]+$/.test(col1);

    if (isWeeks) {
       weeksRaw = col1;
       courseCode = cols.length > 2 ? cols[2].replace(/"/g, '').trim() : '';
    } else {
       extraDescription = col1;
       weeksRaw = cols.length > 2 ? cols[2].replace(/"/g, '').trim() : '';
       courseCode = cols.length > 3 ? cols[3].replace(/"/g, '').trim() : '';
    }

    // Check for complexity markers in the "Weeks" column (e.g., "Weeks 3 in LTA")
    const weeksContent = weeksRaw.replace(/^Weeks?\s*/i, '');
    const isComplexWeeks = /[a-z=]/i.test(weeksContent);

    // Improved Regex for standard format: "Group Name (Location, Day Start - End)"
    // Supports 3-letter days or full names (e.g. Thurs)
    // Updated to use [\s\S] to match newlines in descriptions and allow trailing text
    const descMatch = descriptionRaw.match(/^([\s\S]*?)\s*\(([\s\S]*?),\s*([A-Za-z]+)\s+(\d{1,2}(?:am|pm))\s*-\s*(\d{1,2}(?:am|pm))\)([\s\S]*)$/i);

    if (!descMatch || isComplexWeeks) {
       // Automatic parsing failed or is complex -> Trigger Manual Anomaly Resolver
       const looseMatch = descriptionRaw.match(/^(.*?)\s*\(/);
       const groupName = looseMatch ? looseMatch[1] : descriptionRaw;
       // Fallback to fileName if courseCode is missing
       const distinctGroupName = courseCode ? `${courseCode} - ${groupName}` : (fileName ? `${fileName} - ${groupName}` : groupName);
       
       anomalies.push({
         lineRaw: recordStr, // The full multi-line logical record
         fileName,
         cols,
         suggestedTitle: distinctGroupName,
         suggestedGroup: groupName,
         type: eventType
       });
       return;
    }

    const [, groupName, locationRaw, dayStrRaw, startTimeStr, endTimeStr] = descMatch;
    
    // Normalize location
    const location = locationRaw.replace(/,\s*/g, ' ').trim();

    // Parse week numbers from string (handles "1-8" or "3,5,7")
    const weekNums: number[] = [];
    const cleanWeeks = weeksRaw.replace(/^Weeks?\s+/i, '');
    cleanWeeks.split(',').forEach(w => {
        const trimmedW = w.trim();
        if (trimmedW.includes('-')) {
            const [start, end] = trimmedW.split('-').map(n => parseInt(n));
            if (!isNaN(start) && !isNaN(end)) {
                for (let i = start; i <= end; i++) weekNums.push(i);
            }
        } else {
            const n = parseInt(trimmedW);
            if (!isNaN(n)) weekNums.push(n);
        }
    });

    // Resolve day name to offset (using first 3 chars to handle Mon vs Monday vs Thurs)
    const cleanDayStr = dayStrRaw.substring(0, 3);
    const dayOffset = DAY_MAP[cleanDayStr.charAt(0).toUpperCase() + cleanDayStr.slice(1).toLowerCase()];
    if (dayOffset === undefined) return; 

    const startHour = parseTime(startTimeStr);
    const endHour = parseTime(endTimeStr);
    // Fallback to fileName if courseCode is missing
    const distinctGroupName = courseCode ? `${courseCode} - ${groupName}` : (fileName ? `${fileName} - ${groupName}` : groupName);

    // Use the raw description from the CSV (first two columns) as the event description
    // This allows the tooltip to show: Course Name (from Title), Group Name (descriptionRaw), Weeks (weeksRaw)
    const staticDescription = `${descriptionRaw}\n${weeksRaw}`;

    weekNums.forEach(weekNum => {
      // TERM_START_DATE is Week 1 Monday
      const weekStartDate = new Date(TERM_START_DATE);
      weekStartDate.setDate(TERM_START_DATE.getDate() + (weekNum - 1) * 7);
      
      const eventDate = new Date(weekStartDate);
      eventDate.setDate(weekStartDate.getDate() + dayOffset);

      const start = new Date(eventDate);
      start.setHours(startHour, 0, 0, 0);

      const end = new Date(eventDate);
      end.setHours(endHour, 0, 0, 0);

      events.push({
        id: Math.random().toString(36).substr(2, 9),
        title: distinctGroupName,
        location: location,
        start: start,
        end: end,
        description: staticDescription,
        type: eventType,
        sourceFile: distinctGroupName, 
        hasConflict: false
      });
    });
  });

  return { events, anomalies };
};
