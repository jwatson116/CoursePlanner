
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
import { addDays, TERM_START_DATE, isSameDay } from './utils/dateUtils';

// Explicit overrides for shortnames that algorithmic matching might miss
const SHORTNAME_OVERRIDES: Record<string, string> = {
  "fospa": "Foundations of Self-Programming Agents",
  "compmed": "Computational Medicine",
  "cm": "Computational Medicine",
  "contmath": "Continuous Mathematics",
  "contmaths": "Continuous Mathematics"
  // Add other known specific shortnames here if needed
};

type PortalMode = 'student' | 'admin';

interface AppProps {
  portalMode?: PortalMode;
}

const App: React.FC<AppProps> = ({ portalMode = 'student' }) => {
  const [currentDate, setCurrentDate] = useState(new Date(TERM_START_DATE.getFullYear(), TERM_START_DATE.getMonth(), 1));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<'month' | 'week'>(() => {
    if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('scholarSync_viewMode');
        return (saved === 'month' || saved === 'week') ? saved : 'month';
    }
    return 'month';
  });
  const isAdminMode = portalMode === 'admin';
  const [importType, setImportType] = useState<EventType | 'COHORT'>('COHORT');
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

  // Anomaly Handling State
  const [anomaliesQueue, setAnomaliesQueue] = useState<Anomaly[]>([]);
  const [currentAnomalyIndex, setCurrentAnomalyIndex] = useState(0);

  useEffect(() => {
    // Sanitize sample events to remove old 'Resolved Anomaly' markers from descriptions
    const cleanEvents = SAMPLE_EVENTS.map(e => ({
        ...e,
        description: e.description ? e.description.replace(' (Resolved Anomaly)', '') : ''
    }));
    setEvents(cleanEvents);
    setCohortRules(SAMPLE_COHORT_RULES);
    setChangeLogs(SAMPLE_CHANGE_LOG);
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
      return h