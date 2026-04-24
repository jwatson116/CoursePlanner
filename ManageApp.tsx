import React, { useEffect, useMemo, useState } from 'react';
import { Button } from './components/Button';
import { AnomalyModal } from './components/AnomalyModal';
import { CalendarEvent, ChangeLogEntry, CohortRule, EventType } from './types';
import { parseICS } from './utils/icsParser';
import { parseCSV, Anomaly } from './utils/csvParser';
import { parseMathsCSV } from './utils/mathsParser';
import { parseCohortCSV } from './utils/cohortParser';
import { SAMPLE_CHANGE_LOG, SAMPLE_COHORT_RULES, SAMPLE_EVENTS } from './utils/sampleData';
import { publishPlannerSnapshot, fetchPublishedPlanner, serializeEvents, normalizePlannerSnapshot } from './services/plannerData';
import { resetTermStartDate, setTermStartDate } from './utils/dateUtils';

const cleanSampleEvents = (): CalendarEvent[] =>
  SAMPLE_EVENTS.map((event) => ({
    ...event,
    description: event.description ? event.description.replace(' (Resolved Anomaly)', '') : '',
  }));

const toIsoDate = (value: Date) => {
  const normalized = new Date(value.getTime() - value.getTimezoneOffset() * 60000);
  return normalized.toISOString().split('T')[0];
};

export const ManageApp: React.FC = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [cohortRules, setCohortRules] = useState<CohortRule[]>([]);
  const [changeLogs, setChangeLogs] = useState<ChangeLogEntry[]>([]);
  const [termStartDate, setTermStartDateState] = useState<string>(() => toIsoDate(resetTermStartDate()));
  const [manageToken, setManageToken] = useState('');
  const [importType, setImportType] = useState<EventType | 'COHORT'>('COHORT');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<'neutral' | 'success' | 'error'>('neutral');
  const [isLoading, setIsLoading] = useState(true);
  const [isPublishing, setIsPublishing] = useState(false);
  const [anomaliesQueue, setAnomaliesQueue] = useState<Anomaly[]>([]);
  const [currentAnomalyIndex, setCurrentAnomalyIndex] = useState(0);
  const [logFormDate, setLogFormDate] = useState(() => toIsoDate(new Date()));
  const [logFormDesc, setLogFormDesc] = useState('');
  const [editingLogId, setEditingLogId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        const snapshot = await fetchPublishedPlanner();
        if (!isMounted) return;

        if (!snapshot) {
          const fallbackStart = resetTermStartDate();
          setEvents(cleanSampleEvents());
          setCohortRules(SAMPLE_COHORT_RULES);
          setChangeLogs(SAMPLE_CHANGE_LOG);
          setTermStartDateState(toIsoDate(fallbackStart));
          return;
        }

        const normalized = normalizePlannerSnapshot(snapshot);
        const nextStart = setTermStartDate(snapshot.termStartDate);

        setEvents(normalized.events);
        setCohortRules(snapshot.cohortRules);
        setChangeLogs(snapshot.changeLogs);
        setTermStartDateState(toIsoDate(nextStart));
      } catch (error) {
        console.error(error);
        const fallbackStart = resetTermStartDate();
        if (!isMounted) return;
        setEvents(cleanSampleEvents());
        setCohortRules(SAMPLE_COHORT_RULES);
        setChangeLogs(SAMPLE_CHANGE_LOG);
        setTermStartDateState(toIsoDate(fallbackStart));
        setStatusTone('error');
        setStatusMessage('Could not load published data, so the editor opened with the bundled fallback data.');
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    setTermStartDate(termStartDate);
  }, [termStartDate]);

  const summary = useMemo(() => {
    const totals = {
      cohortRules: cohortRules.length,
      lectures: events.filter((event) => event.type === EventType.LECTURE).length,
      practicals: events.filter((event) => event.type === EventType.PRACTICAL).length,
      classes: events.filter((event) => event.type === EventType.CLASS).length,
      maths: events.filter((event) => event.type === EventType.MATHS).length,
      changes: changeLogs.length,
    };

    return totals;
  }, [cohortRules, events, changeLogs]);

  const setStatus = (message: string, tone: 'neutral' | 'success' | 'error' = 'neutral') => {
    setStatusMessage(message);
    setStatusTone(tone);
  };

  const readFile = (file: File): Promise<string> =>
    new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (loadEvent) => resolve(loadEvent.target?.result as string);
      if (file.name.toLowerCase().endsWith('.csv') || file.name.toLowerCase().endsWith('.txt')) {
        reader.readAsText(file, 'ISO-8859-1');
      } else {
        reader.readAsText(file);
      }
    });

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      return;
    }

    setStatus('Processing upload...');
    setCurrentAnomalyIndex(0);
    setAnomaliesQueue([]);

    if (importType === 'COHORT') {
      const content = await readFile(files[0]);
      setCohortRules(parseCohortCSV(content));
      setStatus(`Loaded cohort rules from ${files[0].name}.`, 'success');
      event.target.value = '';
      return;
    }

    const fileList = Array.from(files);
    const results = await Promise.all(
      fileList.map(async (file) => {
        const content = await readFile(file);
        const cleanName = file.name.replace(/\.(ics|txt|csv)$/i, '').replace(/(?:[_\s-]*new)+$/i, '').trim();
        if (importType === EventType.MATHS) {
          return { events: parseMathsCSV(content, cleanName), anomalies: [] as Anomaly[] };
        }
        if (file.name.toLowerCase().endsWith('.csv')) {
          return parseCSV(
            content,
            cleanName,
            [EventType.CLASS, EventType.PRACTICAL].includes(importType as EventType) ? (importType as EventType) : EventType.PRACTICAL
          );
        }
        return { events: parseICS(content, cleanName, importType as EventType), anomalies: [] as Anomaly[] };
      })
    );

    const allEvents = results.flatMap((result) => result.events);
    const allAnomalies = results.flatMap((result) => result.anomalies);

    setEvents((previousEvents) => {
      let filteredPrevious = previousEvents;

      if (importType === EventType.CLASS) {
        filteredPrevious = previousEvents.filter((existingEvent) => existingEvent.type !== EventType.CLASS);
      } else if (importType === EventType.PRACTICAL) {
        filteredPrevious = previousEvents.filter((existingEvent) => existingEvent.type !== EventType.PRACTICAL);
      } else if (importType === EventType.MATHS) {
        filteredPrevious = previousEvents.filter((existingEvent) => existingEvent.type !== EventType.MATHS);
      } else {
        const incomingSources = new Set(allEvents.map((incomingEvent) => incomingEvent.sourceFile));
        filteredPrevious = previousEvents.filter((existingEvent) => !incomingSources.has(existingEvent.sourceFile));
      }

      return [...filteredPrevious, ...allEvents];
    });

    if (allAnomalies.length > 0) {
      setAnomaliesQueue(allAnomalies);
      setStatus(`Loaded files with ${allAnomalies.length} anomalies to review.`, 'neutral');
    } else {
      setStatus(`Loaded ${allEvents.length} events from ${fileList.length} file(s).`, 'success');
    }

    event.target.value = '';
  };

  const handleResolveAnomaly = (newEvents: CalendarEvent[]) => {
    if (newEvents.length > 0) {
      setEvents((previousEvents) => [...previousEvents, ...newEvents]);
    }

    if (currentAnomalyIndex < anomaliesQueue.length - 1) {
      setCurrentAnomalyIndex((previousIndex) => previousIndex + 1);
    } else {
      setAnomaliesQueue([]);
      setCurrentAnomalyIndex(0);
      setStatus('All anomalies reviewed.', 'success');
    }
  };

  const handleSkipAnomaly = () => {
    if (currentAnomalyIndex < anomaliesQueue.length - 1) {
      setCurrentAnomalyIndex((previousIndex) => previousIndex + 1);
    } else {
      setAnomaliesQueue([]);
      setCurrentAnomalyIndex(0);
      setStatus('Anomaly review closed.', 'neutral');
    }
  };

  const handleSaveLog = () => {
    if (!logFormDesc.trim()) {
      return;
    }

    if (editingLogId) {
      setChangeLogs((previousLogs) =>
        previousLogs.map((log) => (log.id === editingLogId ? { ...log, date: logFormDate, description: logFormDesc } : log))
      );
    } else {
      setChangeLogs((previousLogs) => [
        { id: Math.random().toString(36).slice(2, 10), date: logFormDate, description: logFormDesc },
        ...previousLogs,
      ]);
    }

    setEditingLogId(null);
    setLogFormDate(toIsoDate(new Date()));
    setLogFormDesc('');
  };

  const handlePublish = async () => {
    if (!manageToken.trim()) {
      setStatus('Enter the staff manage token before publishing.', 'error');
      return;
    }

    setIsPublishing(true);
    setStatus('Publishing updated planner data...');

    try {
      await publishPlannerSnapshot(
        {
          termStartDate,
          changeLogs,
          cohortRules,
          events: serializeEvents(events),
          updatedAt: new Date().toISOString(),
        },
        manageToken.trim()
      );
      setStatus('Published the latest planner data successfully.', 'success');
    } catch (error) {
      console.error(error);
      setStatus(error instanceof Error ? error.message : 'Could not publish planner data.', 'error');
    } finally {
      setIsPublishing(false);
    }
  };

  const statusStyles = {
    neutral: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-200',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-200',
    error: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200',
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-6 md:px-6">
        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Staff Publishing Console</p>
              <h1 className="mt-2 text-3xl font-bold text-[#002147] dark:text-white">Course Planner Data Manager</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
                Upload timetable files, choose the term start date, and publish the student-facing planner without exposing editing controls.
              </p>
            </div>
            <a
              href="/"
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Open student site
            </a>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold">Publish latest planner data</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">This page prepares the published dataset used by students.</p>
              </div>
              {isLoading && <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Loading...</span>}
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Term start date</span>
                <input
                  type="date"
                  value={termStartDate}
                  onChange={(event) => setTermStartDateState(event.target.value)}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#002147] dark:border-slate-700 dark:bg-slate-800"
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Staff manage token</span>
                <input
                  type="password"
                  value={manageToken}
                  onChange={(event) => setManageToken(event.target.value)}
                  placeholder="Enter the shared publish token"
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#002147] dark:border-slate-700 dark:bg-slate-800"
                />
              </label>
            </div>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
              <div className="flex flex-col gap-3 md:flex-row md:items-end">
                <label className="flex-1">
                  <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Upload type</span>
                  <select
                    value={importType}
                    onChange={(event) => setImportType(event.target.value as EventType | 'COHORT')}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#002147] dark:border-slate-700 dark:bg-slate-800"
                  >
                    <option value="COHORT">Cohort rules</option>
                    <option value={EventType.LECTURE}>Lectures</option>
                    <option value={EventType.PRACTICAL}>Practicals</option>
                    <option value={EventType.CLASS}>Classes</option>
                    <option value={EventType.MATHS}>Maths</option>
                  </select>
                </label>
                <label className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-[#002147] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#003c7d]">
                  Choose files
                  <input type="file" multiple accept=".ics,.csv,.txt" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                Cohort uploads replace the degree/year mapping. Lecture uploads replace matching sources. Practicals, classes, and maths replace their whole category.
              </p>
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Change log</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">These entries appear to students from the clock icon.</p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-[180px_1fr_auto]">
                <input
                  type="date"
                  value={logFormDate}
                  onChange={(event) => setLogFormDate(event.target.value)}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#002147] dark:border-slate-700 dark:bg-slate-800"
                />
                <textarea
                  value={logFormDesc}
                  onChange={(event) => setLogFormDesc(event.target.value)}
                  placeholder="Describe the timetable update..."
                  className="min-h-[88px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#002147] dark:border-slate-700 dark:bg-slate-800"
                />
                <div className="flex gap-2 md:flex-col">
                  <Button onClick={handleSaveLog}>{editingLogId ? 'Update entry' : 'Add entry'}</Button>
                  {editingLogId && (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setEditingLogId(null);
                        setLogFormDate(toIsoDate(new Date()));
                        setLogFormDesc('');
                      }}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {changeLogs.map((log) => (
                  <div key={log.id} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/40">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-[#002147] dark:text-indigo-300">{log.date}</p>
                        <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">{log.description}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setEditingLogId(log.id);
                            setLogFormDate(log.date);
                            setLogFormDesc(log.description);
                          }}
                        >
                          Edit
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setChangeLogs((previousLogs) => previousLogs.filter((entry) => entry.id !== log.id))}>
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 border-t border-slate-200 pt-6 dark:border-slate-800 md:flex-row md:items-center md:justify-between">
              {statusMessage ? (
                <div className={`rounded-2xl border px-4 py-3 text-sm ${statusStyles[statusTone]}`}>{statusMessage}</div>
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">Publish after you are happy with the latest data and change log.</p>
              )}
              <Button onClick={handlePublish} disabled={isPublishing}>
                {isPublishing ? 'Publishing...' : 'Publish to student site'}
              </Button>
            </div>
          </section>

          <aside className="space-y-6">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-lg font-bold">Current snapshot</h2>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {[
                  ['Cohort rules', summary.cohortRules],
                  ['Lectures', summary.lectures],
                  ['Practicals', summary.practicals],
                  ['Classes', summary.classes],
                  ['Maths', summary.maths],
                  ['Change log entries', summary.changes],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
                    <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-lg font-bold">How staff should use this</h2>
              <ol className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
                <li>1. Set the correct term start date before uploading weekly timetable files.</li>
                <li>2. Upload cohort rules, then lecture, practical, class, and maths files as needed.</li>
                <li>3. Add a short change-log note if students should be told what changed.</li>
                <li>4. Publish once, then refresh the student site to check the result.</li>
              </ol>
            </section>
          </aside>
        </div>
      </div>

      {anomaliesQueue.length > 0 && (
        <AnomalyModal
          isOpen={anomaliesQueue.length > 0}
          anomaly={anomaliesQueue[currentAnomalyIndex]}
          existingLocations={Array.from(new Set(events.map((event) => event.location).filter(Boolean) as string[])).sort()}
          onResolve={handleResolveAnomaly}
          onSkip={handleSkipAnomaly}
          onClose={handleSkipAnomaly}
        />
      )}
    </div>
  );
};

export default ManageApp;
