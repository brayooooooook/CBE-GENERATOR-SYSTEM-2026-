import React, { useState, useEffect, useMemo } from 'react';
import { FileSpreadsheet, Save, CheckCircle2, Filter, Lock, ShieldAlert, AlertTriangle, HelpCircle, Check, XSquare, Ban, BarChart3, ArrowUpDown, Sliders, RefreshCw } from 'lucide-react';
import { Examination, ClassStream, Subject, Student, Mark, Grade, Role, User, Teacher, SubjectStatus, getApplicableSubjectsForGrade, sortSubjectsByStandardOrder } from '../types';
import { getGradeForMark } from '../services/analysisEngine';
import { evaluateMark, IRREGULARITY_REASONS } from '../utils/markUtils';
import { stripSurroundingQuotes } from '../utils/filterUtils';
import { isTermModifiable, canViewTermData, getTermStatusMessage, canEnterMarks } from "../utils/termStatusUtils";
import { useAcademicSession } from "../contexts/AcademicSessionContext";
import { api } from '../lib/storage';
import {
  getActiveTeacher,
  getAccessibleClasses,
  getAccessibleSubjects,
  canUserEditClassMarks,
  canUserEditSubjectMarks, canUserEditClassAndSubjectMarks,
} from '../utils/rbacUtils';

interface MarksEntryTableProps {
  exams: Examination[];
  classes: ClassStream[];
  subjects: Subject[];
  students: Student[];
  marks: Mark[];
  grades: Grade[];
  userRole?: Role;
  currentUser?: User;
  teachers?: Teacher[];
  onSaveMarks: (updatedMarks: Mark[]) => void;
  onUpdateExamStatus?: (examId: string, status: Examination['status']) => void;
}

interface CellEntry {
  rawScore: string;
  status: SubjectStatus;
  irregularityReason: string;
}

export const MarksEntryTable: React.FC<MarksEntryTableProps> = ({
  exams = [],
  classes = [],
  subjects = [],
  students = [],
  marks = [],
  grades = [],
  userRole = 'subject_teacher',
  currentUser,
  teachers = [],
  onSaveMarks,
  onUpdateExamStatus,
}) => {
  const { viewingTerm: activeTermObj } = useAcademicSession();
  const canModify = canEnterMarks(activeTermObj.status);

  if (!canViewTermData(activeTermObj.status)) {
    return (
      <div className="p-8 text-center space-y-4">
        <div className="bg-amber-100 text-amber-800 p-6 rounded-2xl max-w-md mx-auto">
          <h2 className="text-lg font-bold mb-2">Term {activeTermObj.status}</h2>
          <p className="text-sm">{getTermStatusMessage(activeTermObj.status)}</p>
        </div>
      </div>
    );
  }
  const isAdmin = userRole === 'admin';

  const activeTeacher = getActiveTeacher(currentUser || null, teachers);
  const accessibleClasses = getAccessibleClasses(currentUser || null, activeTeacher, classes);
  const accessibleSubjects = getAccessibleSubjects(currentUser || null, activeTeacher, subjects);

  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');

  // Assessment Out-Of Maximum Score (Empty by default for new assessments)
  const [outOfMaxScore, setOutOfMaxScore] = useState<string>('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Local state for grid inputs: { [student_id]: CellEntry }
  const [localMarks, setLocalMarks] = useState<Record<string, CellEntry>>({});
  const [saveToast, setSaveToast] = useState<string | null>(null);

  // Optional Summary & Grid Display Filters
  const [sortByAdmission, setSortByAdmission] = useState<boolean>(false);
  const [sortByPerformance, setSortByPerformance] = useState<boolean>(false);
  const [doNotAssignPositions, setDoNotAssignPositions] = useState<boolean>(false);
  const [includeXYInSummary, setIncludeXYInSummary] = useState<boolean>(false);

  // Check if current user can edit the selected class and subject
  const canEditSelectedClass = selectedClassId ? canUserEditClassMarks(currentUser || null, activeTeacher, selectedClassId, classes) : true;
  const canEditSelectedSubject = selectedSubjectId ? canUserEditSubjectMarks(currentUser || null, activeTeacher, selectedSubjectId) : true;
  const canEditCurrentGrid = canUserEditClassAndSubjectMarks(currentUser || null, activeTeacher, selectedClassId, selectedSubjectId);

  // Active examination and lock status
  const selectedExam = exams.find((e) => e.id === selectedExamId);
  const isExamApproved = selectedExam?.status === 'Approved';
  const isGridModifiable = canModify && canEditCurrentGrid && !isExamApproved;
  const [showReopenConfirm, setShowReopenConfirm] = useState<boolean>(false);

  // Filter students by selected class
  const classStudents = selectedClassId ? students.filter((s) => s.class_id === selectedClassId) : [];

  // Load existing marks into local state whenever filters change
  useEffect(() => {
    if (!selectedExamId || !selectedClassId || !selectedSubjectId) {
      setLocalMarks({});
      setOutOfMaxScore('');
      setValidationError(null);
      return;
    }

    const existingMap: Record<string, CellEntry> = {};
    let existingOutOf: number | null = null;

    classStudents.forEach((std) => {
      const match = marks.find(
        (m) =>
          m.student_id === std.id &&
          m.exam_id === selectedExamId &&
          m.subject_id === selectedSubjectId
      );

      if (match) {
        if (match.out_of && match.out_of > 0) existingOutOf = match.out_of;
        const evalRes = evaluateMark(match);

        if (evalRes.status === 'Normal') {
          existingMap[std.id] = {
            rawScore: evalRes.rawScore !== null ? String(evalRes.rawScore) : String(match.marks),
            status: 'Normal',
            irregularityReason: 'Absent',
          };
        } else if (evalRes.status === 'X') {
          existingMap[std.id] = {
            rawScore: 'X',
            status: 'X',
            irregularityReason: 'Absent',
          };
        } else if (evalRes.status === 'Y') {
          existingMap[std.id] = {
            rawScore: 'Y',
            status: 'Y',
            irregularityReason: match.irregularity_reason || 'Absent',
          };
        } else {
          existingMap[std.id] = {
            rawScore: '',
            status: 'Blank',
            irregularityReason: 'Absent',
          };
        }
      } else {
        existingMap[std.id] = {
          rawScore: '',
          status: 'Blank',
          irregularityReason: 'Absent',
        };
      }
    });

    setOutOfMaxScore(existingOutOf !== null ? String(existingOutOf) : '');
    setLocalMarks(existingMap);
    setValidationError(null);
  }, [selectedExamId, selectedClassId, selectedSubjectId, marks, students]);

  const handleInputChange = (studentId: string, val: string) => {
    const cleanVal = val.trim().toUpperCase();

    if (cleanVal === 'X') {
      setLocalMarks((prev) => ({
        ...prev,
        [studentId]: { rawScore: 'X', status: 'X', irregularityReason: prev[studentId]?.irregularityReason || 'Absent' },
      }));
    } else if (cleanVal === 'Y') {
      setLocalMarks((prev) => ({
        ...prev,
        [studentId]: { rawScore: 'Y', status: 'Y', irregularityReason: prev[studentId]?.irregularityReason || 'Absent' },
      }));
    } else if (cleanVal === '') {
      setLocalMarks((prev) => ({
        ...prev,
        [studentId]: { rawScore: '', status: 'Blank', irregularityReason: prev[studentId]?.irregularityReason || 'Absent' },
      }));
    } else {
      setLocalMarks((prev) => ({
        ...prev,
        [studentId]: { rawScore: val, status: 'Normal', irregularityReason: prev[studentId]?.irregularityReason || 'Absent' },
      }));
    }
  };

  const handleStatusChange = (studentId: string, status: SubjectStatus) => {
    setLocalMarks((prev) => {
      const current = prev[studentId] || { rawScore: '', status: 'Blank', irregularityReason: 'Absent' };
      let newScore = current.rawScore;
      if (status === 'X') newScore = 'X';
      else if (status === 'Y') newScore = 'Y';
      else if (status === 'Blank') newScore = '';
      else if (status === 'Normal' && (current.rawScore === 'X' || current.rawScore === 'Y')) newScore = '';

      return {
        ...prev,
        [studentId]: { ...current, status, rawScore: newScore },
      };
    });
  };

  const handleReasonChange = (studentId: string, reason: string) => {
    setLocalMarks((prev) => ({
      ...prev,
      [studentId]: { ...(prev[studentId] || { rawScore: 'Y', status: 'Y' }), irregularityReason: reason },
    }));
  };

  const handleBulkSetStatus = (targetStatus: SubjectStatus) => {
    if (isExamApproved) {
      setValidationError(`Marks Entry Locked: Assessment "${selectedExam?.exam_name}" is approved. Marks can no longer be entered or edited.`);
      return;
    }
    setLocalMarks((prev) => {
      const next = { ...prev };
      classStudents.forEach((std) => {
        const entry = next[std.id];
        if (!entry || entry.status === 'Blank' || entry.rawScore === '') {
          next[std.id] = {
            rawScore: targetStatus === 'X' ? 'X' : targetStatus === 'Y' ? 'Y' : '',
            status: targetStatus,
            irregularityReason: 'Absent',
          };
        }
      });
      return next;
    });
  };

  const handleSaveAll = () => {
    setValidationError(null);

    if (isExamApproved) {
      setValidationError(`Marks Entry Locked: Assessment "${selectedExam?.exam_name}" is approved. Marks can no longer be entered or edited.`);
      return;
    }

    if (!canEditCurrentGrid) {
      alert('Access Restricted: You are not assigned to enter or edit marks for this class or learning area.');
      return;
    }

    const trimmedOutOf = String(outOfMaxScore).trim();
    const parsedMaxScore = parseFloat(trimmedOutOf);

    if (!trimmedOutOf || isNaN(parsedMaxScore) || parsedMaxScore <= 0) {
      setValidationError('Please enter the maximum score (Assessment Out Of) before saving marks.');
      return;
    }

    // Validate every entered student mark against parsedMaxScore
    const exceedingStudent = classStudents.find((std) => {
      const entry = localMarks[std.id];
      if (entry && entry.status === 'Normal' && entry.rawScore !== '') {
        const val = parseFloat(entry.rawScore);
        return !isNaN(val) && val > parsedMaxScore;
      }
      return false;
    });

    if (exceedingStudent) {
      const invalidScore = localMarks[exceedingStudent.id]?.rawScore;
      setValidationError(
        `Validation Error: Learner "${exceedingStudent.full_name}" has a score of ${invalidScore}, which exceeds the Assessment Out Of limit of ${parsedMaxScore}. Marks cannot exceed the maximum score.`
      );
      return;
    }

    const negativeStudent = classStudents.find((std) => {
      const entry = localMarks[std.id];
      if (entry && entry.status === 'Normal' && entry.rawScore !== '') {
        const val = parseFloat(entry.rawScore);
        return !isNaN(val) && val < 0;
      }
      return false;
    });

    if (negativeStudent) {
      const invalidScore = localMarks[negativeStudent.id]?.rawScore;
      setValidationError(
        `Validation Error: Learner "${negativeStudent.full_name}" has a negative score of ${invalidScore}. Scores must be 0 or greater.`
      );
      return;
    }

    const newMarksToSave: Mark[] = [];

    classStudents.forEach((std) => {
      const entry = localMarks[std.id];
      if (!entry) return;

      const markId = `mk_${std.id}_${selectedSubjectId}_${selectedExamId}`;
      const now = new Date().toISOString();

      if (entry.status === 'X') {
        newMarksToSave.push({
          id: markId,
          student_id: std.id,
          subject_id: selectedSubjectId,
          exam_id: selectedExamId,
          marks: 0,
          raw_score: null,
          out_of: parsedMaxScore,
          special_status: 'X',
          updated_at: now,
        });
      } else if (entry.status === 'Y') {
        newMarksToSave.push({
          id: markId,
          student_id: std.id,
          subject_id: selectedSubjectId,
          exam_id: selectedExamId,
          marks: 0,
          raw_score: null,
          out_of: parsedMaxScore,
          special_status: 'Y',
          irregularity_reason: entry.irregularityReason || 'Absent',
          updated_at: now,
        });
      } else if (entry.status === 'Normal') {
        const numVal = parseFloat(entry.rawScore);
        if (!isNaN(numVal) && numVal >= 0) {
          const percentage = (numVal / parsedMaxScore) * 100;
          newMarksToSave.push({
            id: markId,
            student_id: std.id,
            subject_id: selectedSubjectId,
            exam_id: selectedExamId,
            marks: Math.min(100, Math.max(0, percentage)),
            raw_score: numVal,
            out_of: parsedMaxScore,
            special_status: 'Normal',
            updated_at: now,
          });
        }
      } else if (entry.status === 'Blank') {
        newMarksToSave.push({
          id: markId,
          student_id: std.id,
          subject_id: selectedSubjectId,
          exam_id: selectedExamId,
          marks: 0,
          raw_score: null,
          out_of: parsedMaxScore,
          special_status: 'Blank',
          updated_at: now,
        });
      }
    });

    try {
      onSaveMarks(newMarksToSave);
      setSaveToast('Marks and assessment statuses successfully saved and updated!');
      setTimeout(() => setSaveToast(null), 2500);
    } catch (err: any) {
      setValidationError(err.message || 'Failed to save marks. Assessment is locked.');
    }
  };

  const selectedClass = classes.find((c) => c.id === selectedClassId);

  // Filter subjects applicable to the selected class's grade level and accessible to teacher
  const gradeSubjects = selectedClass
    ? api.getSubjectsForClass(selectedClass)
    : [];

  const rawApplicableSubjects = selectedClass
    ? accessibleSubjects.filter((as) => {
        const isGradeSubject = gradeSubjects.some((gs) => gs.id === as.id);
        if (!isGradeSubject) return false;
        
        // Admin can see all grade subjects
        if (isAdmin) return true;
        
        // Teachers only see subjects explicitly allocated to them for this class
        if (activeTeacher) {
          return (activeTeacher.allocations || []).some(a => a.class_id === selectedClassId && a.subject_id === as.id);
        }
        
        return false;
      })
    : accessibleSubjects;

  const applicableSubjects = sortSubjectsByStandardOrder(rawApplicableSubjects);

  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId);

  const isExamSelected = Boolean(selectedExamId);
  const isClassSelected = Boolean(selectedClassId);
  const isSubjectSelected = Boolean(selectedSubjectId);
  const isOutOfValid = Boolean(outOfMaxScore && !isNaN(parseFloat(outOfMaxScore)) && parseFloat(outOfMaxScore) > 0);
  const isSelectionComplete = isExamSelected && isClassSelected && isSubjectSelected && isOutOfValid;

  const handleClassSelect = (newClassId: string) => {
    setSelectedClassId(newClassId);
    if (newClassId && selectedSubjectId) {
      const cls = classes.find((c) => c.id === newClassId);
      const gradeSubs = cls ? api.getSubjectsForClass(cls) : [];
      const isStillApplicable = gradeSubs.some((gs) => gs.id === selectedSubjectId);
      if (!isStillApplicable) {
        setSelectedSubjectId('');
      }
    }
  };

  // Sorted list of students based on optional filters
  const sortedClassStudents = useMemo(() => {
    const list = [...classStudents];
    if (sortByPerformance) {
      list.sort((a, b) => {
        const entryA = localMarks[a.id];
        const entryB = localMarks[b.id];

        const scoreA = entryA?.status === 'Normal' && entryA.rawScore !== '' ? parseFloat(entryA.rawScore) : -1;
        const scoreB = entryB?.status === 'Normal' && entryB.rawScore !== '' ? parseFloat(entryB.rawScore) : -1;

        if (scoreA !== scoreB) {
          return scoreB - scoreA;
        }
        const statusOrder: Record<string, number> = { Normal: 1, X: 2, Y: 3, Blank: 4 };
        const orderA = statusOrder[entryA?.status || 'Blank'] || 5;
        const orderB = statusOrder[entryB?.status || 'Blank'] || 5;
        if (orderA !== orderB) return orderA - orderB;

        return (a.admission_number || '').localeCompare(b.admission_number || '', undefined, { numeric: true });
      });
    } else if (sortByAdmission) {
      list.sort((a, b) => {
        return (a.admission_number || '').localeCompare(b.admission_number || '', undefined, { numeric: true });
      });
    }
    return list;
  }, [classStudents, localMarks, outOfMaxScore, sortByPerformance, sortByAdmission]);

  // Calculated subject positions per student (if doNotAssignPositions is false)
  const studentPositions = useMemo(() => {
    if (doNotAssignPositions || !isSelectionComplete) return {};
    const pMax = parseFloat(outOfMaxScore);
    if (isNaN(pMax) || pMax <= 0) return {};

    const scores: { id: string; percentage: number }[] = [];
    classStudents.forEach((std) => {
      const entry = localMarks[std.id];
      if (entry && entry.status === 'Normal' && entry.rawScore !== '') {
        const val = parseFloat(entry.rawScore);
        if (!isNaN(val) && val >= 0) {
          scores.push({ id: std.id, percentage: (val / pMax) * 100 });
        }
      }
    });

    scores.sort((a, b) => b.percentage - a.percentage);

    const positions: Record<string, number> = {};
    let currentRank = 1;
    for (let i = 0; i < scores.length; i++) {
      if (i > 0 && Math.abs(scores[i].percentage - scores[i - 1].percentage) > 0.001) {
        currentRank = i + 1;
      }
      positions[scores[i].id] = currentRank;
    }
    return positions;
  }, [classStudents, localMarks, outOfMaxScore, doNotAssignPositions, isSelectionComplete]);

  // Live Class Assessment Summary Data & Performance Breakdown
  const classSummaryData = useMemo(() => {
    const breakdown: Record<string, number> = {
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

    let totalPctSum = 0;
    let totalPointsSum = 0;
    let evaluatedCount = 0;

    const pMax = parseFloat(outOfMaxScore);
    const isPMaxValid = !isNaN(pMax) && pMax > 0;

    classStudents.forEach((std) => {
      const entry = localMarks[std.id];
      if (!entry) return;

      if (entry.status === 'Normal' && entry.rawScore !== '' && isPMaxValid) {
        const numVal = parseFloat(entry.rawScore);
        if (!isNaN(numVal) && numVal >= 0) {
          const percentage = (numVal / pMax) * 100;
          const gr = getGradeForMark(percentage, grades);
          const code = gr.grade_code || gr.grade || 'ME1';
          if (breakdown[code] !== undefined) {
            breakdown[code]++;
          }
          totalPctSum += percentage;
          totalPointsSum += gr.points;
          evaluatedCount++;
        }
      } else if (entry.status === 'X') {
        breakdown.X++;
        if (includeXYInSummary) {
          totalPctSum += 0;
          totalPointsSum += 0;
          evaluatedCount++;
        }
      } else if (entry.status === 'Y') {
        breakdown.Y++;
        if (includeXYInSummary) {
          totalPctSum += 0;
          totalPointsSum += 0;
          evaluatedCount++;
        }
      }
    });

    const avgMarks = evaluatedCount > 0 ? totalPctSum / evaluatedCount : 0;
    const avgPoints = evaluatedCount > 0 ? totalPointsSum / evaluatedCount : 0;

    const overallGrade = evaluatedCount > 0 ? getGradeForMark(avgMarks, grades) : null;
    const overallLevel = evaluatedCount > 0 ? (overallGrade?.performance_level || 'Pending') : 'Pending';
    const overallDescriptor = evaluatedCount > 0 ? (overallGrade?.descriptor || 'Evaluated') : 'No Entry';

    const targetPts = evaluatedCount > 0 ? Math.min(8, Math.max(1, Math.round(avgPoints))) : 0;
    const safeGrades = grades && grades.length > 0 ? grades : [];
    const pointGradeObj = evaluatedCount > 0 
      ? (safeGrades.find((g) => g.points === targetPts) || getGradeForMark((avgPoints / 8) * 100, grades))
      : null;

    const pointGradeCode = evaluatedCount > 0 ? (pointGradeObj?.grade_code || pointGradeObj?.grade || '-') : '—';
    const pointPerfLevel = evaluatedCount > 0 ? (pointGradeObj?.performance_level || 'ME') : 'Not available';

    return {
      breakdown,
      avgMarks,
      avgPoints,
      overallLevel,
      overallDescriptor,
      pointGradeCode,
      pointPerfLevel,
      evaluatedCount,
    };
  }, [classStudents, localMarks, outOfMaxScore, grades, includeXYInSummary]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
            <FileSpreadsheet className="w-5 h-5 sm:w-6 sm:h-6 text-[#176B45] dark:text-emerald-400" />
            <span>Fast Marks & Assessment Status Entry Grid</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Enter numerical scores or set assessment statuses (<strong>X</strong> = Missing Mark, <strong>Y</strong> = Irregularity, <strong>Blank</strong> = Not Applicable).
          </p>
        </div>

        <button
          onClick={handleSaveAll}
          disabled={!isGridModifiable || !isSelectionComplete}
          className={`font-bold text-xs px-4 py-2.5 rounded-lg shadow-xs transition flex items-center justify-center space-x-2 shrink-0 ${
            !isGridModifiable || !isSelectionComplete
              ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
              : 'bg-[#176B45] hover:bg-[#0F5132] dark:bg-emerald-700 dark:hover:bg-emerald-800 text-white'
          }`}
        >
          <Save className="w-4 h-4" />
          <span>Save All Grid Marks</span>
        </button>
      </div>

      {isExamApproved && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200 rounded-xl text-xs font-semibold flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900 rounded-lg shrink-0">
              <Lock className="w-5 h-5 text-emerald-800 dark:text-emerald-300" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-emerald-900 dark:text-emerald-100">Marks Entry Locked</h4>
              <p className="text-emerald-800 dark:text-emerald-300 text-xs mt-0.5">
                Assessment approved. Marks can no longer be entered or edited.
              </p>
            </div>
          </div>
          {currentUser?.role === 'admin' && onUpdateExamStatus && selectedExam && (
            <button
              type="button"
              onClick={() => setShowReopenConfirm(true)}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs shadow-xs transition flex items-center space-x-1.5 shrink-0 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reopen Marks Entry</span>
            </button>
          )}
        </div>
      )}

      {!canEditCurrentGrid && selectedClassId && selectedSubjectId && (
        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200 rounded-xl text-xs font-semibold flex items-center space-x-2">
          <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0" />
          <span>
            <strong>Access Restricted:</strong> You are not assigned to enter or edit marks for this class or learning area.
          </span>
        </div>
      )}

      {!canModify && (
        <div className="p-3.5 bg-amber-50 dark:bg-amber-950/80 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 rounded-xl text-xs font-semibold flex items-center space-x-2">
          <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <span>{getTermStatusMessage(activeTermObj.status)}</span>
        </div>
      )}

      {saveToast && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-lg text-xs font-bold flex items-center space-x-2 shadow-xs animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <span>{saveToast}</span>
        </div>
      )}

      {validationError && (
        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 rounded-xl text-xs font-bold flex items-center justify-between shadow-xs animate-fade-in">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 flex-shrink-0" />
            <span>{validationError}</span>
          </div>
          <button
            onClick={() => setValidationError(null)}
            className="text-rose-600 dark:text-rose-400 hover:text-rose-900 dark:hover:text-rose-200 text-xs font-extrabold px-2 py-1 rounded hover:bg-rose-100 dark:hover:bg-rose-900/50 transition"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filter Selector Panel & Assessment Out-Of Config */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-4 sm:p-5 shadow-xs border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#E8F3EE] dark:bg-emerald-950/60 p-3 rounded-lg border border-[#2E7D5B]/20 dark:border-emerald-800/60">
          <div className="flex items-center space-x-2 text-xs font-bold text-[#176B45] dark:text-emerald-400 uppercase tracking-wider">
            <Filter className="w-4 h-4 text-[#176B45] dark:text-emerald-400" />
            <span>Select Target Assessment, Class & Subject Grid</span>
          </div>

          <div className="flex items-center space-x-2 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 shadow-2xs">
            <span className="text-xs text-slate-700 dark:text-slate-300 font-bold">Assessment Out Of (Max Score) *:</span>
            <input
              type="number"
              min="1"
              max="500"
              disabled={!isGridModifiable}
              value={outOfMaxScore}
              onChange={(e) => {
                setOutOfMaxScore(e.target.value);
                if (validationError) setValidationError(null);
              }}
              placeholder="100"
              className={`w-20 bg-slate-50 dark:bg-slate-900 border text-slate-900 dark:text-slate-100 font-bold font-mono text-xs rounded px-2 py-1 text-center focus:outline-none focus:ring-2 focus:ring-[#176B45] focus:border-[#176B45] placeholder-slate-400 ${
                validationError && (!outOfMaxScore || parseFloat(outOfMaxScore) <= 0)
                  ? 'border-rose-500 ring-2 ring-rose-500'
                  : 'border-slate-300 dark:border-slate-700'
              }`}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-xs">
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Select Assessment *</label>
            <select
              value={selectedExamId}
              onChange={(e) => {
                setSelectedExamId(e.target.value);
                if (validationError) setValidationError(null);
              }}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg p-2.5 font-semibold text-xs focus:ring-2 focus:ring-[#176B45] focus:border-[#176B45] focus:outline-none shadow-2xs max-w-full truncate"
            >
              <option value="">Select Assessment</option>
              {exams.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.exam_name} ({ex.status})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Select Class / Stream *</label>
            <select
              value={selectedClassId}
              onChange={(e) => {
                handleClassSelect(e.target.value);
                if (validationError) setValidationError(null);
              }}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg p-2.5 font-semibold text-xs focus:ring-2 focus:ring-[#176B45] focus:border-[#176B45] focus:outline-none shadow-2xs max-w-full truncate"
            >
              <option value="">Select Class / Stream</option>
              {accessibleClasses.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.class_name} {cls.stream}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Select Subject *</label>
            <select
              value={selectedSubjectId}
              onChange={(e) => {
                setSelectedSubjectId(e.target.value);
                if (validationError) setValidationError(null);
              }}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg p-2.5 font-semibold text-xs focus:ring-2 focus:ring-[#176B45] focus:border-[#176B45] focus:outline-none shadow-2xs max-w-full truncate"
            >
              <option value="">Select Subject</option>
              {applicableSubjects.map((sb) => (
                <option key={sb.id} value={sb.id}>
                  {sb.subject_name} ({sb.subject_code})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick Bulk Action Toolstrip */}
        {isSelectionComplete && isGridModifiable && (
          <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 text-xs">
            <span className="text-slate-600 font-semibold">Quick Assessment Status Fill:</span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={classStudents.length === 0}
                onClick={() => handleBulkSetStatus('X')}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition flex items-center space-x-1 border ${
                  classStudents.length === 0
                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                    : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                <span>Mark Empty as X (Missing)</span>
              </button>
              <button
                type="button"
                disabled={classStudents.length === 0}
                onClick={() => handleBulkSetStatus('Blank')}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition flex items-center space-x-1 border ${
                  classStudents.length === 0
                    ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Ban className="w-3.5 h-3.5 text-slate-500" />
                <span>Mark Empty as Blank</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MARKS SPREADSHEET TABLE OR SELECTION PROMPT */}
      {!isSelectionComplete ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-xs text-center space-y-4">
          <div className="w-12 h-12 bg-[#E8F3EE] dark:bg-emerald-950/60 border border-[#2E7D5B]/30 dark:border-emerald-800/60 rounded-full flex items-center justify-center mx-auto text-[#176B45] dark:text-emerald-400">
            <Filter className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Selection Required to Load Marks Grid</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
              Please explicitly select an <strong>Assessment</strong>, <strong>Class/Stream</strong>, <strong>Subject</strong>, and enter the <strong>Assessment Out Of (Max Score)</strong> above to load the student list and enable marks entry.
            </p>
          </div>

          <div className="inline-flex flex-wrap justify-center gap-2 pt-2 text-xs">
            <span className={`px-3 py-1.5 rounded-lg font-semibold flex items-center space-x-1.5 border ${selectedExamId ? 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300' : 'bg-amber-50 dark:bg-amber-950/80 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300'}`}>
              {selectedExamId ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />}
              <span>Assessment: {selectedExam ? selectedExam.exam_name : 'Select Assessment'}</span>
            </span>

            <span className={`px-3 py-1.5 rounded-lg font-semibold flex items-center space-x-1.5 border ${selectedClassId ? 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300' : 'bg-amber-50 dark:bg-amber-950/80 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300'}`}>
              {selectedClassId ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />}
              <span>Class: {selectedClass ? `${selectedClass.class_name} ${selectedClass.stream}` : 'Select Class / Stream'}</span>
            </span>

            <span className={`px-3 py-1.5 rounded-lg font-semibold flex items-center space-x-1.5 border ${selectedSubjectId ? 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300' : 'bg-amber-50 dark:bg-amber-950/80 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300'}`}>
              {selectedSubjectId ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />}
              <span>Subject: {selectedSubject ? selectedSubject.subject_name : 'Select Subject'}</span>
            </span>

            <span className={`px-3 py-1.5 rounded-lg font-semibold flex items-center space-x-1.5 border ${outOfMaxScore && parseFloat(outOfMaxScore) > 0 ? 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300' : 'bg-amber-50 dark:bg-amber-950/80 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300'}`}>
              {outOfMaxScore && parseFloat(outOfMaxScore) > 0 ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />}
              <span>Assessment Out Of: {outOfMaxScore && parseFloat(outOfMaxScore) > 0 ? `${outOfMaxScore} Marks` : 'Enter Out Of Score'}</span>
            </span>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Active Sheet: <span className="text-[#176B45] dark:text-emerald-400">{selectedClass?.class_name} {selectedClass?.stream}</span> &bull;{' '}
              <span className="text-[#176B45] dark:text-emerald-400">{selectedSubject?.subject_name}</span> ({classStudents.length} Learners)
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center space-x-2">
              {(() => {
                const pMax = parseFloat(outOfMaxScore);
                const isPMaxValid = !isNaN(pMax) && pMax > 0;
                return (
                  <span>
                    Assessment Max Score:{' '}
                    <strong className={isPMaxValid ? 'text-slate-900 dark:text-slate-100 font-bold' : 'text-rose-600 font-bold font-mono'}>
                      {isPMaxValid ? `${pMax} Marks` : 'Not Set (Required)'}
                    </strong>
                  </span>
                );
              })()}
            </div>
          </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700 text-[11px]">
                <th className="p-3 w-10">#</th>
                <th className="p-3">Admission No</th>
                <th className="p-3">Learner Name</th>
                <th className="p-3 w-44">Score / Status Input</th>
                <th className="p-3 text-center">Percentage (%)</th>
                <th className="p-3 text-center">CBE Level</th>
                <th className="p-3 text-center">Points</th>
                <th className="p-3">Assessment Remarks / Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {sortedClassStudents.length > 0 ? (
                sortedClassStudents.map((std, idx) => {
                  const entry = localMarks[std.id] || { rawScore: '', status: 'Blank', irregularityReason: 'Absent' };
                  const numVal = parseFloat(entry.rawScore);
                  const pMax = parseFloat(outOfMaxScore);
                  const isPMaxValid = !isNaN(pMax) && pMax > 0;
                  const isNormalScore = entry.status === 'Normal' && !isNaN(numVal) && numVal >= 0;
                  const isExceeding = isNormalScore && isPMaxValid && numVal > pMax;

                  const percentage = isNormalScore && isPMaxValid ? (numVal / pMax) * 100 : null;

                  const gradeObj = percentage !== null ? getGradeForMark(percentage, grades) : null;
                  const level = gradeObj?.performance_level || 'ME';
                  const code = gradeObj?.grade_code || gradeObj?.grade || '-';

                  return (
                    <tr key={std.id} className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition ${entry.status === 'X' ? 'bg-rose-50/30 dark:bg-rose-950/20' : entry.status === 'Y' ? 'bg-purple-50/30 dark:bg-purple-950/20' : isExceeding ? 'bg-rose-50/40 dark:bg-rose-950/30' : ''}`}>
                      <td className="p-3 text-slate-400 font-bold">
                        {!doNotAssignPositions && studentPositions[std.id] ? `#${studentPositions[std.id]}` : idx + 1}
                      </td>
                      <td className="p-3 font-mono font-bold text-[#176B45] dark:text-emerald-400">{std.admission_number}</td>
                      <td className="p-3 font-bold text-slate-900 dark:text-slate-100">{std.full_name}</td>
                      
                      {/* Score / Status Input Cell */}
                      <td className="p-3">
                        <div className="flex items-center space-x-1.5">
                          <input
                            type="text"
                            value={entry.rawScore}
                            disabled={!isGridModifiable}
                            onChange={(e) => {
                              handleInputChange(std.id, e.target.value);
                              if (validationError) setValidationError(null);
                            }}
                            placeholder={isPMaxValid ? `0-${pMax}, X, Y` : '0-Max, X, Y'}
                            className={`w-28 border rounded-lg px-2.5 py-1.5 font-bold font-mono text-sm text-center focus:ring-2 focus:outline-none uppercase ${
                              !isGridModifiable
                                ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed border-slate-200 dark:border-slate-700'
                                : entry.status === 'X'
                                ? 'border-rose-500 bg-rose-100 dark:bg-rose-950/80 text-rose-900 dark:text-rose-200 font-black'
                                : entry.status === 'Y'
                                ? 'border-purple-500 bg-purple-100 dark:bg-purple-950/80 text-purple-900 dark:text-purple-200 font-black'
                                : isExceeding
                                ? 'border-rose-500 bg-rose-100 dark:bg-rose-950/80 text-rose-900 dark:text-rose-200 font-black ring-2 ring-rose-500'
                                : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-[#176B45]'
                            }`}
                          />
                          <span className="text-slate-400 text-[11px] font-bold font-mono">
                            /{isPMaxValid ? pMax : '?'}
                          </span>
                        </div>

                        {/* Quick Status Toggles below input */}
                        <div className="flex items-center space-x-1 mt-1">
                          <button
                            type="button"
                            onClick={() => handleStatusChange(std.id, 'Normal')}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${entry.status === 'Normal' ? 'bg-[#176B45] text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'}`}
                          >
                            Mark
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStatusChange(std.id, 'X')}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${entry.status === 'X' ? 'bg-rose-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'}`}
                          >
                            X
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStatusChange(std.id, 'Y')}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${entry.status === 'Y' ? 'bg-purple-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'}`}
                          >
                            Y
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStatusChange(std.id, 'Blank')}
                            className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${entry.status === 'Blank' ? 'bg-slate-700 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600'}`}
                          >
                            Blank
                          </button>
                        </div>
                      </td>

                      {/* Percentage Cell */}
                      <td className="p-3 text-center font-bold font-mono text-sm">
                        {percentage !== null ? (
                          <span className="text-slate-900 dark:text-slate-100">{Math.round(percentage)}%</span>
                        ) : entry.status === 'X' ? (
                          <span className="text-rose-700 dark:text-rose-400 font-black">X</span>
                        ) : entry.status === 'Y' ? (
                          <span className="text-purple-700 dark:text-purple-400 font-black">Y</span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">-</span>
                        )}
                      </td>

                      {/* CBE Level Cell */}
                      <td className="p-3 text-center">
                        {gradeObj ? (
                          <span
                            className={`px-2.5 py-1 rounded-md text-xs font-bold border ${
                              level === 'EE'
                                ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800'
                                : level === 'ME'
                                ? 'bg-sky-100 dark:bg-sky-950/80 text-sky-900 dark:text-sky-200 border-sky-300 dark:border-sky-800'
                                : level === 'AE'
                                ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-800'
                                : 'bg-rose-100 dark:bg-rose-950/80 text-rose-900 dark:text-rose-200 border-rose-300 dark:border-rose-800'
                            }`}
                          >
                            {code} ({level})
                          </span>
                        ) : entry.status === 'X' ? (
                          <span className="bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800 px-2 py-0.5 rounded text-xs font-black">X</span>
                        ) : entry.status === 'Y' ? (
                          <span className="bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-800 px-2 py-0.5 rounded text-xs font-black">Y</span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600 font-mono">-</span>
                        )}
                      </td>

                      {/* Points Cell */}
                      <td className="p-3 text-center font-mono font-extrabold text-slate-800 dark:text-slate-200 text-sm">
                        {gradeObj ? gradeObj.points : <span className="text-slate-300 dark:text-slate-600 font-mono">-</span>}
                      </td>

                      {/* Official Remarks / Irregularity Reason Selector */}
                      <td className="p-3 text-xs">
                        {entry.status === 'Y' ? (
                          <div className="space-y-1">
                            <span className="text-purple-700 dark:text-purple-400 font-bold block text-[10px]">Irregularity Reason:</span>
                            <select
                              value={entry.irregularityReason}
                              onChange={(e) => handleReasonChange(std.id, e.target.value)}
                              className="w-full bg-purple-50 dark:bg-purple-950/60 border border-purple-300 dark:border-purple-800 text-purple-900 dark:text-purple-200 font-bold rounded px-2 py-1 text-xs focus:ring-1 focus:ring-[#176B45]"
                            >
                              {IRREGULARITY_REASONS.map((r) => (
                                <option key={r} value={r}>
                                  {r}
                                </option>
                              ))}
                            </select>
                          </div>
                        ) : entry.status === 'X' ? (
                          <span className="text-rose-700 dark:text-rose-400 font-black text-xs">
                            Missing Mark (X) &bull; Provisional Report
                          </span>
                        ) : entry.status === 'Blank' ? (
                          <span className="text-slate-400 dark:text-slate-500 font-medium">Not Applicable / Blank</span>
                        ) : gradeObj ? (
                          <span
                            className={`font-semibold ${
                              level === 'EE'
                                ? 'text-emerald-800 dark:text-emerald-300'
                                : level === 'ME'
                                ? 'text-sky-800 dark:text-sky-300'
                                : level === 'AE'
                                ? 'text-amber-800 dark:text-amber-300'
                                : 'text-rose-800 dark:text-rose-300'
                            }`}
                          >
                            {stripSurroundingQuotes(gradeObj.remarks)}
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500">Pending Entry</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="text-center py-10 px-4 bg-slate-50/50 dark:bg-slate-800/50">
                    <div className="max-w-md mx-auto space-y-1.5 text-center">
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                        No learners are currently assigned to this class/stream.
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                        Check Learner Roster to confirm class and stream assignments.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-xs text-slate-500">
            Changes calculate locally. Click <span className="font-bold text-slate-800">Save All Grid Marks</span> to apply updates.
          </span>
          <button
            onClick={handleSaveAll}
            disabled={(!canModify) || !canEditCurrentGrid || !isSelectionComplete}
            className={`font-bold text-xs px-4 py-2 rounded-lg shadow-xs transition flex items-center space-x-1.5 ${(!canModify) || !canEditCurrentGrid || !isSelectionComplete ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-[#176B45] hover:bg-[#0F5132] text-white'}`}
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save All Grid Marks</span>
          </button>
        </div>

        {/* Class Assessment Summary Section */}
        <div className="mt-6 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                <BarChart3 className="w-5 h-5 text-[#176B45] dark:text-emerald-400" />
                <span>Class Assessment Summary</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Live overview of learner performance for the selected grid.
              </p>
            </div>

            {/* Optional Filters */}
            <div className="flex flex-wrap items-center gap-2.5 text-xs font-medium bg-slate-50 dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
              <label className="flex items-center space-x-1.5 cursor-pointer hover:text-slate-900 dark:hover:text-slate-100 transition">
                <input
                  type="checkbox"
                  checked={sortByAdmission}
                  onChange={(e) => {
                    setSortByAdmission(e.target.checked);
                    if (e.target.checked) setSortByPerformance(false);
                  }}
                  className="rounded border-slate-300 dark:border-slate-700 text-[#176B45] focus:ring-[#176B45]"
                />
                <span>Sort by Admission No.</span>
              </label>

              <label className="flex items-center space-x-1.5 cursor-pointer hover:text-slate-900 dark:hover:text-slate-100 transition">
                <input
                  type="checkbox"
                  checked={sortByPerformance}
                  onChange={(e) => {
                    setSortByPerformance(e.target.checked);
                    if (e.target.checked) setSortByAdmission(false);
                  }}
                  className="rounded border-slate-300 dark:border-slate-700 text-[#176B45] focus:ring-[#176B45]"
                />
                <span>Sort by Performance</span>
              </label>

              <label className="flex items-center space-x-1.5 cursor-pointer hover:text-slate-900 dark:hover:text-slate-100 transition">
                <input
                  type="checkbox"
                  checked={doNotAssignPositions}
                  onChange={(e) => setDoNotAssignPositions(e.target.checked)}
                  className="rounded border-slate-300 dark:border-slate-700 text-[#176B45] focus:ring-[#176B45]"
                />
                <span>No Positions</span>
              </label>

              <label className="flex items-center space-x-1.5 cursor-pointer hover:text-slate-900 dark:hover:text-slate-100 transition">
                <input
                  type="checkbox"
                  checked={includeXYInSummary}
                  onChange={(e) => setIncludeXYInSummary(e.target.checked)}
                  className="rounded border-slate-300 dark:border-slate-700 text-[#176B45] focus:ring-[#176B45]"
                />
                <span>Include X & Y</span>
              </label>
            </div>
          </div>

          {/* Class Summary Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* Performance Level */}
            <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 space-y-1">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Performance Level
              </span>
              <div className="flex items-baseline space-x-1.5">
                <span className="text-lg sm:text-xl font-black text-[#176B45] dark:text-emerald-400">
                  {classSummaryData.overallLevel}
                </span>
                <span className="text-xs text-slate-600 dark:text-slate-300 font-semibold truncate">
                  ({classSummaryData.overallDescriptor})
                </span>
              </div>
            </div>

            {/* Average Marks (%) */}
            <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 space-y-1">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Average Marks (%)
              </span>
              <span className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-100 font-mono">
                {classSummaryData.evaluatedCount > 0 ? `${classSummaryData.avgMarks.toFixed(1)}%` : '—'}
              </span>
            </div>

            {/* Average Points */}
            <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 space-y-1">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Average Points
              </span>
              <span className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-100 font-mono">
                {classSummaryData.evaluatedCount > 0 ? `${classSummaryData.avgPoints.toFixed(2)} Pts` : '—'}
              </span>
            </div>

            {/* Level (Points) */}
            <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 space-y-1">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Level (Points)
              </span>
              <span className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-100">
                {classSummaryData.pointGradeCode} <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">({classSummaryData.pointPerfLevel})</span>
              </span>
            </div>

            {/* Number of Learners */}
            <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 space-y-1 col-span-2 sm:col-span-1">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Number of Learners
              </span>
              <div className="flex items-baseline space-x-1.5">
                <span className="text-lg sm:text-xl font-black text-slate-900 dark:text-slate-100 font-mono">
                  {classStudents.length}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  ({classSummaryData.evaluatedCount} assessed)
                </span>
              </div>
            </div>
          </div>

          {/* Performance Level Breakdown */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider">
              <span>Performance Level Breakdown</span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">Learner count per grade code / status</span>
            </div>

            {/* Mobile Responsive Grid for Breakdown */}
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5 text-center text-xs">
              {[
                { code: 'EE1', count: classSummaryData.breakdown.EE1, bg: 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200', labelBg: 'bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-300' },
                { code: 'EE2', count: classSummaryData.breakdown.EE2, bg: 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200', labelBg: 'bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-300' },
                { code: 'ME1', count: classSummaryData.breakdown.ME1, bg: 'bg-sky-50 dark:bg-sky-950/60 border-sky-200 dark:border-sky-800 text-sky-900 dark:text-sky-200', labelBg: 'bg-sky-100 dark:bg-sky-900 text-sky-800 dark:text-sky-300' },
                { code: 'ME2', count: classSummaryData.breakdown.ME2, bg: 'bg-sky-50 dark:bg-sky-950/60 border-sky-200 dark:border-sky-800 text-sky-900 dark:text-sky-200', labelBg: 'bg-sky-100 dark:bg-sky-900 text-sky-800 dark:text-sky-300' },
                { code: 'AE1', count: classSummaryData.breakdown.AE1, bg: 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200', labelBg: 'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-300' },
                { code: 'AE2', count: classSummaryData.breakdown.AE2, bg: 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200', labelBg: 'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-300' },
                { code: 'BE1', count: classSummaryData.breakdown.BE1, bg: 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200', labelBg: 'bg-rose-100 dark:bg-rose-900 text-rose-800 dark:text-rose-300' },
                { code: 'BE2', count: classSummaryData.breakdown.BE2, bg: 'bg-rose-50 dark:bg-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200', labelBg: 'bg-rose-100 dark:bg-rose-900 text-rose-800 dark:text-rose-300' },
                { code: 'X', count: classSummaryData.breakdown.X, bg: 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200', labelBg: 'bg-rose-200 dark:bg-rose-900 text-rose-900 dark:text-rose-200' },
                { code: 'Y', count: classSummaryData.breakdown.Y, bg: 'bg-purple-50 dark:bg-purple-950/60 border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-200', labelBg: 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-300' },
              ].map((item) => (
                <div key={item.code} className={`border rounded-lg p-2 flex flex-col justify-between ${item.bg}`}>
                  <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${item.labelBg}`}>
                    {item.code}
                  </span>
                  <span className="text-base font-black font-mono mt-1">
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* RE-OPEN CONFIRMATION MODAL FOR MARKS ENTRY */}
      {showReopenConfirm && selectedExam && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center space-x-3 text-amber-700 dark:text-amber-400 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="p-2.5 bg-amber-50 dark:bg-amber-950/80 rounded-xl">
                <RefreshCw className="w-6 h-6 text-amber-700 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-slate-900 dark:text-slate-100">Reopen Assessment for Marks Entry?</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Administrator Reopen Action</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-700 dark:text-slate-300">
              <p className="leading-relaxed font-semibold text-slate-700 dark:text-slate-300">
                Reopening this approved assessment will allow authorised users to modify marks again. Continue?
              </p>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setShowReopenConfirm(false)}
                className="px-4 py-2.5 rounded-xl font-bold text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowReopenConfirm(false);
                  if (onUpdateExamStatus) {
                    onUpdateExamStatus(selectedExam.id, 'Draft');
                  }
                }}
                className="px-5 py-2.5 rounded-xl font-black text-xs bg-amber-600 hover:bg-amber-700 text-white shadow-md transition flex items-center space-x-1.5 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Confirm Reopen</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
