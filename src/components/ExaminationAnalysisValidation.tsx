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
} from 'lucide-react';
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
import { getAccessibleClasses, getTeacherAssignedSubjectIds, getTeacherAssignedClassIds } from '../utils/rbacUtils';
import { getFilteredStudents } from '../utils/filterUtils';
import { TabType } from './Sidebar';
import { ExamWorkflowHeader } from './ExamWorkflowHeader';
import { useAcademicSession } from '../contexts/AcademicSessionContext';
import { canApproveExams, getTermStatusMessage } from '../utils/termStatusUtils';

interface ExaminationAnalysisValidationProps {
  exams: Examination[];
  students: Student[];
  classes: ClassStream[];
  subjects: Subject[];
  marks: Mark[];
  grades: Grade[];
  teachers: Teacher[];
  currentUser: User | null;
  onUpdateExamStatus: (examId: string, status: Examination['status']) => void;
  onNavigateToTab?: (tab: TabType) => void;
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
  onUpdateExamStatus,
  onNavigateToTab,
}) => {
  // Filter States
  const [selectedLevel, setSelectedLevel] = useState<EducationLevel | ''>('');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedStreamId, setSelectedStreamId] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<number | ''>('');
  const [selectedTerm, setSelectedTerm] = useState<string>('');
  const [selectedExamId, setSelectedExamId] = useState<string>('');

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
    const filtered = getFilteredStudents(students, classes, selectedClassId, selectedStreamId);
    return filtered.filter((std) => std.active !== false);
  }, [students, classes, selectedClassId, selectedStreamId]);

  // Applicable Subjects
  const learnerSubjects = useMemo(() => {
    if (!selectedClassObject) return [];
    const baseApplicable = getLearnerReportSubjects({} as any, selectedClassObject, subjects, teachers);
    if (currentUser?.role === 'admin') return baseApplicable;

    if (currentUser?.role === 'class_teacher' || currentUser?.role === 'subject_teacher') {
      const isClassTeacher =
        activeTeacher?.is_class_teacher &&
        (activeTeacher?.class_teacher_of_id === selectedClassObject.id ||
          selectedClassObject.class_teacher_id === activeTeacher.id);

      if (isClassTeacher) return baseApplicable;

      const assignedIds = getTeacherAssignedSubjectIds(activeTeacher);
      return baseApplicable.filter((s) => assignedIds.includes(s.id));
    }
    return baseApplicable;
  }, [selectedClassObject, subjects, currentUser, activeTeacher]);

  // Check selection completeness
  const isSelectionComplete = useMemo(() => {
    return Boolean(selectedLevel && selectedClassId && selectedYear && selectedTerm && selectedExamId);
  }, [selectedLevel, selectedClassId, selectedYear, selectedTerm, selectedExamId]);

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

  // Marks Entry Progress & Per-Subject Summary
  const subjectProgressList = useMemo(() => {
    if (!isSelectionComplete || !activeExam || selectedStudents.length === 0) return [];

    return learnerSubjects.map((sb) => {
      let completed = 0;
      let missingX = 0;
      let irregularityY = 0;

      selectedStudents.forEach((std) => {
        const stdMark = marks.find(
          (m) => m.student_id === std.id && m.subject_id === sb.id && m.exam_id === activeExam.id
        );
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
  }, [isSelectionComplete, activeExam, selectedStudents, learnerSubjects, marks]);

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
        const stdMark = marks.find(
          (m) => m.student_id === std.id && m.subject_id === sb.id && m.exam_id === activeExam?.id
        );
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

    const completedRecords = Math.min(totalLearners, completeLearnerCount);
    const provisionalRecords = Math.max(0, totalLearners - completedRecords);
    const totalMissingX = learnersWithXCount;
    const totalIrregularityY = learnersWithYCount;
    const overallCompletionPercentage = totalLearners > 0 ? (completedRecords / totalLearners) * 100 : 0;
    const allSubjects100Percent =
      totalLearners > 0 &&
      completedRecords === totalLearners &&
      subjectProgressList.every((sp) => sp.isComplete100);

    return {
      totalLearners,
      totalSubjectRecordsExpected: totalLearners * learnerSubjects.length,
      completedRecords,
      provisionalRecords,
      totalMissingX,
      totalIrregularityY,
      overallCompletionPercentage,
      allSubjects100Percent,
    };
  }, [selectedStudents, learnerSubjects, marks, activeExam, subjectProgressList]);

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
        const stdMark = marks.find(
          (m) => m.student_id === std.id && m.subject_id === sb.id && m.exam_id === activeExam.id
        );
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
  }, [isSelectionComplete, activeExam, selectedStudents, learnerSubjects, marks, grades]);

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
        const m = marks.find((mk) => mk.student_id === std.id && mk.subject_id === sb.id && mk.exam_id === activeExam.id);
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
        const m = marks.find((mk) => mk.student_id === std.id && mk.subject_id === sb.id && mk.exam_id === priorExam!.id);
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
  }, [comparisonType, isSelectionComplete, activeExam, exams, selectedStudents, learnerSubjects, marks]);

  // Automated Examination Validation Checklist
  const validationResults = useMemo(() => {
    if (!isSelectionComplete || !activeExam) return null;

    const issues: { type: 'blocking' | 'warning' | 'info'; title: string; detail: string }[] = [];

    // Check 1: Required Learning Areas
    if (learnerSubjects.length === 0) {
      issues.push({
        type: 'blocking',
        title: 'Missing Required Learning Areas',
        detail: `No active subjects or learning areas found for ${selectedClassObject?.class_name || 'selected class'}.`,
      });
    }

    // Check 2: Teacher Allocations
    const unallocatedSubjects = learnerSubjects.filter(
      (sb) =>
        !teachers.some((t) => {
          const assignedSubjects = getTeacherAssignedSubjectIds(t);
          const assignedClasses = getTeacherAssignedClassIds(t, classes);
          return assignedSubjects.includes(sb.id) && (assignedClasses.includes(selectedClassId) || assignedClasses.length === 0);
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
        if (studentBelongs && (m.special_status === 'Normal' || !m.special_status)) {
          const val = m.raw_score !== undefined && m.raw_score !== null ? m.raw_score : m.marks;
          const max = activeExam.max_marks;
          if (typeof val === 'number' && (isNaN(val) || val < 0 || val > max)) {
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
        const key = `${m.student_id}_${m.subject_id}`;
        if (seenMap.has(key)) duplicateCount++;
        else seenMap.add(key);
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
      alert("Please complete all filter selections before running assessment analysis.");
      return;
    }
    if (selectedStudents.length === 0) {
      alert("No active learners found for the selected cohort. Cannot run analysis.");
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
  const { viewingTerm: activeTermObj } = useAcademicSession();
  const canModify = canApproveExams(activeTermObj.status);

  // Handle Official Approval Confirmation
  const handleConfirmApproval = () => {
    if (!activeExam) return;
    if (!canModify) {
      alert(getTermStatusMessage(activeTermObj.status));
      setShowApproveModal(false);
      return;
    }
    onUpdateExamStatus(activeExam.id, 'Approved');
    setShowApproveModal(false);
    setToastMessage({
      type: 'success',
      text: `✓ Assessment "${activeExam.exam_name}" has been OFFICIALLY APPROVED & LOCKED! Official reports and merit lists are now available.`,
    });
    setTimeout(() => setToastMessage(null), 6000);
  };

  // Handle Re-open Confirmation
  const handleConfirmReopen = () => {
    if (!activeExam) return;
    if (currentUser?.role !== 'admin') {
      alert('UNAUTHORIZED: Only an Administrator can reopen an approved assessment.');
      setShowReopenModal(false);
      return;
    }
    if (!canModify) {
      alert(getTermStatusMessage(activeTermObj.status));
      setShowReopenModal(false);
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

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`p-4 rounded-xl shadow-md border text-xs sm:text-sm font-semibold flex items-center justify-between transition ${
            toastMessage.type === 'success'
              ? 'bg-[#E8F5EF] dark:bg-emerald-950/80 text-[#075E42] dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
              : toastMessage.type === 'warning'
              ? 'bg-amber-50 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 border-amber-300 dark:border-amber-800'
              : 'bg-slate-100 dark:bg-slate-800 text-[#1F2937] dark:text-slate-200 border-[#D9E0E7] dark:border-slate-700'
          }`}
        >
          <div className="flex items-center space-x-3">
            <CheckCircle2 className="w-5 h-5 text-[#075E42] dark:text-emerald-400 shrink-0" />
            <span>{toastMessage.text}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-xs text-[#667085] dark:text-slate-400 hover:text-[#1F2937] dark:hover:text-slate-200 px-2 py-1 rounded bg-white dark:bg-slate-900 border border-[#D9E0E7] dark:border-slate-700"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Examination Workflow Breadcrumbs Header */}
      <ExamWorkflowHeader
        currentStep={2}
        examName={activeExam?.exam_name}
        validationPassed={analysisState === 'complete' && (validationResults?.isReadyForApproval || false)}
        isApproved={activeExam?.status === 'Approved'}
        onNavigate={onNavigateToTab}
      />

      {/* Top Main Executive Summary Banner */}
      <div className="bg-[#075E42] dark:bg-emerald-950 text-white rounded-2xl p-5 sm:p-6 shadow-md border border-[#087F5B] dark:border-emerald-800 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/15 pb-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="bg-white/15 text-emerald-100 font-bold px-2.5 py-0.5 rounded-full border border-white/20 uppercase tracking-wider">
                {activeExam ? `${activeExam.exam_name} — ${selectedTerm} ${selectedYear}` : 'No Assessment Selected'}
              </span>
              <span className="text-emerald-200 font-semibold">
                • {selectedClassObject?.class_name || 'Class'}
                {selectedStreamId && selectedStreamId !== 'all'
                  ? ` (${availableStreams.find((s) => s.id === selectedStreamId)?.stream || ''})`
                  : ''}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center space-x-2">
              <ShieldCheck className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-300 shrink-0" />
              <span>Assessment Analysis & Validation Gate</span>
            </h1>
            <p className="text-xs text-emerald-100/90 font-medium max-w-3xl">
              Mandatory Quality-Control Checkpoint — Execute automated analysis, verify mark boundaries and subject completeness, and grant admin approval sign-off.
            </p>
          </div>

          {/* Workflow Status Badge */}
          {activeExam && (
            <div className="flex flex-wrap items-center gap-3 bg-black/20 p-3 rounded-xl border border-white/10 shrink-0">
              <div>
                <span className="text-[10px] font-bold text-emerald-200 uppercase tracking-wider block">
                  Workflow State
                </span>
                <span
                  className={`text-xs font-black uppercase tracking-wide px-3 py-1 rounded-md inline-flex items-center space-x-1.5 mt-0.5 ${
                    activeExam.status === 'Approved'
                      ? 'bg-emerald-400 text-slate-950 shadow-sm'
                      : analysisState === 'running'
                      ? 'bg-amber-400 text-slate-950 shadow-sm animate-pulse'
                      : analysisState === 'complete' && validationResults?.blockingIssues.length === 0
                      ? 'bg-emerald-300 text-slate-950 font-bold'
                      : analysisState === 'complete' && validationResults?.blockingIssues.length > 0
                      ? 'bg-rose-400 text-slate-950 font-bold'
                      : 'bg-amber-300 text-slate-950 font-bold'
                  }`}
                >
                  {activeExam.status === 'Approved' ? (
                    <>
                      <Lock className="w-3.5 h-3.5" />
                      <span>OFFICIALLY APPROVED & LOCKED</span>
                    </>
                  ) : analysisState === 'running' ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>ANALYSIS RUNNING ({analysisProgress}%)</span>
                    </>
                  ) : analysisState === 'complete' && validationResults?.blockingIssues.length === 0 ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>READY FOR APPROVAL</span>
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

              {activeExam.status === 'Approved' && currentUser?.role === 'admin' && (
                <button
                  onClick={() => setShowReopenModal(true)}
                  className="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-2 rounded-lg font-bold transition flex items-center space-x-1 border border-white/20 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Re-open Assessment</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Executive Quick Stats Dashboard */}
        {activeExam && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <div className="bg-white/10 rounded-xl p-3 border border-white/15">
              <span className="text-[10px] font-bold text-emerald-200 uppercase tracking-wider block">Candidates Analysed</span>
              <span className="text-lg font-extrabold text-white font-mono">{selectedStudents.length} Learners</span>
            </div>
            <div className="bg-white/10 rounded-xl p-3 border border-white/15">
              <span className="text-[10px] font-bold text-emerald-200 uppercase tracking-wider block">Analysis Progress</span>
              <span className="text-lg font-extrabold text-white font-mono">
                {analysisState === 'complete' ? '✓ Complete (100%)' : analysisState === 'running' ? `Running (${analysisProgress}%)` : 'Not Executed'}
              </span>
            </div>
            <div className="bg-white/10 rounded-xl p-3 border border-white/15">
              <span className="text-[10px] font-bold text-emerald-200 uppercase tracking-wider block">Blocking Issues</span>
              <span className={`text-lg font-extrabold font-mono ${validationResults?.blockingIssues.length ? 'text-rose-300' : 'text-emerald-300'}`}>
                {validationResults ? `${validationResults.blockingIssues.length} Issues` : '—'}
              </span>
            </div>
            <div className="bg-white/10 rounded-xl p-3 border border-white/15 flex flex-col justify-center">
              {activeExam.status === 'Approved' ? (
                <span className="text-xs font-bold text-emerald-200 flex items-center space-x-1">
                  <Lock className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Locked & Approved</span>
                </span>
              ) : (
                <button
                  onClick={handleStartAnalysis}
                  disabled={analysisState === 'running'}
                  className="w-full bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 text-slate-950 font-black text-xs px-3 py-2 rounded-lg shadow transition flex items-center justify-center space-x-1.5 cursor-pointer"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>{analysisState === 'running' ? 'Analysing...' : '🔍 Analyse Assessment'}</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Cohort & Parameter Selection Panel */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-[#D9E0E7] dark:border-slate-800 space-y-4">
        <div className="flex items-center space-x-2 text-[#1F2937] dark:text-slate-100 font-bold border-b border-[#D9E0E7]/60 dark:border-slate-800 pb-3">
          <Filter className="w-4 h-4 text-[#075E42] dark:text-emerald-400" />
          <span className="text-sm">Assessment & Cohort Parameters</span>
          <span className="text-xs font-normal text-[#667085] dark:text-slate-400">
            (Select all parameters to configure quality-control analysis)
          </span>
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
                setSelectedExamId('');
              }}
              className="w-full bg-[#F6F8FA] dark:bg-slate-800 border border-[#D9E0E7] dark:border-slate-700 text-[#1F2937] dark:text-slate-200 rounded-lg p-2.5 text-xs font-semibold focus:ring-2 focus:ring-[#075E42] dark:focus:ring-emerald-500"
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
            <label className="block text-xs font-semibold text-[#1F2937] dark:text-slate-300 mb-1">
              Class <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedClassId}
              onChange={(e) => {
                setSelectedClassId(e.target.value);
                setSelectedStreamId('');
                setSelectedExamId('');
              }}
              disabled={!selectedLevel}
              className="w-full bg-[#F6F8FA] dark:bg-slate-800 border border-[#D9E0E7] dark:border-slate-700 text-[#1F2937] dark:text-slate-200 rounded-lg p-2.5 text-xs font-semibold focus:ring-2 focus:ring-[#075E42] dark:focus:ring-emerald-500 disabled:opacity-50"
            >
              {!selectedLevel ? (
                <option value="">Select Level First...</option>
              ) : uniqueClasses.length === 0 ? (
                <option value="" disabled>No active classes for {selectedLevel}</option>
              ) : (
                <>
                  <option value="">Select Class...</option>
                  {uniqueClasses.map((className) => (
                    <option key={className} value={className}>
                      {className}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>

          {/* 3. Stream */}
          <div>
            <label className="block text-xs font-semibold text-[#1F2937] dark:text-slate-300 mb-1">Stream</label>
            <select
              value={selectedStreamId}
              onChange={(e) => setSelectedStreamId(e.target.value)}
              disabled={!selectedClassId}
              className="w-full bg-[#F6F8FA] dark:bg-slate-800 border border-[#D9E0E7] dark:border-slate-700 text-[#1F2937] dark:text-slate-200 rounded-lg p-2.5 text-xs font-semibold focus:ring-2 focus:ring-[#075E42] dark:focus:ring-emerald-500 disabled:opacity-50"
            >
              {!selectedClassId ? (
                <option value="">Select Class First...</option>
              ) : (
                <>
                  <option value="">Select Stream...</option>
                  <option value="all">All Streams</option>
                  {availableStreams.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.stream}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>

          {/* 4. Academic Year */}
          <div>
            <label className="block text-xs font-semibold text-[#1F2937] dark:text-slate-300 mb-1">
              Academic Year <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedYear}
              onChange={(e) => {
                setSelectedYear(e.target.value ? Number(e.target.value) : '');
                setSelectedTerm('');
                setSelectedExamId('');
              }}
              className="w-full bg-[#F6F8FA] dark:bg-slate-800 border border-[#D9E0E7] dark:border-slate-700 text-[#1F2937] dark:text-slate-200 rounded-lg p-2.5 text-xs font-semibold focus:ring-2 focus:ring-[#075E42] dark:focus:ring-emerald-500"
            >
              <option value="">Select Year...</option>
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>

          {/* 5. Term */}
          <div>
            <label className="block text-xs font-semibold text-[#1F2937] dark:text-slate-300 mb-1">
              Term <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedTerm}
              onChange={(e) => {
                setSelectedTerm(e.target.value);
                setSelectedExamId('');
              }}
              disabled={!selectedYear}
              className="w-full bg-[#F6F8FA] dark:bg-slate-800 border border-[#D9E0E7] dark:border-slate-700 text-[#1F2937] dark:text-slate-200 rounded-lg p-2.5 text-xs font-semibold focus:ring-2 focus:ring-[#075E42] dark:focus:ring-emerald-500 disabled:opacity-50"
            >
              {!selectedYear ? (
                <option value="">Select Year First...</option>
              ) : (
                <>
                  <option value="">Select Term...</option>
                  {availableTerms.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>

          {/* 6. Assessment */}
          <div>
            <label className="block text-xs font-semibold text-[#1F2937] dark:text-slate-300 mb-1">
              Assessment <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              disabled={!selectedTerm || availableExams.length === 0}
              className="w-full bg-[#F6F8FA] dark:bg-slate-800 border border-[#D9E0E7] dark:border-slate-700 text-[#1F2937] dark:text-slate-200 rounded-lg p-2.5 text-xs font-semibold focus:ring-2 focus:ring-[#075E42] dark:focus:ring-emerald-500 disabled:opacity-50"
            >
              {!selectedTerm ? (
                <option value="">Select Term First...</option>
              ) : availableExams.length === 0 ? (
                <option value="" disabled>No assessment found</option>
              ) : (
                <>
                  <option value="">Select Assessment...</option>
                  {availableExams.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.exam_name} [{ex.status}]
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
        <div className="space-y-6">
          {/* 🔍 Analysis Execution & Progress Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 shadow-sm border border-[#D9E0E7] dark:border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#D9E0E7]/60 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-bold text-[#1F2937] dark:text-slate-100 flex items-center space-x-2">
                  <Search className="w-5 h-5 text-[#075E42] dark:text-emerald-400" />
                  <span>Assessment Quality-Control Analysis</span>
                </h2>
                <p className="text-xs text-[#667085] dark:text-slate-400 mt-0.5">
                  Execute 9 automated checks on mark boundaries, missing records, irregularities, rankings, and CBE level calculations.
                </p>
              </div>

              <div className="flex items-center space-x-3 shrink-0">
                {activeExam.status === 'Approved' ? (
                  <span className="text-xs bg-[#E8F5EF] dark:bg-emerald-950/60 text-[#075E42] dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 font-bold px-3 py-1.5 rounded-lg flex items-center space-x-1">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Locked & Approved</span>
                  </span>
                ) : (
                  <button
                    onClick={handleStartAnalysis}
                    disabled={analysisState === 'running'}
                    className="bg-[#075E42] hover:bg-[#087F5B] disabled:opacity-50 text-white font-extrabold text-xs px-5 py-2.5 rounded-xl shadow-sm transition flex items-center space-x-2 cursor-pointer"
                  >
                    <Search className="w-4 h-4" />
                    <span>{analysisState === 'running' ? 'Analysing Assessment...' : '🔍 Analyse Assessment'}</span>
                  </button>
                )}
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
                  <span>{analysisState === 'complete' ? 'Ready for Admin Review' : 'Processing assessment dataset...'}</span>
                </div>
              </div>
            )}
          </div>

          {/* 1. Marks Entry Status Section */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 shadow-sm border border-[#D9E0E7] dark:border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#D9E0E7]/60 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-bold text-[#1F2937] dark:text-slate-100 flex items-center space-x-2">
                  <FileSpreadsheet className="w-5 h-5 text-[#075E42] dark:text-emerald-400" />
                  <span>Marks Entry Status by Learning Area</span>
                </h2>
                <p className="text-xs text-[#667085] dark:text-slate-400 mt-0.5">
                  Measures mark entry completeness, missing records, and irregularities.
                </p>
              </div>
            </div>

            {/* Aggregate Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-[#F6F8FA] dark:bg-slate-800/60 border border-[#D9E0E7] dark:border-slate-700/80 p-3 rounded-xl">
                <span className="text-[10px] font-bold text-[#667085] dark:text-slate-400 uppercase block">Completion Rate</span>
                <span className="text-lg font-extrabold text-[#075E42] dark:text-emerald-400 font-mono">{overallProgressStats.overallCompletionPercentage.toFixed(1)}%</span>
              </div>
              <div className="bg-[#F6F8FA] dark:bg-slate-800/60 border border-[#D9E0E7] dark:border-slate-700/80 p-3 rounded-xl">
                <span className="text-[10px] font-bold text-[#667085] dark:text-slate-400 uppercase block">Learners Complete</span>
                <span className="text-lg font-extrabold text-emerald-700 dark:text-emerald-400 font-mono">{overallProgressStats.completedRecords}</span>
              </div>
              <div className="bg-[#F6F8FA] dark:bg-slate-800/60 border border-[#D9E0E7] dark:border-slate-700/80 p-3 rounded-xl">
                <span className="text-[10px] font-bold text-[#667085] dark:text-slate-400 uppercase block">Learners Pending</span>
                <span className="text-lg font-extrabold text-amber-700 dark:text-amber-400 font-mono">{overallProgressStats.provisionalRecords}</span>
              </div>
              <div className="bg-[#F6F8FA] dark:bg-slate-800/60 border border-[#D9E0E7] dark:border-slate-700/80 p-3 rounded-xl">
                <span className="text-[10px] font-bold text-[#667085] dark:text-slate-400 uppercase block">Missing (X) / Irreg (Y)</span>
                <span className="text-lg font-extrabold text-rose-700 dark:text-rose-400 font-mono">{overallProgressStats.totalMissingX + overallProgressStats.totalIrregularityY}</span>
              </div>
            </div>

            {/* Mobile Cards View (sm:hidden) */}
            <div className="block sm:hidden space-y-3">
              {subjectProgressList.map((sp) => (
                <div key={sp.subject.id} className="p-3.5 bg-[#F6F8FA] dark:bg-slate-800/60 border border-[#D9E0E7] dark:border-slate-700/80 rounded-xl space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-xs font-black text-[#075E42] dark:text-emerald-300 bg-[#E8F5EF] dark:bg-emerald-950/80 px-1.5 py-0.5 rounded mr-1.5 font-mono">{sp.subject.subject_code}</span>
                      <span className="text-xs font-bold text-[#1F2937] dark:text-slate-200 truncate">{sp.subject.subject_name}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${sp.isComplete100 ? 'bg-emerald-100 dark:bg-emerald-950 text-[#075E42] dark:text-emerald-300 border border-transparent dark:border-emerald-800' : 'bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300 border border-transparent dark:border-amber-800'}`}>
                      {sp.isComplete100 ? '100% COMPLETE' : 'INCOMPLETE'}
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-1 text-[11px] font-semibold text-[#667085] dark:text-slate-400 bg-white dark:bg-slate-900 p-2 rounded-lg border border-[#D9E0E7]/60 dark:border-slate-800">
                    <div>Total: <span className="font-bold text-[#1F2937] dark:text-slate-200">{sp.totalExpected}</span></div>
                    <div>Done: <span className="font-bold text-emerald-700 dark:text-emerald-400">{sp.completed}</span></div>
                    <div>X: <span className="font-bold text-rose-600 dark:text-rose-400">{sp.missingX}</span></div>
                    <div>Y: <span className="font-bold text-purple-700 dark:text-purple-400">{sp.irregularityY}</span></div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-[#667085] dark:text-slate-400 font-semibold">
                      <span>Completion</span>
                      <span className="font-mono text-[#1F2937] dark:text-slate-200 font-bold">{sp.completionRate.toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                      <div className={`h-2 rounded-full ${sp.isComplete100 ? 'bg-[#075E42] dark:bg-emerald-500' : 'bg-amber-500 dark:bg-amber-400'}`} style={{ width: `${Math.min(100, sp.completionRate)}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View (hidden sm:table) */}
            <div className="hidden sm:block overflow-x-auto rounded-xl border border-[#D9E0E7] dark:border-slate-800">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#F6F8FA] dark:bg-slate-800/80 text-[#1F2937] dark:text-slate-200 font-bold border-b border-[#D9E0E7] dark:border-slate-800">
                    <th className="p-3">Learning Area</th>
                    <th className="p-3 text-center">Total Learners</th>
                    <th className="p-3 text-center">Completed</th>
                    <th className="p-3 text-center">Provisional</th>
                    <th className="p-3 text-center">Missing (X)</th>
                    <th className="p-3 text-center">Irregularities (Y)</th>
                    <th className="p-3 text-center">Completion Rate</th>
                    <th className="p-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D9E0E7]/60 dark:divide-slate-800">
                  {subjectProgressList.map((sp) => (
                    <tr key={sp.subject.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                      <td className="p-3 font-semibold text-[#1F2937] dark:text-slate-200">
                        <span className="font-mono text-[#075E42] dark:text-emerald-400 mr-2 font-bold">{sp.subject.subject_code}</span>
                        {sp.subject.subject_name}
                      </td>
                      <td className="p-3 text-center font-mono text-[#1F2937] dark:text-slate-200 font-bold">{sp.totalExpected}</td>
                      <td className="p-3 text-center font-mono text-emerald-700 dark:text-emerald-400 font-bold">{sp.completed}</td>
                      <td className="p-3 text-center font-mono text-amber-700 dark:text-amber-400 font-bold">{sp.provisional}</td>
                      <td className="p-3 text-center font-mono text-rose-600 dark:text-rose-400 font-bold">{sp.missingX}</td>
                      <td className="p-3 text-center font-mono text-purple-700 dark:text-purple-400 font-bold">{sp.irregularityY}</td>
                      <td className="p-3 text-center">
                        <div className="flex items-center space-x-2">
                          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden min-w-[60px]">
                            <div className={`h-2 rounded-full ${sp.isComplete100 ? 'bg-[#075E42] dark:bg-emerald-500' : 'bg-amber-500 dark:bg-amber-400'}`} style={{ width: `${Math.min(100, sp.completionRate)}%` }} />
                          </div>
                          <span className="font-mono font-bold text-[#1F2937] dark:text-slate-200">{sp.completionRate.toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        {sp.isComplete100 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 dark:bg-emerald-950 text-[#075E42] dark:text-emerald-300 border border-transparent dark:border-emerald-800">
                            100%
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300 border border-transparent dark:border-amber-800">
                            INCOMPLETE
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                <span className="text-xl font-black text-emerald-700 dark:text-emerald-400 font-mono">{examStatistics.highestMark.toFixed(1)}%</span>
              </div>
              <div className="bg-[#F6F8FA] dark:bg-slate-800/60 border border-[#D9E0E7] dark:border-slate-700/80 p-3.5 rounded-xl space-y-1">
                <span className="text-[10px] font-bold text-[#667085] dark:text-slate-400 uppercase block">Lowest Mark</span>
                <span className="text-xl font-black text-rose-700 dark:text-rose-400 font-mono">{examStatistics.lowestMark.toFixed(1)}%</span>
              </div>
              <div className="bg-[#F6F8FA] dark:bg-slate-800/60 border border-[#D9E0E7] dark:border-slate-700/80 p-3.5 rounded-xl space-y-1">
                <span className="text-[10px] font-bold text-[#667085] dark:text-slate-400 uppercase block">Class Average</span>
                <span className="text-xl font-black text-[#075E42] dark:text-emerald-400 font-mono">{examStatistics.classAveragePct.toFixed(1)}%</span>
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
                  <p className="text-xs text-[#667085] dark:text-slate-400 mt-0.5">
                    Automated quality audit results across database records and mark bounds.
                  </p>
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

          {/* 4. Approval & Workflow Gate Card */}
          {activeExam && (
            <div
              className={`rounded-2xl p-5 sm:p-6 shadow-sm border space-y-4 transition ${
                activeExam.status === 'Approved'
                  ? 'bg-[#E8F5EF] dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-[#1F2937] dark:text-slate-100'
                  : analysisState === 'complete' && validationResults?.isReadyForApproval
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-[#1F2937] dark:text-slate-100'
                  : 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-[#1F2937] dark:text-slate-100'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
                <div className="space-y-2">
                  {activeExam.status === 'Approved' ? (
                    <div className="flex items-center space-x-2 text-[#075E42] dark:text-emerald-400 font-black text-lg">
                      <Lock className="w-5 h-5 text-[#075E42] dark:text-emerald-400" />
                      <span>✓ Assessment Officially Approved & Locked</span>
                    </div>
                  ) : analysisState === 'complete' && validationResults?.isReadyForApproval ? (
                    <div className="flex items-center space-x-2 text-[#075E42] dark:text-emerald-400 font-black text-lg">
                      <CheckCircle2 className="w-5 h-5 text-[#075E42] dark:text-emerald-400" />
                      <span>✓ Assessment Validation Passed — Ready for Approval</span>
                    </div>
                  ) : analysisState === 'complete' && !validationResults?.isReadyForApproval ? (
                    <div className="flex items-center space-x-2 text-rose-800 dark:text-rose-300 font-black text-lg">
                      <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                      <span>⚠️ Blocking Issues Detected — Resolution Required</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2 text-amber-900 dark:text-amber-300 font-black text-lg">
                      <Info className="w-5 h-5 text-amber-700 dark:text-amber-400" />
                      <span>🔍 Analysis Execution Required</span>
                    </div>
                  )}

                  <p className="text-xs text-[#667085] dark:text-slate-400 max-w-2xl font-medium leading-relaxed">
                    {activeExam.status === 'Approved'
                      ? 'This assessment is officially locked. Official report cards, merit lists, and transcript PDFs are unlocked and available for generation.'
                      : analysisState === 'complete' && validationResults?.isReadyForApproval
                      ? 'All quality-control checks have passed with zero blocking issues. Click below to officially approve and lock results.'
                      : analysisState === 'complete' && !validationResults?.isReadyForApproval
                      ? 'Resolve all blocking issues before approving the assessment.'
                      : 'Click "Analyse Assessment" above to run the 9-stage quality control check before official approval.'}
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

                {/* Action Button */}
                <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
                  {activeExam.status === 'Approved' ? (
                    <div className="flex items-center space-x-2">
                      <span className="bg-[#075E42] dark:bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center space-x-1.5 shadow-sm">
                        <Check className="w-4 h-4" />
                        <span>Approved & Locked</span>
                      </span>
                      {currentUser?.role === 'admin' && (
                        <button
                          onClick={() => setShowReopenModal(true)}
                          className="bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-[#1F2937] dark:text-slate-200 border border-[#D9E0E7] dark:border-slate-700 px-3.5 py-2.5 rounded-xl font-bold text-xs transition flex items-center space-x-1 cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5 text-[#667085] dark:text-slate-400" />
                          <span>Re-open</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowApproveModal(true)}
                      disabled={
                        analysisState !== 'complete' ||
                        analysisRanForExamId !== activeExam.id ||
                        !validationResults?.isReadyForApproval
                      }
                      className={`w-full sm:w-auto px-6 py-3 rounded-xl font-extrabold text-xs shadow-md flex items-center justify-center space-x-2 transition ${
                        analysisState === 'complete' &&
                        analysisRanForExamId === activeExam.id &&
                        validationResults?.isReadyForApproval
                          ? 'bg-[#075E42] hover:bg-[#087F5B] text-white cursor-pointer'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-500 border border-slate-300 dark:border-slate-700 cursor-not-allowed'
                      }`}
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>Approve & Lock Official Results</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Navigation Links */}
              <div className="border-t border-[#D9E0E7] dark:border-slate-800 pt-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                <span className="text-[#667085] dark:text-slate-400 font-semibold">Workflow Actions:</span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => onNavigateToTab?.('marks-entry')}
                    className="bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-[#1F2937] dark:text-slate-200 border border-[#D9E0E7] dark:border-slate-700 px-3 py-1.5 rounded-lg font-semibold transition flex items-center space-x-1 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-[#667085] dark:text-slate-400" />
                    <span>Marks Entry Grid</span>
                  </button>
                  <button
                    onClick={() => onNavigateToTab?.('provisional')}
                    className="bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-[#1F2937] dark:text-slate-200 border border-[#D9E0E7] dark:border-slate-700 px-3 py-1.5 rounded-lg font-semibold transition flex items-center space-x-1 cursor-pointer"
                  >
                    <CheckSquare className="w-3.5 h-3.5 text-[#075E42] dark:text-emerald-400" />
                    <span>Results Verification</span>
                  </button>
                  <button
                    onClick={() => onNavigateToTab?.('reports')}
                    disabled={activeExam.status !== 'Approved'}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition flex items-center space-x-1 ${
                      activeExam.status === 'Approved'
                        ? 'bg-[#075E42] dark:bg-emerald-600 text-white shadow-sm hover:bg-[#087F5B] cursor-pointer'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 cursor-not-allowed'
                    }`}
                  >
                    <FileBarChart className="w-3.5 h-3.5" />
                    <span>Generate Official Reports & Merit Lists</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* APPROVE & LOCK CONFIRMATION MODAL */}
      {showApproveModal && activeExam && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#D9E0E7] dark:border-slate-800 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center space-x-3 text-[#075E42] dark:text-emerald-400 border-b border-[#D9E0E7]/60 dark:border-slate-800 pb-3">
              <div className="p-2.5 bg-[#E8F5EF] dark:bg-emerald-950/80 rounded-xl">
                <ShieldCheck className="w-6 h-6 text-[#075E42] dark:text-emerald-400" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-[#1F2937] dark:text-slate-100">Approve and Lock Assessment?</h3>
                <p className="text-xs text-[#667085] dark:text-slate-400 font-medium">Official Administrative Sign-Off</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-[#1F2937] dark:text-slate-200">
              <p className="leading-relaxed text-[#667085] dark:text-slate-400">
                This will officially approve the assessment and lock its results. Marks and analysis data can no longer be edited until the assessment is explicitly reopened by an authorised administrator.
              </p>

              <div className="bg-[#F6F8FA] dark:bg-slate-800/60 p-3.5 rounded-xl border border-[#D9E0E7] dark:border-slate-700/80 space-y-1.5">
                <div className="flex justify-between font-semibold">
                  <span className="text-[#667085] dark:text-slate-400">Assessment:</span>
                  <span className="font-bold text-[#1F2937] dark:text-slate-200">{activeExam.exam_name}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span className="text-[#667085] dark:text-slate-400">Cohort / Candidates:</span>
                  <span className="font-bold text-[#1F2937] dark:text-slate-200">{selectedStudents.length} Learners</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span className="text-[#667085] dark:text-slate-400">Validation Status:</span>
                  <span className="font-extrabold text-[#075E42] dark:text-emerald-400">✓ Passed (0 Blocking Issues)</span>
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
                onClick={handleConfirmApproval}
                className="px-5 py-2.5 rounded-xl font-black text-xs bg-[#075E42] hover:bg-[#087F5B] text-white shadow-md transition flex items-center space-x-1.5 cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                <span>Approve & Lock</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RE-OPEN CONFIRMATION MODAL */}
      {showReopenModal && activeExam && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#D9E0E7] dark:border-slate-800 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center space-x-3 text-amber-700 dark:text-amber-400 border-b border-[#D9E0E7]/60 dark:border-slate-800 pb-3">
              <div className="p-2.5 bg-amber-50 dark:bg-amber-950/80 rounded-xl">
                <RefreshCw className="w-6 h-6 text-amber-700 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-[#1F2937] dark:text-slate-100">Re-open Assessment for Editing?</h3>
                <p className="text-xs text-[#667085] dark:text-slate-400 font-medium">Revert Lock Status</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-[#1F2937] dark:text-slate-200">
              <p className="leading-relaxed text-[#667085] dark:text-slate-400 font-semibold">
                Reopening this approved assessment will allow authorised users to modify marks again. Continue?
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
                onClick={handleConfirmReopen}
                className="px-5 py-2.5 rounded-xl font-black text-xs bg-amber-600 hover:bg-amber-700 text-white shadow-md transition flex items-center space-x-1.5 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Re-open Assessment</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
