
export enum EventType {
  LECTURE = 'Lecture',
  PRACTICAL = 'Practical',
  CLASS = 'Class',
  MATHS = 'Maths',
  OTHER = 'Other'
}

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  location?: string;
  start: Date;
  end: Date;
  type: EventType;
  sourceFile: string;
  hasConflict?: boolean;
  cohort?: string; // Optional cohort for grouping (e.g., "Prelims", "Part A")
}

export interface DayData {
  date: Date;
  events: CalendarEvent[];
  hasConflict: boolean;
  isCurrentMonth: boolean;
}

export interface FilterState {
  [key: string]: boolean; // Key is EventType, value is isVisible
}

export interface CohortRule {
  courseName: string;
  courseCode: string;
  degree: string;
  year: string;
  url?: string;
}

export interface ChangeLogEntry {
  id: string;
  date: string;
  description: string;
}