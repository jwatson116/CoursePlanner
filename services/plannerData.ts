import { CalendarEvent, ChangeLogEntry, CohortRule } from '../types';

export interface StoredCalendarEvent extends Omit<CalendarEvent, 'start' | 'end'> {
  start: string;
  end: string;
}

export interface PlannerConfig {
  termStartDate: string;
  changeLogs: ChangeLogEntry[];
  updatedAt: string;
  studentAccessEnabled?: boolean;
}

export interface PlannerSnapshot extends PlannerConfig {
  events: StoredCalendarEvent[];
  cohortRules: CohortRule[];
}

export const serializeEvents = (events: CalendarEvent[]): StoredCalendarEvent[] =>
  events.map((event) => ({
    ...event,
    start: event.start.toISOString(),
    end: event.end.toISOString(),
  }));

export const deserializeEvents = (events: StoredCalendarEvent[]): CalendarEvent[] =>
  events.map((event) => ({
    ...event,
    start: new Date(event.start),
    end: new Date(event.end),
  }));

export const normalizePlannerSnapshot = (snapshot: PlannerSnapshot) => ({
  ...snapshot,
  events: deserializeEvents(snapshot.events),
  studentAccessEnabled: snapshot.studentAccessEnabled !== false,
});

export const fetchPublishedPlanner = async (): Promise<PlannerSnapshot | null> => {
  const response = await fetch('/api/planner-data', {
    headers: {
      Accept: 'application/json',
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Could not load published planner data (${response.status})`);
  }

  return response.json();
};

export const publishPlannerSnapshot = async (snapshot: PlannerSnapshot, manageToken: string) => {
  const response = await fetch('/api/manage/publish', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${manageToken}`,
    },
    body: JSON.stringify(snapshot),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message = payload?.error || `Could not publish planner data (${response.status})`;
    throw new Error(message);
  }

  return response.json();
};
