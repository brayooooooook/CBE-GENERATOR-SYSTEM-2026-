import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ShieldCheck,
  Lock,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  FileSpreadsheet,
  BarChart3,
  FileBarChart,
  RefreshCw,
  Users,
  BookOpen,
  Calendar,
  Layers,
  Sparkles,
  ArrowRight,
  Info,
  Check,
  X,
  Clock,
} from 'lucide-react';
import {
  Examination,
  ClassStream,
  Subject,
  Student,
  Mark,
  Grade,
  Teacher,
  User,
  getAllocatedSubjectsForClass,
} from '../types';
import { api, subscribeToMarksRealtime, unsubscribeFromMarksRealtime, RealtimeMarkEvent } from '../lib/storage';
import { evaluateMark } from '../utils/markUtils';
import { isClassExamApproved } from '../utils/examLockUtils';
import { getActiveTeacher, getAccessiblePrimaryClasses } from '../utils/rbacUtils';
import { getLearnerClassAtExamTime } from '../services/historicalContextResolver';
import { useAcademicSession } from '../contexts/AcademicSessionContext';

interface AssessmentStreamApprovalViewProps {
  exams: Examination[];
  classes: ClassStream[];
  subjects: Subject[];
  students: Student[];
  marks: Mark[];
  grades?: Grade[];
  teachers?: Teacher[];
  currentUser?: User | null;
  onNavigateToTab?: (tab: any) => void;
  onMarksUpdated?: () => void;
  onUpdateExamClassApproval?: (examId: string, classStreamId: string, approved: boolean) => Promise<void> | void;
}

export const AssessmentStreamApprovalView: React.FC<AssessmentStreamApprovalViewProps> = ({
  exams = [],
  classes = [],
  subjects = [],
  students = [],
  marks = [],
  grades = [],
  teachers = [],
  currentUser = null,
  onNavigateToTab,
  onMarksUpdated,
  onUpdateExamClassApproval,
}) => {
  const { viewingYear: activeYearObj, viewingTerm: activeTermObj } = useAcademicSession();

  // 1. Resolve Active Teacher & Primary Assigned Class/Stream(s)
  const activeTeacher = useMemo(
    () => getActiveTeacher(currentUser, teachers),
    [currentUser, teachers]
  );

  const primaryClasses = useMemo(
    () => getAccessiblePrimaryClasses(currentUser, activeTeacher, classes),
    [currentUser, activeTeacher, classes]
  );

  // Selected Class Stream State (Default to first assigned stream if available)
  const [selectedStreamKey, setSelectedStreamKey] = useState<string>('');

  useEffect(() => {
    if (primaryClasses.length > 0) {
      const exists = primaryClasses.some(
        (c) => (c.stream_id || c.id) === selectedStreamKey
      );
      if (!exists) {
        setSelectedStreamKey(primaryClasses[0].stream_id || primaryClasses[0].id);
      }
    } else {
      setSelectedStreamKey('');
    }
  }, [primaryClasses, selectedStreamKey]);

  const activePrimaryClass = useMemo(() => {
    if (primaryClasses.length === 0) return null;
    return (
      primaryClasses.find((c) => (c.stream_id || c.id) === selectedStreamKey) ||
      primaryClasses[0]
    );
  }, [primaryClasses, selectedStreamKey]);

  // 2. Target Assessment Selection State
  const [selectedExamId, setSelectedExamId] = useState<string>('');

  // Default Assessment selection to matching active Academic Year & Term
  useEffect(() => {
    if (exams.length > 0 && (!selectedExamId || !exams.some((e) => e.id === selectedExamId))) {
      let defaultExam: Examination | undefined;

      if (activeYearObj && activeTermObj) {
        defaultExam = exams.find((e) => {
          const matchYear = e.academic_year_id
            ? e.academic_year_id === activeYearObj.id
            : e.year === activeYearObj.year;
          const matchTerm = e.term === activeTermObj.term_name;
          return matchYear && matchTerm;
        });
      }

      if (!defaultExam) {
        defaultExam = exams[0];
      }

      if (defaultExam) {
        setSelectedExamId(defaultExam.id);
      }
    }
  }, [exams, activeYearObj, activeTermObj, selectedExamId]);

  const selectedExam = useMemo(
    () => exams.find((e) => e.id === selectedExamId) || null,
    [exams, selectedExamId]
  );

  // 3. Mark Data Synchronization & Realtime Management
  const [localMarks, setLocalMarks] = useState<Mark[] | null>(null);
  const [isLoadingMarks, setIsLoadingMarks] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const lastFetchedExamIdRef = useRef<string | null>(null);

  const effectiveMarks = localMarks ?? marks;

  // Fetch marks when exam selection changes
  useEffect(() => {
    if (!selectedExamId) {
      setIsLoadingMarks(false);
      setFetchError(null);
      return;
    }

    if (lastFetchedExamIdRef.current === selectedExamId && localMarks !== null && !fetchError) {
      return;
    }

    let isMounted = true;
    setIsLoadingMarks(true);
    setFetchError(null);

    api
      .fetchMarksForExam(selectedExamId)
      .then(() => {
        if (isMounted) {
          lastFetchedExamIdRef.current = selectedExamId;
          const freshMarks = api.getMarks();
          setLocalMarks(freshMarks);
          setIsLoadingMarks(false);
          onMarksUpdated?.();
        }
      })
      .catch((err) => {
        console.error('AssessmentStreamApproval: Error fetching marks:', err);
        if (isMounted) {
          setFetchError('Failed to synchronize latest marks from server. Showing cached marks.');
          setIsLoadingMarks(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedExamId, onMarksUpdated]);

  // Realtime subscription for mark changes
  useEffect(() => {
    const handleRealtimeEvent = (event: RealtimeMarkEvent) => {
      const record = event.newRecord || event.oldRecord;
      if (record && record.exam_id === selectedExamId) {
        const freshMarks = api.getMarks();
        setLocalMarks(freshMarks);
      }
    };

    subscribeToMarksRealtime(handleRealtimeEvent);
    return () => {
      unsubscribeFromMarksRealtime(handleRealtimeEvent);
    };
  }, [selectedExamId]);

  // Manual Refresh Handler
  const handleManualRefresh = async () => {
    if (!selectedExamId) return;
    setIsRefreshing(true);
    setFetchError(null);
    try {
      await api.fetchMarksForExam(selectedExamId);
      const freshMarks = api.getMarks();
      setLocalMarks(freshMarks);
      onMarksUpdated?.();
    } catch (err: any) {
      console.error('Manual refresh failed:', err);
      setFetchError('Failed to refresh marks. Please try again.');
    } finally {
      setIsRefreshing(false);
    }
  };

  // 4. Memoized Mark Map
  const markMap = useMemo(() => {
    const map = new Map<string, Mark>();
    if (effectiveMarks) {
      effectiveMarks.forEach((m) => {
        if (m.student_id && m.subject_id && m.exam_id) {
          map.set(`${m.student_id}_${m.subject_id}_${m.exam_id}`, m);
        }
      });
    }
    return map;
  }, [effectiveMarks]);

  // 5. Applicable Subjects for the Class Teacher's Stream
  const applicableSubjects = useMemo(() => {
    if (!activePrimaryClass) return [];
    const subs = getAllocatedSubjectsForClass(activePrimaryClass, subjects);
    return (subs || []).filter((s): s is Subject => Boolean(s && s.id));
  }, [activePrimaryClass, subjects]);

  // Map of Subject ID -> Allocated Subject Teacher Name
  const subjectTeacherMap = useMemo(() => {
    const map = new Map<string, string>();
    if (!activePrimaryClass) return map;

    const targetStreamId = activePrimaryClass.stream_id || activePrimaryClass.id;
    const targetClassName = activePrimaryClass.class_name?.toLowerCase();
    const targetStreamName = activePrimaryClass.stream?.toLowerCase();

    applicableSubjects.forEach((sub) => {
      if (!sub || !sub.id) return;
      const teacher = (teachers || []).find((t) => {
        if (!t || !Array.isArray(t.allocations)) return false;
        return t.allocations.some((alloc) => {
          if (!alloc) return false;
          const matchSub =
            alloc.subject_id === sub.id ||
            (alloc.subject_code && sub.subject_code && alloc.subject_code.toLowerCase() === sub.subject_code.toLowerCase()) ||
            (alloc.subject_name && sub.subject_name && alloc.subject_name.toLowerCase() === sub.subject_name.toLowerCase());
          if (!matchSub) return false;

          if (alloc.stream_id && (alloc.stream_id === targetStreamId || alloc.stream_id === activePrimaryClass.id)) {
            return true;
          }
          if (alloc.class_id && alloc.class_id === activePrimaryClass.id) {
            return true;
          }
          if (alloc.class_name && alloc.stream && targetClassName && targetStreamName) {
            return (
              alloc.class_name.toLowerCase() === targetClassName &&
              alloc.stream.toLowerCase() === targetStreamName
            );
          }
          return false;
        });
      });

      if (teacher) {
        map.set(sub.id, teacher.teacher_name || (teacher as any).name || 'Assigned Teacher');
      }
    });

    return map;
  }, [applicableSubjects, activePrimaryClass, teachers]);

  // 6. Strict Stream Learners Resolution
  const classLearners = useMemo(() => {
    if (!activePrimaryClass) return [];

    const targetStreamId = activePrimaryClass.stream_id || activePrimaryClass.id;
    const targetClassId = activePrimaryClass.id;

    return students
      .filter((s) => {
        if (selectedExam) {
          const examContext = getLearnerClassAtExamTime(s, selectedExam, classes);
          if (activePrimaryClass.stream_id) {
            return examContext.stream_id === activePrimaryClass.stream_id;
          }
          return (
            examContext.class_id === targetClassId ||
            examContext.stream_id === targetClassId
          );
        }

        if (activePrimaryClass.stream_id) {
          return s.stream_id === activePrimaryClass.stream_id;
        }
        return s.class_id === targetClassId;
      })
      .sort((a, b) => {
        const admA = a.admission_number || '';
        const admB = b.admission_number || '';
        return admA.localeCompare(admB, undefined, { numeric: true });
      });
  }, [students, activePrimaryClass, selectedExam, classes]);

  // 7. Evaluated Learner Records & Progress
  interface LearnerProgressRow {
    student: Student;
    completedCount: number;
    missingCount: number;
    xCount: number;
    yCount: number;
    totalExpected: number;
    completionPct: number;
    missingSubjects: Subject[];
  }

  const evaluatedLearners: LearnerProgressRow[] = useMemo(() => {
    if (!selectedExam || classLearners.length === 0 || applicableSubjects.length === 0) {
      return [];
    }

    return classLearners.map((student) => {
      let completedCount = 0;
      let missingCount = 0;
      let xCount = 0;
      let yCount = 0;
      const missingSubjects: Subject[] = [];

      applicableSubjects.forEach((sub) => {
        const key = `${student.id}_${sub.id}_${selectedExam.id}`;
        const rawMark = markMap.get(key) || null;
        const evaluated = evaluateMark(rawMark);

        if (evaluated.status === 'Normal') {
          completedCount += 1;
        } else if (evaluated.status === 'X') {
          completedCount += 1;
          xCount += 1;
        } else if (evaluated.status === 'Y') {
          completedCount += 1;
          yCount += 1;
        } else {
          missingCount += 1;
          missingSubjects.push(sub);
        }
      });

      const totalExpected = applicableSubjects.length;
      const completionPct = totalExpected > 0 ? (completedCount / totalExpected) * 100 : 0;

      return {
        student,
        completedCount,
        missingCount,
        xCount,
        yCount,
        totalExpected,
        completionPct,
        missingSubjects,
      };
    });
  }, [classLearners, applicableSubjects, selectedExam, markMap]);

  // 8. Class Overall KPI Calculations
  const classKpis = useMemo(() => {
    const totalLearners = classLearners.length;
    const totalSubjects = applicableSubjects.length;
    const expectedEntries = totalLearners * totalSubjects;

    let completedEntries = 0;
    let missingEntries = 0;
    let totalX = 0;
    let totalY = 0;
    let fullyCompletedLearners = 0;

    evaluatedLearners.forEach((row) => {
      completedEntries += row.completedCount;
      missingEntries += row.missingCount;
      totalX += row.xCount;
      totalY += row.yCount;
      if (row.missingCount === 0 && row.totalExpected > 0) {
        fullyCompletedLearners += 1;
      }
    });

    const completionRate =
      expectedEntries > 0 ? (completedEntries / expectedEntries) * 100 : 0;

    return {
      totalLearners,
      totalSubjects,
      expectedEntries,
      completedEntries,
      missingEntries,
      totalX,
      totalY,
      fullyCompletedLearners,
      completionRate,
    };
  }, [classLearners, applicableSubjects, evaluatedLearners]);

  // 9. Subject-by-Subject Progress Breakdown for Class
  const subjectProgressList = useMemo(() => {
    if (!selectedExam || classLearners.length === 0) return [];
    const totalLearners = classLearners.length;

    return applicableSubjects.map((sub) => {
      let completed = 0;
      let absentX = 0;
      let irregularityY = 0;
      const missingLearnerNames: string[] = [];

      classLearners.forEach((st) => {
        const key = `${st.id}_${sub.id}_${selectedExam.id}`;
        const rawMark = markMap.get(key);
        const evalMark = evaluateMark(rawMark);

        if (evalMark.status === 'Normal') {
          completed += 1;
        } else if (evalMark.status === 'X') {
          completed += 1;
          absentX += 1;
        } else if (evalMark.status === 'Y') {
          completed += 1;
          irregularityY += 1;
        } else {
          missingLearnerNames.push(st.full_name || st.name || st.admission_number);
        }
      });

      const missing = Math.max(0, totalLearners - completed);
      const isComplete = missing === 0 && totalLearners > 0;
      const pct = totalLearners > 0 ? (completed / totalLearners) * 100 : 0;
      const assignedTeacher = subjectTeacherMap.get(sub.id) || 'Not Allocated';

      return {
        subject: sub,
        totalLearners,
        completed,
        missing,
        absentX,
        irregularityY,
        isComplete,
        pct,
        assignedTeacher,
        missingLearnerNames,
      };
    });
  }, [applicableSubjects, classLearners, selectedExam, markMap, subjectTeacherMap]);

  // Completed vs Incomplete Subjects Counts
  const completedSubjectsCount = useMemo(
    () => subjectProgressList.filter((sp) => sp.isComplete).length,
    [subjectProgressList]
  );
  const incompleteSubjectsCount = useMemo(
    () => subjectProgressList.filter((sp) => !sp.isComplete).length,
    [subjectProgressList]
  );

  // Incomplete Subjects List
  const incompleteSubjects = useMemo(
    () => subjectProgressList.filter((sp) => !sp.isComplete),
    [subjectProgressList]
  );

  // Stream Approval States
  const isStreamApproved = useMemo(() => {
    if (!selectedExam || !activePrimaryClass) return false;
    return isClassExamApproved(selectedExam, activePrimaryClass);
  }, [selectedExam, activePrimaryClass]);

  const isReadyForApproval = useMemo(() => {
    return (
      classKpis.totalLearners > 0 &&
      classKpis.missingEntries === 0 &&
      applicableSubjects.length > 0
    );
  }, [classKpis, applicableSubjects]);

  const [isApproving, setIsApproving] = useState<boolean>(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState<boolean>(false);

  const handleApproveStream = async () => {
    if (!selectedExam || !activePrimaryClass) return;
    setIsApproving(true);
    setApprovalError(null);
    try {
      const streamIdentifier = activePrimaryClass.stream_id || activePrimaryClass.id;
      if (onUpdateExamClassApproval) {
        await onUpdateExamClassApproval(selectedExam.id, streamIdentifier, true);
      } else {
        await api.updateExaminationClassApproval(selectedExam.id, streamIdentifier, true, currentUser);
        onMarksUpdated?.();
      }
      setShowApprovalModal(false);
    } catch (err: any) {
      console.error('Failed to approve class stream:', err);
      setApprovalError(err?.message || 'Failed to approve class stream results.');
    } finally {
      setIsApproving(false);
    }
  };

  // -------------------------------------------------------------------------
  // GUARD: NO ASSIGNED CLASS TEACHER STREAM
  // -------------------------------------------------------------------------
  if (primaryClasses.length === 0) {
    return (
      <div className="space-y-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center max-w-xl mx-auto shadow-sm space-y-4">
          <div className="w-12 h-12 bg-amber-50 dark:bg-amber-950/60 rounded-full flex items-center justify-center mx-auto text-amber-600 dark:text-amber-400">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            No Class Teacher Assignment Found
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Assessment Stream Approval is restricted to designated Class Teachers. Your account is not currently assigned as a Class Teacher to any stream.
          </p>
          <div className="pt-2 flex items-center justify-center gap-3">
            <button
              onClick={() => onNavigateToTab?.('marks-entry')}
              className="cbe-btn-secondary text-xs font-semibold px-4 py-2 flex items-center gap-1.5"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Go to Marks Entry</span>
            </button>
            <button
              onClick={() => onNavigateToTab?.('dashboard')}
              className="cbe-btn-primary text-xs font-semibold px-4 py-2 flex items-center gap-1.5"
            >
              <span>Return to Dashboard</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const streamDisplayName = `${activePrimaryClass?.class_name || 'Class'} ${activePrimaryClass?.stream || ''}`.trim();

  return (
    <div className="space-y-6">
      {/* 1. TOP TITLE & CONTEXT CARD */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-[#075E42] dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                <span>Class Teacher Oversight</span>
              </span>
              <span className="text-slate-300 dark:text-slate-700">&bull;</span>
              <span className="inline-flex items-center text-xs font-semibold text-[#075E42] dark:text-emerald-300 bg-[#E6F4EA] dark:bg-emerald-950/80 px-2.5 py-0.5 rounded-md border border-[#075E42]/20 dark:border-emerald-800">
                My Class: {streamDisplayName}
              </span>
            </div>

            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>Assessment Stream Approval</span>
            </h1>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Verify readiness and officially sign off marks for your assigned stream to lock results and unlock report cards.
            </p>
          </div>

          {/* Quick Module Navigation Shortcuts */}
          <div className="flex flex-wrap items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800/80">
            <button
              onClick={() => onNavigateToTab?.('marks-entry')}
              className="cbe-btn-secondary text-xs font-semibold px-3 py-2 flex items-center gap-1.5 min-h-[38px]"
              title="Enter marks for your learners"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
              <span>Enter Marks</span>
            </button>
            <button
              onClick={() => onNavigateToTab?.('class-marks-monitoring')}
              className="cbe-btn-secondary text-xs font-semibold px-3 py-2 flex items-center gap-1.5 min-h-[38px]"
              title="View full monitoring dashboard"
            >
              <BarChart3 className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
              <span>Marks Monitoring</span>
            </button>
            <button
              onClick={() => onNavigateToTab?.('reports')}
              className="cbe-btn-secondary text-xs font-semibold px-3 py-2 flex items-center gap-1.5 min-h-[38px]"
              title="Access official merit lists & reports"
            >
              <FileBarChart className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
              <span>Reports & Merit Lists</span>
            </button>
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing || isLoadingMarks}
              className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 min-h-[38px] flex items-center justify-center"
              title="Refresh marks data"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing || isLoadingMarks ? 'animate-spin text-emerald-600' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* 2. FILTER & SELECTION CONTROLS BAR */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Target Assessment Dropdown */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#075E42] dark:text-emerald-400" />
              <span>Target Examination</span>
            </label>
            <select
              id="target-assessment-select"
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
            >
              {exams.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.exam_name} • [{ex.exam_type ? (ex.exam_type === 'CAT' ? 'CAT / Continuous' : ex.exam_type) : 'Exam'}] ({ex.term} • {ex.year}) — [{ex.status || 'Active'}]
                </option>
              ))}
            </select>
          </div>

          {/* Assigned Class Stream Selector (or Single Stream Badge) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-[#075E42] dark:text-emerald-400" />
              <span>My Assigned Class / Stream</span>
            </label>
            {primaryClasses.length > 1 ? (
              <select
                id="assigned-class-stream-select"
                value={selectedStreamKey}
                onChange={(e) => setSelectedStreamKey(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
              >
                {primaryClasses.map((cls) => {
                  const key = cls.stream_id || cls.id;
                  return (
                    <option key={key} value={key}>
                      {cls.class_name} {cls.stream} ({cls.education_level || 'General'})
                    </option>
                  );
                })}
              </select>
            ) : (
              <div className="w-full bg-slate-50 dark:bg-slate-800/90 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 flex items-center justify-between">
                <span>{streamDisplayName}</span>
                <span className="text-[11px] text-emerald-700 dark:text-emerald-400 bg-emerald-100/80 dark:bg-emerald-950/80 px-2 py-0.5 rounded font-medium">
                  {activePrimaryClass?.education_level || 'Designated Class'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {fetchError && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{fetchError}</span>
          </div>
          <button
            onClick={handleManualRefresh}
            className="text-[11px] font-bold underline hover:no-underline ml-2"
          >
            Retry
          </button>
        </div>
      )}

      {/* 3. PRIMARY DEDICATED APPROVAL & READINESS CARD */}
      <div
        id="class-stream-approval-card"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 shadow-sm space-y-6"
      >
        {/* Card Header & Status Badge */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
          <div className="space-y-1.5">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Assessment Stream Approval & Readiness</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xl font-extrabold text-slate-900 dark:text-white">
                {streamDisplayName} — {selectedExam?.exam_name || 'Selected Examination'}
              </span>
              {selectedExam && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-black bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 uppercase tracking-wider">
                  <BookOpen className="w-3 h-3" />
                  <span>Type: {selectedExam.exam_type ? (selectedExam.exam_type === 'CAT' ? 'CAT / Continuous' : selectedExam.exam_type) : 'Standard Assessment'}</span>
                </span>
              )}
            </div>
            {selectedExam && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Monitoring approval status for {selectedExam.term} • Academic Year {selectedExam.year}
              </p>
            )}
          </div>

          {/* Prominent Status Badge */}
          {isStreamApproved ? (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/90 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800 shadow-xs">
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>✓ APPROVED & LOCKED</span>
            </div>
          ) : isReadyForApproval ? (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700 shadow-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>✓ READY FOR APPROVAL</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-700 shadow-xs">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>⚠ NOT READY FOR APPROVAL</span>
            </div>
          )}
        </div>

        {/* State Banner & Direct Explanation */}
        {isStreamApproved ? (
          <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 rounded-lg shrink-0 mt-0.5">
                <Lock className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <div className="text-sm font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
                  <span>✓ APPROVED &bull; 🔒 LOCKED</span>
                </div>
                <p className="text-xs text-emerald-800 dark:text-emerald-300/90 leading-relaxed">
                  Marks for <strong>{streamDisplayName}</strong> are officially approved and locked. Results are finalized, and official report cards and merit lists are unlocked and available for distribution.
                </p>
              </div>
            </div>

            <button
              onClick={() => onNavigateToTab?.('reports')}
              className="shrink-0 px-4 py-2.5 text-xs font-bold text-white bg-[#075E42] hover:bg-[#054531] rounded-xl shadow-xs transition-colors flex items-center gap-2 min-h-[44px] cursor-pointer"
            >
              <FileBarChart className="w-4 h-4" />
              <span>View Official Reports & Merit Lists</span>
            </button>
          </div>
        ) : isReadyForApproval ? (
          <div className="p-4 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 rounded-lg shrink-0 mt-0.5">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <div className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                  Ready for Official Class Teacher Approval
                </div>
                <p className="text-xs text-emerald-800 dark:text-emerald-300/90 leading-relaxed">
                  All <strong>{classKpis.completedEntries} of {classKpis.expectedEntries} marks</strong> across all {applicableSubjects.length} learning areas have been entered and validated. This stream is 100% complete and ready for official sign-off.
                </p>
              </div>
            </div>

            <button
              id="btn-approve-class-stream-results"
              onClick={() => setShowApprovalModal(true)}
              disabled={isApproving}
              className="shrink-0 px-5 py-2.5 text-xs font-bold text-white bg-[#075E42] hover:bg-[#054531] rounded-xl shadow-xs transition-colors flex items-center gap-2 min-h-[44px] cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Approve {streamDisplayName} Results</span>
            </button>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 rounded-lg shrink-0 mt-0.5">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <div className="text-sm font-bold text-amber-900 dark:text-amber-200">
                  Approval Unavailable — Marks Incomplete
                </div>
                <p className="text-xs text-amber-800 dark:text-amber-300/90 leading-relaxed">
                  <strong>{classKpis.missingEntries} mark entries</strong> are still missing across <strong>{incompleteSubjectsCount} learning area{incompleteSubjectsCount > 1 ? 's' : ''}</strong>. All learning areas must be 100% complete before the stream can be approved and locked.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                onClick={() => onNavigateToTab?.('marks-entry')}
                className="px-4 py-2.5 text-xs font-bold text-white bg-amber-700 hover:bg-amber-800 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 min-h-[44px] cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Go to Marks Entry</span>
              </button>
              <button
                id="btn-approve-class-stream-results"
                disabled={true}
                className="px-4 py-2.5 text-xs font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl cursor-not-allowed flex items-center gap-2 min-h-[44px]"
                title="Complete all learning area marks first to enable approval"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Approve {streamDisplayName} Results</span>
              </button>
            </div>
          </div>
        )}

        {/* Progress Bar & Rate */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
            <span>Result Readiness Progress ({classKpis.completedEntries} / {classKpis.expectedEntries} entries)</span>
            <span className="text-sm font-extrabold text-slate-900 dark:text-white">
              {classKpis.completionRate.toFixed(1)}%
            </span>
          </div>
          <div className="w-full h-3.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                isStreamApproved
                  ? 'bg-emerald-600'
                  : isReadyForApproval
                  ? 'bg-emerald-500'
                  : 'bg-amber-500'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, classKpis.completionRate))}%` }}
            />
          </div>
        </div>

        {/* 4. READINESS METRICS SUMMARY GRID */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
          {/* Total Learners */}
          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3.5 border border-slate-200 dark:border-slate-700">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Enrolled Learners
            </div>
            <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
              {classKpis.totalLearners}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
              Active in {streamDisplayName}
            </div>
          </div>

          {/* Learning Areas */}
          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3.5 border border-slate-200 dark:border-slate-700">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Learning Areas
            </div>
            <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
              {classKpis.totalSubjects}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
              Allocated Curriculum
            </div>
          </div>

          {/* Completed Subjects */}
          <div className="bg-emerald-50/50 dark:bg-emerald-950/30 rounded-xl p-3.5 border border-emerald-200 dark:border-emerald-800/60">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Completed Subjects
            </div>
            <div className="text-xl font-bold text-emerald-800 dark:text-emerald-200 mt-1">
              {completedSubjectsCount} / {applicableSubjects.length}
            </div>
            <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">
              100% Entries Done
            </div>
          </div>

          {/* Incomplete Subjects */}
          <div className={`rounded-xl p-3.5 border ${
            incompleteSubjectsCount === 0
              ? 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
              : 'bg-amber-50/60 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60'
          }`}>
            <div className={`text-[10px] font-semibold uppercase tracking-wider ${
              incompleteSubjectsCount === 0 ? 'text-slate-500 dark:text-slate-400' : 'text-amber-700 dark:text-amber-400'
            }`}>
              Incomplete Subjects
            </div>
            <div className={`text-xl font-bold mt-1 ${
              incompleteSubjectsCount === 0 ? 'text-slate-900 dark:text-white' : 'text-amber-800 dark:text-amber-200'
            }`}>
              {incompleteSubjectsCount}
            </div>
            <div className={`text-[10px] mt-0.5 ${
              incompleteSubjectsCount === 0 ? 'text-slate-500 dark:text-slate-400' : 'text-amber-600 dark:text-amber-400'
            }`}>
              {incompleteSubjectsCount === 0 ? 'All Complete' : 'Pending Marks'}
            </div>
          </div>

          {/* Missing Marks */}
          <div className={`rounded-xl p-3.5 border ${
            classKpis.missingEntries === 0
              ? 'bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60'
              : 'bg-rose-50/60 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/60'
          }`}>
            <div className={`text-[10px] font-semibold uppercase tracking-wider ${
              classKpis.missingEntries === 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'
            }`}>
              Missing Marks
            </div>
            <div className={`text-xl font-bold mt-1 ${
              classKpis.missingEntries === 0 ? 'text-emerald-800 dark:text-emerald-200' : 'text-rose-800 dark:text-rose-200'
            }`}>
              {classKpis.missingEntries}
            </div>
            <div className={`text-[10px] mt-0.5 ${
              classKpis.missingEntries === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
            }`}>
              {classKpis.missingEntries === 0 ? 'Zero Missing' : 'Entries Needed'}
            </div>
          </div>

          {/* Fully Completed Learners */}
          <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl p-3.5 border border-slate-200 dark:border-slate-700">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Full Learner Records
            </div>
            <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
              {classKpis.fullyCompletedLearners} / {classKpis.totalLearners}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
              Learners with all marks
            </div>
          </div>
        </div>
      </div>

      {/* 5. LEARNING AREAS READINESS CHECKLIST */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#075E42] dark:text-emerald-400" />
              <span>Learning Areas Readiness Checklist</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Every learning area must reach 100% completion before official stream approval.
            </p>
          </div>
          <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            <span>{completedSubjectsCount} of {applicableSubjects.length} Ready</span>
          </div>
        </div>

        {/* Grid of Subject Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {subjectProgressList.map((sp) => (
            <div
              key={sp.subject.id}
              className={`p-3.5 rounded-xl border transition-colors flex flex-col justify-between space-y-3 ${
                sp.isComplete
                  ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60'
                  : 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/60'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                      {sp.subject.subject_name}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                      Code: {sp.subject.subject_code || 'N/A'} &bull; Teacher: {sp.assignedTeacher}
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold shrink-0 ${
                      sp.isComplete
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 border border-amber-300 dark:border-amber-700'
                    }`}
                  >
                    {sp.isComplete ? '✓ Complete' : `✕ ${sp.missing} Missing`}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden mt-2.5">
                  <div
                    className={`h-full ${sp.isComplete ? 'bg-emerald-600' : 'bg-amber-500'}`}
                    style={{ width: `${Math.min(100, Math.max(0, sp.pct))}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                <span>{sp.completed} of {sp.totalLearners} entered</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{sp.pct.toFixed(0)}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 6. INCOMPLETE ITEMS BREAKDOWN (IF ANY) */}
      {incompleteSubjects.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-amber-800 dark:text-amber-300">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>Outstanding Marks Requiring Attention ({incompleteSubjects.length} Subject{incompleteSubjects.length > 1 ? 's' : ''})</span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            The following subjects have missing marks that prevent stream approval. Reach out to the assigned subject teachers or enter the missing marks:
          </p>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
            {incompleteSubjects.map((sp) => (
              <div key={sp.subject.id} className="p-3 bg-slate-50/50 dark:bg-slate-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div>
                  <div className="font-bold text-slate-900 dark:text-white">
                    {sp.subject.subject_name} ({sp.subject.subject_code})
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 text-[11px]">
                    Assigned Teacher: <span className="font-semibold text-slate-700 dark:text-slate-300">{sp.assignedTeacher}</span> &bull; Missing for {sp.missing} learner{sp.missing > 1 ? 's' : ''}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-amber-700 dark:text-amber-400 font-bold bg-amber-100 dark:bg-amber-950/80 px-2.5 py-1 rounded-md text-[11px]">
                    {sp.completed} / {sp.totalLearners} entered ({sp.missing} missing)
                  </span>
                  <button
                    onClick={() => onNavigateToTab?.('marks-entry')}
                    className="px-3 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-200 font-semibold rounded-md shadow-2xs transition-colors"
                  >
                    Enter
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. APPROVAL CONFIRMATION MODAL */}
      {showApprovalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 rounded-full text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Approve Class Stream Results
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Official Class Teacher Sign-Off & Results Lock
                </p>
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="font-bold text-slate-900 dark:text-white text-sm">
                {streamDisplayName} &bull; {selectedExam?.exam_name}
              </div>
              <ul className="list-disc pl-4 space-y-1 text-slate-600 dark:text-slate-400 pt-1">
                <li>Total Enrolled Learners: <span className="font-semibold text-slate-900 dark:text-white">{classKpis.totalLearners}</span></li>
                <li>Total Mark Entries: <span className="font-semibold text-slate-900 dark:text-white">{classKpis.completedEntries} / {classKpis.expectedEntries} (100% Complete)</span></li>
                <li>Total Learning Areas: <span className="font-semibold text-slate-900 dark:text-white">{applicableSubjects.length} (All Validated)</span></li>
                <li className="text-emerald-800 dark:text-emerald-300 font-medium">
                  Approving will <span className="font-bold">lock marks entry</span> for this stream and unlock official report cards and merit lists.
                </li>
              </ul>
            </div>

            {approvalError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200 rounded-lg flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{approvalError}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowApprovalModal(false)}
                disabled={isApproving}
                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors min-h-[44px] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                id="btn-confirm-approve-class-stream"
                onClick={handleApproveStream}
                disabled={isApproving}
                className="px-4 py-2 text-xs font-bold text-white bg-[#075E42] hover:bg-[#054531] rounded-xl shadow-sm transition-colors flex items-center gap-1.5 min-h-[44px] cursor-pointer"
              >
                {isApproving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Approving & Locking...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Confirm & Lock Results</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
