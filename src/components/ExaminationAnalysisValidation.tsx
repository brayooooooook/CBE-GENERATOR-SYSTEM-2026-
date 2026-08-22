import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Filter,
  Award,
  BookOpen,
  ArrowRight,
  RefreshCw,
  Info,
  Sliders,
  Users,
  AlertCircle,
  FileSpreadsheet,
  FileBarChart,
  CheckSquare,
  Search,
  Lock,
  Unlock,
  Check,
  FileText,
  Clock,
  Sparkles,
  Layers,
  GraduationCap,
  Calendar,
  X,
  Eye,
} from 'lucide-react';
import { LoadingIndicator } from './LoadingIndicator';
import {
  Examination,
  Student,
  ClassStream,
  Subject,
  Mark,
  Grade,
  Teacher,
  User,
  EducationLevel,
  GradeName,
  ALL_EDUCATION_LEVELS,
  LEVEL_TO_GRADES,
  getEducationLevelForGrade,
  sortGrades,
} from '../types';
import { getGradeForMark, getLearnerReportSubjects } from '../services/analysisEngine';
import { evaluateMark } from '../utils/markUtils';
import { getAccessibleClasses, getTeacherAssignedSubjectIds, getTeacherAssignedClassIds, isClassTeacherFor } from '../utils/rbacUtils';
import { getFilteredStudents } from '../utils/filterUtils';
import { TabType } from './Sidebar';
import { useAcademicSession } from '../contexts/AcademicSessionContext';
import { canApproveExams, getTermStatusMessage } from '../utils/termStatusUtils';
import {
  isLevelApproved,
  isClassExamApproved,
  isStreamApproved,
  isGradeFullyApproved,
  isEducationLevelFullyApproved,
  isExaminationFullyApproved,
} from '../utils/examLockUtils';
import {
  computeExamReadiness,
  StreamReadinessDetail,
  GradeReadinessDetail,
  LevelReadinessDetail,
  ExamReadinessOverview,
} from '../utils/examReadinessUtils';
import { getApplicableSubjectsForGrade } from '../types';
import { api } from '../lib/storage';

interface ExaminationAnalysisValidationProps {
  exams: Examination[];
  students: Student[];
  classes: ClassStream[];
  subjects: Subject[];
  marks: Mark[];
  grades: Grade[];
  teachers: Teacher[];
  currentUser: User | null;
  initialAdminViewMode?: 'analysis' | 'stream-approvals';
  onUpdateExamStatus: (examId: string, status: Examination['status']) => void;
  onUpdateExamLevelApproval?: (examId: string, level: EducationLevel, approved: boolean) => void;
  onUpdateExamClassApproval?: (examId: string, classStreamId: string, approved: boolean) => void;
  onNavigateToTab?: (tab: TabType) => void;
  onMarksUpdated?: () => void;
}

const ANALYSIS_OPERATIONS = [
  "Checking learner records & enrollment",
  "Checking missing marks & unentered subjects",
  "Checking exam irregularities & status flags",
  "Calculating percentages & mean scores",
  "Calculating CBE performance levels (EE1 - BE2)",
  "Checking subject & learning-area completeness",
  "Calculating stream & overall class rankings",
  "Validating merit-list data & tie-breaking rules",
  "Preparing official validation results",
];

export const ExaminationAnalysisValidation: React.FC<ExaminationAnalysisValidationProps> = ({
  exams,
  students,
  classes,
  subjects,
  marks,
  grades,
  teachers,
  currentUser,
  initialAdminViewMode = 'analysis',
  onUpdateExamStatus,
  onUpdateExamLevelApproval,
  onUpdateExamClassApproval,
  onNavigateToTab,
  onMarksUpdated,
}) => {
  // Admin View Mode: Assessment Quality-Control Analysis vs Manage Class-Stream Approvals
  const [adminViewMode, setAdminViewMode] = useState<'analysis' | 'stream-approvals'>(initialAdminViewMode);

  useEffect(() => {
    if (initialAdminViewMode) {
      setAdminViewMode(initialAdminViewMode);
    }
  }, [initialAdminViewMode]);

  const [streamToApprove, setStreamToApprove] = useState<ClassStream | null>(null);
  const [streamToReopen, setStreamToReopen] = useState<ClassStream | null>(null);
  const [streamFilterLevel, setStreamFilterLevel] = useState<EducationLevel | 'All'>('All');

  // Term Session Context Detection
  const { viewingTerm: activeTermObj, viewingYear: activeYearObj } = useAcademicSession();

  // Filter States
  const [selectedLevel, setSelectedLevel] = useState<EducationLevel | ''>('');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedStreamId, setSelectedStreamId] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<number | ''>(() => activeYearObj?.year || 2026);
  const [selectedTerm, setSelectedTerm] = useState<string>(() => activeTermObj?.term_name || 'Term 2');
  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [isLoadingMarks, setIsLoadingMarks] = useState<boolean>(false);

  // Auto-sync selected Year & Term when active viewing session changes
  useEffect(() => {
    if (activeYearObj?.year) setSelectedYear(activeYearObj.year);
    if (activeTermObj?.term_name) setSelectedTerm(activeTermObj.term_name);
  }, [activeYearObj?.year, activeTermObj?.term_name]);

  // Auto-default selectedExamId if empty or invalid when exams load or session changes
  useEffect(() => {
    if (exams && exams.length > 0) {
      const examExists = exams.some((e) => e.id === selectedExamId);
      if (!selectedExamId || !examExists) {
        let defaultExam: Examination | undefined;
        // 1. First priority: Matching active viewing year & term
        if (activeYearObj && activeTermObj) {
          defaultExam = exams.find((e) => {
            const matchYear = e.academic_year_id ? e.academic_year_id === activeYearObj.id : e.year === activeYearObj.year;
            const matchTerm = e.term === activeTermObj.term_name;
            return matchYear && matchTerm && e.status !== 'Archived';
          });
        }
        // 2. Second priority: Matching selectedYear and selectedTerm
        if (!defaultExam && selectedYear && selectedTerm) {
          defaultExam = exams.find(
            (e) => e.year === Number(selectedYear) && e.term === selectedTerm && e.status !== 'Archived'
          );
        }
        // 3. Third priority: Any non-archived exam or first available exam
        if (!defaultExam) {
          defaultExam = exams.find((e) => e.status !== 'Archived') || exams[0];
        }
        if (defaultExam) {
          setSelectedExamId(defaultExam.id);
          if (defaultExam.year) setSelectedYear(Number(defaultExam.year));
          if (defaultExam.term) setSelectedTerm(defaultExam.term);
        }
      }
    }
  }, [exams, activeYearObj, activeTermObj, selectedExamId, selectedYear, selectedTerm]);

  // Helper to find the best matching exam when parameters change
  const findMatchingExam = (
    lvl: string,
    clsId: string,
    yr: number | '',
    trm: string
  ) => {
    if (!exams || exams.length === 0) return '';
    const matching = exams.filter((ex) => {
      const matchLevel = !lvl || !ex.education_level || ex.education_level === lvl;
      let matchClass = true;
      if (ex.class_id && ex.class_id !== 'all' && clsId) {
        const clsObj = classes.find((c) => c.id === clsId || c.class_name.toLowerCase() === clsId.toLowerCase());
        matchClass = ex.class_id === clsId || (clsObj && (ex.class_id.toLowerCase() === clsObj.class_name.toLowerCase() || ex.class_id === clsObj.id));
      }
      const matchYear = !yr || ex.year === Number(yr);
      const matchTerm = !trm || ex.term === trm;
      return matchLevel && matchClass && matchYear && matchTerm;
    });

    if (matching.length > 0) {
      const preferred = matching.find((ex) => ex.status !== 'Archived') || matching[0];
      return preferred.id;
    }

    // Fallback: match level and class regardless of year/term
    const fallbackClass = exams.find((ex) => {
      const matchLevel = !lvl || !ex.education_level || ex.education_level === lvl;
      let matchClass = true;
      if (ex.class_id && ex.class_id !== 'all' && clsId) {
        const clsObj = classes.find((c) => c.id === clsId || c.class_name.toLowerCase() === clsId.toLowerCase());
        matchClass = ex.class_id === clsId || (clsObj && (ex.class_id.toLowerCase() === clsObj.class_name.toLowerCase() || ex.class_id === clsObj.id));
      }
      return matchLevel && matchClass;
    });

    return fallbackClass ? fallbackClass.id : '';
  };

  // Note: Filter selection starts in neutral state (unselected) so no level is favored on mount.



  // Fetch targeted marks for selected exam from Supabase
  useEffect(() => {
    let isMounted = true;
    if (!selectedExamId) {
      setIsLoadingMarks(false);
      return;
    }

    setIsLoadingMarks(true);
    api
      .fetchMarksForExam(selectedExamId, {
        classId: selectedClassId,
        streamId: selectedStreamId,
      })
      .then(() => {
        if (isMounted) {
          setIsLoadingMarks(false);
          onMarksUpdated?.();
        }
      })
      .catch((err) => {
        console.error('Error fetching validation marks:', err);
        if (isMounted) setIsLoadingMarks(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedExamId, selectedClassId, selectedStreamId]);

  // Comparison Option Selection
  const [comparisonType, setComparisonType] = useState<string>('None');

  // Merit Configuration Options
  const [rankingMethod, setRankingMethod] = useState<'total_marks' | 'total_points'>('total_marks');
  const [perfLevelMethod, setPerfLevelMethod] = useState<'avg_marks' | 'avg_points'>('avg_marks');
  const [includeXYInRankings, setIncludeXYInRankings] = useState<boolean>(false);
  const [excludeProvisional, setExcludeProvisional] = useState<boolean>(false);
  const [provisionalRankingsOnly, setProvisionalRankingsOnly] = useState<boolean>(false);
  const [applyTieBreaking, setApplyTieBreaking] = useState<boolean>(true);

  // Analysis Execution Progress States
  const [analysisState, setAnalysisState] = useState<'idle' | 'running' | 'complete'>('idle');
  const [analysisProgress, setAnalysisProgress] = useState<number>(0);
  const [currentOperationIndex, setCurrentOperationIndex] = useState<number>(0);
  const [analysisRanForExamId, setAnalysisRanForExamId] = useState<string | null>(null);

  // Confirmation Modals State
  const [showApproveModal, setShowApproveModal] = useState<boolean>(false);
  const [showReopenModal, setShowReopenModal] = useState<boolean>(false);

  // Toast Notification State
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'info' | 'warning'; text: string } | null>(null);

  // Active teacher and accessible classes for RBAC
  const activeTeacher = useMemo(() => {
    if (!currentUser) return null;
    return teachers.find((t) => t.user_id === currentUser.id || t.id === currentUser.id) || null;
  }, [currentUser, teachers]);

  const accessibleClasses = useMemo(() => {
    return getAccessibleClasses(currentUser || null, activeTeacher, classes);
  }, [currentUser, activeTeacher, classes]);

  // Unique Classes
  const uniqueClasses = useMemo(() => {
    const activeList = (accessibleClasses || []).filter((c) => c.status !== 'Inactive');
    const levelFiltered = selectedLevel
      ? activeList.filter((c) => {
          const cLevel = c.education_level || getEducationLevelForGrade(c.class_name);
          const levelGrades = LEVEL_TO_GRADES[selectedLevel] || [];
          return cLevel === selectedLevel || levelGrades.includes(c.class_name as GradeName);
        })
      : activeList;

    const rawNames = Array.from(new Set(levelFiltered.map((c) => c.class_name))) as string[];
    return sortGrades(rawNames);
  }, [accessibleClasses, selectedLevel]);

  // Selected Class object
  const selectedClassObject = useMemo(() => {
    if (!selectedClassId) return null;
    return (
      classes.find(
        (c) =>
          c.id === selectedClassId ||
          c.class_name.toLowerCase() === selectedClassId.toLowerCase()
      ) || null
    );
  }, [classes, selectedClassId]);

  // Available Streams
  const availableStreams = useMemo(() => {
    if (!selectedClassId) return [];
    const activeList = (accessibleClasses || []).filter((c) => c.status !== 'Inactive');
    const matching = activeList.filter(
      (c) =>
        c.class_name.toLowerCase() === selectedClassId.toLowerCase() ||
        c.id === selectedClassId
    );
    const streamMap = new Map<string, ClassStream>();
    matching.forEach((c) => {
      const sKey = c.stream ? c.stream.trim() : 'General';
      if (!streamMap.has(sKey)) {
        streamMap.set(sKey, c);
      }
    });
    return Array.from(streamMap.values());
  }, [accessibleClasses, selectedClassId]);

  // Available Years
  const availableYears = useMemo(() => {
    const yrSet = new Set<number>();
    exams.forEach((ex) => {
      if (ex.year) yrSet.add(Number(ex.year));
    });
    yrSet.add(2026);
    yrSet.add(2025);
    yrSet.add(2024);
    return Array.from(yrSet).sort((a, b) => b - a);
  }, [exams]);

  // Available Terms
  const availableTerms = useMemo(() => {
    const defaultTerms = ['Term 1', 'Term 2', 'Term 3'];
    const termSet = new Set<string>(defaultTerms);
    exams.forEach((ex) => {
      if (ex.term) termSet.add(ex.term);
    });
    return Array.from(termSet);
  }, [exams]);

  // Available Exams
  const availableExams = useMemo(() => {
    return exams.filter((ex) => {
      const matchYear = !selectedYear || ex.year === Number(selectedYear);
      const matchTerm = !selectedTerm || ex.term === selectedTerm;
      const matchLevel =
        !selectedLevel ||
        !ex.education_level ||
        ex.education_level === selectedLevel;

      let matchClass = true;
      if (ex.class_id && ex.class_id !== 'all') {
        if (selectedClassId) {
          matchClass =
            ex.class_id === selectedClassId ||
            (selectedClassObject &&
              (ex.class_id.toLowerCase() === selectedClassObject.class_name.toLowerCase() ||
               ex.class_id === selectedClassObject.id));
        }
      }
      return matchYear && matchTerm && matchLevel && matchClass;
    });
  }, [exams, selectedYear, selectedTerm, selectedLevel, selectedClassId, selectedClassObject]);

  // Active Exam
  const activeExam = useMemo(() => {
    return exams.find((ex) => ex.id === selectedExamId) || null;
  }, [exams, selectedExamId]);

  // Selected Students
  const selectedStudents = useMemo(() => {
    if (!selectedClassId) return [];
    const filtered = getFilteredStudents(students, classes, selectedClassId, selectedStreamId, activeExam);
    return filtered.filter((std) => std.active !== false);
  }, [students, classes, selectedClassId, selectedStreamId, activeExam]);

  // Applicable Subjects
  const learnerSubjects = useMemo(() => {
    if (!selectedClassObject) return [];
    const baseApplicable = getLearnerReportSubjects({} as any, selectedClassObject, subjects, teachers);
    if (currentUser?.role === 'admin') return baseApplicable;

    if (currentUser?.role === 'class_teacher' || currentUser?.role === 'subject_teacher') {
      const targetStreamObj = selectedStreamId
        ? classes.find((c) => c.id === selectedStreamId || c.stream === selectedStreamId) || selectedClassObject
        : selectedClassObject;

      const isClassTeacher =
        isClassTeacherFor(activeTeacher, targetStreamObj.id, classes) ||
        (activeTeacher?.is_class_teacher &&
          (activeTeacher?.class_teacher_of_id === selectedClassObject.id ||
            selectedClassObject.class_teacher_id === activeTeacher.id));

      if (isClassTeacher) return baseApplicable;

      const assignedIds = getTeacherAssignedSubjectIds(activeTeacher);
      return baseApplicable.filter((s) => assignedIds.includes(s.id));
    }
    return baseApplicable;
  }, [selectedClassObject, selectedStreamId, classes, subjects, currentUser, activeTeacher]);

  // Check selection completeness
  const isSelectionComplete = useMemo(() => {
    return Boolean(selectedLevel && selectedClassId && selectedStreamId && selectedYear && selectedTerm && selectedExamId);
  }, [selectedLevel, selectedClassId, selectedStreamId, selectedYear, selectedTerm, selectedExamId]);

  // Reset analysis state if selected exam changes or status resets
  useEffect(() => {
    if (activeExam?.id !== analysisRanForExamId) {
      if (activeExam?.status === 'Approved') {
        setAnalysisState('complete');
        setAnalysisProgress(100);
        setAnalysisRanForExamId(activeExam.id);
      } else {
        setAnalysisState('idle');
        setAnalysisProgress(0);
        setCurrentOperationIndex(0);
      }
    }
  }, [activeExam, analysisRanForExamId]);

  // Shared memoised lookup Map for O(1) mark retrieval: student_id + subject_id + exam_id
  const markMap = useMemo(() => {
    const map = new Map<string, Mark>();
    if (marks) {
      marks.forEach((m) => {
        if (m.student_id && m.subject_id && m.exam_id) {
          map.set(`${m.student_id}_${m.subject_id}_${m.exam_id}`, m);
        }
      });
    }
    return map;
  }, [marks]);

  // Marks Entry Progress & Per-Subject Summary
  const subjectProgressList = useMemo(() => {
    if (!isSelectionComplete || !activeExam || selectedStudents.length === 0) return [];

    return learnerSubjects.map((sb) => {
      let completed = 0;
      let missingX = 0;
      let irregularityY = 0;

      selectedStudents.forEach((std) => {
        const stdMark = markMap.get(`${std.id}_${sb.id}_${activeExam.id}`);
        const evalMark = evaluateMark(stdMark);

        if (evalMark.status === 'Normal' && evalMark.percentage !== null) {
          completed++;
        } else if (evalMark.status === 'X') {
          missingX++;
          completed++;
        } else if (evalMark.status === 'Y') {
          irregularityY++;
          completed++;
        }
      });

      const totalExpected = selectedStudents.length;
      const provisional = totalExpected - completed;
      const completionRate = totalExpected > 0 ? (completed / totalExpected) * 100 : 0;
      const isComplete100 = totalExpected > 0 && completed === totalExpected;

      return {
        subject: sb,
        totalExpected,
        completed,
        provisional,
        missingX,
        irregularityY,
        completionRate,
        isComplete100,
      };
    });
  }, [isSelectionComplete, activeExam, selectedStudents, learnerSubjects, markMap]);

  // Aggregate Stats
  const overallProgressStats = useMemo(() => {
    const totalLearners = selectedStudents.length;

    if (totalLearners === 0 || learnerSubjects.length === 0) {
      return {
        totalLearners,
        totalSubjectRecordsExpected: 0,
        completedRecords: 0,
        provisionalRecords: totalLearners,
        totalMissingX: 0,
        totalIrregularityY: 0,
        overallCompletionPercentage: 0,
        allSubjects100Percent: false,
      };
    }

    let completeLearnerCount = 0;
    let learnersWithXCount = 0;
    let learnersWithYCount = 0;

    selectedStudents.forEach((std) => {
      let studentCompletedSubjects = 0;
      let studentHasX = false;
      let studentHasY = false;

      learnerSubjects.forEach((sb) => {
        const stdMark = activeExam ? markMap.get(`${std.id}_${sb.id}_${activeExam.id}`) : undefined;
        const evalMark = evaluateMark(stdMark);

        if (
          (evalMark.status === 'Normal' && evalMark.percentage !== null) ||
          evalMark.status === 'X' ||
          evalMark.status === 'Y'
        ) {
          studentCompletedSubjects++;
        }
        if (evalMark.status === 'X') studentHasX = true;
        if (evalMark.status === 'Y') studentHasY = true;
      });

      if (studentCompletedSubjects === learnerSubjects.length && learnerSubjects.length > 0) {
        completeLearnerCount++;
      }
      if (studentHasX) learnersWithXCount++;
      if (studentHasY) learnersWithYCount++;
    });

    const totalSubjectRecordsExpected = totalLearners * learnerSubjects.length;
    const totalSubjectRecordsCompleted = subjectProgressList.reduce((acc, sp) => acc + sp.completed, 0);
    const completedRecords = Math.min(totalLearners, completeLearnerCount);
    const provisionalRecords = Math.max(0, totalLearners - completedRecords);
    const totalMissingX = learnersWithXCount;
    const totalIrregularityY = learnersWithYCount;
    const overallCompletionPercentage = totalSubjectRecordsExpected > 0 ? (totalSubjectRecordsCompleted / totalSubjectRecordsExpected) * 100 : 0;
    const allSubjects100Percent =
      totalLearners > 0 &&
      completedRecords === totalLearners &&
      subjectProgressList.every((sp) => sp.isComplete100);

    return {
      totalLearners,
      totalSubjectRecordsExpected,
      completedRecords,
      provisionalRecords,
      totalMissingX,
      totalIrregularityY,
      overallCompletionPercentage,
      allSubjects100Percent,
    };
  }, [selectedStudents, learnerSubjects, markMap, activeExam, subjectProgressList]);

  // Exam Statistics & Grade Distribution
  const examStatistics = useMemo(() => {
    const defaultStats = {
      highestMark: 0,
      lowestMark: 0,
      classAveragePct: 0,
      classAveragePoints: 0,
      overallLevelCode: '-',
      overallPerfLevel: 'Pending',
      overallDescriptor: 'No Data',
      totalLearners: selectedStudents.length,
      completeLearnersCount: 0,
      provisionalLearnersCount: 0,
      levelCounts: {
        EE1: 0,
        EE2: 0,
        ME1: 0,
        ME2: 0,
        AE1: 0,
        AE2: 0,
        BE1: 0,
        BE2: 0,
        X: 0,
        Y: 0,
      } as Record<string, number>,
    };

    if (!isSelectionComplete || !activeExam || selectedStudents.length === 0) {
      return defaultStats;
    }

    let maxMark = 0;
    let minMark = 100;
    let sumMarks = 0;
    let sumPoints = 0;
    let evaluatedStudentsCount = 0;

    const levelCounts: Record<string, number> = {
      EE1: 0,
      EE2: 0,
      ME1: 0,
      ME2: 0,
      AE1: 0,
      AE2: 0,
      BE1: 0,
      BE2: 0,
      X: 0,
      Y: 0,
    };

    selectedStudents.forEach((std) => {
      let studentSumPct = 0;
      let studentSumPts = 0;
      let validSubjCount = 0;
      let hasX = false;
      let hasY = false;

      learnerSubjects.forEach((sb) => {
        const stdMark = markMap.get(`${std.id}_${sb.id}_${activeExam.id}`);
        const evalMark = evaluateMark(stdMark);

        if (evalMark.status === 'Normal' && evalMark.percentage !== null) {
          studentSumPct += evalMark.percentage;
          const gr = getGradeForMark(evalMark.percentage, grades);
          studentSumPts += gr.points;
          validSubjCount++;
        } else if (evalMark.status === 'X') {
          hasX = true;
        } else if (evalMark.status === 'Y') {
          hasY = true;
        }
      });

      if (validSubjCount > 0) {
        const studentAvgPct = studentSumPct / validSubjCount;
        const studentAvgPts = studentSumPts / validSubjCount;

        if (studentAvgPct > maxMark) maxMark = studentAvgPct;
        if (studentAvgPct < minMark) minMark = studentAvgPct;

        sumMarks += studentAvgPct;
        sumPoints += studentAvgPts;
        evaluatedStudentsCount++;

        const studentGradeObj = getGradeForMark(studentAvgPct, grades);
        const code = studentGradeObj.grade_code || studentGradeObj.grade || 'ME1';
        if (levelCounts[code] !== undefined) {
          levelCounts[code]++;
        }
      } else if (hasX) {
        levelCounts.X++;
      } else if (hasY) {
        levelCounts.Y++;
      }
    });

    const classAveragePct = evaluatedStudentsCount > 0 ? sumMarks / evaluatedStudentsCount : 0;
    const overallGrade = evaluatedStudentsCount > 0 ? getGradeForMark(classAveragePct, grades) : null;
    const classAveragePoints = overallGrade?.points || 0;

    return {
      highestMark: evaluatedStudentsCount > 0 ? maxMark : 0,
      lowestMark: evaluatedStudentsCount > 0 ? minMark : 0,
      classAveragePct,
      classAveragePoints,
      overallLevelCode: overallGrade?.grade_code || overallGrade?.grade || '-',
      overallPerfLevel: overallGrade?.performance_level || 'Pending',
      overallDescriptor: overallGrade?.descriptor || (evaluatedStudentsCount > 0 ? 'Evaluated' : 'No Entry'),
      totalLearners: selectedStudents.length,
      completeLearnersCount: Math.min(selectedStudents.length, evaluatedStudentsCount),
      provisionalLearnersCount: Math.max(0, selectedStudents.length - Math.min(selectedStudents.length, evaluatedStudentsCount)),
      levelCounts,
    };
  }, [isSelectionComplete, activeExam, selectedStudents, learnerSubjects, markMap, grades]);

  // Comparison Data
  const comparisonData = useMemo(() => {
    if (comparisonType === 'None' || !isSelectionComplete || !activeExam) return null;

    let priorExam: Examination | null = null;
    if (comparisonType === 'Previous CAT') {
      priorExam = exams.find((ex) => ex.exam_type === 'CAT' && ex.id !== activeExam.id) || null;
    } else if (comparisonType === 'Previous Mid-Term') {
      priorExam = exams.find((ex) => ex.exam_type === 'Mid-Term' && ex.id !== activeExam.id) || null;
    } else if (comparisonType === 'Previous End-Term') {
      priorExam = exams.find((ex) => ex.exam_type === 'End-Term' && ex.id !== activeExam.id) || null;
    } else if (comparisonType === 'Previous Term') {
      priorExam = exams.find((ex) => ex.year === activeExam.year && ex.id !== activeExam.id) || null;
    } else if (comparisonType === 'Previous Academic Year') {
      priorExam = exams.find((ex) => ex.year === activeExam.year - 1) || null;
    }

    if (!priorExam) {
      return { found: false, message: `No historical assessment records found for "${comparisonType}".` };
    }

    let totalGains = 0;
    let totalLosses = 0;
    let countImproved = 0;
    let countDeclined = 0;
    let countUnchanged = 0;

    selectedStudents.forEach((std) => {
      let currPctSum = 0;
      let currCount = 0;
      learnerSubjects.forEach((sb) => {
        const m = markMap.get(`${std.id}_${sb.id}_${activeExam.id}`);
        const evalM = evaluateMark(m);
        if (evalM.status === 'Normal' && evalM.percentage !== null) {
          currPctSum += evalM.percentage;
          currCount++;
        }
      });
      const currAvg = currCount > 0 ? currPctSum / currCount : null;

      let priorPctSum = 0;
      let priorCount = 0;
      learnerSubjects.forEach((sb) => {
        const m = priorExam ? markMap.get(`${std.id}_${sb.id}_${priorExam.id}`) : undefined;
        const evalM = evaluateMark(m);
        if (evalM.status === 'Normal' && evalM.percentage !== null) {
          priorPctSum += evalM.percentage;
          priorCount++;
        }
      });
      const priorAvg = priorCount > 0 ? priorPctSum / priorCount : null;

      if (currAvg !== null && priorAvg !== null) {
        const diff = currAvg - priorAvg;
        if (diff > 0.05) {
          countImproved++;
          totalGains += diff;
        } else if (diff < -0.05) {
          countDeclined++;
          totalLosses += Math.abs(diff);
        } else {
          countUnchanged++;
        }
      }
    });

    return {
      found: true,
      priorExamName: `${priorExam.exam_name} (${priorExam.term} ${priorExam.year})`,
      countImproved,
      countDeclined,
      countUnchanged,
      avgImprovement: countImproved > 0 ? totalGains / countImproved : 0,
      avgDecline: countDeclined > 0 ? totalLosses / countDeclined : 0,
    };
  }, [comparisonType, isSelectionComplete, activeExam, exams, selectedStudents, learnerSubjects, markMap]);

  // Automated Examination Validation Checklist
  const validationResults = useMemo(() => {
    if (!isSelectionComplete || !activeExam) return null;

    const issues: { type: 'blocking' | 'warning' | 'info'; title: string; detail: string }[] = [];

    // Check 0: Active Learners in Cohort
    if (selectedStudents.length === 0) {
      issues.push({
        type: 'blocking',
        title: 'No Active Learners in Cohort',
        detail: 'No active learners found for the selected cohort. Cannot run analysis.',
      });
    }

    // Check 1: Required Learning Areas
    if (learnerSubjects.length === 0) {
      issues.push({
        type: 'blocking',
        title: 'Missing Required Learning Areas',
        detail: `No active subjects or learning areas found for ${selectedClassObject?.class_name || 'selected class'}.`,
      });
    }

    // Check 2: Teacher Allocations
    const matchingClassIds = classes
      .filter((c) => c.id === selectedClassId || c.class_name.toLowerCase() === selectedClassId.toLowerCase())
      .map((c) => c.id);

    const unallocatedSubjects = learnerSubjects.filter(
      (sb) =>
        !teachers.some((t) => {
          const assignedSubjects = getTeacherAssignedSubjectIds(t);
          const assignedClasses = getTeacherAssignedClassIds(t, classes);
          const matchesClass = assignedClasses.length === 0 || assignedClasses.some((cId) => matchingClassIds.includes(cId) || cId === selectedClassId);
          return assignedSubjects.includes(sb.id) && matchesClass;
        })
    );
    if (unallocatedSubjects.length > 0) {
      issues.push({
        type: 'warning',
        title: 'Unassigned Learning Areas',
        detail: `${unallocatedSubjects.length} subject(s) lack explicit teacher allocations (${unallocatedSubjects.map((s) => s.subject_code).join(', ')}).`,
      });
    }

    // Check 3: Assessment Range & Invalid Marks
    let invalidMarkCount = 0;
    marks.forEach((m) => {
      if (m.exam_id === activeExam.id) {
        const studentBelongs = selectedStudents.some((s) => s.id === m.student_id);
        const subjectBelongs = learnerSubjects.some((s) => s.id === m.subject_id);
        if (studentBelongs && subjectBelongs && (m.special_status === 'Normal' || !m.special_status)) {
          const val = m.raw_score !== undefined && m.raw_score !== null ? m.raw_score : m.marks;
          const max = activeExam.max_marks;
          const numVal = typeof val === 'number' ? val : (typeof val === 'string' && val.trim() !== '' ? Number(val) : NaN);
          if (isNaN(numVal) || numVal < 0 || numVal > max) {
            invalidMarkCount++;
          }
        }
      }
    });

    if (invalidMarkCount > 0) {
      issues.push({
        type: 'blocking',
        title: 'Invalid Mark Entries Detected',
        detail: `${invalidMarkCount} mark entry(ies) fall outside allowed boundaries (0–${activeExam.max_marks}).`,
      });
    }

    // Check 4: Duplicate Entries
    const seenMap = new Set<string>();
    let duplicateCount = 0;
    marks.forEach((m) => {
      if (m.exam_id === activeExam.id) {
        const studentBelongs = selectedStudents.some((s) => s.id === m.student_id);
        const subjectBelongs = learnerSubjects.some((s) => s.id === m.subject_id);
        if (studentBelongs && subjectBelongs) {
          const key = `${m.student_id}_${m.subject_id}`;
          if (seenMap.has(key)) duplicateCount++;
          else seenMap.add(key);
        }
      }
    });

    if (duplicateCount > 0) {
      issues.push({
        type: 'blocking',
        title: 'Duplicate Assessment Entries',
        detail: `Found ${duplicateCount} duplicate mark record(s) in the database.`,
      });
    }

    // Check 5: Missing Marks (X)
    let missingXCount = 0;
    subjectProgressList.forEach((sp) => { missingXCount += sp.missingX; });
    if (missingXCount > 0) {
      issues.push({
        type: 'warning',
        title: 'Missing Assessments (Status X)',
        detail: `Identified ${missingXCount} missing assessment record(s) flagged as 'X'.`,
      });
    }

    // Check 6: Irregularities (Y)
    let irregularityYCount = 0;
    subjectProgressList.forEach((sp) => { irregularityYCount += sp.irregularityY; });
    if (irregularityYCount > 0) {
      issues.push({
        type: 'warning',
        title: 'Assessment Irregularities (Status Y)',
        detail: `Identified ${irregularityYCount} irregularity record(s) flagged as 'Y'.`,
      });
    }

    // Check 7: Subject Completeness
    const incompleteSubjects = subjectProgressList.filter((sp) => !sp.isComplete100);
    if (incompleteSubjects.length > 0) {
      issues.push({
        type: 'warning',
        title: 'Incomplete Learning Area Entry',
        detail: `${incompleteSubjects.length} learning area(s) have uncompleted mark entries.`,
      });
    }

    // Check 8: Zero Marks Entered
    if (selectedStudents.length > 0 && learnerSubjects.length > 0) {
      const totalEntered = subjectProgressList.reduce((acc, sp) => acc + sp.completed, 0);
      if (totalEntered === 0) {
        issues.push({
          type: 'blocking',
          title: 'No Marks Entered',
          detail: 'No assessment marks have been entered for this cohort. Enter marks before running analysis and requesting approval.',
        });
      }
    }

    const blockingIssues = issues.filter((i) => i.type === 'blocking');
    const warningIssues = issues.filter((i) => i.type === 'warning');

    return {
      issues,
      blockingIssues,
      warningIssues,
      isReadyForApproval: blockingIssues.length === 0,
    };
  }, [isSelectionComplete, activeExam, learnerSubjects, selectedClassObject, teachers, selectedClassId, marks, selectedStudents, subjectProgressList]);

  // Initiate Examination Analysis Progress (1% -> 100%)
  const handleStartAnalysis = () => {
    if (!isSelectionComplete || !activeExam) {
      setToastMessage({
        type: 'warning',
        text: 'Please complete all filter selections before running assessment analysis.',
      });
      return;
    }
    if (selectedStudents.length === 0) {
      setToastMessage({
        type: 'warning',
        text: 'No active learners found for the selected cohort. Cannot run analysis.',
      });
      return;
    }

    setAnalysisState('running');
    setAnalysisProgress(0);
    setCurrentOperationIndex(0);
    setAnalysisRanForExamId(activeExam.id);

    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.floor(Math.random() * 12) + 8;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        setAnalysisProgress(100);
        setAnalysisState('complete');
        setCurrentOperationIndex(ANALYSIS_OPERATIONS.length - 1);

        setToastMessage({
          type: 'success',
          text: `✓ Assessment Analysis Complete for "${activeExam.exam_name}"! Review validation status below.`,
        });
        setTimeout(() => setToastMessage(null), 5000);
      } else {
        setAnalysisProgress(progress);
        const opIdx = Math.min(
          ANALYSIS_OPERATIONS.length - 1,
          Math.floor((progress / 100) * ANALYSIS_OPERATIONS.length)
        );
        setCurrentOperationIndex(opIdx);
      }
    }, 200);
  };

  // Term Permission
  const canModify = canApproveExams(activeTermObj.status);

  // Determine if currently selected level is approved
  const isCurrentLevelApproved = useMemo(() => {
    if (!activeExam) return false;
    if (activeExam.status === 'Approved') return true;
    if (selectedLevel) {
      return isLevelApproved(activeExam, selectedLevel);
    }
    return false;
  }, [activeExam, selectedLevel]);

  // Handle Official Level-Specific Approval Confirmation
  const handleConfirmLevelApproval = () => {
    if (!activeExam || !selectedLevel) return;
    if (currentUser?.role !== 'admin') {
      setShowApproveModal(false);
      setToastMessage({
        type: 'warning',
        text: 'UNAUTHORIZED: Only an Administrator can approve and lock official results.',
      });
      setTimeout(() => setToastMessage(null), 5000);
      return;
    }
    if (!canModify) {
      setShowApproveModal(false);
      setToastMessage({
        type: 'warning',
        text: getTermStatusMessage(activeTermObj.status),
      });
      setTimeout(() => setToastMessage(null), 5000);
      return;
    }

    if (onUpdateExamLevelApproval) {
      onUpdateExamLevelApproval(activeExam.id, selectedLevel as EducationLevel, true);
    } else {
      onUpdateExamStatus(activeExam.id, 'Approved');
    }
    setShowApproveModal(false);
    setToastMessage({
      type: 'success',
      text: `✓ Education Level [${selectedLevel}] for "${activeExam.exam_name}" has been OFFICIALLY APPROVED & LOCKED! Reports for ${selectedLevel} are now unlocked.`,
    });
    setTimeout(() => setToastMessage(null), 6000);
  };

  // Handle Level Re-open Confirmation
  const handleConfirmLevelReopen = () => {
    if (!activeExam || !selectedLevel) return;
    if (currentUser?.role !== 'admin') {
      setShowReopenModal(false);
      setToastMessage({
        type: 'warning',
        text: 'UNAUTHORIZED: Only an Administrator can reopen an approved assessment level.',
      });
      setTimeout(() => setToastMessage(null), 5000);
      return;
    }
    if (!canModify) {
      setShowReopenModal(false);
      setToastMessage({
        type: 'warning',
        text: getTermStatusMessage(activeTermObj.status),
      });
      setTimeout(() => setToastMessage(null), 5000);
      return;
    }

    if (onUpdateExamLevelApproval) {
      onUpdateExamLevelApproval(activeExam.id, selectedLevel as EducationLevel, false);
    } else {
      onUpdateExamStatus(activeExam.id, 'Draft');
    }
    setAnalysisState('idle');
    setAnalysisProgress(0);
    setAnalysisRanForExamId(null);
    setShowReopenModal(false);

    setToastMessage({
      type: 'info',
      text: `Education Level [${selectedLevel}] reopened for editing. Re-run analysis before re-approving.`,
    });
    setTimeout(() => setToastMessage(null), 5000);
  };

  // Handle Official Global Approval Confirmation
  const handleConfirmApproval = () => {
    if (!activeExam) return;
    if (currentUser?.role !== 'admin') {
      setShowApproveModal(false);
      setToastMessage({
        type: 'warning',
        text: 'UNAUTHORIZED: Only an Administrator can approve and lock official results.',
      });
      setTimeout(() => setToastMessage(null), 5000);
      return;
    }
    if (!canModify) {
      setShowApproveModal(false);
      setToastMessage({
        type: 'warning',
        text: getTermStatusMessage(activeTermObj.status),
      });
      setTimeout(() => setToastMessage(null), 5000);
      return;
    }
    onUpdateExamStatus(activeExam.id, 'Approved');
    setShowApproveModal(false);
    setToastMessage({
      type: 'success',
      text: `✓ Assessment "${activeExam.exam_name}" has been OFFICIALLY APPROVED & LOCKED across all education levels! Official reports and merit lists are now available.`,
    });
    setTimeout(() => setToastMessage(null), 6000);
  };

  // Handle Re-open Confirmation
  const handleConfirmReopen = () => {
    if (!activeExam) return;
    if (currentUser?.role !== 'admin') {
      setShowReopenModal(false);
      setToastMessage({
        type: 'warning',
        text: 'UNAUTHORIZED: Only an Administrator can reopen an approved assessment.',
      });
      setTimeout(() => setToastMessage(null), 5000);
      return;
    }
    if (!canModify) {
      setShowReopenModal(false);
      setToastMessage({
        type: 'warning',
        text: getTermStatusMessage(activeTermObj.status),
      });
      setTimeout(() => setToastMessage(null), 5000);
      return;
    }
    onUpdateExamStatus(activeExam.id, 'Draft');
    setAnalysisState('idle');
    setAnalysisProgress(0);
    setAnalysisRanForExamId(null);
    setShowReopenModal(false);

    setToastMessage({
      type: 'info',
      text: `Assessment "${activeExam.exam_name}" reopened for editing. Re-run analysis before re-approving.`,
    });
    setTimeout(() => setToastMessage(null), 5000);
  };

  // Handle Individual Class-Stream Approval by Admin
  const handleConfirmStreamApproval = async (targetStream: ClassStream) => {
    if (!activeExam) return;
    if (currentUser?.role !== 'admin') {
      setStreamToApprove(null);
      setToastMessage({
        type: 'warning',
        text: 'UNAUTHORIZED: Only an Administrator can approve class streams from this management panel.',
      });
      setTimeout(() => setToastMessage(null), 5000);
      return;
    }
    if (!canModify) {
      setStreamToApprove(null);
      setToastMessage({
        type: 'warning',
        text: getTermStatusMessage(activeTermObj.status),
      });
      setTimeout(() => setToastMessage(null), 5000);
      return;
    }

    const streamIdentifier = targetStream.stream_id || targetStream.id;
    try {
      if (onUpdateExamClassApproval) {
        await onUpdateExamClassApproval(activeExam.id, streamIdentifier, true);
      } else {
        await api.updateExaminationClassApproval(activeExam.id, streamIdentifier, true, currentUser);
        onMarksUpdated?.();
      }
      setStreamToApprove(null);
      setToastMessage({
        type: 'success',
        text: `✓ Results for ${targetStream.class_name} ${targetStream.stream} OFFICIALLY APPROVED & LOCKED.`,
      });
      setTimeout(() => setToastMessage(null), 5000);
    } catch (err: any) {
      console.error('Failed to approve class stream:', err);
      setStreamToApprove(null);
      setToastMessage({
        type: 'warning',
        text: err?.message || 'Failed to approve class stream.',
      });
      setTimeout(() => setToastMessage(null), 5000);
    }
  };

  // Handle Individual Class-Stream Reopen by Admin
  const handleConfirmStreamReopen = async (targetStream: ClassStream) => {
    if (!activeExam) return;
    if (currentUser?.role !== 'admin') {
      setStreamToReopen(null);
      setToastMessage({
        type: 'warning',
        text: 'UNAUTHORIZED: Only an Administrator can reopen an approved class stream.',
      });
      setTimeout(() => setToastMessage(null), 5000);
      return;
    }
    if (!canModify) {
      setStreamToReopen(null);
      setToastMessage({
        type: 'warning',
        text: getTermStatusMessage(activeTermObj.status),
      });
      setTimeout(() => setToastMessage(null), 5000);
      return;
    }

    const streamIdentifier = targetStream.stream_id || targetStream.id;
    try {
      if (onUpdateExamClassApproval) {
        await onUpdateExamClassApproval(activeExam.id, streamIdentifier, false);
      } else {
        await api.updateExaminationClassApproval(activeExam.id, streamIdentifier, false, currentUser);
        onMarksUpdated?.();
      }
      setStreamToReopen(null);
      setToastMessage({
        type: 'info',
        text: `Results for ${targetStream.class_name} ${targetStream.stream} reopened for editing.`,
      });
      setTimeout(() => setToastMessage(null), 5000);
    } catch (err: any) {
      console.error('Failed to reopen class stream:', err);
      setStreamToReopen(null);
      setToastMessage({
        type: 'warning',
        text: err?.message || 'Failed to reopen class stream.',
      });
      setTimeout(() => setToastMessage(null), 5000);
    }
  };

  // Helper to compute comprehensive stream readiness & approval stats
  const streamApprovalStats = useMemo(() => {
    return computeExamReadiness(activeExam, classes, students, subjects, marks, teachers);
  }, [classes, students, subjects, marks, teachers, activeExam]);

  return (
    <div className="space-y-6 pb-12">
      {/* Floating Brief Pop-up Toast: Examination Approval & Workflow */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-4 left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:right-6 sm:top-5 z-50 flex items-center bg-white/95 dark:bg-slate-900/95 text-slate-900 dark:text-slate-100 border border-slate-200/80 dark:border-slate-800/80 shadow-lg shadow-black/10 dark:shadow-black/30 rounded-2xl px-3.5 py-2 sm:px-4 sm:py-2.5 backdrop-blur-md space-x-2.5 max-w-[calc(100vw-2rem)] sm:max-w-md transition-all duration-300 animate-in fade-in slide-in-from-top-2"
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : toastMessage.type === 'warning' ? (
            <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-sky-500 dark:text-sky-400 shrink-0" />
          )}
          <span className="text-xs font-bold leading-tight truncate">{toastMessage.text}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="ml-1 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* TOP EXECUTIVE BANNER: CONDITIONAL RENDERING ACCORDING TO VIEW MODE */}
      {adminViewMode === 'analysis' ? (
        /* Analysis & Validation Mode Executive Banner */
        <div className="bg-[#075E42] dark:bg-emerald-950 text-white rounded-2xl p-5 sm:p-6 shadow-md border border-[#087F5B] dark:border-emerald-800 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/15 pb-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {activeExam ? (
                  <>
                    <span className="bg-white/20 text-white font-black px-3 py-1 rounded-full border border-white/30 uppercase tracking-wider text-[11px] flex items-center gap-1.5 shadow-xs">
                      <BookOpen className="w-3 h-3 text-emerald-200" />
                      <span>{activeExam.exam_name}</span>
                    </span>
                    <span className="bg-emerald-900/90 text-emerald-100 font-bold px-2.5 py-0.5 rounded-md border border-emerald-700/60 uppercase tracking-wider text-[10px]">
                      Type: {activeExam.exam_type ? (activeExam.exam_type === 'CAT' ? 'CAT / Continuous' : activeExam.exam_type) : 'Standard Assessment'}
                    </span>
                    <span className="bg-white/10 text-emerald-100 font-semibold px-2.5 py-0.5 rounded-md text-[11px]">
                      {activeExam.term} • {activeExam.year}
                    </span>
                    {selectedClassObject ? (
                      <span className="text-emerald-200 font-medium text-xs">
                        &bull; Scope: {selectedClassObject.class_name}
                        {selectedStreamId && selectedStreamId !== 'all'
                          ? ` (${availableStreams.find((s) => s.id === selectedStreamId)?.stream || ''})`
                          : ' (All Streams)'}
                      </span>
                    ) : (
                      <span className="text-emerald-200 font-medium text-xs">
                        &bull; Scope: Whole School (All Streams)
                      </span>
                    )}
                  </>
                ) : (
                  <span className="bg-rose-500/30 text-rose-100 font-bold px-3 py-1 rounded-full border border-rose-400/40 text-[11px]">
                    No Assessment Selected
                  </span>
                )}
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center space-x-2.5">
                  <Search className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-300 shrink-0" />
                  <span>Assessment Analysis &amp; Validation Gate</span>
                </h1>
                <p className="text-xs text-emerald-100/90 mt-1 max-w-2xl font-medium">
                  Verify assessment data integrity, detect anomalies, check score distributions, and ensure quality standards before results approval.
                </p>
              </div>
            </div>

            {/* Validation Workflow Status Badge */}
            {activeExam && (
              <div className="flex flex-wrap items-center gap-3 bg-black/20 p-3.5 rounded-xl border border-white/10 shrink-0">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-emerald-200 uppercase tracking-wider block">
                    Validation State
                  </span>
                  <span
                    className={`text-xs font-black uppercase tracking-wide px-3 py-1.5 rounded-lg inline-flex items-center space-x-1.5 ${
                      analysisState === 'running'
                        ? 'bg-amber-400 text-slate-950 shadow-sm animate-pulse'
                        : analysisState === 'complete' && validationResults?.blockingIssues.length === 0
                        ? 'bg-emerald-300 text-slate-950 font-bold'
                        : analysisState === 'complete' && validationResults?.blockingIssues.length > 0
                        ? 'bg-rose-400 text-slate-950 font-bold'
                        : 'bg-slate-200 text-slate-900 font-bold'
                    }`}
                  >
                    {analysisState === 'running' ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>ANALYSIS RUNNING ({analysisProgress}%)</span>
                      </>
                    ) : analysisState === 'complete' && validationResults?.blockingIssues.length === 0 ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>VALIDATION CHECKS PASSED</span>
                      </>
                    ) : analysisState === 'complete' && validationResults?.blockingIssues.length > 0 ? (
                      <>
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>VALIDATION ISSUES FOUND</span>
                      </>
                    ) : (
                      <>
                        <Info className="w-3.5 h-3.5" />
                        <span>READY FOR ANALYSIS</span>
                      </>
                    )}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Executive Quick Stats Dashboard */}
          {activeExam && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              <div className="bg-white/10 rounded-xl p-3.5 border border-white/15 space-y-0.5">
                <span className="text-[10px] font-bold text-emerald-200 uppercase tracking-wider block">Candidates Selected</span>
                <span className="text-base sm:text-lg font-extrabold text-white font-mono">{selectedStudents.length} Learners</span>
              </div>
              <div className="bg-white/10 rounded-xl p-3.5 border border-white/15 space-y-0.5">
                <span className="text-[10px] font-bold text-emerald-200 uppercase tracking-wider block">Analysis Status</span>
                <span className="text-base sm:text-lg font-extrabold text-white font-mono">
                  {analysisState === 'complete' ? '✓ Executed' : analysisState === 'running' ? `${analysisProgress}%` : 'Not Executed'}
                </span>
              </div>
              <div className="bg-white/10 rounded-xl p-3.5 border border-white/15 space-y-0.5">
                <span className="text-[10px] font-bold text-emerald-200 uppercase tracking-wider block">Blocking Issues</span>
                <span className={`text-base sm:text-lg font-extrabold font-mono ${validationResults?.blockingIssues.length ? 'text-rose-300' : 'text-emerald-300'}`}>
                  {validationResults ? `${validationResults.blockingIssues.length} Issues` : '0 Issues'}
                </span>
              </div>
              <div className="bg-white/10 rounded-xl p-3.5 border border-white/15 flex flex-col justify-center col-span-2 sm:col-span-1">
                <button
                  onClick={handleStartAnalysis}
                  disabled={analysisState === 'running'}
                  className="w-full bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 text-slate-950 font-black text-xs min-h-[44px] px-4 py-2.5 rounded-xl shadow transition flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  <Search className="w-4 h-4" />
                  <span>{analysisState === 'running' ? 'Analysing...' : 'Analyse Assessment'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Results Approval Mode Executive Banner */
        <div className="bg-[#075E42] dark:bg-emerald-950 text-white rounded-2xl p-5 sm:p-6 shadow-md border border-[#087F5B] dark:border-emerald-800 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/15 pb-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {activeExam ? (
                  <>
                    <span className="bg-white/20 text-white font-black px-3 py-1 rounded-full border border-white/30 uppercase tracking-wider text-[11px] flex items-center gap-1.5 shadow-xs">
                      <BookOpen className="w-3 h-3 text-emerald-200" />
                      <span>{activeExam.exam_name}</span>
                    </span>
                    <span className="bg-emerald-900/90 text-emerald-100 font-bold px-2.5 py-0.5 rounded-md border border-emerald-700/60 uppercase tracking-wider text-[10px]">
                      Type: {activeExam.exam_type ? (activeExam.exam_type === 'CAT' ? 'CAT / Continuous' : activeExam.exam_type) : 'Standard Assessment'}
                    </span>
                    <span className="bg-white/10 text-emerald-100 font-semibold px-2.5 py-0.5 rounded-md text-[11px]">
                      {activeExam.term} • {activeExam.year}
                    </span>
                    <span className="text-emerald-200 font-medium text-xs">
                      &bull; Target: All Streams ({streamApprovalStats.totalStreamsCount} Streams)
                    </span>
                  </>
                ) : (
                  <span className="bg-rose-500/30 text-rose-100 font-bold px-3 py-1 rounded-full border border-rose-400/40 text-[11px]">
                    No Assessment Selected
                  </span>
                )}
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center space-x-2.5">
                  <ShieldCheck className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-300 shrink-0" />
                  <span>Results Approval &amp; Stream Authorization Gate</span>
                </h1>
                <p className="text-xs text-emerald-100/90 mt-1 max-w-2xl font-medium">
                  Formally authorize stream results, review completion readiness, execute grade and level approvals, and lock the assessment.
                </p>
              </div>
            </div>

            {/* Approval Workflow / Lock Status Badge */}
            {activeExam && (
              <div className="flex flex-wrap items-center gap-3 bg-black/20 p-3.5 rounded-xl border border-white/10 shrink-0">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-emerald-200 uppercase tracking-wider block">
                    Lock &amp; Approval State
                  </span>
                  <span
                    className={`text-xs font-black uppercase tracking-wide px-3 py-1.5 rounded-lg inline-flex items-center space-x-1.5 ${
                      activeExam.status === 'Approved'
                        ? 'bg-emerald-400 text-slate-950 shadow-sm'
                        : activeExam.status === 'Provisional'
                        ? 'bg-amber-300 text-slate-950 shadow-sm'
                        : streamApprovalStats.incompleteStreamsCount === 0
                        ? 'bg-sky-300 text-slate-950 font-bold'
                        : 'bg-slate-200 text-slate-900 font-bold'
                    }`}
                  >
                    {activeExam.status === 'Approved' ? (
                      <>
                        <Lock className="w-3.5 h-3.5" />
                        <span>OFFICIALLY APPROVED &amp; LOCKED</span>
                      </>
                    ) : activeExam.status === 'Provisional' ? (
                      <>
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>PARTIALLY APPROVED ({streamApprovalStats.approvedStreamsCount}/{streamApprovalStats.totalStreamsCount})</span>
                      </>
                    ) : streamApprovalStats.incompleteStreamsCount === 0 ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>READY FOR FINAL APPROVAL</span>
                      </>
                    ) : (
                      <>
                        <Info className="w-3.5 h-3.5" />
                        <span>MARKS IN PROGRESS</span>
                      </>
                    )}
                  </span>
                </div>

                {activeExam.status === 'Approved' && currentUser?.role === 'admin' && (
                  <button
                    onClick={() => setShowReopenModal(true)}
                    className="text-xs bg-white/10 hover:bg-white/20 text-white px-3.5 py-2 rounded-lg font-bold transition flex items-center space-x-1.5 border border-white/20 cursor-pointer min-h-[44px]"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Re-open Assessment</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Results Approval Quick Stats Dashboard */}
          {activeExam && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              <div className="bg-white/10 rounded-xl p-3.5 border border-white/15 space-y-0.5">
                <span className="text-[10px] font-bold text-emerald-200 uppercase tracking-wider block">Active Streams</span>
                <span className="text-base sm:text-lg font-extrabold text-white font-mono">{streamApprovalStats.totalStreamsCount} Streams</span>
              </div>
              <div className="bg-white/10 rounded-xl p-3.5 border border-white/15 space-y-0.5">
                <span className="text-[10px] font-bold text-emerald-200 uppercase tracking-wider block">Approved &amp; Locked</span>
                <span className="text-base sm:text-lg font-extrabold text-emerald-300 font-mono">
                  {streamApprovalStats.approvedStreamsCount} of {streamApprovalStats.totalStreamsCount} (
                  {streamApprovalStats.totalStreamsCount > 0
                    ? Math.round((streamApprovalStats.approvedStreamsCount / streamApprovalStats.totalStreamsCount) * 100)
                    : 0}
                  %)
                </span>
              </div>
              <div className="bg-white/10 rounded-xl p-3.5 border border-white/15 space-y-0.5">
                <span className="text-[10px] font-bold text-emerald-200 uppercase tracking-wider block">Ready for Approval</span>
                <span className="text-base sm:text-lg font-extrabold text-sky-200 font-mono">
                  {streamApprovalStats.readyStreamsCount} Ready
                </span>
              </div>
              <div className="bg-white/10 rounded-xl p-3.5 border border-white/15 space-y-0.5">
                <span className="text-[10px] font-bold text-emerald-200 uppercase tracking-wider block">Incomplete / In Progress</span>
                <span className="text-base sm:text-lg font-extrabold text-amber-200 font-mono">
                  {streamApprovalStats.incompleteStreamsCount} Incomplete
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW 1: MANAGE CLASS-STREAM APPROVALS (ADMINISTRATOR VIEW) */}
      {adminViewMode === 'stream-approvals' && currentUser?.role === 'admin' ? (
        <div className="space-y-6">
          {/* Stream Approvals Executive Banner */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-[#D9E0E7] dark:border-slate-800 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#D9E0E7]/60 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-base sm:text-lg font-black text-[#1F2937] dark:text-slate-100 flex items-center space-x-2">
                  <ShieldCheck className="w-5 h-5 text-[#075E42] dark:text-emerald-400" />
                  <span>Class-Stream Examination Approval Management</span>
                </h2>
                <p className="text-xs text-[#667085] dark:text-slate-400 mt-0.5">
                  Authorize individual class streams independently. Approvals roll up automatically to Grade, Level, and Examination.
                </p>
              </div>

              {/* Filter by Education Level */}
              <div className="flex flex-wrap gap-1.5 items-center">
                {(['All', 'Pre-Primary', 'Lower Primary', 'Upper Primary', 'Junior School'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => setStreamFilterLevel(lvl)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-bold transition cursor-pointer ${
                      streamFilterLevel === lvl
                        ? 'bg-[#075E42] text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            {/* Formal Sign-Off Gate Orientation & Readiness Guide */}
            <div className="bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/70 rounded-xl p-4 text-xs text-emerald-950 dark:text-emerald-200 space-y-2">
              <div className="flex items-center space-x-2 font-bold text-emerald-900 dark:text-emerald-100">
                <ShieldCheck className="w-4 h-4 text-[#075E42] dark:text-emerald-400 shrink-0" />
                <span className="text-xs uppercase tracking-wide">Formal Sign-Off Gate — What Approval &amp; Locking Means</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 text-[11.5px] leading-relaxed text-emerald-900/90 dark:text-emerald-200/90">
                <div className="bg-white/60 dark:bg-slate-900/60 p-2.5 rounded-lg border border-emerald-100 dark:border-emerald-900/40 space-y-1">
                  <span className="font-extrabold text-[#075E42] dark:text-emerald-400 block">1. Prior Verification</span>
                  <span>Calculations, CBE levels, and learner mark rosters were audited during Analysis and Provisional Results.</span>
                </div>
                <div className="bg-white/60 dark:bg-slate-900/60 p-2.5 rounded-lg border border-emerald-100 dark:border-emerald-900/40 space-y-1">
                  <span className="font-extrabold text-[#075E42] dark:text-emerald-400 block">2. Approval &amp; Lock Action</span>
                  <span>Clicking <strong>Approve Stream</strong> freezes marks entry against further changes and unlocks official merit lists and reports.</span>
                </div>
                <div className="bg-white/60 dark:bg-slate-900/60 p-2.5 rounded-lg border border-emerald-100 dark:border-emerald-900/40 space-y-1">
                  <span className="font-extrabold text-[#075E42] dark:text-emerald-400 block">3. Rollup Hierarchy</span>
                  <span>Stream approvals aggregate into Grade, Education Level, and Whole-Assessment status automatically.</span>
                </div>
              </div>
            </div>

            {/* Target Assessment Being Monitored for Stream Approvals */}
            <div className="bg-slate-50 dark:bg-slate-800/80 rounded-xl p-4 border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Exam Selector Dropdown */}
                <div className="flex-1 min-w-[280px] space-y-1">
                  <label htmlFor="stream-approval-target-exam" className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#075E42] dark:text-emerald-400" />
                    <span>Target Assessment Monitored for Approval:</span>
                  </label>
                  <select
                    id="stream-approval-target-exam"
                    value={selectedExamId}
                    onChange={(e) => {
                      const newId = e.target.value;
                      setSelectedExamId(newId);
                      const ex = exams.find((x) => x.id === newId);
                      if (ex) {
                        if (ex.year) setSelectedYear(Number(ex.year));
                        if (ex.term) setSelectedTerm(ex.term);
                        if (ex.education_level) setSelectedLevel(ex.education_level as EducationLevel);
                      }
                    }}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-xs font-bold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#075E42] dark:focus:ring-emerald-500 cursor-pointer shadow-xs"
                  >
                    {exams.map((ex) => (
                      <option key={ex.id} value={ex.id}>
                        {ex.exam_name} • [{ex.exam_type || 'Exam'}] — {ex.term} {ex.year} ({ex.status || 'Active'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Prominent Assessment Type and Context Indicators */}
                {activeExam ? (
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {/* Assessment Type Badge */}
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800 text-xs font-black shadow-2xs">
                      <BookOpen className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                      <span className="uppercase tracking-wide">
                        Type: {activeExam.exam_type ? (activeExam.exam_type === 'CAT' ? 'CAT / Continuous' : activeExam.exam_type) : 'Standard Assessment'}
                      </span>
                    </div>

                    {/* Term & Year Badge */}
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs font-bold shadow-2xs">
                      <Clock className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                      <span>{activeExam.term} • {activeExam.year}</span>
                    </div>

                    {/* Examination Workflow / Lock Status Badge */}
                    <div
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border shadow-2xs ${
                        activeExam.status === 'Approved'
                          ? 'bg-emerald-600 text-white border-emerald-700'
                          : activeExam.status === 'Provisional'
                          ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-200 border-amber-300 dark:border-amber-700'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700'
                      }`}
                    >
                      {activeExam.status === 'Approved' ? (
                        <>
                          <Lock className="w-3.5 h-3.5" />
                          <span>Approved & Locked</span>
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Status: {activeExam.status || 'Active'}</span>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-800">
                    Please select an assessment to monitor stream approval
                  </div>
                )}
              </div>

              {/* Informational Subtext */}
              {activeExam && (
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-medium text-slate-600 dark:text-slate-400 border-t border-slate-200/80 dark:border-slate-700/80 pt-2">
                  <div className="flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>
                      Monitoring stream approval and mark completeness for <strong>{activeExam.exam_name}</strong> (<strong>{activeExam.exam_type ? (activeExam.exam_type === 'CAT' ? 'CAT / Continuous' : activeExam.exam_type) : 'Standard Assessment'}</strong> • {activeExam.term} {activeExam.year}).
                    </span>
                  </div>
                  <span className="text-[10px] font-bold bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                    Max Marks: {activeExam.max_marks || 100} pts
                  </span>
                </div>
              )}
            </div>

            {/* Overall Progress Stat Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="bg-[#F6F8FA] dark:bg-slate-800/60 p-3.5 rounded-xl border border-[#D9E0E7] dark:border-slate-700 space-y-1">
                <span className="text-[10px] font-bold text-[#667085] dark:text-slate-400 uppercase tracking-wider block">
                  Active Streams
                </span>
                <span className="text-xl font-extrabold text-[#1F2937] dark:text-slate-100 font-mono">
                  {streamApprovalStats.totalStreamsCount} Streams
                </span>
              </div>
              <div className="bg-[#F6F8FA] dark:bg-slate-800/60 p-3.5 rounded-xl border border-[#D9E0E7] dark:border-slate-700 space-y-1">
                <span className="text-[10px] font-bold text-[#667085] dark:text-slate-400 uppercase tracking-wider block">
                  Approved & Locked
                </span>
                <span className="text-xl font-extrabold text-[#075E42] dark:text-emerald-400 font-mono">
                  {streamApprovalStats.approvedStreamsCount} of {streamApprovalStats.totalStreamsCount} (
                  {streamApprovalStats.totalStreamsCount > 0
                    ? Math.round((streamApprovalStats.approvedStreamsCount / streamApprovalStats.totalStreamsCount) * 100)
                    : 0}
                  %)
                </span>
              </div>
              <div className="bg-[#F6F8FA] dark:bg-slate-800/60 p-3.5 rounded-xl border border-[#D9E0E7] dark:border-slate-700 space-y-1">
                <span className="text-[10px] font-bold text-[#667085] dark:text-slate-400 uppercase tracking-wider block">
                  Ready for Approval
                </span>
                <span className="text-xl font-extrabold text-sky-700 dark:text-sky-400 font-mono">
                  {streamApprovalStats.readyStreamsCount} Ready
                </span>
              </div>
              <div className="bg-[#F6F8FA] dark:bg-slate-800/60 p-3.5 rounded-xl border border-[#D9E0E7] dark:border-slate-700 space-y-1">
                <span className="text-[10px] font-bold text-[#667085] dark:text-slate-400 uppercase tracking-wider block">
                  Incomplete / In Progress
                </span>
                <span className="text-xl font-extrabold text-amber-700 dark:text-amber-400 font-mono">
                  {streamApprovalStats.incompleteStreamsCount} Incomplete
                </span>
              </div>
            </div>
          </div>

          {/* Grouped Level & Grade Stream Cards */}
          <div className="space-y-6">
            {(Object.values(streamApprovalStats.levelGroups) as LevelReadinessDetail[])
              .filter((lvlGrp) => streamFilterLevel === 'All' || lvlGrp.level === streamFilterLevel)
              .map((lvlGrp) => (
                <div
                  key={lvlGrp.level}
                  className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-[#D9E0E7] dark:border-slate-800 space-y-5"
                >
                  {/* Education Level Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#D9E0E7]/60 dark:border-slate-800 pb-3">
                    <div className="space-y-0.5">
                      <h3 className="text-base font-extrabold text-[#1F2937] dark:text-slate-100 flex items-center space-x-2">
                        <GraduationCap className="w-5 h-5 text-[#075E42] dark:text-emerald-400" />
                        <span>{lvlGrp.level}</span>
                      </h3>
                      <p className="text-xs text-[#667085] dark:text-slate-400">
                        {lvlGrp.totalStreams} Total Stream{lvlGrp.totalStreams === 1 ? '' : 's'} across {Object.keys(lvlGrp.grades).length} Grade{Object.keys(lvlGrp.grades).length === 1 ? '' : 's'}
                      </p>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span
                        className={`text-xs font-bold px-3 py-1 rounded-full inline-flex items-center space-x-1.5 ${
                          lvlGrp.isLevelApproved
                            ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            : lvlGrp.isLevelReady
                            ? 'bg-sky-100 dark:bg-sky-950/80 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800'
                            : 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                        }`}
                      >
                        {lvlGrp.isLevelApproved ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span>Level Fully Approved ({lvlGrp.approvedCount}/{lvlGrp.totalStreams})</span>
                          </>
                        ) : lvlGrp.isLevelReady ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                            <span>Level Ready for Approval ({lvlGrp.readyCount + lvlGrp.approvedCount}/{lvlGrp.totalStreams} Ready)</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                            <span>Level In Progress ({lvlGrp.readyCount} Ready, {lvlGrp.incompleteCount} Incomplete)</span>
                          </>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Level Incomplete Warning Banner */}
                  {lvlGrp.incompleteStreams.length > 0 && !lvlGrp.isLevelApproved && (
                    <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200/90 dark:border-amber-800/80 rounded-xl p-3.5 flex items-start space-x-3">
                      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                      <div className="space-y-1 text-xs text-amber-900 dark:text-amber-200">
                        <p className="font-extrabold text-amber-950 dark:text-amber-100">
                          {lvlGrp.level} is not fully ready for whole-level approval
                        </p>
                        <p className="text-[11px] text-amber-800 dark:text-amber-300">
                          {lvlGrp.approvedCount + lvlGrp.readyCount} of {lvlGrp.totalStreams} streams are ready. {lvlGrp.incompleteCount} stream{lvlGrp.incompleteCount === 1 ? '' : 's'} still {lvlGrp.incompleteCount === 1 ? 'has' : 'have'} incomplete marks:
                        </p>
                        <ul className="list-disc list-inside space-y-0.5 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                          {lvlGrp.incompleteStreams.map((st) => (
                            <li key={st.streamId}>
                              <span className="font-bold text-amber-950 dark:text-amber-100">{st.className} {st.streamName}</span> — {st.missingMarks} mark{st.missingMarks === 1 ? '' : 's'} missing {st.missingSubjects.length > 0 ? `(${st.missingSubjects.map(s => `${s.subjectName}: ${s.missingCount}`).join(', ')})` : ''}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* Grades within this Level */}
                  <div className="space-y-4">
                    {(Object.values(lvlGrp.grades) as GradeReadinessDetail[]).map((grd) => (
                      <div
                        key={grd.gradeName}
                        className="bg-[#F6F8FA] dark:bg-slate-800/40 rounded-xl p-4 border border-[#D9E0E7]/80 dark:border-slate-800 space-y-3"
                      >
                        {/* Grade Header */}
                        <div className="flex items-center justify-between border-b border-[#D9E0E7]/60 dark:border-slate-700/60 pb-2">
                          <span className="font-extrabold text-xs text-[#1F2937] dark:text-slate-200 uppercase tracking-wide">
                            {grd.gradeName}
                          </span>
                          <span
                            className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md ${
                              grd.isGradeApproved
                                ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                                : grd.isGradeReady
                                ? 'bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300'
                                : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                            }`}
                          >
                            {grd.isGradeApproved
                              ? '✓ Grade Fully Approved'
                              : grd.isGradeReady
                              ? `✓ Grade Ready (${grd.readyCount + grd.approvedCount}/${grd.totalStreams} Ready)`
                              : `⚠ Grade Incomplete (${grd.approvedCount} approved / ${grd.readyCount} ready / ${grd.incompleteCount} incomplete)`}
                          </span>
                        </div>

                        {/* Stream Rows */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {grd.streams.map((st) => (
                            <div
                              key={st.streamObj.stream_id || st.streamObj.id}
                              className="bg-white dark:bg-slate-900 rounded-xl p-3.5 border border-[#D9E0E7] dark:border-slate-700/80 shadow-xs flex flex-col justify-between space-y-3"
                            >
                              <div className="space-y-1.5">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <h4 className="text-xs font-black text-[#1F2937] dark:text-slate-100">
                                      {st.streamObj.class_name} {st.streamObj.stream}
                                    </h4>
                                    <p className="text-[11px] text-[#667085] dark:text-slate-400">
                                      Teacher: <span className="font-semibold text-[#1F2937] dark:text-slate-300">{st.teacherName}</span>
                                    </p>
                                  </div>

                                  <span
                                    className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0 flex items-center space-x-1 ${
                                      st.isApproved
                                        ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                        : st.isReady
                                        ? 'bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800'
                                        : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                                    }`}
                                  >
                                    {st.isApproved ? (
                                      <>
                                        <Lock className="w-3 h-3" />
                                        <span>Approved & Locked</span>
                                      </>
                                    ) : st.isReady ? (
                                      <>
                                        <CheckCircle2 className="w-3 h-3" />
                                        <span>Ready for Approval</span>
                                      </>
                                    ) : (
                                      <>
                                        <AlertTriangle className="w-3 h-3" />
                                        <span>Marks Incomplete</span>
                                      </>
                                    )}
                                  </span>
                                </div>

                                <div className="space-y-1 pt-1">
                                  <div className="flex justify-between text-[11px] font-semibold text-[#667085] dark:text-slate-400">
                                    <span>{st.totalLearners} Learners</span>
                                    <span>
                                      {st.enteredMarks}/{st.expectedMarks} Marks ({st.percentage}%)
                                    </span>
                                  </div>
                                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full transition-all duration-300 ${
                                        st.percentage >= 100
                                          ? 'bg-emerald-500'
                                          : st.percentage >= 80
                                          ? 'bg-amber-500'
                                          : 'bg-rose-500'
                                      }`}
                                      style={{ width: `${Math.min(100, st.percentage)}%` }}
                                    />
                                  </div>

                                  {/* Missing subjects breakdown */}
                                  {st.missingSubjects.length > 0 && (
                                    <div className="pt-1.5 flex flex-wrap gap-1">
                                      {st.missingSubjects.slice(0, 3).map((sub) => (
                                        <span
                                          key={sub.subjectId}
                                          className="text-[9px] font-bold bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/80 px-1.5 py-0.5 rounded"
                                        >
                                          {sub.subjectCode || sub.subjectName}: {sub.missingCount} missing
                                        </span>
                                      ))}
                                      {st.missingSubjects.length > 3 && (
                                        <span className="text-[9px] font-bold text-amber-700 dark:text-amber-400">
                                          +{st.missingSubjects.length - 3} more
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="pt-2 border-t border-[#D9E0E7]/60 dark:border-slate-800 flex items-center justify-between">
                                <span className="text-[10px] font-bold text-[#667085] dark:text-slate-400">
                                  {st.isReady ? '✓ 100% Complete' : `${st.missingMarks} marks missing`}
                                </span>

                                {st.isApproved ? (
                                  <button
                                    onClick={() => setStreamToReopen(st.streamObj)}
                                    className="text-[11px] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[#1F2937] dark:text-slate-200 font-bold px-3 py-1.5 rounded-lg border border-[#D9E0E7] dark:border-slate-700 transition cursor-pointer flex items-center space-x-1"
                                  >
                                    <RefreshCw className="w-3 h-3 text-amber-600" />
                                    <span>Re-open Stream</span>
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => setStreamToApprove(st.streamObj)}
                                    className={`text-[11px] font-bold px-3 py-1.5 rounded-lg shadow-xs transition cursor-pointer flex items-center space-x-1 ${
                                      st.isReady
                                        ? 'bg-[#075E42] hover:bg-[#087F5B] text-white'
                                        : 'bg-amber-600 hover:bg-amber-700 text-white'
                                    }`}
                                  >
                                    <Lock className="w-3 h-3" />
                                    <span>{st.isReady ? 'Approve Stream' : 'Approve Incomplete Stream'}</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </div>
      ) : (
        <>
          {/* Cohort & Parameter Selection Panel */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-[#D9E0E7] dark:border-slate-800 space-y-4">
        <div className="flex items-center space-x-2 text-[#1F2937] dark:text-slate-100 font-bold border-b border-[#D9E0E7]/60 dark:border-slate-800 pb-3">
          <Filter className="w-4 h-4 text-[#075E42] dark:text-emerald-400" />
          <span className="text-sm">Assessment & Cohort Parameters</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* 1. Education Level */}
          <div>
            <label className="block text-xs font-semibold text-[#1F2937] dark:text-slate-300 mb-1">
              Education Level <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedLevel}
              onChange={(e) => {
                const lvl = e.target.value as EducationLevel;
                setSelectedLevel(lvl);
                setSelectedClassId('');
                setSelectedStreamId('');
                setSelectedExamId('');
              }}
              className="w-full bg-[#F6F8FA] dark:bg-slate-800 border border-[#D9E0E7] dark:border-slate-700 text-[#1F2937] dark:text-slate-200 rounded-lg p-2.5 text-xs font-semibold focus:ring-2 focus:ring-[#075E42] dark:focus:ring-emerald-500 cursor-pointer"
            >
              <option value="">Select Level...</option>
              {ALL_EDUCATION_LEVELS.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {lvl}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Class */}
          <div>
            <label className={`block text-xs font-semibold mb-1 ${!selectedLevel ? 'text-slate-400 dark:text-slate-500' : 'text-[#1F2937] dark:text-slate-300'}`}>
              Class <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedLevel ? selectedClassId : ''}
              onChange={(e) => {
                const nextClass = e.target.value;
                setSelectedClassId(nextClass);
                setSelectedStreamId('');
                setSelectedExamId('');
              }}
              disabled={!selectedLevel}
              className={`w-full border rounded-lg p-2.5 text-xs font-semibold transition ${
                !selectedLevel
                  ? 'bg-slate-100 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-800 cursor-not-allowed opacity-75'
                  : 'bg-[#F6F8FA] dark:bg-slate-800 border-[#D9E0E7] dark:border-slate-700 text-[#1F2937] dark:text-slate-200 cursor-pointer focus:ring-2 focus:ring-[#075E42] dark:focus:ring-emerald-500'
              }`}
            >
              {!selectedLevel ? (
                <option value="">Select Level First...</option>
              ) : uniqueClasses.length === 0 ? (
                <option value="" disabled>No active classes for {selectedLevel}</option>
              ) : (
                <>
                  <option value="">Select Class...</option>
                  {uniqueClasses.map((className, idx) => (
                    <option key={`${className}_${idx}`} value={className}>
                      {className}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>

          {/* 3. Stream */}
          <div>
            <label className={`block text-xs font-semibold mb-1 ${(!selectedLevel || !selectedClassId) ? 'text-slate-400 dark:text-slate-500' : 'text-[#1F2937] dark:text-slate-300'}`}>
              Stream <span className="text-rose-500">*</span>
            </label>
            <select
              value={(selectedLevel && selectedClassId) ? selectedStreamId : ''}
              onChange={(e) => {
                setSelectedStreamId(e.target.value);
              }}
              disabled={!selectedLevel || !selectedClassId}
              className={`w-full border rounded-lg p-2.5 text-xs font-semibold transition ${
                (!selectedLevel || !selectedClassId)
                  ? 'bg-slate-100 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-800 cursor-not-allowed opacity-75'
                  : 'bg-[#F6F8FA] dark:bg-slate-800 border-[#D9E0E7] dark:border-slate-700 text-[#1F2937] dark:text-slate-200 cursor-pointer focus:ring-2 focus:ring-[#075E42] dark:focus:ring-emerald-500'
              }`}
            >
              {(!selectedLevel || !selectedClassId) ? (
                <option value="">Select Class First...</option>
              ) : (
                <>
                  <option value="">Select Stream...</option>
                  <option value="all">All Streams</option>
                  {availableStreams.map((c, idx) => (
                    <option key={`${c.stream_id || c.id}_${c.stream}_${idx}`} value={c.id}>
                      {c.stream}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>

          {/* 4. Academic Year */}
          <div>
            <label className={`block text-xs font-semibold mb-1 ${(!selectedLevel || !selectedClassId || !selectedStreamId) ? 'text-slate-400 dark:text-slate-500' : 'text-[#1F2937] dark:text-slate-300'}`}>
              Academic Year <span className="text-rose-500">*</span>
            </label>
            <select
              value={(selectedLevel && selectedClassId && selectedStreamId) ? selectedYear : ''}
              onChange={(e) => {
                const nextYear = e.target.value ? Number(e.target.value) : '';
                setSelectedYear(nextYear);
                const bestExamId = findMatchingExam(selectedLevel, selectedClassId, nextYear, selectedTerm);
                setSelectedExamId(bestExamId);
              }}
              disabled={!selectedLevel || !selectedClassId || !selectedStreamId}
              className={`w-full border rounded-lg p-2.5 text-xs font-semibold transition ${
                (!selectedLevel || !selectedClassId || !selectedStreamId)
                  ? 'bg-slate-100 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-800 cursor-not-allowed opacity-75'
                  : 'bg-[#F6F8FA] dark:bg-slate-800 border-[#D9E0E7] dark:border-slate-700 text-[#1F2937] dark:text-slate-200 cursor-pointer focus:ring-2 focus:ring-[#075E42] dark:focus:ring-emerald-500'
              }`}
            >
              {(!selectedLevel || !selectedClassId || !selectedStreamId) ? (
                <option value="">Select Stream First...</option>
              ) : (
                <>
                  <option value="">Select Year...</option>
                  {availableYears.map((yr, idx) => (
                    <option key={`${yr}_${idx}`} value={yr}>
                      {yr} {activeYearObj?.year === yr ? '(Active Session)' : ''}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>

          {/* 5. Term */}
          <div>
            <label className={`block text-xs font-semibold mb-1 ${(!selectedLevel || !selectedClassId || !selectedStreamId || !selectedYear) ? 'text-slate-400 dark:text-slate-500' : 'text-[#1F2937] dark:text-slate-300'}`}>
              Term <span className="text-rose-500">*</span>
            </label>
            <select
              value={(selectedLevel && selectedClassId && selectedStreamId && selectedYear) ? selectedTerm : ''}
              onChange={(e) => {
                const nextTerm = e.target.value;
                setSelectedTerm(nextTerm);
                const bestExamId = findMatchingExam(selectedLevel, selectedClassId, selectedYear, nextTerm);
                setSelectedExamId(bestExamId);
              }}
              disabled={!selectedLevel || !selectedClassId || !selectedStreamId || !selectedYear}
              className={`w-full border rounded-lg p-2.5 text-xs font-semibold transition ${
                (!selectedLevel || !selectedClassId || !selectedStreamId || !selectedYear)
                  ? 'bg-slate-100 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-800 cursor-not-allowed opacity-75'
                  : 'bg-[#F6F8FA] dark:bg-slate-800 border-[#D9E0E7] dark:border-slate-700 text-[#1F2937] dark:text-slate-200 cursor-pointer focus:ring-2 focus:ring-[#075E42] dark:focus:ring-emerald-500'
              }`}
            >
              {(!selectedLevel || !selectedClassId || !selectedStreamId || !selectedYear) ? (
                <option value="">Select Year First...</option>
              ) : (
                <>
                  <option value="">Select Term...</option>
                  {availableTerms.map((t, idx) => (
                    <option key={`${t}_${idx}`} value={t}>
                      {t} {activeTermObj?.term_name === t && activeYearObj?.year === selectedYear ? '(Active Session)' : ''}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>

          {/* 6. Assessment */}
          <div>
            <label className={`block text-xs font-semibold mb-1 ${(!selectedLevel || !selectedClassId || !selectedStreamId || !selectedYear || !selectedTerm) ? 'text-slate-400 dark:text-slate-500' : 'text-[#1F2937] dark:text-slate-300'}`}>
              Assessment <span className="text-rose-500">*</span>
            </label>
            <select
              value={(selectedLevel && selectedClassId && selectedStreamId && selectedYear && selectedTerm) ? selectedExamId : ''}
              onChange={(e) => {
                const nextExamId = e.target.value;
                setSelectedExamId(nextExamId);
                const ex = exams.find((x) => x.id === nextExamId);
                if (ex) {
                  if (ex.year) setSelectedYear(Number(ex.year));
                  if (ex.term) setSelectedTerm(ex.term);
                  if (ex.education_level) setSelectedLevel(ex.education_level as EducationLevel);
                }
              }}
              disabled={!selectedLevel || !selectedClassId || !selectedStreamId || !selectedYear || !selectedTerm || availableExams.length === 0}
              className={`w-full border rounded-lg p-2.5 text-xs font-semibold transition ${
                (!selectedLevel || !selectedClassId || !selectedStreamId || !selectedYear || !selectedTerm || availableExams.length === 0)
                  ? 'bg-slate-100 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-800 cursor-not-allowed opacity-75'
                  : 'bg-[#F6F8FA] dark:bg-slate-800 border-[#D9E0E7] dark:border-slate-700 text-[#1F2937] dark:text-slate-200 cursor-pointer focus:ring-2 focus:ring-[#075E42] dark:focus:ring-emerald-500'
              }`}
            >
              {(!selectedLevel || !selectedClassId || !selectedStreamId || !selectedYear || !selectedTerm) ? (
                <option value="">Select Term First...</option>
              ) : availableExams.length === 0 ? (
                <option value="" disabled>No assessment found</option>
              ) : (
                <>
                  <option value="">Select Assessment...</option>
                  {availableExams.map((ex, idx) => (
                    <option key={`${ex.id}_${idx}`} value={ex.id}>
                      {ex.exam_name} • [{ex.exam_type || 'Exam'}] [{ex.status}] {ex.year === activeYearObj?.year && ex.term === activeTermObj?.term_name ? '(Active Session)' : ''}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>
        </div>
      </div>

      {/* Unselected State Prompt */}
      {!isSelectionComplete && (
        <div className="bg-[#F6F8FA] dark:bg-slate-900/80 border border-[#D9E0E7] dark:border-slate-800 rounded-2xl p-8 text-center space-y-3">
          <div className="inline-flex p-3 bg-[#E8F5EF] dark:bg-emerald-950/60 text-[#075E42] dark:text-emerald-400 rounded-full">
            <Info className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-[#1F2937] dark:text-slate-100">Cohort & Assessment Selection Required</h2>
          <p className="text-xs text-[#667085] dark:text-slate-400 max-w-md mx-auto leading-relaxed">
            Please select the Education Level, Class, Year, Term, and Assessment above to initiate the 9-stage analysis and quality control validation.
          </p>
        </div>
      )}

      {/* Main Analysis Body */}
      {isSelectionComplete && activeExam && (
        isLoadingMarks ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-slate-200 dark:border-slate-800 shadow-xs">
            <LoadingIndicator minHeight="min-h-[300px]" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Prominent Empty Cohort Warning Banner */}
            {selectedStudents.length === 0 && (
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 rounded-2xl p-5 shadow-xs flex items-start space-x-3.5">
                <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                    No Active Learners Found
                  </h3>
                  <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed font-medium">
                    No active learners found for the selected cohort. Cannot run analysis.
                  </p>
                </div>
              </div>
            )}

            {/* 🔍 Analysis Execution & Progress Card */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 shadow-sm border border-[#D9E0E7] dark:border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#D9E0E7]/60 dark:border-slate-800 pb-3">
                <div>
                  <h2 className="text-base font-bold text-[#1F2937] dark:text-slate-100 flex items-center space-x-2">
                    <Search className="w-5 h-5 text-[#075E42] dark:text-emerald-400" />
                    <span>Assessment Quality-Control Analysis Engine</span>
                  </h2>
                  <p className="text-xs text-[#667085] dark:text-slate-400 mt-0.5">
                    Execute 9-stage validation algorithm to verify score boundaries, teacher allocations, anomalies, and grade distributions.
                  </p>
                </div>

                <div className="flex items-center space-x-3 shrink-0">
                  <button
                    onClick={handleStartAnalysis}
                    disabled={analysisState === 'running'}
                    className="bg-[#075E42] hover:bg-[#087F5B] disabled:opacity-50 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl shadow-sm transition flex items-center space-x-2 cursor-pointer"
                  >
                    {analysisState === 'running' ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Analysing Assessment...</span>
                      </>
                    ) : (
                      <>
                        <Search className="w-4 h-4" />
                        <span>{analysisState === 'complete' ? 'Re-run Quality Analysis' : '🔍 Analyse Assessment'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Analysis Progress Display */}
              {(analysisState === 'running' || analysisState === 'complete') && (
                <div className="bg-[#F6F8FA] dark:bg-slate-800/60 p-4 rounded-xl border border-[#D9E0E7] dark:border-slate-700/80 space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-[#1F2937] dark:text-slate-200">
                    <span className="flex items-center space-x-2">
                      {analysisState === 'running' && <RefreshCw className="w-3.5 h-3.5 text-[#075E42] dark:text-emerald-400 animate-spin" />}
                      {analysisState === 'complete' && <CheckCircle2 className="w-3.5 h-3.5 text-[#075E42] dark:text-emerald-400" />}
                      <span>{ANALYSIS_OPERATIONS[currentOperationIndex]}</span>
                    </span>
                    <span className="font-mono text-[#075E42] dark:text-emerald-400 font-black text-sm">{analysisProgress}%</span>
                  </div>

                  <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-3 overflow-hidden p-0.5">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        analysisState === 'complete' ? 'bg-[#075E42] dark:bg-emerald-500' : 'bg-[#087F5B] dark:bg-emerald-600 animate-pulse'
                      }`}
                      style={{ width: `${analysisProgress}%` }}
                    />
                  </div>

                  <div className="flex justify-between text-[11px] text-[#667085] dark:text-slate-400">
                    <span>{analysisState === 'complete' ? '✓ 9 of 9 Operations Completed' : `Step ${currentOperationIndex + 1} of 9`}</span>
                    <span>{analysisState === 'complete' ? 'Quality validation checks complete' : 'Processing assessment dataset...'}</span>
                  </div>
                </div>
              )}
            </div>

          {/* 1. Streamlined Entry Validation Gate Banner */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 shadow-sm border border-[#D9E0E7] dark:border-slate-800">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-3 min-w-0">
                <div className={`p-2.5 rounded-xl flex-shrink-0 ${
                  overallProgressStats.overallCompletionPercentage >= 100
                    ? 'bg-emerald-100 dark:bg-emerald-950/80 text-[#075E42] dark:text-emerald-400'
                    : 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-400'
                }`}>
                  {overallProgressStats.overallCompletionPercentage >= 100 ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                    <span className="text-sm font-bold text-[#1F2937] dark:text-slate-100">
                      Mark Entry Gate:
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs font-black font-mono ${
                      overallProgressStats.overallCompletionPercentage >= 100
                        ? 'bg-emerald-100 dark:bg-emerald-950 text-[#075E42] dark:text-emerald-300'
                        : 'bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300'
                    }`}>
                      {overallProgressStats.overallCompletionPercentage.toFixed(1)}% COMPLETE
                    </span>
                  </div>
                  <p className="text-xs text-[#667085] dark:text-slate-400 mt-0.5">
                    {overallProgressStats.overallCompletionPercentage >= 100
                      ? `All ${overallProgressStats.completedRecords} learner record entries verified for analysis gate.`
                      : `${overallProgressStats.provisionalRecords} learner entry/entries pending (${overallProgressStats.completedRecords} complete, ${overallProgressStats.totalMissingX + overallProgressStats.totalIrregularityY} X/Y flags).`}
                  </p>
                </div>
              </div>

              {onNavigateToTab && (
                <button
                  onClick={() => onNavigateToTab('marks-monitoring')}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#E8F5EF] hover:bg-[#D3EBE0] dark:bg-emerald-950/80 dark:hover:bg-emerald-900/80 text-[#075E42] dark:text-emerald-300 transition-colors flex-shrink-0 self-stretch sm:self-auto justify-center"
                >
                  <span>Open Marks Monitoring</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* 2. Examination Statistics & Grade Distribution */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 shadow-sm border border-[#D9E0E7] dark:border-slate-800 space-y-5">
            <div className="flex items-center space-x-2 text-[#1F2937] dark:text-slate-100 font-bold border-b border-[#D9E0E7]/60 dark:border-slate-800 pb-3">
              <Award className="w-5 h-5 text-[#075E42] dark:text-emerald-400" />
              <h2 className="text-base">Assessment Statistics & Grade Distribution</h2>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
              <div className="bg-[#F6F8FA] dark:bg-slate-800/60 border border-[#D9E0E7] dark:border-slate-700/80 p-3.5 rounded-xl space-y-1">
                <span className="text-[10px] font-bold text-[#667085] dark:text-slate-400 uppercase block">Highest Mark</span>
                <span className="text-xl font-black text-emerald-700 dark:text-emerald-400 font-mono">{Math.round(examStatistics.highestMark)}%</span>
              </div>
              <div className="bg-[#F6F8FA] dark:bg-slate-800/60 border border-[#D9E0E7] dark:border-slate-700/80 p-3.5 rounded-xl space-y-1">
                <span className="text-[10px] font-bold text-[#667085] dark:text-slate-400 uppercase block">Lowest Mark</span>
                <span className="text-xl font-black text-rose-700 dark:text-rose-400 font-mono">{Math.round(examStatistics.lowestMark)}%</span>
              </div>
              <div className="bg-[#F6F8FA] dark:bg-slate-800/60 border border-[#D9E0E7] dark:border-slate-700/80 p-3.5 rounded-xl space-y-1">
                <span className="text-[10px] font-bold text-[#667085] dark:text-slate-400 uppercase block">Class Average</span>
                <span className="text-xl font-black text-[#075E42] dark:text-emerald-400 font-mono">{Math.round(examStatistics.classAveragePct)}%</span>
              </div>
              <div className="bg-[#F6F8FA] dark:bg-slate-800/60 border border-[#D9E0E7] dark:border-slate-700/80 p-3.5 rounded-xl space-y-1">
                <span className="text-[10px] font-bold text-[#667085] dark:text-slate-400 uppercase block">Average Points</span>
                <span className="text-xl font-black text-emerald-800 dark:text-emerald-300 font-mono">{examStatistics.classAveragePoints.toFixed(2)} Pts</span>
              </div>
              <div className="bg-[#F6F8FA] dark:bg-slate-800/60 border border-[#D9E0E7] dark:border-slate-700/80 p-3.5 rounded-xl space-y-1 col-span-2 sm:col-span-1">
                <span className="text-[10px] font-bold text-[#667085] dark:text-slate-400 uppercase block">Performance Level</span>
                <div className="flex items-baseline space-x-1">
                  <span className="text-xl font-black text-[#075E42] dark:text-emerald-400">{examStatistics.overallLevelCode}</span>
                  <span className="text-xs text-[#667085] dark:text-slate-400 font-medium truncate">({examStatistics.overallPerfLevel})</span>
                </div>
              </div>
            </div>

            {/* Performance Level Breakdown Grid */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-[#1F2937] dark:text-slate-200 uppercase tracking-wider block">
                Performance Level Breakdown (Learner Count)
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-2">
                {[
                  { code: 'EE1', label: 'Exceeding 1', color: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800/60' },
                  { code: 'EE2', label: 'Exceeding 2', color: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800/60' },
                  { code: 'ME1', label: 'Meeting 1', color: 'bg-teal-50 dark:bg-teal-950/60 text-teal-900 dark:text-teal-200 border-teal-200 dark:border-teal-800/60' },
                  { code: 'ME2', label: 'Meeting 2', color: 'bg-teal-50 dark:bg-teal-950/60 text-teal-900 dark:text-teal-200 border-teal-200 dark:border-teal-800/60' },
                  { code: 'AE1', label: 'Approaching 1', color: 'bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-800/60' },
                  { code: 'AE2', label: 'Approaching 2', color: 'bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border-amber-200 dark:border-amber-800/60' },
                  { code: 'BE1', label: 'Below 1', color: 'bg-rose-50 dark:bg-rose-950/60 text-rose-900 dark:text-rose-200 border-rose-200 dark:border-rose-800/60' },
                  { code: 'BE2', label: 'Below 2', color: 'bg-rose-50 dark:bg-rose-950/60 text-rose-900 dark:text-rose-200 border-rose-200 dark:border-rose-800/60' },
                  { code: 'X', label: 'Missing', color: 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700' },
                  { code: 'Y', label: 'Irregularity', color: 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700' },
                ].map((item) => (
                  <div key={item.code} className={`p-2.5 rounded-xl border text-center space-y-0.5 ${item.color}`}>
                    <span className="text-[10px] font-extrabold uppercase block tracking-wider">{item.code}</span>
                    <span className="text-lg font-black font-mono block">{examStatistics.levelCounts[item.code] || 0}</span>
                    <span className="text-[9px] opacity-75 font-medium truncate block">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 3. Validation Status & Detected Issues */}
          {validationResults && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 shadow-sm border border-[#D9E0E7] dark:border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#D9E0E7]/60 dark:border-slate-800 pb-3">
                <div>
                  <h2 className="text-base font-bold text-[#1F2937] dark:text-slate-100 flex items-center space-x-2">
                    <ShieldCheck className="w-5 h-5 text-[#075E42] dark:text-emerald-400" />
                    <span>Validation Status & Quality Checks</span>
                  </h2>
                </div>
              </div>

              {/* Status Metric Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-[#F6F8FA] dark:bg-slate-800/60 border border-[#D9E0E7] dark:border-slate-700/80 p-3.5 rounded-xl">
                  <span className="text-[10px] font-bold text-[#667085] dark:text-slate-400 uppercase block">Validation Passed</span>
                  <span className="text-lg font-black text-emerald-700 dark:text-emerald-400 font-mono">
                    {validationResults.isReadyForApproval ? 'Yes ✓' : 'No ✕'}
                  </span>
                </div>
                <div className="bg-[#F6F8FA] dark:bg-slate-800/60 border border-[#D9E0E7] dark:border-slate-700/80 p-3.5 rounded-xl">
                  <span className="text-[10px] font-bold text-[#667085] dark:text-slate-400 uppercase block">Blocking Issues</span>
                  <span className={`text-lg font-black font-mono ${validationResults.blockingIssues.length > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                    {validationResults.blockingIssues.length}
                  </span>
                </div>
                <div className="bg-[#F6F8FA] dark:bg-slate-800/60 border border-[#D9E0E7] dark:border-slate-700/80 p-3.5 rounded-xl">
                  <span className="text-[10px] font-bold text-[#667085] dark:text-slate-400 uppercase block">Warnings & Irregularities</span>
                  <span className="text-lg font-black text-amber-700 dark:text-amber-400 font-mono">
                    {validationResults.warningIssues.length}
                  </span>
                </div>
              </div>

              {/* Issue Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {validationResults.issues.length === 0 ? (
                  <div className="col-span-2 bg-[#E8F5EF] dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800 rounded-xl p-4 text-[#075E42] dark:text-emerald-300 flex items-center space-x-3 font-semibold">
                    <CheckCircle2 className="w-5 h-5 text-[#075E42] dark:text-emerald-400 shrink-0" />
                    <span>
                      All required learning areas, mark boundaries, teacher allocations, and record structures passed automated verification cleanly.
                    </span>
                  </div>
                ) : (
                  validationResults.issues.map((iss, idx) => (
                    <div
                      key={idx}
                      className={`p-3.5 rounded-xl border flex items-start space-x-3 ${
                        iss.type === 'blocking'
                          ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800/60 text-rose-950 dark:text-rose-200'
                          : iss.type === 'warning'
                          ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800/60 text-amber-950 dark:text-amber-200'
                          : 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800/60 text-blue-950 dark:text-blue-200'
                      }`}
                    >
                      {iss.type === 'blocking' ? (
                        <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <span className="font-bold block text-sm">{iss.title}</span>
                        <p className="text-xs mt-0.5 opacity-90">{iss.detail}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 4. Quality Control & Workflow Transition Gate Card */}
          {activeExam && (
            <div
              className={`rounded-2xl p-5 sm:p-6 shadow-sm border space-y-4 transition ${
                analysisState === 'complete' && validationResults?.isReadyForApproval
                  ? 'bg-[#E8F5EF] dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-[#1F2937] dark:text-slate-100'
                  : analysisState === 'complete' && !validationResults?.isReadyForApproval
                  ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-[#1F2937] dark:text-slate-100'
                  : 'bg-[#F6F8FA] dark:bg-slate-900 border-[#D9E0E7] dark:border-slate-800 text-[#1F2937] dark:text-slate-100'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-2">
                  {analysisState === 'complete' && validationResults?.isReadyForApproval ? (
                    <div className="flex items-center space-x-2 text-[#075E42] dark:text-emerald-400 font-black text-lg">
                      <CheckCircle2 className="w-5 h-5 text-[#075E42] dark:text-emerald-400 shrink-0" />
                      <span>✓ Assessment Validation Passed — Ready for Provisional Review &amp; Approval</span>
                    </div>
                  ) : analysisState === 'complete' && !validationResults?.isReadyForApproval ? (
                    <div className="flex items-center space-x-2 text-rose-800 dark:text-rose-300 font-black text-lg">
                      <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
                      <span>Blocking Validation Issues Detected — Resolution Required</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2 text-slate-800 dark:text-slate-200 font-black text-lg">
                      <Info className="w-5 h-5 text-[#075E42] dark:text-emerald-400 shrink-0" />
                      <span>Quality Control Validation Pending Execution</span>
                    </div>
                  )}

                  <p className="text-xs text-[#667085] dark:text-slate-400 max-w-2xl font-medium leading-relaxed">
                    {analysisState === 'complete' && validationResults?.isReadyForApproval
                      ? 'All required learning areas, score boundaries, and calculation integrity checks passed with 0 blocking issues. Results are validated and ready for learner-level provisional inspection and administrative results approval.'
                      : analysisState === 'complete' && !validationResults?.isReadyForApproval
                      ? 'Please resolve all blocking anomalies and mark entry errors before proceeding to results approval.'
                      : 'Click "Analyse Assessment" above to run automated quality control checks, audit score distributions, and verify data consistency.'}
                  </p>

                  {analysisState === 'complete' && validationResults && !validationResults.isReadyForApproval && (
                    <div className="bg-rose-100/70 dark:bg-rose-950/80 p-3 rounded-xl border border-rose-300 dark:border-rose-800 text-xs text-rose-900 dark:text-rose-200 space-y-1 mt-2">
                      <span className="font-bold block text-rose-950 dark:text-rose-100">Outstanding Blocking Issues:</span>
                      <ul className="list-disc list-inside space-y-0.5">
                        {validationResults.blockingIssues.map((iss, i) => (
                          <li key={i}>{iss.detail}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Validation Status Indicator */}
                <div className="shrink-0">
                  {analysisState === 'complete' && validationResults?.isReadyForApproval ? (
                    <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700 text-xs font-black">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>READY FOR REVIEW</span>
                    </div>
                  ) : analysisState === 'complete' && !validationResults?.isReadyForApproval ? (
                    <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-100 dark:bg-rose-950 text-rose-900 dark:text-rose-200 border border-rose-300 dark:border-rose-700 text-xs font-black">
                      <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                      <span>{validationResults.blockingIssues.length} BLOCKING ISSUE(S)</span>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 text-xs font-bold">
                      <Info className="w-4 h-4 text-slate-500" />
                      <span>ANALYSIS NOT RUN</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Next Step Workflow Actions */}
              <div className="border-t border-[#D9E0E7]/80 dark:border-slate-800 pt-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                <span className="text-[#667085] dark:text-slate-400 font-bold">Recommended Workflow Next Steps:</span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => onNavigateToTab?.('marks-entry')}
                    className="bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-[#1F2937] dark:text-slate-200 border border-[#D9E0E7] dark:border-slate-700 px-3.5 py-2 rounded-lg font-semibold transition flex items-center space-x-1.5 cursor-pointer min-h-[40px]"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-[#667085] dark:text-slate-400" />
                    <span>Marks Entry Grid</span>
                  </button>
                  <button
                    onClick={() => onNavigateToTab?.('marks-monitoring')}
                    className="bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-[#1F2937] dark:text-slate-200 border border-[#D9E0E7] dark:border-slate-700 px-3.5 py-2 rounded-lg font-semibold transition flex items-center space-x-1.5 cursor-pointer min-h-[40px]"
                  >
                    <Eye className="w-3.5 h-3.5 text-[#667085] dark:text-slate-400" />
                    <span>Marks Monitoring</span>
                  </button>
                  <button
                    onClick={() => onNavigateToTab?.('provisional')}
                    className="bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-[#1F2937] dark:text-slate-200 border border-[#D9E0E7] dark:border-slate-700 px-3.5 py-2 rounded-lg font-semibold transition flex items-center space-x-1.5 cursor-pointer min-h-[40px]"
                  >
                    <CheckSquare className="w-3.5 h-3.5 text-[#075E42] dark:text-emerald-400" />
                    <span>Provisional Results Verification</span>
                  </button>
                  {currentUser?.role === 'admin' && (
                    <button
                      onClick={() => onNavigateToTab?.('results-approval')}
                      className={`px-4 py-2 rounded-lg font-bold transition flex items-center space-x-1.5 min-h-[40px] shadow-sm ${
                        analysisState === 'complete' && validationResults?.isReadyForApproval
                          ? 'bg-[#075E42] hover:bg-[#087F5B] text-white cursor-pointer'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer'
                      }`}
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Proceed to Results Approval</span>
                      <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )
    )}
  </>
)}

      {/* APPROVE & LOCK CONFIRMATION MODAL */}
      {showApproveModal && activeExam && (() => {
        const targetLevelReadiness = selectedLevel ? streamApprovalStats.levelGroups[selectedLevel] : null;
        const incompleteStreamsInScope = targetLevelReadiness
          ? targetLevelReadiness.incompleteStreams
          : streamApprovalStats.allIncompleteStreams;

        return (
          <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#D9E0E7] dark:border-slate-800 space-y-5 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center space-x-3 text-[#075E42] dark:text-emerald-400 border-b border-[#D9E0E7]/60 dark:border-slate-800 pb-3">
                <div className="p-2.5 bg-[#E8F5EF] dark:bg-emerald-950/80 rounded-xl">
                  <ShieldCheck className="w-6 h-6 text-[#075E42] dark:text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-[#1F2937] dark:text-slate-100">
                    {selectedLevel ? `Approve & Lock ${selectedLevel}?` : 'Approve and Lock Assessment?'}
                  </h3>
                  <p className="text-xs text-[#667085] dark:text-slate-400 font-medium">
                    {selectedLevel ? `Official Administrative Sign-Off for ${selectedLevel}` : 'Official Administrative Sign-Off for All Levels'}
                  </p>
                </div>
              </div>

              <div className="space-y-3 text-xs text-[#1F2937] dark:text-slate-200">
                <p className="leading-relaxed text-[#667085] dark:text-slate-400">
                  {selectedLevel
                    ? `This will officially approve and lock results specifically for ${selectedLevel}. Teachers will no longer be able to modify marks for ${selectedLevel}, while other education levels remain editable.`
                    : 'This will officially approve the assessment and lock its results across all levels. Marks and analysis data can no longer be edited until reopened by an administrator.'}
                </p>

                {incompleteStreamsInScope.length > 0 ? (
                  <div className="bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700/80 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center space-x-2 text-amber-900 dark:text-amber-200 font-extrabold text-xs">
                      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span>Warning: {selectedLevel || 'Assessment'} is not fully ready for approval</span>
                    </div>
                    <p className="text-[11px] text-amber-800 dark:text-amber-300">
                      {incompleteStreamsInScope.length} stream{incompleteStreamsInScope.length === 1 ? '' : 's'} still {incompleteStreamsInScope.length === 1 ? 'has' : 'have'} incomplete marks:
                    </p>
                    <ul className="list-disc list-inside space-y-0.5 text-[11px] text-amber-800 dark:text-amber-300 font-medium max-h-28 overflow-y-auto">
                      {incompleteStreamsInScope.map((st) => (
                        <li key={st.streamId}>
                          <span className="font-bold text-amber-950 dark:text-amber-100">{st.className} {st.streamName}</span> — {st.missingMarks} mark{st.missingMarks === 1 ? '' : 's'} missing {st.missingSubjects.length > 0 ? `(${st.missingSubjects.map(s => `${s.subjectName}: ${s.missingCount}`).join(', ')})` : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-700/80 rounded-xl p-3 flex items-center space-x-2 text-emerald-900 dark:text-emerald-200 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>All streams in {selectedLevel || 'assessment'} are 100% complete and ready for approval.</span>
                  </div>
                )}

                <div className="bg-[#F6F8FA] dark:bg-slate-800/60 p-3.5 rounded-xl border border-[#D9E0E7] dark:border-slate-700/80 space-y-1.5">
                  <div className="flex justify-between font-semibold">
                    <span className="text-[#667085] dark:text-slate-400">Assessment:</span>
                    <span className="font-bold text-[#1F2937] dark:text-slate-200">{activeExam.exam_name}</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span className="text-[#667085] dark:text-slate-400">Target Level:</span>
                    <span className="font-bold text-[#1F2937] dark:text-slate-200">{selectedLevel || 'All Education Levels (Global)'}</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span className="text-[#667085] dark:text-slate-400">Cohort / Candidates:</span>
                    <span className="font-bold text-[#1F2937] dark:text-slate-200">{selectedStudents.length} Learners</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span className="text-[#667085] dark:text-slate-400">Readiness Status:</span>
                    <span className={`font-extrabold ${incompleteStreamsInScope.length === 0 ? 'text-[#075E42] dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
                      {incompleteStreamsInScope.length === 0 ? '✓ Ready (0 Incomplete Streams)' : `⚠ ${incompleteStreamsInScope.length} Stream(s) Incomplete`}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  onClick={() => setShowApproveModal(false)}
                  className="px-4 py-2.5 rounded-xl font-bold text-xs text-[#667085] dark:text-slate-400 hover:text-[#1F2937] dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={selectedLevel ? handleConfirmLevelApproval : handleConfirmApproval}
                  className={`px-5 py-2.5 rounded-xl font-black text-xs text-white shadow-md transition flex items-center space-x-1.5 cursor-pointer ${
                    incompleteStreamsInScope.length > 0
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-[#075E42] hover:bg-[#087F5B]'
                  }`}
                >
                  <Lock className="w-4 h-4" />
                  <span>{selectedLevel ? `Lock ${selectedLevel} Results` : 'Approve & Lock All Levels'}</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* RE-OPEN CONFIRMATION MODAL */}
      {showReopenModal && activeExam && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#D9E0E7] dark:border-slate-800 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center space-x-3 text-amber-700 dark:text-amber-400 border-b border-[#D9E0E7]/60 dark:border-slate-800 pb-3">
              <div className="p-2.5 bg-amber-50 dark:bg-amber-950/80 rounded-xl">
                <RefreshCw className="w-6 h-6 text-amber-700 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-[#1F2937] dark:text-slate-100">
                  {selectedLevel ? `Re-open ${selectedLevel} for Editing?` : 'Re-open Assessment for Editing?'}
                </h3>
                <p className="text-xs text-[#667085] dark:text-slate-400 font-medium">Revert Lock Status</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-[#1F2937] dark:text-slate-200">
              <p className="leading-relaxed text-[#667085] dark:text-slate-400 font-semibold">
                {selectedLevel
                  ? `Reopening ${selectedLevel} will allow authorised teachers to modify marks for ${selectedLevel} classes again. Continue?`
                  : 'Reopening this approved assessment will allow authorised users to modify marks again across all classes. Continue?'}
              </p>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setShowReopenModal(false)}
                className="px-4 py-2.5 rounded-xl font-bold text-xs text-[#667085] dark:text-slate-400 hover:text-[#1F2937] dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={selectedLevel && activeExam.status !== 'Approved' ? handleConfirmLevelReopen : handleConfirmReopen}
                className="px-5 py-2.5 rounded-xl font-black text-xs bg-amber-600 hover:bg-amber-700 text-white shadow-md transition flex items-center space-x-1.5 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>{selectedLevel ? `Re-open ${selectedLevel}` : 'Re-open Assessment'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STREAM APPROVE & LOCK CONFIRMATION MODAL */}
      {streamToApprove && activeExam && (() => {
        const streamId = streamToApprove.stream_id || streamToApprove.id;
        let streamReadiness: StreamReadinessDetail | null = null;
        for (const lvl of (Object.values(streamApprovalStats.levelGroups) as LevelReadinessDetail[])) {
          const found = lvl.allStreams.find((s) => s.streamId === streamId);
          if (found) {
            streamReadiness = found;
            break;
          }
        }

        return (
          <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#D9E0E7] dark:border-slate-800 space-y-5 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center space-x-3 text-[#075E42] dark:text-emerald-400 border-b border-[#D9E0E7]/60 dark:border-slate-800 pb-3">
                <div className="p-2.5 bg-[#E8F5EF] dark:bg-emerald-950/80 rounded-xl">
                  <ShieldCheck className="w-6 h-6 text-[#075E42] dark:text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-[#1F2937] dark:text-slate-100">
                    Approve {streamToApprove.class_name} {streamToApprove.stream}?
                  </h3>
                  <p className="text-xs text-[#667085] dark:text-slate-400 font-medium">Class-Stream Official Sign-Off</p>
                </div>
              </div>

              <div className="space-y-3 text-xs text-[#1F2937] dark:text-slate-200">
                <p className="leading-relaxed text-[#667085] dark:text-slate-400">
                  Approving this stream will lock marks entry specifically for{' '}
                  <span className="font-bold text-[#1F2937] dark:text-slate-200">
                    {streamToApprove.class_name} {streamToApprove.stream}
                  </span>
                  . Official stream report cards and merit lists will become authorized, while other streams remain independently editable.
                </p>

                {streamReadiness && !streamReadiness.isReady ? (
                  <div className="bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700/80 rounded-xl p-3 space-y-1.5">
                    <div className="flex items-center space-x-2 text-amber-900 dark:text-amber-200 font-extrabold text-xs">
                      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span>Stream has incomplete marks ({streamReadiness.missingMarks} missing entries)</span>
                    </div>
                    {streamReadiness.missingSubjects.length > 0 && (
                      <p className="text-[11px] text-amber-800 dark:text-amber-300">
                        Missing in: {streamReadiness.missingSubjects.map((s) => `${s.subjectName} (${s.missingCount} learners)`).join(', ')}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-700/80 rounded-xl p-2.5 flex items-center space-x-2 text-emerald-900 dark:text-emerald-200 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>Marks entry for this stream is 100% complete.</span>
                  </div>
                )}

                <div className="bg-[#F6F8FA] dark:bg-slate-800/60 p-3.5 rounded-xl border border-[#D9E0E7] dark:border-slate-700/80 space-y-1.5">
                  <div className="flex justify-between font-semibold">
                    <span className="text-[#667085] dark:text-slate-400">Assessment:</span>
                    <span className="font-bold text-[#1F2937] dark:text-slate-200">{activeExam.exam_name}</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span className="text-[#667085] dark:text-slate-400">Target Stream:</span>
                    <span className="font-bold text-[#075E42] dark:text-emerald-400">
                      {streamToApprove.class_name} {streamToApprove.stream}
                    </span>
                  </div>
                  {streamReadiness && (
                    <div className="flex justify-between font-semibold">
                      <span className="text-[#667085] dark:text-slate-400">Marks Progress:</span>
                      <span className="font-bold text-[#1F2937] dark:text-slate-200">
                        {streamReadiness.enteredMarks} / {streamReadiness.expectedMarks} ({streamReadiness.percentage}%)
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  onClick={() => setStreamToApprove(null)}
                  className="px-4 py-2.5 rounded-xl font-bold text-xs text-[#667085] dark:text-slate-400 hover:text-[#1F2937] dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleConfirmStreamApproval(streamToApprove)}
                  className={`px-5 py-2.5 rounded-xl font-black text-xs text-white shadow-md transition flex items-center space-x-1.5 cursor-pointer ${
                    streamReadiness && !streamReadiness.isReady
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : 'bg-[#075E42] hover:bg-[#087F5B]'
                  }`}
                >
                  <Lock className="w-4 h-4" />
                  <span>Approve & Lock Stream</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* STREAM RE-OPEN CONFIRMATION MODAL */}
      {streamToReopen && activeExam && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#D9E0E7] dark:border-slate-800 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center space-x-3 text-amber-700 dark:text-amber-400 border-b border-[#D9E0E7]/60 dark:border-slate-800 pb-3">
              <div className="p-2.5 bg-amber-50 dark:bg-amber-950/80 rounded-xl">
                <RefreshCw className="w-6 h-6 text-amber-700 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-[#1F2937] dark:text-slate-100">
                  Re-open {streamToReopen.class_name} {streamToReopen.stream}?
                </h3>
                <p className="text-xs text-[#667085] dark:text-slate-400 font-medium">Revert Stream Lock Status</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-[#1F2937] dark:text-slate-200">
              <p className="leading-relaxed text-[#667085] dark:text-slate-400 font-semibold">
                Reopening this class stream will allow authorised subject teachers and the class teacher to modify marks for{' '}
                <span className="font-bold text-[#1F2937] dark:text-slate-200">
                  {streamToReopen.class_name} {streamToReopen.stream}
                </span>{' '}
                again. Continue?
              </p>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setStreamToReopen(null)}
                className="px-4 py-2.5 rounded-xl font-bold text-xs text-[#667085] dark:text-slate-400 hover:text-[#1F2937] dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => handleConfirmStreamReopen(streamToReopen)}
                className="px-5 py-2.5 rounded-xl font-black text-xs bg-amber-600 hover:bg-amber-700 text-white shadow-md transition flex items-center space-x-1.5 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Re-open Stream</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
