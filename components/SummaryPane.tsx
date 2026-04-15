
import React, { useMemo } from 'react';
import { EventType } from '../types';

interface SummaryPaneProps {
  visibleSources: string[];
  sourceTypes: Record<string, EventType>;
  sourceCohorts: Record<string, string>;
  conflictDetails?: Record<string, string[]>;
  onRemoveSource?: (source: string) => void;
  onRemoveCohort?: (cohort: string) => void;
  availableSources?: string[];
  onAddGroups?: (courseName: string) => void;
  sourceUrls?: Map<string, string>;
  sourceDescriptions?: Record<string, string>;
}

interface ActivityItem {
  label: string;
  type: EventType;
  source: string;
  description?: string;
}

interface CourseSummary {
  name: string;
  activities: ActivityItem[];
}

interface MathsCohortSummary {
  cohort: string;
  courses: Record<string, ActivityItem[]>;
}

export const SummaryPane: React.FC<SummaryPaneProps> = ({ 
  visibleSources, 
  sourceTypes, 
  sourceCohorts,
  conflictDetails = {},
  onRemoveSource,
  onRemoveCohort,
  availableSources,
  onAddGroups,
  sourceUrls,
  sourceDescriptions
}) => {
  
  const { groupedStandardCourses, groupedMathsCohorts } = useMemo(() => {
    const standard: Record<string, CourseSummary> = {};
    const maths: Record<string, MathsCohortSummary> = {};

    visibleSources.forEach(source => {
      const type = sourceTypes[source] || EventType.OTHER;
      const description = sourceDescriptions?.[source];
      
      if (type === EventType.MATHS) {
        const cohort = sourceCohorts[source] || 'Other';
        const courseName = source.split(' (')[0];

        if (!maths[cohort]) {
          maths[cohort] = { cohort, courses: {} };
        }
        if (!maths[cohort].courses[courseName]) {
          maths[cohort].courses[courseName] = [];
        }
        maths[cohort].courses[courseName].push({
          label: courseName,
          type: type,
          source: source,
          description
        });
      } else {
        let courseName = source;
        let activityLabel = 'Lectures';

        if (source.includes(' - ')) {
          const parts = source.split(' - ');
          courseName = parts[0];
          activityLabel = parts.slice(1).join(' - ');
        } else {
          if (type === EventType.LECTURE) activityLabel = 'Lectures';
          else if (type === EventType.PRACTICAL) activityLabel = 'Practical';
          else if (type === EventType.CLASS) activityLabel = 'Classes';
          else activityLabel = 'Event';
        }

        if (!standard[courseName]) {
          standard[courseName] = { name: courseName, activities: [] };
        }

        standard[courseName].activities.push({
          label: activityLabel,
          type: type,
          source: source,
          description
        });
      }
    });

    return {
        groupedStandardCourses: Object.values(standard).sort((a, b) => a.name.localeCompare(b.name)),
        groupedMathsCohorts: Object.values(maths).sort((a, b) => a.cohort.localeCompare(b.cohort))
    };
  }, [visibleSources, sourceTypes, sourceCohorts, sourceDescriptions]);

  const typeColors = {
    [EventType.LECTURE]: 'text-blue-600 bg-blue-50 border-blue-100 dark:text-blue-200 dark:bg-blue-900/40 dark:border-blue-800',
    [EventType.PRACTICAL]: 'text-emerald-600 bg-emerald-50 border-emerald-100 dark:text-emerald-200 dark:bg-emerald-900/40 dark:border-emerald-800',
    [EventType.CLASS]: 'text-orange-600 bg-orange-50 border-orange-100 dark:text-orange-200 dark:bg-orange-900/40 dark:border-orange-800',
    [EventType.MATHS]: 'text-purple-600 bg-purple-50 border-purple-100 dark:text-purple-200 dark:bg-purple-900/40 dark:border-purple-800',
    [EventType.OTHER]: 'text-slate-600 bg-slate-50 border-slate-100 dark:text-slate-300 dark:bg-slate-700/50 dark:border-slate-600',
  };

  const getUrl = (courseName: string) => {
      if (!sourceUrls) return null;
      if (sourceUrls.has(courseName)) return sourceUrls.get(courseName);
      const norm = courseName.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
      if (sourceUrls.has(norm)) return sourceUrls.get(norm);
      return null;
  };

  const handleRemoveCourse = (course: CourseSummary) => {
    if (onRemoveSource) {
      course.activities.forEach(activity => {
        onRemoveSource(activity.source);
      });
    }
  };

  const handleRemoveMathsCourse = (activities: ActivityItem[]) => {
    if (onRemoveSource) {
        activities.forEach(a => onRemoveSource(a.source));
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-800 transition-colors duration-200">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex-none">
        <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Selection Summary</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-8">
        {groupedStandardCourses.length === 0 && groupedMathsCohorts.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-sm text-slate-400 italic">No courses selected.</p>
          </div>
        ) : (
          <>
            {/* Standard Courses Sections */}
            {groupedStandardCourses.map((course, idx) => {
              const missingActivities = availableSources ? availableSources.filter(src => {
                  if (visibleSources.includes(src)) return false;
                  return src === course.name || src.startsWith(course.name + ' - ');
              }) : [];
              const hasMissing = missingActivities.length > 0;
              const url = getUrl(course.name);

              return (
              <div key={idx} className="group animate-fade-in">
                <div className="flex justify-between items-center mb-2 group/header">
                  <div className="flex items-center gap-2 min-w-0">
                      <h3 title={course.name} className="text-sm font-bold text-slate-800 dark:text-slate-200 leading-tight truncate">
                        {course.name}
                      </h3>
                      {url && (
                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-indigo-600 transition-colors" title="View Course Page" onClick={e => e.stopPropagation()}>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5z" clipRule="evenodd" /><path fillRule="evenodd" d="M6.194 12.753a.75.75 0 001.06.053L16.5 4.44v2.81a.75.75 0 001.5 0v-4.5a.75.75 0 00-.75-.75h-4.5a.75.75 0 000 1.5h2.553l-9.056 8.194a.75.75 0 00-.053 1.06z" clipRule="evenodd" /></svg>
                        </a>
                      )}
                      {onAddGroups && hasMissing && (
                          <button 
                              onClick={() => onAddGroups(course.name)}
                              className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-emerald-100 text-emerald-700 rounded-full border border-emerald-200 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800 dark:hover:bg-emerald-800 transition-colors flex items-center gap-1 shadow-sm shrink-0"
                              title="Add all remaining classes and practicals for this course"
                          >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" /></svg>
                              Add Groups
                          </button>
                      )}
                  </div>
                  {onRemoveSource && (
                    <button 
                      onClick={() => handleRemoveCourse(course)}
                      className="opacity-0 group-hover/header:opacity-100 transition-opacity text-slate-400 hover:text-red-500 p-0.5 rounded shrink-0"
                      title="Remove all activities for this course"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" /></svg>
                    </button>
                  )}
                </div>
                <div className="space-y-1.5 pl-2 border-l-2 border-slate-100 dark:border-slate-700">
                  {course.activities.sort((a, b) => {
                      const order = { [EventType.LECTURE]: 0, [EventType.PRACTICAL]: 1, [EventType.CLASS]: 2, [EventType.MATHS]: 3, [EventType.OTHER]: 4 };
                      const scoreA = order[a.type] ?? 99;
                      const scoreB = order[b.type] ?? 99;
                      if (scoreA !== scoreB) return scoreA - scoreB;
                      return a.label.localeCompare(b.label);
                  }).map((activity, aIdx) => {
                    const conflictingWith = conflictDetails[activity.source] || [];
                    const isConflicting = conflictingWith.length > 0;
                    
                    return (
                      <div 
                        key={aIdx} 
                        className={`text-xs px-2 py-1.5 rounded border block w-full transition-colors group/item ${isConflicting ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300' : typeColors[activity.type]}`}
                      >
                        <div className="flex flex-col gap-1">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-1.5 min-w-0">
                              {isConflicting && (
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 flex-shrink-0 text-red-500">
                                  <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                </svg>
                              )}
                              <span title={activity.description ? `${course.name}\n${activity.description}` : activity.source} className="font-medium truncate cursor-help border-b border-dotted border-current border-opacity-30">{activity.label}</span>
                            </div>
                            {onRemoveSource && (
                              <button 
                                onClick={() => onRemoveSource(activity.source)}
                                className={`p-0.5 rounded transition-opacity ${isConflicting ? 'text-red-400 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/40' : 'text-slate-400 hover:text-slate-600 hover:bg-black/5 dark:hover:bg-white/10 opacity-0 group-hover/item:opacity-100'}`}
                                title="Remove this schedule"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" /></svg>
                              </button>
                            )}
                          </div>
                          {isConflicting && (
                            <div className="mt-1 pl-4 border-l border-red-200 dark:border-red-800/50">
                              <p className="text-[10px] font-semibold text-red-500/80 dark:text-red-400/80 mb-0.5">Clashes with:</p>
                              <ul className="space-y-0.5">
                                {conflictingWith.map((clash, cIdx) => (
                                  <li key={cIdx} className="flex items-center justify-between gap-2 text-[10px] text-red-600 dark:text-red-300/80 leading-tight group/conflict">
                                    <span title={clash.split(' (')[0]} className="truncate">• {clash.split(' (')[0]}</span>
                                    {onRemoveSource && (
                                        <button 
                                            onClick={() => onRemoveSource(clash)}
                                            className="opacity-60 hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity p-0.5"
                                            title={`Remove ${clash}`}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" /></svg>
                                        </button>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )})}

            {/* Maths Cohorts Sections */}
            {groupedMathsCohorts.map((mathsGroup, idx) => (
              <div key={`maths-${idx}`} className="group animate-fade-in border-t border-slate-100 dark:border-slate-700 pt-6">
                <div className="flex justify-between items-center mb-3 group/header">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="p-1 rounded-md bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 shrink-0">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM6.75 9.25a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5z" clipRule="evenodd" /></svg>
                    </span>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide truncate">
                      Maths: {mathsGroup.cohort}
                    </h3>
                  </div>
                  {onRemoveCohort && (
                    <button 
                      onClick={() => onRemoveCohort(mathsGroup.cohort)}
                      className="opacity-0 group-hover/header:opacity-100 transition-opacity text-slate-400 hover:text-red-500 p-0.5 rounded shrink-0"
                      title={`Remove all ${mathsGroup.cohort} Maths courses`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" /></svg>
                    </button>
                  )}
                </div>
                
                <div className="space-y-2 pl-2 border-l-2 border-purple-50 dark:border-purple-900/30">
                  {Object.entries(mathsGroup.courses).sort(([a],[b]) => a.localeCompare(b)).map(([courseName, activities]: [string, ActivityItem[]], cIdx) => {
                    const isAnyConflicting = activities.some(a => (conflictDetails[a.source] || []).length > 0);
                    const url = getUrl(courseName);

                    return (
                      <div key={cIdx} className="group/item relative">
                        <div className={`flex justify-between items-center p-2 rounded-lg border transition-colors ${isAnyConflicting ? 'bg-red-50 border-red-100 text-red-800 dark:bg-red-900/10 dark:border-red-900/30 dark:text-red-300' : 'bg-purple-50/30 border-purple-100/50 text-slate-700 dark:bg-slate-700/20 dark:border-slate-700 dark:text-slate-300'}`}>
                           <div className="flex items-center gap-2 min-w-0">
                                {isAnyConflicting && (
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 flex-shrink-0 text-red-500">
                                        <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                                    </svg>
                                )}
                                <span title={courseName} className="text-xs font-medium truncate">{courseName}</span>
                                {url && (
                                    <a href={url} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-purple-600 transition-colors" title="View Course Page" onClick={e => e.stopPropagation()}>
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5z" clipRule="evenodd" /><path fillRule="evenodd" d="M6.194 12.753a.75.75 0 001.06.053L16.5 4.44v2.81a.75.75 0 001.5 0v-4.5a.75.75 0 00-.75-.75h-4.5a.75.75 0 000 1.5h2.553l-9.056 8.194a.75.75 0 00-.053 1.06z" clipRule="evenodd" /></svg>
                                    </a>
                                )}
                           </div>
                           <button 
                             onClick={() => handleRemoveMathsCourse(activities)}
                             className="opacity-0 group-hover/item:opacity-100 p-0.5 rounded text-slate-400 hover:text-red-500 transition-opacity"
                             title="Remove course"
                           >
                             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" /></svg>
                           </button>
                        </div>
                        {isAnyConflicting && (
                            <div className="mt-1 pl-3 border-l border-red-200 dark:border-red-800/50 space-y-0.5">
                                {activities.map(a => (conflictDetails[a.source] || []).map((clash, clashIdx) => (
                                    <div key={`${a.source}-${clashIdx}`} className="flex items-center justify-between gap-2 text-[9px] text-red-500/70 dark:text-red-400/70 italic leading-tight group/conflict">
                                        <span title={clash.split(' (')[0]} className="truncate">Clashes with {clash.split(' (')[0]}</span>
                                        {onRemoveSource && (
                                            <button 
                                                onClick={() => onRemoveSource(clash)}
                                                className="opacity-60 hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity p-0.5"
                                                title={`Remove ${clash}`}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3"><path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" /></svg>
                                            </button>
                                        )}
                                    </div>
                                )))}
                            </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
      
      <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex flex-col gap-2 items-center">
         <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{visibleSources.length} Item{visibleSources.length !== 1 && 's'} Selected</span>
      </div>
    </div>
  );
};
        