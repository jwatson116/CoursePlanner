
import React, { useState, useMemo, useEffect } from 'react';
import { CalendarMonth } from './components/CalendarMonth';
import { CalendarWeek } from './components/CalendarWeek';
import { EventModal } from './components/EventModal';
import { Button } from './components/Button';
import { SummaryPane } from './components/SummaryPane';
import { ChangeLogModal } from './components/ChangeLogModal';
import { AnomalyModal } from './components/AnomalyModal';
import { CalendarEvent, EventType, CohortRule, ChangeLogEntry } from './types';
import { parseICS, detectConflicts } from './utils/icsParser';
import { parseCSV, Anomaly, CSVParseResult } from './utils/csvParser';
import { parseMathsCSV } from './utils/mathsParser';
import { parseCohortCSV } from './utils/cohortParser';
import { SAMPLE_EVENTS, SAMPLE_COHORT_RULES, SAMPLE_CHANGE_LOG } from './utils/sampleData';
import { addDays, getTermStartDate, isSameDay, resetTermStartDate, setTermStartDate } from './utils/dateUtils';
import { fetchPublishedPlanner, normalizePlannerSnapshot } from './services/plannerData';

// Explicit overrides for shortnames that algorithmic matching might miss
const SHORTNAME_OVERRIDES: Record<string, string> = {
  "fospa": "Foundations of Self-Programming Agents",
  "compmed": "Computational Medicine",
  "cm": "Computational Medicine",
  "contmath": "Continuous Mathematics",
  "contmaths": "Continuous Mathematics"
  // Add other known specific shortnames here if needed
};

const App: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(() => {
    const initialTermStartDate = getTermStartDate();
    return new Date(initialTermStartDate.getFullYear(), initialTermStartDate.getMonth(), 1);
  });
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<'month' | 'week'>(() => {
    if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('scholarSync_viewMode');
        return (saved === 'month' || saved === 'week') ? saved : 'month';
    }
    return 'month';
  });
  const [importType] = useState<EventType | 'COHORT'>('COHORT');
  const [calendarVisibility, setCalendarVisibility] = useState<Record<string, boolean>>(() => {
    if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('scholarSync_visibility');
        try { return saved ? JSON.parse(saved) : {}; } catch (e) { return {}; }
    }
    return {};
  });
  const [excludedSources, setExcludedSources] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('scholarSync_excluded');
        try { return saved ? new Set(JSON.parse(saved)) : new Set(); } catch (e) { return new Set(); }
    }
    return new Set();
  });
  const [mobileTab, setMobileTab] = useState<'schedule' | 'filters' | 'summary'>('schedule');
  const [cohortRules, setCohortRules] = useState<CohortRule[]>([]);
  const [selectedDegree, setSelectedDegree] = useState<string>(() => (typeof window !== 'undefined' ? localStorage.getItem('scholarSync_degree') : '') || '');
  const [selectedYear, setSelectedYear] = useState<string>(() => (typeof window !== 'undefined' ? localStorage.getItem('scholarSync_year') : '') || '');
  const [isLoading, setIsLoading] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportCode, setExportCode] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    [EventType.LECTURE]: true, [EventType.PRACTICAL]: false, [EventType.CLASS]: false, [EventType.MATHS]: true, [EventType.OTHER]: false
  });
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  const [changeLogs, setChangeLogs] = useState<ChangeLogEntry[]>([]);
  const [isChangeLogOpen, setIsChangeLogOpen] = useState(false);
  const [logFormDesc, setLogFormDesc] = useState('');
  const [logFormDate, setLogFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [lastSeenLogId, setLastSeenLogId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('scholarSync_lastSeenLogId');
    }
    return null;
  });
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [studentAccessEnabled, setStudentAccessEnabled] = useState(true);

  // Anomaly Handling State
  const [anomaliesQueue, setAnomaliesQueue] = useState<Anomaly[]>([]);
  const [currentAnomalyIndex, setCurrentAnomalyIndex] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const applyFallbackSnapshot = () => {
      const cleanEvents = SAMPLE_EVENTS.map((event) => ({
        ...event,
        description: event.description ? event.description.replace(' (Resolved Anomaly)', '') : '',
      }));
      const termStartDate = resetTermStartDate();

      if (!isMounted) {
        return;
      }

      setEvents(cleanEvents);
      setCohortRules(SAMPLE_COHORT_RULES);
      setChangeLogs(SAMPLE_CHANGE_LOG);
      setCurrentDate(new Date(termStartDate.getFullYear(), termStartDate.getMonth(), 1));
      setLastUpdatedAt(null);
    };

    const loadPublishedData = async () => {
      setIsLoading(true);
      try {
        const snapshot = await fetchPublishedPlanner();
        if (!snapshot) {
          applyFallbackSnapshot();
          return;
        }

        const normalized = normalizePlannerSnapshot(snapshot);
        const termStartDate = setTermStartDate(snapshot.termStartDate);

        if (!isMounted) {
          return;
        }

        setEvents(normalized.events);
        setCohortRules(snapshot.cohortRules);
        setChangeLogs(snapshot.changeLogs);
        setCurrentDate(new Date(termStartDate.getFullYear(), termStartDate.getMonth(), 1));
        setLastUpdatedAt(snapshot.updatedAt);
        setStudentAccessEnabled(normalized.studentAccessEnabled);
      } catch (error) {
        console.error(error);
        applyFallbackSnapshot();
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadPublishedData();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (isDarkMode) { document.documentElement.classList.add('dark'); localStorage.setItem('theme', 'dark'); }
    else { document.documentElement.classList.remove('dark'); localStorage.setItem('theme', 'light'); }
  }, [isDarkMode]);

  useEffect(() => { localStorage.setItem('scholarSync_viewMode', viewMode); }, [viewMode]);
  useEffect(() => { localStorage.setItem('scholarSync_visibility', JSON.stringify(calendarVisibility)); }, [calendarVisibility]);
  useEffect(() => { localStorage.setItem('scholarSync_excluded', JSON.stringify(Array.from(excludedSources))); }, [excludedSources]);
  useEffect(() => { localStorage.setItem('scholarSync_degree', selectedDegree); }, [selectedDegree]);
  useEffect(() => { localStorage.setItem('scholarSync_year', selectedYear); }, [selectedYear]);

  /**
   * Oxford logic and processing...
   */
  const normalizeString = (s: string) => {
    if (!s) return '';
    return s.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
  };

  const getInitials = (s: string) => {
    if (!s) return '';
    // Filter out common stop words to improve acronym matching
    const stopWords = new Set(['and', 'for', 'of', 'the', 'to', 'in', 'on', 'at', 'a']);
    return s.split(/[\s-]+/)
      .filter(w => w.length > 0 && !stopWords.has(w.toLowerCase()))
      .map(w => w[0])
      .join('')
      .toLowerCase();
  };

  // Generates initials including stopwords (e.g. "Foundations of Self-Programming Agents" -> "fospa")
  const getLooseInitials = (s: string) => {
    if (!s) return '';
    return s.split(/[\s-]+/)
      .filter(w => w.length > 0)
      .map(w => w[0])
      .join('')
      .toLowerCase();
  };

  const processedEvents = useMemo(() => {
    const map = new Map<string, string>(); // Key -> Full Name
    const matchedPrio = new Map<string, number>(); // Key -> Priority (2=Exact Cohort Match, 1=Any Match)

    const addMapping = (key: string, name: string, rule: CohortRule) => {
        if (!key) return;
        const currentPrio = matchedPrio.get(key) || 0;
        // Prioritize if the rule matches the currently selected student cohort
        const isSelectedCohort = rule.year === selectedYear && rule.degree === selectedDegree;
        const newPrio = isSelectedCohort ? 2 : 1;

        if (newPrio >= currentPrio) {
            map.set(key, name);
            matchedPrio.set(key, newPrio);
        }
    };

    cohortRules.forEach(r => { 
        if (r.courseName) {
            const longName = r.courseName.replace(/&amp;/g, '&');
            const normName = normalizeString(longName);
            const initials = getInitials(longName);
            const looseInitials = getLooseInitials(longName);
            
            // Map strict codes if available
            if (r.courseCode) {
                const cleanCode = r.courseCode.trim();
                addMapping(normalizeString(cleanCode), longName, r);
                // Also map prefix (e.g. 'advsec' from 'advsec_2025...')
                const prefix = cleanCode.split('_')[0];
                if (prefix) addMapping(normalizeString(prefix), longName, r);
            }

            // Map normalized full name
            addMapping(normName, longName, r);
            
            // Map strict initials (e.g. 'ads' -> 'Algorithms and Data Structures')
            if (initials.length > 1) addMapping(initials, longName, r);

            // Map loose initials (e.g. 'fospa' -> 'Foundations of Self-Programming Agents')
            if (looseInitials.length > 1 && looseInitials !== initials) addMapping(looseInitials, longName, r);

            // Check if this course name is a target of a known alias
            Object.entries(SHORTNAME_OVERRIDES).forEach(([short, target]) => {
                if (longName === target) {
                    addMapping(short, longName, r);
                }
            });
        }
    });

    return events.map(event => {
       let newSource = event.sourceFile.replace(/&amp;/g, '&');
       let newTitle = event.title.replace(/&amp;/g, '&');
       let newType = event.type;
       
       const normSrc = normalizeString(newSource);
       const initialsSrc = getInitials(newSource);

       // Try to find a mapped name using various keys
       let mappedName = map.get(normSrc) || map.get(initialsSrc);
       
       // Fallback for Practicals/Classes which might be "ShortName - Group X"
       if (!mappedName && (event.type === EventType.PRACTICAL || event.type === EventType.CLASS)) {
          const parts = newSource.split(' - ');
          if (parts.length >= 2) {
             const subNorm = normalizeString(parts[0]);
             const subInitials = getInitials(parts[0]);
             let fullParentName = map.get(subNorm) || map.get(subInitials);
             if (fullParentName) mappedName = `${fullParentName} - ${parts.slice(1).join(' - ')}`;
          }
       }

       if (mappedName) { 
           newSource = mappedName;
           // Auto-correct type if we found a match in cohort rules (implies it's likely a Lecture/Course context)
           // but keep specific types like Practical/Class if already set
           if (newType === EventType.OTHER) newType = EventType.LECTURE;
           
           // Update title if it looks like a short code or matches the source
           if (newTitle.length < 10 || normalizeString(newTitle) === normSrc || getInitials(newTitle) === initialsSrc) {
               newTitle = newSource;
           }
       } 
       return { ...event, sourceFile: newSource, title: newTitle, type: newType };
    });
  }, [events, cohortRules, selectedDegree, selectedYear]);

  const uniqueSources = useMemo(() => Array.from(new Set(processedEvents.map(e => e.sourceFile))).sort(), [processedEvents]);
  
  const sourceTypes = useMemo(() => {
    const mapping: Record<string, EventType> = {};
    processedEvents.forEach(e => { if (!mapping[e.sourceFile]) mapping[e.sourceFile] = e.type; });
    return mapping;
  }, [processedEvents]);

  const sourceCohorts = useMemo(() => {
    const mapping: Record<string, string> = {};
    processedEvents.forEach(e => { if (e.cohort && !mapping[e.sourceFile]) mapping[e.sourceFile] = e.cohort; });
    return mapping;
  }, [processedEvents]);

  const groupedSources = useMemo(() => {
    const groups: Record<EventType, string[]> = {
      [EventType.LECTURE]: [], [EventType.PRACTICAL]: [], [EventType.CLASS]: [], [EventType.MATHS]: [], [EventType.OTHER]: []
    };
    uniqueSources.forEach(src => { const type = sourceTypes[src] || EventType.OTHER; groups[type]?.push(src); });
    return groups;
  }, [uniqueSources, sourceTypes]);

  const sourceToUrl = useMemo(() => {
    const map = new Map<string, string>();
    cohortRules.forEach(rule => {
      if (rule.url && rule.courseName) {
        // Sanitize name to match processedEvents logic (replace &amp; with &)
        const cleanName = rule.courseName.replace(/&amp;/g, '&');
        map.set(cleanName, rule.url);
        // Also map normalized versions to URL for fallback lookup
        map.set(normalizeString(cleanName), rule.url);
      }
    });
    return map;
  }, [cohortRules]);

  const sourceDescriptions = useMemo(() => {
    const map: Record<string, string> = {};
    processedEvents.forEach(e => {
        if (e.description && !map[e.sourceFile]) {
             map[e.sourceFile] = e.description;
        }
    });
    return map;
  }, [processedEvents]);

  const existingLocations = useMemo(() => {
    const locs = new Set<string>();
    events.forEach(e => { if (e.location) locs.add(e.location); });
    return Array.from(locs).sort();
  }, [events]);

  const getSourceUrl = (source: string) => {
    // 1. Try exact match
    if (sourceToUrl.has(source)) return sourceToUrl.get(source);
    
    // 2. Try normalized source
    const norm = normalizeString(source);
    if (sourceToUrl.has(norm)) return sourceToUrl.get(norm);

    // 3. Handle parts like "Course - Group 1"
    const parts = source.split(' - ');
    if (parts.length > 1) {
        if (sourceToUrl.has(parts[0])) return sourceToUrl.get(parts[0]);
        const normPart = normalizeString(parts[0]);
        if (sourceToUrl.has(normPart)) return sourceToUrl.get(normPart);
    }
    
    // 4. Handle "Name (Cohort)" for Maths or similar formats
    const parensMatch = source.match(/^(.*?) \(/);
    if (parensMatch) {
        const baseName = parensMatch[1];
        if (sourceToUrl.has(baseName)) return sourceToUrl.get(baseName);
        const normBase = normalizeString(baseName);
        if (sourceToUrl.has(normBase)) return sourceToUrl.get(normBase);
    }

    return null;
  };

  // Track new logs count
  const unreadLogsCount = useMemo(() => {
    if (!changeLogs.length) return 0;
    if (!lastSeenLogId) return changeLogs.length;
    
    // Logs are typically sorted newest first
    const lastSeenIndex = changeLogs.findIndex(log => log.id === lastSeenLogId);
    if (lastSeenIndex === -1) return changeLogs.length;
    return lastSeenIndex;
  }, [changeLogs, lastSeenLogId]);

  const openChangeLog = () => {
    setIsChangeLogOpen(true);
    if (changeLogs.length > 0) {
      const newestId = changeLogs[0].id;
      setLastSeenLogId(newestId);
      localStorage.setItem('scholarSync_lastSeenLogId', newestId);
    }
  };

  useEffect(() => {
    setCalendarVisibility(prev => {
      const next = { ...prev };
      let hasChanges = false;
      uniqueSources.forEach(src => {
        if (next[src] === undefined) {
          next[src] = false;
          hasChanges = true;
        }
      });
      return hasChanges ? next : prev;
    });
  }, [uniqueSources]);

  const { degrees, years } = useMemo(() => {
    const d = new Set<string>(); const y = new Set<string>();
    cohortRules.forEach(r => { if (r.degree) d.add(r.degree); if (r.year) y.add(r.year); });
    return { degrees: Array.from(d).sort(), years: Array.from(y).filter(Boolean).sort() };
  }, [cohortRules]);

  const isYearRequired = useMemo(() => {
      if (!selectedDegree) return false;
      return cohortRules.some(r => r.degree === selectedDegree && r.year && r.year.trim() !== '');
  }, [cohortRules, selectedDegree]);

  const allowedCourseCodes = useMemo(() => {
    if (!selectedDegree || (isYearRequired && !selectedYear)) return null;
    const allowed = new Set<string>();
    cohortRules.forEach(r => { 
        if (r.degree === selectedDegree && (!isYearRequired || r.year === selectedYear)) { 
            if (r.courseName) allowed.add(normalizeString(r.courseName));
            if (r.courseCode) allowed.add(normalizeString(r.courseCode));
        } 
    });
    return allowed;
  }, [cohortRules, selectedDegree, selectedYear, isYearRequired]);

  const isSourceAllowed = (source: string, type: EventType) => {
    if (excludedSources.has(source)) return false;
    if (type === EventType.MATHS) return true;
    if (!allowedCourseCodes) return true;
    const norm = normalizeString(source.split(' - ')[0]);
    return allowedCourseCodes.has(norm);
  };

  const isSourceDependenciesMet = (source: string) => {
    const parts = source.split(' - ');
    if (parts.length < 2) return true;
    return calendarVisibility[parts[0]] === true;
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files; if (!files) return;
    setIsLoading(true);
    setAnomaliesQueue([]);
    setCurrentAnomalyIndex(0);

    const readFile = (file: File): Promise<string> => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            // Try ISO-8859-1 for CSV/TXT which might be Excel encoded (fixes ö display issues)
            // Keep default UTF-8 for ICS
            if (file.name.toLowerCase().endsWith('.csv') || file.name.toLowerCase().endsWith('.txt')) {
                reader.readAsText(file, 'ISO-8859-1');
            } else {
                reader.readAsText(file);
            }
        });
    };

    if (importType === 'COHORT') {
        readFile(files[0]).then(content => {
             setCohortRules(parseCohortCSV(content));
             setIsLoading(false);
        });
        event.target.value = '';
        return;
    }

    const fileList = Array.from(files) as File[];
    const readers = fileList.map(file => readFile(file).then(content => {
        const cleanName = file.name.replace(/\.(ics|txt|csv)$/i, '').replace(/(?:[_\s-]*new)+$/i, '').trim();
        if (importType === EventType.MATHS) {
            const events = parseMathsCSV(content, cleanName);
            return { events, anomalies: [] };
        } else if (file.name.toLowerCase().endsWith('.csv')) {
            const result = parseCSV(content, cleanName, [EventType.CLASS, EventType.PRACTICAL].includes(importType as EventType) ? importType as EventType : EventType.PRACTICAL);
            return result;
        } else {
            const events = parseICS(content, cleanName, importType as EventType);
            return { events, anomalies: [] };
        }
    }));

    Promise.all(readers).then(results => {
      const allEvents = results.flatMap(r => r.events);
      const allAnomalies = results.flatMap(r => r.anomalies);
      
      setEvents(prev => {
        let filteredPrev = prev;
        
        // When uploading group-based data (Classes, Practicals) or Maths, replace the entire category 
        // to avoid duplicate/stale groups if the new file contains a full update.
        // For Lectures (ICS), typically uploaded per-course, we only replace events from the same source file.
        if (importType === EventType.CLASS) {
            filteredPrev = prev.filter(e => e.type !== EventType.CLASS);
        } else if (importType === EventType.PRACTICAL) {
             filteredPrev = prev.filter(e => e.type !== EventType.PRACTICAL);
        } else if (importType === EventType.MATHS) {
             filteredPrev = prev.filter(e => e.type !== EventType.MATHS);
        } else {
             const newEventSources = new Set(allEvents.map(e => e.sourceFile));
             filteredPrev = prev.filter(e => !newEventSources.has(e.sourceFile));
        }

        return [...filteredPrev, ...allEvents];
      });

      if (allAnomalies.length > 0) {
          setAnomaliesQueue(allAnomalies);
      }
      
      setIsLoading(false);
      event.target.value = ''; 
    });
  };

  const handleResolveAnomaly = (newEvents: CalendarEvent[]) => {
      if (newEvents.length > 0) {
          setEvents(prev => [...prev, ...newEvents]);
      }
      
      if (currentAnomalyIndex < anomaliesQueue.length - 1) {
          setCurrentAnomalyIndex(prev => prev + 1);
      } else {
          // Done
          setAnomaliesQueue([]);
          setCurrentAnomalyIndex(0);
      }
  };

  const handleSkipAnomaly = () => {
      if (currentAnomalyIndex < anomaliesQueue.length - 1) {
          setCurrentAnomalyIndex(prev => prev + 1);
      } else {
          setAnomaliesQueue([]);
          setCurrentAnomalyIndex(0);
      }
  };

  const handleCancelAnomalies = () => {
      setAnomaliesQueue([]);
      setCurrentAnomalyIndex(0);
  };

  const handleClearData = () => {
    setEvents([]); setCohortRules([]); setCalendarVisibility({}); setExcludedSources(new Set()); setSelectedDegree(''); setSelectedYear(''); setChangeLogs(SAMPLE_CHANGE_LOG);
    localStorage.removeItem('scholarSync_visibility'); localStorage.removeItem('scholarSync_excluded'); localStorage.removeItem('scholarSync_degree'); localStorage.removeItem('scholarSync_year');
  };

  const handleClearFilters = () => { setSelectedDegree(''); setSelectedYear(''); };
  const handleResetStudentView = () => { setExcludedSources(new Set()); };

  const handleExportData = () => {
    const eventsLines = events.map(e => {
        const cohortStr = e.cohort ? `, cohort: ${JSON.stringify(e.cohort)}` : '';
        return `  { id: '${e.id}', title: ${JSON.stringify(e.title)}, start: new Date('${e.start.toISOString()}'), end: new Date('${e.end.toISOString()}'), type: EventType.${Object.keys(EventType).find(k => EventType[k as keyof typeof EventType] === e.type) || 'OTHER'}, sourceFile: ${JSON.stringify(e.sourceFile)}, location: ${JSON.stringify(e.location || '')}, description: ${JSON.stringify(e.description || '')}${cohortStr} }`;
    });

    const chunkSize = 500;
    const chunks = [];
    for (let i = 0; i < eventsLines.length; i += chunkSize) {
        chunks.push(eventsLines.slice(i, i + chunkSize));
    }

    let output = `import { CalendarEvent, EventType, CohortRule, ChangeLogEntry } from '../types';\n\n`;
    output += `export const SAMPLE_CHANGE_LOG: ChangeLogEntry[] = ${JSON.stringify(changeLogs, null, 2)};\n\n`;
    output += `export const SAMPLE_COHORT_RULES: CohortRule[] = ${JSON.stringify(cohortRules, null, 2)};\n\n`;

    chunks.forEach((chunk, index) => {
        output += `const SAMPLE_EVENTS_PART${index + 1}: CalendarEvent[] = [\n${chunk.join(',\n')}\n];\n\n`;
    });

    output += `export const SAMPLE_EVENTS: CalendarEvent[] = [\n`;
    output += chunks.map((_, i) => `  ...SAMPLE_EVENTS_PART${i + 1}`).join(',\n');
    output += `\n];`;

    setExportCode(output);
    setShowExportModal(true);
  };

  const handleEditLog = (log: ChangeLogEntry) => {
    setEditingLogId(log.id);
    setLogFormDesc(log.description);
    setLogFormDate(log.date);
  };

  const handleSaveLog = (date: string, description: string) => {
    if (!description.trim()) return;
    if (editingLogId) {
        setChangeLogs(prev => prev.map(log => log.id === editingLogId ? { ...log, date, description } : log));
        setEditingLogId(null);
    } else {
        const newEntry: ChangeLogEntry = { id: Math.random().toString(36).substr(2, 9), date, description };
        setChangeLogs(prev => [newEntry, ...prev]);
    }
    setLogFormDesc('');
    setLogFormDate(new Date().toISOString().split('T')[0]);
  };

  const handleRemoveSource = (source: string) => { setCalendarVisibility(prev => ({ ...prev, [source]: false })); };
  const handleRemoveCohort = (cohort: string) => {
    setCalendarVisibility(prev => {
        const next = { ...prev };
        uniqueSources.forEach(src => { if (sourceCohorts[src] === cohort && sourceTypes[src] === EventType.MATHS) next[src] = false; });
        return next;
    });
  };
  const handleExcludeSource = (source: string) => { setExcludedSources(prev => { const next = new Set(prev); next.add(source); return next; }); };
  const handleAddGroups = (groupName: string) => {
    setCalendarVisibility(prev => {
      const next = { ...prev };
      uniqueSources.forEach(src => { if (src === groupName || src.startsWith(groupName + ' - ')) next[src] = true; });
      return next;
    });
  };

  const filteredEventsList = useMemo(() => processedEvents.filter(e => !excludedSources.has(e.sourceFile) && isSourceAllowed(e.sourceFile, e.type) && (calendarVisibility[e.sourceFile] !== false) && isSourceDependenciesMet(e.sourceFile)), [processedEvents, calendarVisibility, allowedCourseCodes, excludedSources]);
  const eventsWithConflicts = useMemo(() => detectConflicts(filteredEventsList), [filteredEventsList]);
  const conflictCount = eventsWithConflicts.filter(e => e.hasConflict).length;
  
  const conflictDetails = useMemo(() => {
    const details: Record<string, string[]> = {}; 
    const sorted = [...filteredEventsList].sort((a, b) => a.start.getTime() - b.start.getTime());
    for (let i = 0; i < sorted.length; i++) {
        const e1 = sorted[i];
        for (let j = i + 1; j < sorted.length; j++) {
            const e2 = sorted[j]; if (e2.start >= e1.end) break; 
            if (e1.end > e2.start && e1.start < e2.end && e1.sourceFile !== e2.sourceFile) {
                if (!details[e1.sourceFile]) details[e1.sourceFile] = []; 
                if (!details[e2.sourceFile]) details[e2.sourceFile] = [];
                if (!details[e1.sourceFile].includes(e2.sourceFile)) details[e1.sourceFile].push(e2.sourceFile); 
                if (!details[e2.sourceFile].includes(e1.sourceFile)) details[e2.sourceFile].push(e1.sourceFile);
            }
        }
    }
    return details;
  }, [filteredEventsList]);

  const visibleSources = uniqueSources.filter(src => !excludedSources.has(src) && isSourceAllowed(src, sourceTypes[src]) && isSourceDependenciesMet(src) && (calendarVisibility[src] ?? true));
  const selectedDateEvents = useMemo(() => selectedDay ? eventsWithConflicts.filter(e => isSameDay(e.start, selectedDay)) : [], [eventsWithConflicts, selectedDay]);
  const monthsToDisplay = useMemo(() => {
    const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    return [start, new Date(start.getFullYear(), start.getMonth() + 1, 1), new Date(start.getFullYear(), start.getMonth() + 2, 1)];
  }, [currentDate]);

  const renderMathsFilters = (allFiles: string[]) => {
    // ... existing logic ...
    const byCohort: Record<string, string[]> = {};
    allFiles.forEach(src => {
        const cohort = sourceCohorts[src] || 'Other';
        if (!byCohort[cohort]) byCohort[cohort] = [];
        byCohort[cohort].push(src);
    });
    return (
      <div className="space-y-4 py-1">
        {Object.entries(byCohort).sort(([a], [b]) => a.localeCompare(b)).map(([cohort, files]) => {
          const visibleCount = files.filter(f => calendarVisibility[f] !== false).length;
          const isAll = visibleCount === files.length;
          const isNone = visibleCount === 0;
          return (
            <div key={cohort} className="border-l-2 border-purple-100 dark:border-purple-900/30 pl-3">
               <div className="flex items-center justify-between mb-2 group/cohort">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                     <div className={`w-4 h-4 rounded border flex items-center justify-center ${!isNone ? 'bg-purple-600 border-purple-600 text-white' : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-500'}`}>
                        {!isNone && <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" /></svg>}
                     </div>
                     <input type="checkbox" className="hidden" checked={!isNone} onChange={() => { const newVal = isNone; setCalendarVisibility(prev => { const next = { ...prev }; files.forEach(f => next[f] = newVal); return next; }); }} />
                     <span className="text-[10px] font-black text-purple-700 dark:text-purple-400 uppercase tracking-widest">{cohort}</span>
                  </label>
                  <button onClick={() => { files.forEach(f => handleExcludeSource(f)); }} className="opacity-0 group-hover/cohort:opacity-100 transition-opacity text-slate-300 hover:text-red-500 p-0.5" title="Remove all from list"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75V4H5a2 2 0 00-2 2v.041c0 .121.013.24.038.354l.842 3.786A3.75 3.75 0 007.5 13h5a3.75 3.75 0 003.62-2.819l.842-3.786c.025-.114.038-.233.038-.354V6a2 2 0 00-2-2h-1V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 3a1.25 1.25 0 011.25 1.25V4h-2.5V3.75A1.25 1.25 0 0110 3zm2.25 8a.75.75 0 000-1.5h-4.5a.75.75 0 000 1.5h4.5z" clipRule="evenodd" /></svg></button>
               </div>
               <div className="space-y-1">
                 {files.sort((a, b) => a.localeCompare(b)).map(src => {
                    const url = getSourceUrl(src);
                    const isVisible = calendarVisibility[src] !== false;
                    const desc = sourceDescriptions[src];
                    const tooltip = desc ? `${src}\n${desc}` : src;
                    return (
                        <div key={src} className="flex items-center justify-between p-1 rounded hover:bg-white dark:hover:bg-slate-700/50 group/item">
                            <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0 group/checkbox">
                                <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${isVisible ? 'bg-purple-600 border-purple-600 text-white' : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 group-hover/checkbox:border-purple-400'}`}>
                                    {isVisible && <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-2.5 h-2.5"><path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" /></svg>}
                                </div>
                                <input type="checkbox" checked={isVisible} onChange={() => setCalendarVisibility(p => ({...p, [src]: !p[src]}))} className="hidden" />
                                <span className="text-[11px] truncate text-slate-600 dark:text-slate-300" title={tooltip}>{src.split(' (')[0]}</span>
                            </label>
                            <div className="flex items-center gap-1">
                                {url && (
                                    <a href={url} target="_blank" rel="noopener noreferrer" className="p-0.5 text-slate-400 hover:text-purple-600 transition-colors" title="View Course Page" onClick={e => e.stopPropagation()}>
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path fillRule="evenodd" d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5z" clipRule="evenodd" /></svg>
                                    </a>
                                )}
                                <button onClick={() => handleExcludeSource(src)} className="opacity-0 group-hover/item:opacity-100 text-slate-300 hover:text-red-500 transition-opacity p-0.5" title="Remove course from filters"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75V4H5a2 2 0 00-2 2v.041c0 .121.013.24.038.354l.842 3.786A3.75 3.75 0 007.5 13h5a3.75 3.75 0 003.62-2.819l.842-3.786c.025-.114.038-.233.038-.354V6a2 2 0 00-2-2h-1V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 3a1.25 1.25 0 011.25 1.25V4h-2.5V3.75A1.25 1.25 0 0110 3zm2.25 8a.75.75 0 000-1.5h-4.5a.75.75 0 000 1.5h4.5z" clipRule="evenodd" /></svg></button>
                            </div>
                        </div>
                    );
                 })}
               </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderCategory = (type: EventType, label: string) => {
    // ... existing logic ...
    const allFiles = (groupedSources[type] || []).filter(src => isSourceAllowed(src, type) && isSourceDependenciesMet(src) && !excludedSources.has(src));
    if (allFiles.length === 0) return null;
    const isExpanded = expandedCategories[type];
    const visibleCount = allFiles.filter(src => calendarVisibility[src] !== false).length;
    const isAll = visibleCount === allFiles.length; 
    const isNone = visibleCount === 0;
    return (
      <div key={type} className="border border-slate-200 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700/50 overflow-hidden mb-2 shadow-sm">
         <div className="flex items-center justify-between p-3 bg-white dark:bg-slate-800">
           <label className="flex items-center gap-3 cursor-pointer select-none">
             <div className={`w-5 h-5 rounded border flex items-center justify-center ${!isNone ? 'bg-[#002147] border-[#002147] dark:bg-indigo-600 dark:border-indigo-600 text-white' : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-500'}`}>
                {!isNone && <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d={isAll ? "M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" : "M4 10a.75.75 0 01.75-.75h10.5a.75.75 0 010 1.5H4.75A.75.75 0 014 10z"} clipRule="evenodd" /></svg>}
             </div>
             <input type="checkbox" className="hidden" checked={!isNone} onChange={() => { const newVal = isNone; setCalendarVisibility(prev => { const next = { ...prev }; allFiles.forEach(f => next[f] = newVal); return next; }); }} />
             <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{label}</span>
           </label>
           <button onClick={() => setExpandedCategories(p => ({...p, [type]: !p[type]}))} className="p-1 text-slate-400"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}><path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" /></svg></button>
         </div>
         {isExpanded && (
           <div className="border-t border-slate-200 dark:border-slate-600 p-2 space-y-1">
             {type === EventType.MATHS ? renderMathsFilters(allFiles) : allFiles.map(src => {
              const url = getSourceUrl(src);
              const isVisible = calendarVisibility[src] !== false;
              const desc = sourceDescriptions[src];
              const tooltip = desc ? `${src}\n${desc}` : src;
              return (
                <div key={src} className="flex items-center justify-between p-2 rounded hover:bg-white dark:hover:bg-slate-700 group/item">
                    <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-0 group/checkbox">
                        <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${isVisible ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 group-hover/checkbox:border-indigo-400'}`}>
                            {isVisible && <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-2.5 h-2.5"><path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" /></svg>}
                        </div>
                        <input type="checkbox" checked={isVisible} onChange={() => setCalendarVisibility(p => ({...p, [src]: !p[src]}))} className="hidden" />
                        <span className="text-xs truncate text-slate-600 dark:text-slate-300" title={tooltip}>{src}</span>
                    </label>
                    <div className="flex items-center gap-1">
                        {url && (
                            <a href={url} target="_blank" rel="noopener noreferrer" className="p-1 text-slate-400 hover:text-indigo-600 transition-colors" title="View Course Page" onClick={e => e.stopPropagation()}>
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5z" clipRule="evenodd" /></svg>
                            </a>
                        )}
                        <button onClick={() => handleExcludeSource(src)} className="opacity-40 group-hover/item:opacity-100 text-slate-400 hover:text-red-500 transition-opacity p-1" title="Remove course from filters"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75V4H5a2 2 0 00-2 2v.041c0 .121.013.24.038.354l.842 3.786A3.75 3.75 0 007.5 13h5a3.75 3.75 0 003.62-2.819l.842-3.786c.025-.114.038-.233.038-.354V6a2 2 0 00-2-2h-1V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 3a1.25 1.25 0 011.25 1.25V4h-2.5V3.75A1.25 1.25 0 0110 3zm2.25 8a.75.75 0 000-1.5h-4.5a.75.75 0 000 1.5h4.5z" clipRule="evenodd" /></svg></button>
                    </div>
                </div>
              );
             })}
           </div>
         )}
      </div>
    );
  };

  const renderFiltersContent = () => (
    // ... existing content ...
    <>
      <div className="flex-1 overflow-y-auto">
        {cohortRules.length > 0 && (
          <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
             <div className="flex items-center gap-2 mb-3">
                <div className="bg-[#002147] text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center dark:bg-indigo-600">1</div>
                <h2 className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Set Your Cohort</h2>
             </div>
             <div className="space-y-2">
               <select value={selectedDegree} onChange={e => setSelectedDegree(e.target.value)} className="w-full text-xs p-2 rounded border border-slate-300 bg-white text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 shadow-sm outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">Degree...</option>
                  {degrees.map(d => <option key={d} value={d}>{d}</option>)}
               </select>
               <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} disabled={!selectedDegree || !isYearRequired} className="w-full text-xs p-2 rounded border border-slate-300 bg-white text-slate-900 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 shadow-sm outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50">
                  <option value="">{isYearRequired ? 'Select Year...' : 'N/A'}</option>
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
               </select>
               {(selectedDegree || (isYearRequired && selectedYear)) && (
                  <button onClick={handleClearFilters} className="w-full text-[10px] font-bold text-red-500 uppercase py-2 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded hover:bg-red-100 transition-colors shadow-sm mt-1">Clear Filters</button>
               )}
             </div>
          </div>
        )}
        <div className="p-4">
           <div className="flex items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2">
                 <div className="bg-[#002147] text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center dark:bg-indigo-600">2</div>
                 <h2 className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Select Courses</h2>
              </div>
              {excludedSources.size > 0 && (
                 <button onClick={handleResetStudentView} className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase hover:underline">Reset View</button>
              )}
           </div>
           {renderCategory(EventType.LECTURE, 'Lectures')}
           {renderCategory(EventType.PRACTICAL, 'Practicals')}
           {renderCategory(EventType.CLASS, 'Classes')}
           {renderCategory(EventType.MATHS, 'Maths')}
           {renderCategory(EventType.OTHER, 'Miscellaneous')}
        </div>
      </div>
      <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 space-y-3">
        {conflictCount > 0 && (
          <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl animate-pulse">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-red-600 flex-shrink-0"><path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>
            <span className="text-sm font-bold text-red-700 dark:text-red-300 uppercase tracking-tight">{conflictCount} Conflicts Found</span>
          </div>
        )}
      </div>
    </>
  );

  if (!isLoading && !studentAccessEnabled) {
    return (
      <div className="min-h-screen bg-slate-100 px-4 py-10 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">Course Planner</p>
          <h1 className="mt-4 text-3xl font-bold text-[#002147] dark:text-white">The planner is currently unavailable</h1>
          <p className="mt-4 text-base text-slate-600 dark:text-slate-300">
            This tool is switched off at the moment. Please check back when teaching resumes or ask your course team when it will reopen.
          </p>
          {lastUpdatedAt && (
            <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
              Last updated {new Date(lastUpdatedAt).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden">
      <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 md:px-6 py-3 flex-none flex flex-col md:flex-row md:items-center justify-between gap-3 z-50 shadow-sm transition-colors">
        <div className="flex items-center gap-3">
          <div className="bg-[#002147] text-white p-2 rounded-lg dark:bg-indigo-600 flex-none select-none">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-[#002147] dark:text-white leading-tight truncate">Interactive Course Planner</h1>
            <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide truncate">Student Planner</p>
          </div>
        </div>
        <div className={`${mobileTab === 'schedule' ? 'flex' : 'hidden'} md:flex items-center gap-2 bg-slate-100 dark:bg-slate-700/50 p-1 rounded-lg justify-between md:justify-start flex-none`}>
           <div className="flex bg-white dark:bg-slate-800 rounded p-0.5 shadow-inner">
              <button onClick={() => setViewMode('month')} className={`px-2.5 py-1 text-[10px] font-bold rounded transition-all ${viewMode === 'month' ? 'bg-[#002147] text-white dark:bg-indigo-600 shadow-sm' : 'text-slate-600 dark:text-slate-300'}`}>Month</button>
              <button onClick={() => setViewMode('week')} className={`px-2.5 py-1 text-[10px] font-bold rounded transition-all ${viewMode === 'week' ? 'bg-[#002147] text-white dark:bg-indigo-600 shadow-sm' : 'text-slate-600 dark:text-slate-300'}`}>Week</button>
           </div>
           <div className="flex items-center gap-1">
             <Button variant="ghost" size="sm" onClick={() => setCurrentDate(addDays(currentDate, viewMode === 'month' ? -30 : -7))} className="font-bold px-2 py-1 h-7">&lt;</Button>
             <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200 min-w-[90px] text-center">{currentDate.toLocaleDateString([], { month: 'short', year: 'numeric' })}</span>
             <Button variant="ghost" size="sm" onClick={() => setCurrentDate(addDays(currentDate, viewMode === 'month' ? 30 : 7))} className="font-bold px-2 py-1 h-7">&gt;</Button>
           </div>
        </div>
        <div className="flex items-center justify-end gap-1 md:gap-2">
          <button onClick={openChangeLog} className="p-2 rounded-full text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 transition-colors relative" title="Change Log">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
            {unreadLogsCount > 0 && (
              <span className="absolute top-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white dark:ring-slate-800 animate-pulse">
                {unreadLogsCount}
              </span>
            )}
          </button>
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 rounded-full text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700 transition-colors">{isDarkMode ? <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0z" /></svg> : <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998z" /></svg>}</button>
          {lastUpdatedAt && (
            <div className="hidden md:flex items-center rounded-full bg-slate-100 dark:bg-slate-700 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-300">
              Updated {new Date(lastUpdatedAt).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
          )}
        </div>
      </header>
      <div className="flex-1 flex overflow-hidden relative">
        {isLoading && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-sm">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-6 py-4 shadow-xl">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">Loading published planner data...</p>
            </div>
          </div>
        )}
        <aside className={`${mobileTab === 'filters' ? 'flex w-full absolute inset-0 z-40 bg-white dark:bg-slate-800' : 'hidden'} md:flex md:relative md:w-52 lg:w-64 xl:w-72 flex-col border-r border-slate-200 dark:border-slate-700 overflow-hidden`}>{renderFiltersContent()}</aside>
        <main className={`flex-1 flex flex-col overflow-hidden ${mobileTab !== 'schedule' ? 'hidden md:flex' : 'flex'}`}>
           <div className="flex-1 overflow-auto p-4 md:p-6 bg-slate-100/30 dark:bg-slate-900/50">
             {viewMode === 'month' ? (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 h-full min-h-[500px]">{monthsToDisplay.map((d, i) => <CalendarMonth key={i} year={d.getFullYear()} month={d.getMonth()} events={eventsWithConflicts} onDayClick={(date) => setSelectedDay(date)} selectedDate={selectedDay || null} />)}</div>
             ) : (
                <CalendarWeek currentDate={currentDate} events={eventsWithConflicts} onEventClick={e => setSelectedDay(e.start)} />
             )}
           </div>
        </main>
        <aside className={`${mobileTab === 'summary' ? 'flex w-full absolute inset-0 z-40 bg-white dark:bg-slate-800' : 'hidden'} md:flex md:relative md:w-52 lg:w-64 xl:w-72 flex-col border-l border-slate-200 dark:border-slate-700`}><SummaryPane visibleSources={visibleSources} sourceTypes={sourceTypes} sourceCohorts={sourceCohorts} conflictDetails={conflictDetails} onRemoveSource={handleRemoveSource} onRemoveCohort={handleRemoveCohort} availableSources={uniqueSources} onAddGroups={handleAddGroups} sourceUrls={sourceToUrl} sourceDescriptions={sourceDescriptions} /></aside>
      </div>
      
      {/* Mobile Conflict Banner */}
      {conflictCount > 0 && (
          <div className="md:hidden bg-red-600 text-white px-4 py-2 text-center text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-[55]" onClick={() => setMobileTab('summary')}>
             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
             </svg>
             <span>{conflictCount} Conflict{conflictCount !== 1 ? 's' : ''} Detected</span>
          </div>
      )}

      <div className="md:hidden bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-around p-2 z-[60] shadow-2xl">
          <button onClick={() => setMobileTab('filters')} className={`flex flex-col items-center p-2 text-[10px] font-bold transition-colors ${mobileTab === 'filters' ? 'text-indigo-600' : 'text-slate-400'}`}>Filters</button>
          <button onClick={() => setMobileTab('schedule')} className={`flex flex-col items-center p-2 text-[10px] font-bold transition-colors ${mobileTab === 'schedule' ? 'text-indigo-600' : 'text-slate-400'}`}>Schedule</button>
          <button onClick={() => setMobileTab('summary')} className={`flex flex-col items-center p-2 text-[10px] font-bold transition-colors ${mobileTab === 'summary' ? 'text-indigo-600' : 'text-slate-400'}`}>Summary</button>
      </div>
      <EventModal isOpen={!!selectedDay} onClose={() => setSelectedDay(null)} date={selectedDay || null} events={selectedDateEvents} onRemoveSource={handleRemoveSource} sourceUrls={sourceToUrl} />
      <ChangeLogModal isOpen={isChangeLogOpen} onClose={() => setIsChangeLogOpen(false)} logs={changeLogs} logFormDesc="" setLogFormDesc={() => {}} logFormDate="" setLogFormDate={() => {}} editingLogId={null} />
      
      {/* Anomaly Resolution Modal */}
      {anomaliesQueue.length > 0 && (
          <AnomalyModal 
            isOpen={anomaliesQueue.length > 0} 
            anomaly={anomaliesQueue[currentAnomalyIndex]} 
            existingLocations={existingLocations}
            onResolve={handleResolveAnomaly}
            onSkip={handleSkipAnomaly}
            onClose={handleCancelAnomalies}
          />
      )}

    </div>
  );
};

export default App;
