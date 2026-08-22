import React, { useState, useEffect, useMemo } from 'react';
import { FileSpreadsheet, Save, CheckCircle2, Filter, Lock, ShieldAlert, AlertTriangle, HelpCircle, Check, XSquare, Ban, BarChart3, ArrowUpDown, Sliders, RefreshCw, Printer, FileText, X } from 'lucide-react';
import { Examination, ClassStream, Subject, Student, Mark, Grade, Role, User, Teacher, SubjectStatus, getApplicableSubjectsForGrade, sortSubjectsByStandardOrder } from '../types';
import { getGradeForMark } from '../services/analysisEngine';
import { isClassExamApproved } from '../utils/examLockUtils';
import { evaluateMark, IRREGULARITY_REASONS } from '../utils/markUtils';
import { stripSurroundingQuotes } from '../utils/filterUtils';
import { isTermModifiable, canViewTermData, getTermStatusMessage, canEnterMarks } from "../utils/termStatusUtils";
import { useAcademicSession } from "../contexts/AcademicSessionContext";
import { api, subscribeToMarksRealtime, unsubscribeFromMarksRealtime, RealtimeMarkEvent } from '../lib/storage';
import { exportSubjectPerformanceAnalysisPDF } from '../services/subjectPerformancePdfExporter';
import { exportRawMarksAllSubjectsPDF } from '../services/rawMarksPdfExporter';
import { exportScoreSheetPDF } from '../services/scoreSheetPdfExporter';
import { downloadMeritListPDF } from '../services/meritListExporter';
import { LoadingIndicator } from './LoadingIndicator';
import { getUserFriendlyErrorMessage } from '../utils/errorUtils';
import {
  getActiveTeacher,
  getAccessibleClasses,
  getAccessibleSubjects,
  canUserEditClassMarks,
  canUserEditSubjectMarks,
  canUserEditClassAndSubjectMarks,
  isClassTeacherFor,
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
  onSaveMarks: (updatedMarks: Mark[]) => void | Promise<void>;
  onUpdateExamStatus?: (examId: string, status: Examination['status']) => void | Promise<void>;
  onUpdateExamClassApproval?: (examId: string, classStreamId: string, approved: boolean) => void | Promise<void>;
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
  onUpdateExamClassApproval,
}) => {
  const { viewingTerm: activeTermObj, viewingYear: activeYearObj } = useAcademicSession();
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

  const [selectedExamId, setSelectedExamId] = useState<string>(() => {
    try {
      const saved = sessionStorage.getItem('cbe_marks_workflow_exam');
      if (saved) {
        sessionStorage.removeItem('cbe_marks_workflow_exam');
        return saved;
      }
    } catch (e) {}
    return '';
  });
  const [selectedClassId, setSelectedClassId] = useState<string>(() => {
    try {
      const saved = sessionStorage.getItem('cbe_marks_workflow_class');
      if (saved) {
        sessionStorage.removeItem('cbe_marks_workflow_class');
        return saved;
      }
    } catch (e) {}
    return '';
  });
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(() => {
    try {
      const saved = sessionStorage.getItem('cbe_marks_workflow_subject');
      if (saved) {
        sessionStorage.removeItem('cbe_marks_workflow_subject');
        return saved;
      }
    } catch (e) {}
    return '';
  });

  // Auto-detect and select active/viewing term session exam for marks entry
  useEffect(() => {
    if (!exams || exams.length === 0) return;
    if (!selectedExamId || !exams.some((e) => e.id === selectedExamId)) {
      const match =
        exams.find(
          (ex) =>
            ex.year === activeYearObj?.year &&
            ex.term === activeTermObj?.term_name &&
            ex.status === 'Open'
        ) ||
        exams.find(
          (ex) =>
            ex.year === activeYearObj?.year &&
            ex.term === activeTermObj?.term_name &&
            ex.status !== 'Archived'
        ) ||
        exams.find((ex) => ex.year === activeYearObj?.year && ex.term === activeTermObj?.term_name) ||
        exams[0];
      if (match) {
        setSelectedExamId(match.id);
      }
    }
  }, [exams, activeYearObj?.year, activeTermObj?.term_name]);

  // Assessment Out-Of Maximum Score (Empty by default for new assessments)
  const [outOfMaxScore, setOutOfMaxScore] = useState<string>('');
  const [validationError, setValidationError] = useState<string | null>(null);

  // Local state for grid inputs: { [student_id]: CellEntry }
  const [localMarks, setLocalMarks] = useState<Record<string, CellEntry>>({});
  const [saveToast, setSaveToast] = useState<{
    type: 'saving' | 'success' | 'error';
    title: string;
    message: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isLoadingMarks, setIsLoadingMarks] = useState<boolean>(false);

  // Stage 8C: Active-editing dirty-cell protection & remote conflict tracking
  const [dirtyCells, setDirtyCells] = useState<Set<string>>(new Set());
  const [remoteConflicts, setRemoteConflicts] = useState<Record<string, { remoteValue: string; timestamp: string }>>({});
  const dirtyCellsRef = React.useRef<Set<string>>(new Set());
  dirtyCellsRef.current = dirtyCells;

  const getCellKey = (studentId: string) => `${studentId}_${selectedSubjectId}_${selectedExamId}`;

  const markCellDirty = (studentId: string) => {
    if (!selectedSubjectId || !selectedExamId) return;
    const key = getCellKey(studentId);
    setDirtyCells((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  };

  // Optional Summary & Grid Display Filters
  const [sortByAdmission, setSortByAdmission] = useState<boolean>(false);
  const [sortByPerformance, setSortByPerformance] = useState<boolean>(false);
  const [doNotAssignPositions, setDoNotAssignPositions] = useState<boolean>(false);
  const [includeXYInSummary, setIncludeXYInSummary] = useState<boolean>(false);

  // Check if current user can edit the selected class and subject
  const hasExistingMarksInGrid = useMemo(() => {
    if (!selectedExamId || !selectedClassId || !selectedSubjectId) return false;
    return marks.some(
      (m) =>
        m.exam_id === selectedExamId &&
        m.subject_id === selectedSubjectId &&
        students.some((s) => s.class_id === selectedClassId && s.id === m.student_id)
    );
  }, [selectedExamId, selectedClassId, selectedSubjectId, marks, students]);

  const canEditSelectedClass = selectedClassId ? canUserEditClassMarks(currentUser || null, activeTeacher, selectedClassId, classes) : true;
  const canEditSelectedSubject = selectedSubjectId ? canUserEditSubjectMarks(currentUser || null, activeTeacher, selectedSubjectId, selectedClassId, classes, hasExistingMarksInGrid) : true;
  const canEditCurrentGrid = canUserEditClassAndSubjectMarks(currentUser || null, activeTeacher, selectedClassId, selectedSubjectId, classes, hasExistingMarksInGrid);

  // Active examination and lock status
  const selectedExam = exams.find((e) => e.id === selectedExamId);
  const selectedClassObj = classes.find((c) => c.id === selectedClassId || c.stream_id === selectedClassId || c.class_name === selectedClassId);
  const isExamApproved = selectedExam ? isClassExamApproved(selectedExam, selectedClassObj) : false;
  const isGridModifiable = canModify && canEditCurrentGrid && !isExamApproved;
  const [showReopenConfirm, setShowReopenConfirm] = useState<boolean>(false);

  // PDF Export States
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // PDF Export Handlers
  const handlePrintPerformance = async () => {
    if (!selectedExamId || !selectedClassId || !selectedSubjectId) {
      setExportError('Please select Assessment, Class, and Subject to export subject performance report.');
      return;
    }
    const targetExam = exams.find((e) => e.id === selectedExamId);
    const targetSubject = subjects.find((s) => s.id === selectedSubjectId);
    if (!targetExam || !targetSubject) {
      setExportError('Selected assessment or subject record not found.');
      return;
    }

    setIsExporting(true);
    setExportError(null);

    try {
      const school = api.getSchool();
      const selectedClassObj = classes.find((c) => c.stream_id === selectedClassId || c.id === selectedClassId);
      await exportSubjectPerformanceAnalysisPDF({
        school,
        exam: targetExam,
        subject: targetSubject,
        selectedClassId: selectedClassObj ? selectedClassObj.class_name : selectedClassId,
        selectedStreamId: selectedClassObj ? selectedClassObj.id : selectedClassId,
        students,
        marks,
        grades,
        classes,
        teachers,
        generatedBy: currentUser?.name || 'Administrator',
      });
    } catch (err: any) {
      console.error('Error generating Subject Performance PDF:', err);
      setExportError(err?.message || 'Failed to generate Subject Performance report.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleRawMarksAllSubjects = async () => {
    if (!selectedExamId || !selectedClassId) {
      setExportError('Please select Assessment and Class to export raw marks sheet.');
      return;
    }
    const targetExam = exams.find((e) => e.id === selectedExamId);
    if (!targetExam) {
      setExportError('Selected assessment record not found.');
      return;
    }

    setIsExporting(true);
    setExportError(null);

    try {
      const school = api.getSchool();
      const selectedClassObj = classes.find((c) => c.stream_id === selectedClassId || c.id === selectedClassId);
      await exportRawMarksAllSubjectsPDF({
        school,
        exam: targetExam,
        selectedClassId: selectedClassObj ? selectedClassObj.class_name : selectedClassId,
        selectedStreamId: selectedClassObj ? (selectedClassObj.stream_id || selectedClassObj.id) : selectedClassId,
        students,
        subjects,
        marks,
        grades,
        classes,
        teachers,
        generatedBy: currentUser?.name || 'Administrator',
      });
    } catch (err: any) {
      console.error('Error generating Raw Marks PDF:', err);
      setExportError(err?.message || 'Failed to generate Raw Marks report.');
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrintScoreSheet = async () => {
    if (!selectedClassId) {
      setExportError('Please select a Class to export score sheet.');
      return;
    }
    const targetExam = exams.find((e) => e.id === selectedExamId) || null;
    const targetSubject = subjects.find((s) => s.id === selectedSubjectId) || null;

    setIsExporting(true);
    setExportError(null);

    try {
      const school = api.getSchool();
      const selectedClassObj = classes.find((c) => c.stream_id === selectedClassId || c.id === selectedClassId);
      await exportScoreSheetPDF({
        school,
        exam: targetExam,
        subject: targetSubject,
        outOfMaxScore,
        selectedClassId: selectedClassObj ? selectedClassObj.class_name : selectedClassId,
        selectedStreamId: selectedClassObj ? (selectedClassObj.stream_id || selectedClassObj.id) : selectedClassId,
        students,
        classes,
        teachers,
        generatedBy: currentUser?.name || 'Administrator',
      });
    } catch (err: any) {
      console.error('Error generating Score Sheet PDF:', err);
      setExportError(err?.message || 'Failed to generate Score Sheet.');
    } finally {
      setIsExporting(false);
    }
  };

  // Filter students by selected class/stream (exclude inactive and future intake learners from active marks entry)
  const selectedClassObjForFilter = classes.find((c) => c.stream_id === selectedClassId || c.id === selectedClassId);
  const classStudents = selectedClassId
    ? students.filter((s) => {
        if (s.active === false || s.enrolment_status === 'future') return false;
        if (s.stream_id && (s.stream_id === selectedClassId || (selectedClassObjForFilter?.stream_id && s.stream_id === selectedClassObjForFilter.stream_id))) {
          return true;
        }
        if (s.class_id && (s.class_id === selectedClassId || (selectedClassObjForFilter?.id && s.class_id === selectedClassObjForFilter.id))) {
          if (!selectedClassObjForFilter?.stream_id || !s.stream_id || s.stream_id === selectedClassObjForFilter.stream_id) {
            return true;
          }
        }
        return false;
      })
    : [];

  // Clear dirty state and conflicts when workflow selection filters change
  useEffect(() => {
    setDirtyCells(new Set());
    setRemoteConflicts({});
  }, [selectedExamId, selectedClassId, selectedSubjectId]);

  // Load existing marks into local state whenever filters change
  useEffect(() => {
    let isMounted = true;
    if (!selectedExamId || !selectedClassId || !selectedSubjectId) {
      setLocalMarks({});
      setOutOfMaxScore('');
      setValidationError(null);
      setIsLoadingMarks(false);
      setDirtyCells(new Set());
      setRemoteConflicts({});
      return;
    }

    setIsLoadingMarks(true);

    const loadWorkflowData = async () => {
      try {
        const fetchedMarks = await api.fetchMarksForWorkflow({
          examId: selectedExamId,
          subjectId: selectedSubjectId,
          studentIds: classStudents.map((s) => s.id),
          classId: selectedClassId,
        });

        if (!isMounted) return;

        const activeMarksList = fetchedMarks && fetchedMarks.length > 0 ? fetchedMarks : marks;
        let existingOutOf: number | null = null;

        setLocalMarks((prevLocal) => {
          const mergedMap: Record<string, CellEntry> = {};
          const newConflicts: Record<string, { remoteValue: string; timestamp: string }> = {};

          classStudents.forEach((std) => {
            const cellKey = `${std.id}_${selectedSubjectId}_${selectedExamId}`;
            const match = activeMarksList.find(
              (m) =>
                m.student_id === std.id &&
                m.exam_id === selectedExamId &&
                m.subject_id === selectedSubjectId
            );

            let remoteCellEntry: CellEntry = { rawScore: '', status: 'Blank', irregularityReason: 'Absent' };
            if (match) {
              if (match.out_of && match.out_of > 0) existingOutOf = match.out_of;
              const evalRes = evaluateMark(match);

              if (evalRes.status === 'Normal') {
                remoteCellEntry = {
                  rawScore: evalRes.rawScore !== null ? String(evalRes.rawScore) : String(match.marks),
                  status: 'Normal',
                  irregularityReason: 'Absent',
                };
              } else if (evalRes.status === 'X') {
                remoteCellEntry = {
                  rawScore: 'X',
                  status: 'X',
                  irregularityReason: 'Absent',
                };
              } else if (evalRes.status === 'Y') {
                remoteCellEntry = {
                  rawScore: 'Y',
                  status: 'Y',
                  irregularityReason: match.irregularity_reason || 'Absent',
                };
              } else {
                remoteCellEntry = {
                  rawScore: '',
                  status: 'Blank',
                  irregularityReason: 'Absent',
                };
              }
            }

            if (dirtyCellsRef.current.has(cellKey) && prevLocal[std.id]) {
              mergedMap[std.id] = prevLocal[std.id];
              if (
                remoteCellEntry.rawScore !== prevLocal[std.id].rawScore ||
                remoteCellEntry.status !== prevLocal[std.id].status
              ) {
                const displayVal =
                  remoteCellEntry.rawScore ||
                  (remoteCellEntry.status !== 'Blank' ? remoteCellEntry.status : 'Blank');
                newConflicts[cellKey] = {
                  remoteValue: displayVal,
                  timestamp: match?.updated_at || '',
                };
              }
            } else {
              mergedMap[std.id] = remoteCellEntry;
            }
          });

          setRemoteConflicts(newConflicts);
          return mergedMap;
        });

        const targetExam = exams.find((e) => e.id === selectedExamId);
        const storedMaxScore =
          existingOutOf !== null && existingOutOf > 0
            ? existingOutOf
            : targetExam?.max_marks && targetExam.max_marks > 0
            ? targetExam.max_marks
            : null;

        setOutOfMaxScore((prev) => (prev ? prev : storedMaxScore !== null ? String(storedMaxScore) : ''));
        setValidationError(null);
      } catch (err) {
        console.error('Error loading workflow marks:', err);
      } finally {
        if (isMounted) {
          setIsLoadingMarks(false);
        }
      }
    };

    loadWorkflowData();

    return () => {
      isMounted = false;
    };
  }, [selectedExamId, selectedClassId, selectedSubjectId, marks, students, exams]);

  // Stage 8C: Realtime Event Stream Protection for Active Cell Edits
  useEffect(() => {
    if (!selectedExamId || !selectedSubjectId) return;

    const unsubscribe = subscribeToMarksRealtime((event: RealtimeMarkEvent) => {
      const raw = event.newRecord || event.oldRecord;
      if (!raw) return;

      const eventExamId = raw.exam_id;
      const eventSubjectId = raw.subject_id;
      const eventStudentId = raw.student_id;

      if (
        eventExamId === selectedExamId &&
        eventSubjectId === selectedSubjectId &&
        eventStudentId
      ) {
        // Resolve student ID within classStudents (handles both UUID and ID matches)
        const targetStudent = classStudents.find(
          (s) => s.id === eventStudentId || s.admission_number === eventStudentId
        );
        const resolvedStudentId = targetStudent ? targetStudent.id : eventStudentId;
        const cellKey = `${resolvedStudentId}_${selectedSubjectId}_${selectedExamId}`;

        if (event.eventType === 'DELETE') {
          if (dirtyCellsRef.current.has(cellKey)) {
            setRemoteConflicts((prev) => ({
              ...prev,
              [cellKey]: { remoteValue: 'Deleted', timestamp: new Date().toISOString() },
            }));
          } else {
            setLocalMarks((prev) => ({
              ...prev,
              [resolvedStudentId]: { rawScore: '', status: 'Blank', irregularityReason: 'Absent' },
            }));
            setRemoteConflicts((prev) => {
              const next = { ...prev };
              delete next[cellKey];
              return next;
            });
          }
          return;
        }

        const mappedList = api.mapDatabaseMarks([raw]);
        if (!mappedList || mappedList.length === 0) return;
        const mappedMark = mappedList[0];
        const evalRes = evaluateMark(mappedMark);

        // Update Out Of max score if not yet defined locally
        if (mappedMark.out_of && mappedMark.out_of > 0) {
          setOutOfMaxScore((prev) => (prev ? prev : String(mappedMark.out_of)));
        }

        let remoteEntry: CellEntry = { rawScore: '', status: 'Blank', irregularityReason: 'Absent' };
        if (evalRes.status === 'Normal') {
          remoteEntry = {
            rawScore: evalRes.rawScore !== null ? String(evalRes.rawScore) : String(mappedMark.marks),
            status: 'Normal',
            irregularityReason: 'Absent',
          };
        } else if (evalRes.status === 'X') {
          remoteEntry = { rawScore: 'X', status: 'X', irregularityReason: 'Absent' };
        } else if (evalRes.status === 'Y') {
          remoteEntry = { rawScore: 'Y', status: 'Y', irregularityReason: mappedMark.irregularity_reason || 'Absent' };
        }

        if (dirtyCellsRef.current.has(cellKey)) {
          const displayVal = remoteEntry.rawScore || (remoteEntry.status !== 'Blank' ? remoteEntry.status : 'Blank');
          setRemoteConflicts((prev) => ({
            ...prev,
            [cellKey]: { remoteValue: displayVal, timestamp: mappedMark.updated_at || '' },
          }));
        } else {
          setLocalMarks((prev) => ({
            ...prev,
            [resolvedStudentId]: remoteEntry,
          }));
          setRemoteConflicts((prev) => {
            const next = { ...prev };
            delete next[cellKey];
            return next;
          });
        }
      }
    });

    return () => {
      if (unsubscribe) {
        unsubscribeFromMarksRealtime(unsubscribe);
      }
    };
  }, [selectedExamId, selectedSubjectId, classStudents]);

  const handleInputChange = (studentId: string, val: string) => {
    markCellDirty(studentId);
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
    markCellDirty(studentId);
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
    markCellDirty(studentId);
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
    classStudents.forEach((std) => markCellDirty(std.id));
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

  const handleSaveAll = async (): Promise<boolean> => {
    setValidationError(null);

    if (isExamApproved) {
      setValidationError(`Marks Entry Locked: Assessment "${selectedExam?.exam_name}" is approved. Marks can no longer be entered or edited.`);
      return false;
    }

    if (!canEditCurrentGrid) {
      setValidationError('Access Restricted: You are not assigned to enter or edit marks for this class or learning area.');
      return false;
    }

    const trimmedOutOf = String(outOfMaxScore).trim();
    const parsedMaxScore = parseFloat(trimmedOutOf);

    if (!trimmedOutOf || isNaN(parsedMaxScore) || parsedMaxScore <= 0) {
      setValidationError('Please enter the maximum score (Assessment Out Of) before saving marks.');
      return false;
    }

    // Check for unallocated Grade 4-9 new mark entry attempt
    const newUnallocatedAttempt = classStudents.find((std) => {
      const entry = localMarks[std.id];
      if (!entry || entry.status === 'Blank' || entry.rawScore === '') return false;

      const studentHasExistingMark = marks.some(
        (m) =>
          m.student_id === std.id &&
          m.exam_id === selectedExamId &&
          m.subject_id === selectedSubjectId
      );

      const canEdit = canUserEditClassAndSubjectMarks(
        currentUser || null,
        activeTeacher,
        selectedClassId,
        selectedSubjectId,
        classes,
        studentHasExistingMark
      );

      return !canEdit;
    });

    if (newUnallocatedAttempt) {
      setValidationError(
        `Access Restricted: You do not have permission to enter or edit marks for this learning area in this class.`
      );
      return false;
    }
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
      return false;
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
      return false;
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

    setIsSaving(true);
    setSaveToast({
      type: 'saving',
      title: 'Saving marks…',
      message: '',
    });

    try {
      await onSaveMarks(newMarksToSave);
      setDirtyCells(new Set());
      dirtyCellsRef.current = new Set();
      setRemoteConflicts({});
      setSaveToast({
        type: 'success',
        title: 'Marks saved successfully',
        message: '',
      });
      setTimeout(() => {
        setSaveToast((current) => (current?.type === 'success' ? null : current));
      }, 3000);
      return true;
    } catch (err: any) {
      setSaveToast({
        type: 'error',
        title: 'Marks not saved',
        message: getUserFriendlyErrorMessage(err, 'Unable to save marks. Please check your connection and try again.'),
      });
      // Retain dirtyCells and unsaved local marks so teacher can retry
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const selectedClass = classes.find((c) => c.stream_id === selectedClassId || c.id === selectedClassId);

  // Filter subjects applicable to the selected class's grade level and accessible to teacher
  const gradeSubjects = selectedClass
    ? api.getSubjectsForClass(selectedClass)
    : [];

  const rawApplicableSubjects = selectedClass
    ? getAccessibleSubjects(
        currentUser || null,
        activeTeacher,
        gradeSubjects.length > 0 ? gradeSubjects : subjects,
        selectedClassId,
        classes
      )
    : getAccessibleSubjects(currentUser || null, activeTeacher, subjects, undefined, classes);

  const applicableSubjects = sortSubjectsByStandardOrder(rawApplicableSubjects);

  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId);

  const isExamSelected = Boolean(selectedExamId);
  const isClassSelected = Boolean(selectedClassId);
  const isSubjectSelected = Boolean(selectedSubjectId);
  const isOutOfValid = Boolean(outOfMaxScore && !isNaN(parseFloat(outOfMaxScore)) && parseFloat(outOfMaxScore) > 0);
  const isSelectionComplete = isExamSelected && isClassSelected && isSubjectSelected && isOutOfValid;

  // Unsaved Marks Protection Navigation State & Handlers
  interface PendingWorkflowChange {
    type: 'exam' | 'class' | 'subject';
    targetValue: string;
  }

  const [pendingWorkflowChange, setPendingWorkflowChange] = useState<PendingWorkflowChange | null>(null);

  const applyWorkflowChange = (change: PendingWorkflowChange) => {
    if (change.type === 'exam') {
      setSelectedExamId(change.targetValue);
      setSelectedClassId('');
      setSelectedSubjectId('');
      setOutOfMaxScore('');
    } else if (change.type === 'class') {
      setSelectedClassId(change.targetValue);
      setSelectedSubjectId('');
      setOutOfMaxScore('');
    } else if (change.type === 'subject') {
      setSelectedSubjectId(change.targetValue);
      setOutOfMaxScore('');
    }
    if (validationError) setValidationError(null);
  };

  const handleExamChangeRequest = (newExamId: string) => {
    if (newExamId === selectedExamId) return;
    if (dirtyCells.size > 0) {
      setPendingWorkflowChange({ type: 'exam', targetValue: newExamId });
    } else {
      applyWorkflowChange({ type: 'exam', targetValue: newExamId });
    }
  };

  const handleClassChangeRequest = (newClassId: string) => {
    if (newClassId === selectedClassId) return;
    if (dirtyCells.size > 0) {
      setPendingWorkflowChange({ type: 'class', targetValue: newClassId });
    } else {
      applyWorkflowChange({ type: 'class', targetValue: newClassId });
    }
  };

  const handleSubjectChangeRequest = (newSubjectId: string) => {
    if (newSubjectId === selectedSubjectId) return;
    if (dirtyCells.size > 0) {
      setPendingWorkflowChange({ type: 'subject', targetValue: newSubjectId });
    } else {
      applyWorkflowChange({ type: 'subject', targetValue: newSubjectId });
    }
  };

  const handleCancelUnsavedChange = () => {
    setPendingWorkflowChange(null);
  };

  const handleDiscardUnsavedChange = () => {
    if (!pendingWorkflowChange) return;
    const changeToApply = pendingWorkflowChange;
    setPendingWorkflowChange(null);
    setDirtyCells(new Set());
    dirtyCellsRef.current = new Set();
    applyWorkflowChange(changeToApply);
  };

  const handleSaveAndContinue = async () => {
    if (!pendingWorkflowChange) return;
    const changeToApply = pendingWorkflowChange;
    const saveSuccess = await handleSaveAll();
    if (saveSuccess) {
      setPendingWorkflowChange(null);
      applyWorkflowChange(changeToApply);
    } else {
      setPendingWorkflowChange(null);
    }
  };

  const handleClassSelect = (newClassId: string) => {
    handleClassChangeRequest(newClassId);
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
      <div className="bg-white dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 lg:p-6 shadow-sm transition-all">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6">
          <div className="flex items-start space-x-3.5 sm:space-x-4 min-w-0 flex-1">
            <div className="p-2.5 sm:p-3 rounded-xl bg-emerald-50 dark:bg-zinc-800 border border-emerald-200/60 dark:border-zinc-700 text-[#176B45] dark:text-zinc-300 shrink-0 shadow-2xs">
              <FileSpreadsheet className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="space-y-2 min-w-0 flex-1">
              <h1 className="text-base sm:text-lg md:text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 leading-snug">
                Fast Marks & Assessment Status Entry Grid
              </h1>
              <div className="p-2 sm:p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/80 rounded-xl text-xs flex flex-wrap items-center gap-x-2 gap-y-1 text-amber-900 dark:text-amber-200">
                <span className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                  ⚠️ Mark Status Guide
                </span>
                <span className="text-amber-300 dark:text-amber-700 hidden sm:inline">&middot;</span>
                <span className="text-amber-800 dark:text-amber-200 font-medium">
                  X = Missing Mark &nbsp;&middot;&nbsp; Y = Irregularity &nbsp;&middot;&nbsp; Blank = Not Applicable
                </span>
              </div>
            </div>
          </div>

          <div className="w-full md:w-auto shrink-0 pt-1 md:pt-0">
            <button
              onClick={handleSaveAll}
              disabled={!isGridModifiable || !isSelectionComplete || isSaving}
              className={`w-full md:w-auto font-bold text-xs sm:text-sm px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl transition-all duration-150 flex items-center justify-center space-x-2 shrink-0 ${
                !isGridModifiable || !isSelectionComplete || isSaving
                  ? 'bg-slate-100 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-200 dark:border-slate-700/70'
                  : 'bg-[#176B45] hover:bg-[#115234] dark:bg-emerald-700 dark:hover:bg-emerald-800 text-white shadow-md shadow-emerald-950/10 cursor-pointer border border-transparent active:scale-[0.99]'
              }`}
            >
              {isSaving ? <RefreshCw className="w-4 h-4 shrink-0 animate-spin" /> : <Save className="w-4 h-4 shrink-0" />}
              <span>{isSaving ? 'Saving Marks...' : 'Save All Grid Marks'}</span>
            </button>
          </div>
        </div>
      </div>

      {isExamApproved && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200 rounded-xl text-xs font-semibold flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900 rounded-lg shrink-0">
              <Lock className="w-5 h-5 text-emerald-800 dark:text-emerald-300" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-emerald-900 dark:text-emerald-100">
                {selectedClassObj ? `Marks Entry Locked for ${selectedClassObj.class_name} ${selectedClassObj.stream}` : 'Marks Entry Locked'}
              </h4>
              <p className="text-emerald-800 dark:text-emerald-300 text-xs mt-0.5">
                {selectedExam?.status === 'Approved'
                  ? 'Assessment is officially approved and locked across all classes. Marks can no longer be edited.'
                  : `Results for ${selectedClassObj ? `${selectedClassObj.class_name} ${selectedClassObj.stream}` : 'this class stream'} have been approved and locked. Other streams remain editable.`}
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

      {/* Floating Brief Pop-up Toast: Save status */}
      {saveToast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed top-4 left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:right-6 sm:top-5 z-50 flex items-center bg-white/95 dark:bg-slate-900/95 text-slate-900 dark:text-slate-100 shadow-lg shadow-black/10 dark:shadow-black/30 rounded-2xl px-3.5 py-2 sm:px-4 sm:py-2.5 backdrop-blur-md space-x-2.5 max-w-[calc(100vw-2rem)] sm:max-w-md transition-all duration-300 animate-in fade-in slide-in-from-top-2 border ${
            saveToast.type === 'saving'
              ? 'border-sky-300 dark:border-sky-700/80'
              : saveToast.type === 'success'
              ? 'border-emerald-300 dark:border-emerald-700/80'
              : 'border-rose-300 dark:border-rose-700/80'
          }`}
        >
          {saveToast.type === 'saving' && (
            <RefreshCw className="w-4 h-4 text-sky-500 dark:text-sky-400 flex-shrink-0 animate-spin" />
          )}
          {saveToast.type === 'success' && (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          )}
          {saveToast.type === 'error' && (
            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 flex-shrink-0" />
          )}
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-bold leading-tight truncate">{saveToast.title}</span>
            {saveToast.message && saveToast.type === 'error' && (
              <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight truncate">
                {saveToast.message}
              </span>
            )}
          </div>
          {saveToast.type === 'error' && (
            <button
              onClick={() => setSaveToast(null)}
              className="ml-1 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Floating Brief Pop-up Toast: Validation alert */}
      {validationError && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-4 left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:right-6 sm:top-5 z-50 flex items-center bg-white/95 dark:bg-slate-900/95 text-slate-900 dark:text-slate-100 border border-amber-300 dark:border-amber-700/80 shadow-lg shadow-black/10 dark:shadow-black/30 rounded-2xl px-3.5 py-2 sm:px-4 sm:py-2.5 backdrop-blur-md space-x-2.5 max-w-[calc(100vw-2rem)] sm:max-w-md transition-all duration-300 animate-in fade-in slide-in-from-top-2"
        >
          <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400 flex-shrink-0" />
          <span className="text-xs font-bold leading-tight truncate">{validationError}</span>
          <button
            onClick={() => setValidationError(null)}
            className="ml-1 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Filter Selector Panel & Assessment Out-Of Config */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-4 sm:p-5 shadow-xs border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="w-full bg-[#E8F3EE] dark:bg-zinc-800/50 p-3 rounded-lg border border-[#2E7D5B]/20 dark:border-zinc-700/60">
          <div className="flex items-center space-x-2 text-xs font-bold text-[#176B45] dark:text-zinc-300 uppercase tracking-wider">
            <Filter className="w-4 h-4 text-[#176B45] dark:text-zinc-400 flex-shrink-0" />
            <span>Select Target Assessment, Class, Subject & Assessment Out Of Grid</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 text-xs">
          {/* 1. Target Assessment */}
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-bold mb-1">Target Assessment *</label>
            <select
              value={selectedExamId}
              onChange={(e) => handleExamChangeRequest(e.target.value)}
              className="w-full h-10 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 font-semibold text-xs focus:ring-2 focus:ring-[#176B45] focus:border-[#176B45] focus:outline-none shadow-2xs max-w-full truncate cursor-pointer"
            >
              <option value="">Select Assessment</option>
              {exams.map((ex, idx) => {
                const isCurrentSession = ex.year === activeYearObj?.year && ex.term === activeTermObj?.term_name;
                return (
                  <option key={`${ex.id}_${idx}`} value={ex.id}>
                    {ex.exam_name} ({ex.term} {ex.year}) — {ex.status} {isCurrentSession ? '(Active Session)' : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {/* 2. Class */}
          <div>
            <label className={`block font-bold mb-1 ${!selectedExamId ? 'text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-300'}`}>Class *</label>
            <select
              disabled={!selectedExamId}
              value={selectedExamId ? selectedClassId : ''}
              onChange={(e) => handleClassChangeRequest(e.target.value)}
              className={`w-full h-10 border rounded-lg px-3 py-2 font-semibold text-xs transition max-w-full truncate ${
                !selectedExamId
                  ? 'bg-slate-100 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-800 cursor-not-allowed opacity-75'
                  : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 cursor-pointer focus:ring-2 focus:ring-[#176B45] focus:border-[#176B45] focus:outline-none shadow-2xs'
              }`}
            >
              <option value="">Select Class</option>
              {accessibleClasses.map((cls, idx) => (
                <option key={`${cls.stream_id || cls.id}_${cls.stream}_${idx}`} value={cls.stream_id || cls.id}>
                  {cls.class_name} {cls.stream}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Subject */}
          <div>
            <label className={`block font-bold mb-1 ${(!selectedExamId || !selectedClassId) ? 'text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-300'}`}>Subject *</label>
            <select
              disabled={!selectedExamId || !selectedClassId}
              value={(selectedExamId && selectedClassId) ? selectedSubjectId : ''}
              onChange={(e) => handleSubjectChangeRequest(e.target.value)}
              className={`w-full h-10 border rounded-lg px-3 py-2 font-semibold text-xs transition max-w-full truncate ${
                (!selectedExamId || !selectedClassId)
                  ? 'bg-slate-100 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-800 cursor-not-allowed opacity-75'
                  : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 cursor-pointer focus:ring-2 focus:ring-[#176B45] focus:border-[#176B45] focus:outline-none shadow-2xs'
              }`}
            >
              <option value="">Select Subject</option>
              {applicableSubjects.map((sb, idx) => (
                <option key={`${sb.id}_${idx}`} value={sb.id}>
                  {sb.subject_name} ({sb.subject_code})
                </option>
              ))}
            </select>
          </div>

          {/* 4. Assessment Out Of (Max Score) */}
          <div>
            <label className={`block font-bold mb-1 ${(!selectedExamId || !selectedClassId || !selectedSubjectId || !isGridModifiable) ? 'text-slate-400 dark:text-slate-500' : 'text-slate-700 dark:text-slate-300'}`}>
              Assessment Out Of (Max Score) *
            </label>
            <input
              type="number"
              min="1"
              max="500"
              disabled={!selectedExamId || !selectedClassId || !selectedSubjectId || !isGridModifiable}
              value={(selectedExamId && selectedClassId && selectedSubjectId) ? outOfMaxScore : ''}
              onChange={(e) => {
                setOutOfMaxScore(e.target.value);
                if (validationError) setValidationError(null);
              }}
              placeholder="100"
              className={`w-full h-10 border font-semibold text-xs rounded-lg px-3 py-2 transition shadow-2xs placeholder-slate-400 ${
                (!selectedExamId || !selectedClassId || !selectedSubjectId || !isGridModifiable)
                  ? 'bg-slate-100 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-800 cursor-not-allowed opacity-75'
                  : validationError && (!outOfMaxScore || parseFloat(outOfMaxScore) <= 0)
                  ? 'bg-slate-50 dark:bg-slate-800 border-rose-500 ring-2 ring-rose-500 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#176B45] focus:border-[#176B45] focus:outline-none'
                  : 'bg-slate-50 dark:bg-slate-800 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-[#176B45] focus:border-[#176B45] focus:outline-none'
              }`}
            />
          </div>
        </div>

        {/* Quick Bulk Action Toolstrip */}
        {isSelectionComplete && isGridModifiable && (
          <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 dark:border-slate-800 text-xs">
            <span className="text-slate-700 dark:text-slate-300 font-bold">Quick Assessment Status Fill:</span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={classStudents.length === 0}
                onClick={() => handleBulkSetStatus('X')}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition flex items-center space-x-1 border ${
                  classStudents.length === 0
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 cursor-not-allowed'
                    : 'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/80 cursor-pointer'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                <span>Mark Empty as X (Missing)</span>
              </button>
              <button
                type="button"
                disabled={classStudents.length === 0}
                onClick={() => handleBulkSetStatus('Blank')}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition flex items-center space-x-1 border ${
                  classStudents.length === 0
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 cursor-not-allowed'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer'
                }`}
              >
                <Ban className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                <span>Mark Empty as Blank</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MARKS SPREADSHEET TABLE OR SELECTION PROMPT */}
      {isLoadingMarks ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl p-8 border border-slate-200 dark:border-slate-800 shadow-xs">
          <LoadingIndicator minHeight="min-h-[300px]" />
        </div>
      ) : !isSelectionComplete ? (
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
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs text-slate-800 dark:text-slate-200">
              <span className="font-bold uppercase tracking-wider text-[10px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200/60 dark:border-slate-700/60 whitespace-nowrap">
                Active Sheet
              </span>
              <span className="font-bold text-[#176B45] dark:text-emerald-400">
                {selectedExam?.exam_name || 'Assessment'}
              </span>
              <span className="text-slate-400 dark:text-slate-600 font-bold">&bull;</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {selectedClass?.class_name} {selectedClass?.stream}
              </span>
              <span className="text-slate-400 dark:text-slate-600 font-bold">&bull;</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {selectedSubject?.subject_name}
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-semibold text-[11px] whitespace-nowrap">
                {classStudents.length} {classStudents.length === 1 ? 'Learner' : 'Learners'}
              </span>
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center shrink-0 whitespace-nowrap">
              {(() => {
                const pMax = parseFloat(outOfMaxScore);
                const isPMaxValid = !isNaN(pMax) && pMax > 0;
                return (
                  <div className="inline-flex items-center space-x-1.5 bg-slate-50 dark:bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-200/80 dark:border-slate-700/80">
                    <span className="text-slate-600 dark:text-slate-400 font-medium">Assessment Max Score:</span>
                    <strong className={isPMaxValid ? 'text-slate-900 dark:text-slate-100 font-bold' : 'text-rose-600 font-bold font-mono'}>
                      {isPMaxValid ? `${pMax} Marks` : 'Not Set (Required)'}
                    </strong>
                  </div>
                );
              })()}
            </div>
          </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700 text-[11px]">
                <th className="px-2.5 py-2.5 w-10 text-slate-500 dark:text-slate-400">No.</th>
                <th className="px-2.5 py-2.5 min-w-[150px]">Learner Details</th>
                <th className="px-2.5 py-2.5 w-40">Score / Status</th>
                <th className="px-2 py-2.5 text-center w-14">%</th>
                <th className="px-2 py-2.5 text-center w-24">Level</th>
                <th className="px-2 py-2.5 text-center w-12">Pts</th>
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

                  const studentHasExistingMark = marks.some(
                    (m) =>
                      m.student_id === std.id &&
                      m.exam_id === selectedExamId &&
                      m.subject_id === selectedSubjectId
                  );
                  const canEditStudentRow = canUserEditClassAndSubjectMarks(
                    currentUser || null,
                    activeTeacher,
                    selectedClassId,
                    selectedSubjectId,
                    classes,
                    studentHasExistingMark
                  );
                  const isRowDisabled = !isGridModifiable || !canEditStudentRow;

                  const percentage = isNormalScore && isPMaxValid ? (numVal / pMax) * 100 : null;

                  const gradeObj = percentage !== null ? getGradeForMark(percentage, grades) : null;
                  const level = gradeObj?.performance_level || 'ME';
                  const code = gradeObj?.grade_code || gradeObj?.grade || '-';

                  return (
                    <tr key={`${std.id}_${idx}`} className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition ${entry.status === 'X' ? 'bg-rose-50/30 dark:bg-rose-950/20' : entry.status === 'Y' ? 'bg-purple-50/30 dark:bg-purple-950/20' : isExceeding ? 'bg-rose-50/40 dark:bg-rose-950/30' : ''}`}>
                      <td className="px-2.5 py-2 text-slate-400 font-bold">
                        {!doNotAssignPositions && studentPositions[std.id] ? `${studentPositions[std.id]}` : idx + 1}
                      </td>
                      <td className="px-2.5 py-2">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 dark:text-slate-100 text-xs leading-snug break-words">
                            {std.full_name}
                          </span>
                          <span className="font-mono text-[11px] font-semibold text-[#176B45] dark:text-emerald-400">
                            {std.admission_number}
                          </span>
                        </div>
                      </td>
                      
                      {/* Score / Status Input Cell */}
                      <td className="px-2.5 py-2">
                        <div className="flex items-center space-x-1.5">
                          <input
                            type="text"
                            value={entry.rawScore}
                            disabled={isRowDisabled}
                            onChange={(e) => {
                              handleInputChange(std.id, e.target.value);
                              if (validationError) setValidationError(null);
                            }}
                            placeholder={!canEditStudentRow ? 'Unallocated' : isPMaxValid ? `0-${pMax}` : '0-Max'}
                            className={`w-16 border rounded-lg px-2 py-1 font-bold font-mono text-xs text-center focus:ring-2 focus:outline-none uppercase ${
                              isRowDisabled
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
                          <span className="text-slate-500 dark:text-slate-300 text-xs font-bold font-mono">
                            /{isPMaxValid ? pMax : '?'}
                          </span>

                          <select
                            aria-label={`Status for ${std.full_name}`}
                            value={entry.status}
                            disabled={isRowDisabled}
                            tabIndex={-1}
                            onChange={(e) => handleStatusChange(std.id, e.target.value as SubjectStatus)}
                            className={`text-[10px] font-bold border rounded-md px-1.5 py-1 focus:ring-1 focus:outline-none transition cursor-pointer ${
                              entry.status === 'X'
                                ? 'bg-rose-50 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-700'
                                : entry.status === 'Y'
                                ? 'bg-purple-50 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-700'
                                : entry.status === 'Blank'
                                ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                            }`}
                          >
                            <option value="Normal">Score</option>
                            <option value="X">X (Missing)</option>
                            <option value="Y">Y (Irregular)</option>
                            <option value="Blank">Blank (N/A)</option>
                          </select>
                        </div>

                        {/* Irregularity Reason Selector for Y status */}
                        {entry.status === 'Y' && (
                          <div className="mt-1 space-y-0.5">
                            <span className="text-purple-700 dark:text-purple-400 font-bold block text-[10px]">Irregularity Reason:</span>
                            <select
                              value={entry.irregularityReason}
                              disabled={isRowDisabled}
                              onChange={(e) => handleReasonChange(std.id, e.target.value)}
                              className="w-full bg-purple-50 dark:bg-purple-950/60 border border-purple-300 dark:border-purple-800 text-purple-900 dark:text-purple-200 font-bold rounded px-1.5 py-0.5 text-[11px] focus:ring-1 focus:ring-[#176B45]"
                            >
                              {IRREGULARITY_REASONS.map((r) => (
                                <option key={r} value={r}>
                                  {r}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {/* Stage 8C: Inline Remote Conflict Indicator for Active Dirty Cells */}
                        {(() => {
                          const cellKey = `${std.id}_${selectedSubjectId}_${selectedExamId}`;
                          const conflict = remoteConflicts[cellKey];
                          if (!conflict) return null;

                          return (
                            <div className="flex items-center space-x-1 mt-1 text-[10px] font-bold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/80 px-2 py-0.5 rounded border border-amber-300 dark:border-amber-800/80">
                              <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                              <span>Remote update: {conflict.remoteValue}</span>
                            </div>
                          );
                        })()}
                      </td>

                      {/* Percentage Cell */}
                      <td className="px-2 py-2 text-center font-bold font-mono text-xs">
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
                      <td className="px-2 py-2 text-center">
                        {gradeObj ? (
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold border inline-block whitespace-nowrap ${
                              level === 'EE'
                                ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800'
                                : level === 'ME'
                                ? 'bg-sky-100 dark:bg-sky-950/80 text-sky-900 dark:text-sky-200 border-sky-300 dark:border-sky-800'
                                : level === 'AE'
                                ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-800'
                                : 'bg-rose-100 dark:bg-rose-950/80 text-rose-900 dark:text-rose-200 border-rose-300 dark:border-rose-800'
                            }`}
                          >
                            {code}
                          </span>
                        ) : entry.status === 'X' ? (
                          <span className="bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800 px-1.5 py-0.5 rounded text-[10px] font-black">X</span>
                        ) : entry.status === 'Y' ? (
                          <span className="bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-800 px-1.5 py-0.5 rounded text-[10px] font-black">Y</span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600 font-mono">-</span>
                        )}
                      </td>

                      {/* Points Cell */}
                      <td className="px-2 py-2 text-center font-mono font-extrabold text-slate-800 dark:text-slate-200 text-xs">
                        {gradeObj ? gradeObj.points : <span className="text-slate-300 dark:text-slate-600 font-mono">-</span>}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-10 px-4 bg-slate-50/50 dark:bg-slate-800/50">
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

        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            onClick={handleSaveAll}
            disabled={(!canModify) || !canEditCurrentGrid || !isSelectionComplete || isSaving}
            className={`font-bold text-xs px-4 py-2.5 rounded-lg shadow-xs transition flex items-center space-x-1.5 ${
              (!canModify) || !canEditCurrentGrid || !isSelectionComplete || isSaving
                ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-400 cursor-not-allowed border border-slate-300 dark:border-slate-700'
                : 'bg-[#176B45] hover:bg-[#0F5132] dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white shadow-md cursor-pointer'
            }`}
          >
            {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>{isSaving ? 'Saving Marks...' : 'Save All Grid Marks'}</span>
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
                {classSummaryData.evaluatedCount > 0 ? `${Math.round(classSummaryData.avgMarks)}%` : '—'}
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
                { code: 'EE1', count: classSummaryData.breakdown.EE1, activeBg: 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300/60 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200', activeLabelBg: 'bg-emerald-100/80 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-extrabold' },
                { code: 'EE2', count: classSummaryData.breakdown.EE2, activeBg: 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300/60 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200', activeLabelBg: 'bg-emerald-100/80 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-extrabold' },
                { code: 'ME1', count: classSummaryData.breakdown.ME1, activeBg: 'bg-sky-50/70 dark:bg-sky-950/30 border-sky-300/60 dark:border-sky-800/60 text-sky-900 dark:text-sky-200', activeLabelBg: 'bg-sky-100/80 dark:bg-sky-900/60 text-sky-800 dark:text-sky-300 font-extrabold' },
                { code: 'ME2', count: classSummaryData.breakdown.ME2, activeBg: 'bg-sky-50/70 dark:bg-sky-950/30 border-sky-300/60 dark:border-sky-800/60 text-sky-900 dark:text-sky-200', activeLabelBg: 'bg-sky-100/80 dark:bg-sky-900/60 text-sky-800 dark:text-sky-300 font-extrabold' },
                { code: 'AE1', count: classSummaryData.breakdown.AE1, activeBg: 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-300/60 dark:border-amber-800/60 text-amber-900 dark:text-amber-200', activeLabelBg: 'bg-amber-100/80 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 font-extrabold' },
                { code: 'AE2', count: classSummaryData.breakdown.AE2, activeBg: 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-300/60 dark:border-amber-800/60 text-amber-900 dark:text-amber-200', activeLabelBg: 'bg-amber-100/80 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 font-extrabold' },
                { code: 'BE1', count: classSummaryData.breakdown.BE1, activeBg: 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-300/60 dark:border-rose-800/60 text-rose-900 dark:text-rose-200', activeLabelBg: 'bg-rose-100/80 dark:bg-rose-900/60 text-rose-800 dark:text-rose-300 font-extrabold' },
                { code: 'BE2', count: classSummaryData.breakdown.BE2, activeBg: 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-300/60 dark:border-rose-800/60 text-rose-900 dark:text-rose-200', activeLabelBg: 'bg-rose-100/80 dark:bg-rose-900/60 text-rose-800 dark:text-rose-300 font-extrabold' },
                { code: 'X', count: classSummaryData.breakdown.X, activeBg: 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-300/60 dark:border-rose-800/60 text-rose-900 dark:text-rose-200', activeLabelBg: 'bg-rose-100/80 dark:bg-rose-900/60 text-rose-800 dark:text-rose-300 font-extrabold' },
                { code: 'Y', count: classSummaryData.breakdown.Y, activeBg: 'bg-purple-50/70 dark:bg-purple-950/30 border-purple-300/60 dark:border-purple-800/60 text-purple-900 dark:text-purple-200', activeLabelBg: 'bg-purple-100/80 dark:bg-purple-900/60 text-purple-800 dark:text-purple-300 font-extrabold' },
              ].map((item) => {
                const isActive = item.count > 0;
                return (
                  <div
                    key={item.code}
                    className={`border rounded-lg p-2 flex flex-col justify-between transition-colors ${
                      isActive
                        ? item.activeBg
                        : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 text-slate-400 dark:text-slate-500 opacity-75'
                    }`}
                  >
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded ${
                        isActive
                          ? item.activeLabelBg
                          : 'font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {item.code}
                    </span>
                    <span
                      className={`text-base font-mono mt-1 ${
                        isActive
                          ? 'font-black'
                          : 'font-semibold text-slate-400 dark:text-slate-500'
                      }`}
                    >
                      {item.count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* PDF Report Generation Buttons */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
            {exportError && (
              <div className="p-2.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 font-medium">
                {exportError}
              </div>
            )}
            <div className="flex flex-wrap items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={handlePrintPerformance}
                disabled={!selectedExamId || !selectedClassId || !selectedSubjectId || isExporting}
                className="inline-flex items-center space-x-1.5 px-4 py-2.5 rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition disabled:opacity-50 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Performance</span>
              </button>

              <button
                type="button"
                onClick={handleRawMarksAllSubjects}
                disabled={!selectedExamId || !selectedClassId || isExporting}
                className="inline-flex items-center space-x-1.5 px-4 py-2.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition disabled:opacity-50 cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Raw Marks — All Subjects</span>
              </button>

              <button
                type="button"
                onClick={handlePrintScoreSheet}
                disabled={!selectedClassId || isExporting}
                className="inline-flex items-center space-x-1.5 px-4 py-2.5 rounded-xl font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition disabled:opacity-50 cursor-pointer"
              >
                <FileText className="w-4 h-4" />
                <span>Print Score Sheet</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* UNSAVED MARKS CONFIRMATION MODAL */}
      {pendingWorkflowChange && (
        <div
          id="unsaved-marks-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="unsaved-marks-dialog-title"
          aria-describedby="unsaved-marks-dialog-desc"
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4"
        >
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center space-x-3 text-amber-700 dark:text-amber-400 border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="p-2.5 bg-amber-50 dark:bg-amber-950/80 rounded-xl">
                <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 id="unsaved-marks-dialog-title" className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
                  Unsaved Marks
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {dirtyCells.size} unsaved {dirtyCells.size === 1 ? 'cell change' : 'cell changes'} on active sheet
                </p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-700 dark:text-slate-300">
              <p id="unsaved-marks-dialog-desc" className="leading-relaxed font-semibold text-slate-700 dark:text-slate-300">
                You have unsaved marks on the current sheet. What would you like to do before changing the sheet?
              </p>
            </div>

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-2.5 pt-2">
              <button
                id="unsaved-marks-cancel-btn"
                type="button"
                disabled={isSaving}
                onClick={handleCancelUnsavedChange}
                className="px-4 py-2.5 rounded-xl font-bold text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer text-center disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                id="unsaved-marks-discard-btn"
                type="button"
                disabled={isSaving}
                onClick={handleDiscardUnsavedChange}
                className="px-4 py-2.5 rounded-xl font-bold text-xs bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 transition cursor-pointer text-center disabled:opacity-50"
              >
                Discard &amp; Continue
              </button>

              <button
                id="unsaved-marks-save-btn"
                type="button"
                disabled={isSaving}
                onClick={handleSaveAndContinue}
                className="px-5 py-2.5 rounded-xl font-black text-xs bg-[#176B45] hover:bg-[#125335] text-white shadow-md transition flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Save &amp; Continue</span>
                  </>
                )}
              </button>
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
                onClick={async () => {
                  setShowReopenConfirm(false);
                  if (onUpdateExamStatus) {
                    await onUpdateExamStatus(selectedExam.id, 'Draft');
                  }
                  if (selectedClassObj && onUpdateExamClassApproval) {
                    await onUpdateExamClassApproval(selectedExam.id, selectedClassObj.stream_id || selectedClassObj.id, false);
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
