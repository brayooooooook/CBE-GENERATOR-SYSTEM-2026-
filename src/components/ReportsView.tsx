import React, { useState, useEffect } from 'react';
import {
  FileBarChart,
  Award,
  Users,
  BookOpen,
  Download,
  CheckCircle,
  CheckCircle2,
  XCircle,
  Clock,
  BarChart2,
  TrendingUp,
  Layers,
  UserCheck,
  Archive,
  Loader2,
  FileText,
  AlertTriangle,
  ShieldCheck,
  Filter,
} from 'lucide-react';
import {
  School,
  Student,
  Subject,
  Examination,
  Mark,
  Grade,
  ClassStream,
  Teacher,
  User,
  LearnerReportComment,
  sortGrades,
  sortClasses,
} from '../types';
import {
  calculateExamResults,
  generateExamAnalysisSummary,
  getGradeForMark,
  getLearnerReportSubjects,
} from '../services/analysisEngine';
import { getFilteredStudents, stripSurroundingQuotes, getClassStreamLabel } from '../utils/filterUtils';
import {
  getActiveTeacher,
  getAccessibleClasses,
  getAccessibleSubjects,
  getAccessibleStudents,
} from '../utils/rbacUtils';
import { LearnerReportCard } from './LearnerReportCard';
import { ChartWrapper } from './ChartWrapper';
import { CbeMeritListReport } from './CbeMeritListReport';
import { ProvisionalResultsView } from './ProvisionalResultsView';
import {
  downloadSingleReportCardPDF,
  downloadAllReportCardsZIP,
  downloadAllReportCardsCombinedPDF,
  PDFReportData,
} from '../services/pdfReportGenerator';
import { exportSubjectPerformanceAnalysisPDF } from '../services/subjectPerformancePdfExporter';
import { exportProvisionalStudentResultsPDF } from '../services/provisionalStudentResultsPdfExporter';
import { getShortCbeCode, sortSubjectsByStandardOrder } from '../services/meritListExporter';
import { evaluateMark, roundMark } from '../utils/markUtils';
import { isTermModifiable, canGenerateReports, getTermStatusMessage, canEnterMarks } from "../utils/termStatusUtils";
import { useAcademicSession } from "../contexts/AcademicSessionContext";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from 'recharts';

interface ReportsViewProps {
  school: School;
  students: Student[];
  subjects: Subject[];
  exams: Examination[];
  marks: Mark[];
  grades: Grade[];
  classes: ClassStream[];
  teachers?: Teacher[];
  currentUser?: User;
  onNavigateToTab?: (tab: any) => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  school,
  students = [],
  subjects = [],
  exams = [],
  marks = [],
  grades = [],
  classes = [],
  teachers = [],
  currentUser,
  onNavigateToTab,
}) => {
  const isStudent = false;
  const studentSelfId = undefined;

  const { viewingTerm: activeTermObj } = useAcademicSession();
  const canModify = canEnterMarks(activeTermObj.status);

  const [reportTab, setReportTab] = useState<
    'individual' | 'batch' | 'provisional' | 'merit' | 'subject' | 'grades'
  >(currentUser?.role === 'subject_teacher' ? 'subject' : 'individual');

  const [selectedExamId, setSelectedExamId] = useState<string>('');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedStreamId, setSelectedStreamId] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>(studentSelfId || '');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [isExportingProvisionalPdf, setIsExportingProvisionalPdf] = useState(false);

  const activeTeacher = getActiveTeacher(currentUser || null, teachers || []);
  const isSubjectTeacherOnly = currentUser?.role === 'subject_teacher';

  const baseAccessibleClasses = getAccessibleClasses(currentUser || null, activeTeacher, classes);
  const accessibleClasses = baseAccessibleClasses.filter(c => {
    if (currentUser?.role === 'admin') return true;
    if (reportTab === 'subject') return true;
    return activeTeacher?.is_class_teacher && (activeTeacher?.class_teacher_of_id === c.id || c.class_teacher_id === activeTeacher.id);
  });
  const accessibleSubjects = getAccessibleSubjects(currentUser || null, activeTeacher, subjects);
  const baseAccessibleStudents = React.useMemo(() => getAccessibleStudents(currentUser || null, activeTeacher, students, classes), [currentUser, activeTeacher, students, classes]);
  const accessibleStudents = baseAccessibleStudents.filter(s => {
    if (currentUser?.role === 'admin') return true;
    if (reportTab === 'subject') return true;
    const cls = classes.find(c => c.id === s.class_id);
    if (!cls) return false;
    return activeTeacher?.is_class_teacher && (activeTeacher?.class_teacher_of_id === cls.id || cls.class_teacher_id === activeTeacher.id);
  });

  const selectedExam = (exams || []).find((e) => e.id === selectedExamId);

  // Unique class levels
  const uniqueClasses = sortGrades(Array.from(new Set((accessibleClasses || []).map((c) => c.class_name))));

  // Determine learning areas (subjects) applicable strictly to the selected class level
  const targetClass = accessibleClasses.find(c => c.id === selectedClassId || c.class_name === selectedClassId);
  const applicableSubjects = targetClass ? getLearnerReportSubjects({} as any, targetClass, accessibleSubjects, teachers) : [];
  const displaySubjects = targetClass ? applicableSubjects : accessibleSubjects;

  const handleDownloadSubjectPdf = async (sbObj?: Subject) => {
    const targetSub = sbObj || displaySubjects.find((s) => s.id === selectedSubjectId) || displaySubjects[0];
    if (!targetSub || !selectedExam) return;
    try {
      await exportSubjectPerformanceAnalysisPDF({
        school,
        exam: selectedExam,
        subject: targetSub,
        selectedClassId,
        selectedStreamId,
        students,
        marks,
        grades,
        classes,
        teachers,
        allExams: exams,
        generatedBy: currentUser?.name || 'Administrator',
      });
    } catch (err) {
      console.error('Failed to export subject performance analysis PDF:', err);
    }
  };

  const handleDownloadProvisionalResultsPdf = async () => {
    if (!selectedExam) return;
    setIsExportingProvisionalPdf(true);
    try {
      await exportProvisionalStudentResultsPDF({
        school,
        exam: selectedExam,
        selectedClassId,
        selectedStreamId,
        classes,
        students,
        subjects,
        marks,
        grades,
        teachers,
        generatedBy: currentUser?.name || 'Administrator',
      });
    } catch (err) {
      console.error('Failed to export Provisional Student Results PDF:', err);
    } finally {
      setIsExportingProvisionalPdf(false);
    }
  };

  useEffect(() => {
    if (isStudent && currentUser?.student_id) {
      setSelectedStudentId(currentUser.student_id);
      setReportTab('individual');
    }
  }, [isStudent, currentUser]);

  // In-Memory Remarks Storage
  const [savedRemarksMap, setSavedRemarksMap] = useState<
    Record<string, LearnerReportComment>
  >({});

  const handleSaveRemarks = (
    studentId: string,
    examId: string,
    remarks: Partial<LearnerReportComment>
  ) => {
    if (!canModify) return alert(getTermStatusMessage(activeTermObj.status));
    const key = `${studentId}_${examId}`;
    const cleanedRemarks = { ...remarks };
    if (cleanedRemarks.class_teacher_comment) {
      cleanedRemarks.class_teacher_comment = stripSurroundingQuotes(cleanedRemarks.class_teacher_comment);
    }
    if (cleanedRemarks.hoi_comment) {
      cleanedRemarks.hoi_comment = stripSurroundingQuotes(cleanedRemarks.hoi_comment);
    }
    if (cleanedRemarks.subject_comments) {
      const cleanedSubj: Record<string, string> = {};
      Object.entries(cleanedRemarks.subject_comments).forEach(([k, v]) => {
        cleanedSubj[k] = stripSurroundingQuotes(v);
      });
      cleanedRemarks.subject_comments = cleanedSubj;
    }

    const updated = {
      ...savedRemarksMap[key],
      student_id: studentId,
      exam_id: examId,
      ...cleanedRemarks,
    };
    const newMap = { ...savedRemarksMap, [key]: updated };
    setSavedRemarksMap(newMap);
  };

  // Filter students strictly by class and stream
  const targetStudents = getFilteredStudents(
    accessibleStudents,
    accessibleClasses,
    selectedClassId,
    selectedStreamId,
    selectedExam
  );

  const selectedStudent = (students || []).find((s) => s.id === selectedStudentId);

  const meritResults = calculateExamResults(
    selectedExamId,
    targetStudents,
    marks,
    grades
  );

  const analysis = selectedExam
    ? generateExamAnalysisSummary(
        selectedExam.id,
        selectedExam.exam_name,
        targetStudents,
        displaySubjects,
        marks,
        grades
      )
    : null;

  // Batch ZIP Download state
  const [isDownloadingBatch, setIsDownloadingBatch] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number }>({
    current: 0,
    total: 0,
  });

  const isSelectionComplete = React.useMemo(() => {
    if (!selectedExamId || !selectedClassId || !selectedStreamId) return false;
    if (reportTab === 'individual' && !selectedStudentId) return false;
    if (reportTab === 'subject' && !selectedSubjectId) return false;
    return true;
  }, [selectedExamId, selectedClassId, selectedStreamId, selectedStudentId, selectedSubjectId, reportTab]);

  const handleDownloadSinglePdf = async () => {
    if (!selectedStudent) return;
    try {
      await downloadSingleReportCardPDF({
        student: selectedStudent,
        school,
        exam: selectedExam,
        classes,
        subjects,
        marks,
        grades,
        teachers,
        allStudents: students,
        savedRemarks: savedRemarksMap[`${selectedStudent.id}_${selectedExamId}`],
      });
    } catch (err) {
      console.error('Error generating PDF:', err);
    }
  };

  const handleDownloadBatchZip = async () => {
    if (targetStudents.length === 0) return;
    setIsDownloadingBatch(true);
    setBatchProgress({ current: 0, total: targetStudents.length });

    try {
      const dataList: PDFReportData[] = targetStudents.map((std) => ({
        student: std,
        school,
        exam: selectedExam,
        classes,
        subjects,
        marks,
        grades,
        teachers,
        allStudents: students,
        savedRemarks: savedRemarksMap[`${std.id}_${selectedExamId}`],
      }));

      await downloadAllReportCardsCombinedPDF(dataList, (current, total) => {
        setBatchProgress({ current, total });
      });
    } catch (err) {
      console.error('Error generating combined PDF:', err);
    } finally {
      setIsDownloadingBatch(false);
    }
  };

  // Grade counts for Pie chart
  const pieData = grades.map((g) => ({
    name: `${g.grade_code || g.grade} (${g.descriptor})`,
    value: analysis?.grade_counts[g.grade_code || g.grade || ''] || 0,
  }));
  const PIE_COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1', '#14B8A6'];

  const isExamApproved = Boolean(
    selectedExam &&
      (selectedExam.status === 'Approved' ||
        selectedExam.status === 'Published' ||
        selectedExam.status === 'Official Results Released')
  );

  if (!canGenerateReports(activeTermObj.status)) {
    return (
      <div className="p-8 text-center space-y-4">
        <div className="bg-amber-100 text-amber-800 p-6 rounded-2xl max-w-md mx-auto">
          <h2 className="text-lg font-bold mb-2">Term {activeTermObj.status}</h2>
          <p className="text-sm">{getTermStatusMessage(activeTermObj.status)}</p>
          <button onClick={() => window.history.back()} className="mt-4 px-4 py-2 bg-amber-600 text-white font-bold rounded-lg hover:bg-amber-700">
            Return
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Navigation Header (Hidden in Print) */}
      <div className="print:hidden bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
            <FileBarChart className="w-6 h-6 text-[#176B45] dark:text-emerald-400" />
            <span>Learner Assessment Reports & Merit Analytics</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Dynamic CBE 8-Point assessment reports, batch printing, merit lists, and performance summaries.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!isSubjectTeacherOnly && (
            <>
              <button
                onClick={() => setReportTab('individual')}
                className={`px-3 py-2 text-xs font-bold rounded-lg transition ${
                  reportTab === 'individual'
                    ? 'bg-[#176B45] text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100 border border-slate-200 dark:border-slate-700'
                }`}
              >
                Learner Report Form
              </button>

              <button
                onClick={() => setReportTab('batch')}
                className={`px-3 py-2 text-xs font-bold rounded-lg transition flex items-center space-x-1 ${
                  reportTab === 'batch'
                    ? 'bg-[#176B45] text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100 border border-slate-200 dark:border-slate-700'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Batch Class Reports ({targetStudents.length})</span>
              </button>
            </>
          )}

          <button
            onClick={() => setReportTab('provisional')}
            className={`px-3 py-2 text-xs font-bold rounded-lg transition flex items-center space-x-1 ${
              reportTab === 'provisional'
                ? 'bg-[#176B45] text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100 border border-slate-200 dark:border-slate-700'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Provisional Student Results</span>
          </button>

          {!isSubjectTeacherOnly && (
            <button
              onClick={() => setReportTab('merit')}
              className={`px-3 py-2 text-xs font-bold rounded-lg transition ${
                reportTab === 'merit'
                  ? 'bg-[#176B45] text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100 border border-slate-200 dark:border-slate-700'
              }`}
            >
              Class Merit List
            </button>
          )}

          <button
            onClick={() => setReportTab('subject')}
            className={`px-3 py-2 text-xs font-bold rounded-lg transition ${
              reportTab === 'subject'
                ? 'bg-[#176B45] text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100 border border-slate-200 dark:border-slate-700'
            }`}
          >
            Subject Analysis
          </button>

          {!isSubjectTeacherOnly && (
            <button
              onClick={() => setReportTab('grades')}
              className={`px-3 py-2 text-xs font-bold rounded-lg transition ${
                reportTab === 'grades'
                  ? 'bg-[#176B45] text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100 border border-slate-200 dark:border-slate-700'
              }`}
            >
              Grade Distribution
            </button>
          )}

          {reportTab === 'batch' ? (
            <button
              onClick={handleDownloadBatchZip}
              disabled={isDownloadingBatch}
              className="bg-[#176B45] hover:bg-[#0F5132] disabled:opacity-50 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-xs transition flex items-center space-x-1.5"
            >
              {isDownloadingBatch ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>
                {isDownloadingBatch
                  ? `Generating PDF (${batchProgress.current}/${batchProgress.total})...`
                  : 'Download All Reports (Combined PDF)'}
              </span>
            </button>
          ) : reportTab === 'provisional' ? (
            <button
              onClick={handleDownloadProvisionalResultsPdf}
              disabled={isExportingProvisionalPdf}
              className="bg-[#176B45] hover:bg-[#0F5132] disabled:opacity-50 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-xs transition flex items-center space-x-1.5"
            >
              {isExportingProvisionalPdf ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>Export Provisional Results PDF</span>
            </button>
          ) : reportTab === 'individual' ? (
            <button
              onClick={handleDownloadSinglePdf}
              disabled={!selectedStudent}
              className="bg-[#176B45] hover:bg-[#0F5132] disabled:opacity-50 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-xs transition flex items-center space-x-1.5"
            >
              <Download className="w-4 h-4" />
              <span>Download PDF Report</span>
            </button>
          ) : null}
        </div>
      </div>

      {/* Filter Controls Panel (Hidden in Print) */}
      <div className="print:hidden bg-white dark:bg-slate-900 rounded-xl p-4 sm:p-5 shadow-xs border border-slate-200 dark:border-slate-800 space-y-3.5">
        <div className="flex items-center space-x-2 text-[#176B45] dark:text-emerald-400 font-extrabold text-xs uppercase tracking-wider">
          <Filter className="w-4 h-4 text-[#176B45] dark:text-emerald-400" />
          <span>Report Filters</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5">Select Assessment:</label>
            <select
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="w-full h-10 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg p-2.5 font-semibold focus:outline-none focus:ring-2 focus:ring-[#176B45]/20 focus:border-[#176B45] disabled:bg-slate-100 dark:disabled:bg-slate-800/50 disabled:border-slate-200 dark:disabled:border-slate-700 disabled:text-slate-400 dark:disabled:text-slate-500 disabled:cursor-not-allowed transition-colors"
            >
              <option value="">Select Assessment...</option>
              {exams.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.exam_name} [{ex.status}]
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5">Select Class:</label>
            <select
              value={selectedClassId}
              onChange={(e) => {
                setSelectedClassId(e.target.value);
                setSelectedStreamId('');
                setSelectedStudentId('');
              }}
              disabled={!selectedExamId}
              className="w-full h-10 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg p-2.5 font-semibold focus:outline-none focus:ring-2 focus:ring-[#176B45]/20 focus:border-[#176B45] disabled:bg-slate-100 dark:disabled:bg-slate-800/50 disabled:border-slate-200 dark:disabled:border-slate-700 disabled:text-slate-400 dark:disabled:text-slate-500 disabled:cursor-not-allowed transition-colors"
            >
              {!selectedExamId ? (
                <option value="">Select Assessment First...</option>
              ) : (
                <>
                  <option value="">Select Class...</option>
                  {uniqueClasses.map((className) => {
                    const count = getFilteredStudents(accessibleStudents, accessibleClasses, className, 'all', selectedExam).length;
                    return (
                      <option key={className} value={className}>
                        {className} ({count} learners)
                      </option>
                    );
                  })}
                </>
              )}
            </select>
          </div>

          <div>
            <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5">Select Stream:</label>
            <select
              value={selectedStreamId}
              onChange={(e) => {
                setSelectedStreamId(e.target.value);
                setSelectedStudentId('');
              }}
              disabled={!selectedClassId}
              className="w-full h-10 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg p-2.5 font-semibold focus:outline-none focus:ring-2 focus:ring-[#176B45]/20 focus:border-[#176B45] disabled:bg-slate-100 dark:disabled:bg-slate-800/50 disabled:border-slate-200 dark:disabled:border-slate-700 disabled:text-slate-400 dark:disabled:text-slate-500 disabled:cursor-not-allowed transition-colors"
            >
              {!selectedClassId ? (
                <option value="">Select Class First...</option>
              ) : (
                <>
                  <option value="">Select Stream...</option>
                  <option value="all">
                    All Streams
                  </option>
                  {sortClasses(accessibleClasses
                    .filter(
                      (c) =>
                        c.class_name.toLowerCase() === selectedClassId.toLowerCase() ||
                        c.id === selectedClassId
                    ))
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.class_name} - {c.stream} ({getFilteredStudents(accessibleStudents, accessibleClasses, c.class_name, c.id, selectedExam).length} learners)
                      </option>
                    ))}
                </>
              )}
            </select>
          </div>

          {reportTab === 'subject' && (
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5">Select Learning Area:</label>
              <select
                value={selectedSubjectId}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                className="w-full h-10 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg p-2.5 font-semibold focus:outline-none focus:ring-2 focus:ring-[#176B45]/20 focus:border-[#176B45] disabled:bg-slate-100 dark:disabled:bg-slate-800/50 disabled:border-slate-200 dark:disabled:border-slate-700 disabled:text-slate-400 dark:disabled:text-slate-500 disabled:cursor-not-allowed transition-colors"
              >
                <option value="">Select Learning Area...</option>
                {displaySubjects.map((sb) => (
                  <option key={sb.id} value={sb.id}>
                    {sb.subject_name} ({sb.subject_code})
                  </option>
                ))}
              </select>
            </div>
          )}

          {reportTab === 'individual' && (
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5">Select Learner:</label>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                disabled={!selectedStreamId}
                className="w-full h-10 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg p-2.5 font-semibold focus:outline-none focus:ring-2 focus:ring-[#176B45]/20 focus:border-[#176B45] disabled:bg-slate-100 dark:disabled:bg-slate-800/50 disabled:border-slate-200 dark:disabled:border-slate-700 disabled:text-slate-400 dark:disabled:text-slate-500 disabled:cursor-not-allowed transition-colors"
              >
                {!selectedStreamId ? (
                  <option value="">Select Stream First...</option>
                ) : targetStudents.length > 0 ? (
                  <>
                    <option value="">Select Learner...</option>
                    {targetStudents.map((std) => (
                      <option key={std.id} value={std.id}>
                        {std.full_name} ({std.admission_number || 'No Adm'})
                      </option>
                    ))}
                  </>
                ) : (
                  <option value="">No learners found</option>
                )}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* MANDATORY CHECKPOINT GUARD FOR OFFICIAL REPORTS */}
      {!isExamApproved && reportTab !== 'provisional' ? (
        (() => {
          const examStatus = selectedExam?.status || 'Draft';
          const analysisDone = ['Verification', 'Provisional', 'Approved', 'Published', 'Official Results Released'].includes(examStatus);
          const validationFailed = examStatus.toLowerCase().includes('fail') || examStatus.toLowerCase().includes('block');
          const validationPassed = analysisDone && !validationFailed;

          let statusBadgeStyle = 'bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-800';
          if (validationFailed) {
            statusBadgeStyle = 'bg-rose-100 dark:bg-rose-950/80 text-rose-900 dark:text-rose-200 border-rose-300 dark:border-rose-800';
          } else if (examStatus === 'Open' || examStatus === 'Verification' || examStatus === 'Provisional') {
            statusBadgeStyle = 'bg-blue-100 dark:bg-blue-950/80 text-blue-900 dark:text-blue-200 border-blue-300 dark:border-blue-800';
          }

          return (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-amber-200/90 dark:border-amber-800/80 shadow-xs p-5 max-w-lg mx-auto my-6 space-y-4 text-slate-800 dark:text-slate-200">
              <div className="flex items-start space-x-3.5">
                <div className="p-2.5 bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 rounded-xl border border-amber-200/80 dark:border-amber-800/60 shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Assessment Analysis Required</h3>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border uppercase tracking-wider ${statusBadgeStyle}`}>
                      {examStatus}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-normal">
                    This assessment has not yet completed the required validation and approval process.
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3.5 space-y-2.5 text-xs">
                <p className="font-semibold text-slate-700 dark:text-slate-300 text-[11px]">
                  Official reports, rankings, analytics, and exports require:
                </p>
                <div className="space-y-2 pt-0.5">
                  <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                    <span className="flex items-center space-x-2 min-w-0">
                      {analysisDone ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      ) : (
                        <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      )}
                      <span className="truncate font-medium">1. Assessment Analysis</span>
                    </span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${analysisDone ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300' : 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300'}`}>
                      {analysisDone ? 'Completed' : 'Pending'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                    <span className="flex items-center space-x-2 min-w-0">
                      {validationFailed ? (
                        <XCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                      ) : validationPassed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      ) : (
                        <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      )}
                      <span className="truncate font-medium">2. Zero Blocking Validation Issues</span>
                    </span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                      validationFailed
                        ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300'
                        : validationPassed
                        ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300'
                        : 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300'
                    }`}>
                      {validationFailed ? 'Failed' : validationPassed ? 'Passed' : 'Pending'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                    <span className="flex items-center space-x-2 min-w-0">
                      {isExamApproved ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      ) : (
                        <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      )}
                      <span className="truncate font-medium">3. Official Examination Approval</span>
                    </span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${isExamApproved ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300' : 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300'}`}>
                      {isExamApproved ? 'Approved' : 'Pending'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-1 flex justify-start sm:justify-end">
                <button
                  onClick={() => onNavigateToTab?.('exam-validation')}
                  className="w-full sm:w-auto bg-[#176B45] hover:bg-[#0F5132] text-white font-bold text-xs px-4 py-2.5 rounded-lg transition shadow-xs flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Go to Examination Analysis & Validation</span>
                </button>
              </div>
            </div>
          );
        })()
      ) : (
        <>
          {/* SELECTION INCOMPLETE PLACEHOLDER */}
          {!isSelectionComplete ? (
            <div className="bg-amber-50/60 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-2xl p-8 text-center space-y-4 max-w-lg mx-auto my-12 shadow-xs">
              <div className="inline-flex p-3 bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 rounded-full">
                <Filter className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Selection Required</h2>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 font-medium">Please select:</p>
                <ul className="text-sm text-slate-700 dark:text-slate-300 text-left list-disc pl-8 mt-2 space-y-1 mx-auto max-w-xs font-semibold">
                  <li>Examination</li>
                  <li>Class</li>
                  <li>Stream (where applicable)</li>
                  {reportTab === 'individual' && <li>Learner (for individual report form)</li>}
                  {reportTab === 'subject' && <li>Learning Area (Subject)</li>}
                </ul>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">before generating reports.</p>

              {selectedClassId && selectedStreamId && targetStudents.length === 0 && (
                <div className="mt-4 p-3 bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-800 dark:text-rose-200 text-xs font-semibold inline-block">
                  ⚠️ No learners found for the selected class and stream.
                </div>
              )}
            </div>
          ) : (
            <>
              {/* TAB 1: INDIVIDUAL LEARNER ASSESSMENT REPORT */}
              {reportTab === 'individual' && selectedStudent && (
                <LearnerReportCard
                  canModify={canModify}
                  student={selectedStudent}
                  school={school}
                  classes={classes}
                  subjects={subjects}
                  exams={exams}
                  marks={marks}
                  grades={grades}
                  teachers={teachers}
                  currentUser={currentUser}
                  selectedExamId={selectedExamId}
                  allStudents={students}
                  savedRemarks={savedRemarksMap[`${selectedStudent.id}_${selectedExamId}`]}
                  onSaveRemarks={handleSaveRemarks}
                />
              )}

              {/* TAB 2: BATCH CLASS REPORTS */}
              {reportTab === 'batch' && (
                <div className="space-y-6">
                  <div className="print:hidden bg-[#E8F3EE] dark:bg-emerald-950/60 border border-[#2E7D5B]/30 dark:border-emerald-800/60 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#1F2937] dark:text-slate-200">
                    <div className="flex items-center space-x-3">
                      <Archive className="w-6 h-6 text-[#176B45] dark:text-emerald-400 shrink-0" />
                      <div>
                        <strong className="block text-sm text-slate-900 dark:text-slate-100 font-bold">
                          Batch Class Report Generator ({targetStudents.length} Learners Loaded)
                        </strong>
                        <p className="text-[11px] text-[#667085] dark:text-slate-400">
                          Generate single-page PDF report forms for all {targetStudents.length} learners in this class and download them combined as a single PDF document.
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={handleDownloadBatchZip}
                      disabled={isDownloadingBatch}
                      className="bg-[#176B45] hover:bg-[#0F5132] disabled:opacity-50 text-white px-5 py-2.5 rounded-xl font-bold shadow-md transition flex items-center space-x-2 shrink-0"
                    >
                      {isDownloadingBatch ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      <span>
                        {isDownloadingBatch
                          ? `Generating Combined PDF (${batchProgress.current}/${batchProgress.total})...`
                          : `Download All ${targetStudents.length} Reports (Combined PDF)`}
                      </span>
                    </button>
                  </div>

                  <div className="space-y-8">
                    {targetStudents.map((std) => (
                      <LearnerReportCard
                        canModify={canModify}
                        key={std.id}
                        student={std}
                        school={school}
                        classes={classes}
                        subjects={subjects}
                        exams={exams}
                        marks={marks}
                        grades={grades}
                        teachers={teachers}
                        currentUser={currentUser}
                        selectedExamId={selectedExamId}
                        allStudents={students}
                        isBatchMode={true}
                        savedRemarks={savedRemarksMap[`${std.id}_${selectedExamId}`]}
                        onSaveRemarks={handleSaveRemarks}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 3: PROVISIONAL STUDENT RESULTS */}
              {reportTab === 'provisional' && (
                <ProvisionalResultsView
                  school={school}
                  students={students}
                  subjects={subjects}
                  exams={exams}
                  marks={marks}
                  grades={grades}
                  classes={classes}
                  teachers={teachers}
                  currentUser={currentUser}
                  selectedExamId={selectedExamId}
                  selectedClassId={selectedClassId}
                  selectedStreamId={selectedStreamId}
                />
              )}

              {/* TAB 4: CLASS MERIT LIST */}
              {reportTab === 'merit' && (
                <CbeMeritListReport
                  school={school}
                  students={students}
                  subjects={subjects}
                  exam={selectedExam}
                  exams={exams}
                  marks={marks}
                  grades={grades}
                  classes={classes}
                  teachers={teachers}
                  selectedClassId={selectedClassId}
                  selectedStreamId={selectedStreamId}
                  onClassChange={(classId) => {
                    setSelectedClassId(classId);
                    setSelectedStreamId('all');
                  }}
                  generatedBy="Administrator"
                />
              )}

              {/* TAB 5: SUBJECT ANALYSIS */}
              {reportTab === 'subject' && analysis && (
                <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                    <div>
                      <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                        Subject Performance Analysis & PDF Reports
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Detailed single-subject diagnostic reports including statistics, 8-point CBE performance level distribution, historical trends, and ranked student rosters.
                      </p>
                    </div>

                    <button
                      onClick={() => handleDownloadSubjectPdf()}
                      className="bg-[#176B45] hover:bg-[#0F5132] text-white px-4 py-2 rounded-lg text-xs font-bold shadow-xs transition flex items-center space-x-1.5 shrink-0"
                    >
                      <Download className="w-4 h-4" />
                      <span>Export PDF (Selected Learning Area)</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                    <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
                      <thead>
                        <tr className="bg-slate-900 dark:bg-slate-800 text-white font-bold uppercase text-[10px] tracking-wider">
                          <th className="p-3">Subject Code</th>
                          <th className="p-3">Subject Name</th>
                          <th className="p-3 text-center">Mean Score (%)</th>
                          <th className="p-3 text-center">Mean Points</th>
                          <th className="p-3 text-center">Highest Mark</th>
                          <th className="p-3 text-center">Lowest Mark</th>
                          <th className="p-3 text-center">Pass Rate (%)</th>
                          <th className="p-3 text-center">Export PDF</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {analysis.subject_summaries.map((s) => {
                          const sbObj = (subjects || []).find((sub) => sub.id === s.subject_id || sub.subject_code === s.subject_code);
                          return (
                            <tr key={s.subject_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 font-medium text-slate-800 dark:text-slate-200">
                              <td className="p-3 font-mono font-bold text-slate-700 dark:text-slate-300">{s.subject_code}</td>
                              <td className="p-3 font-bold text-slate-900 dark:text-slate-100">{s.subject_name}</td>
                              <td className="p-3 text-center font-extrabold text-blue-700 dark:text-blue-400">{s.mean_score}%</td>
                              <td className="p-3 text-center font-bold text-indigo-800 dark:text-indigo-400">{s.mean_points} Pts</td>
                              <td className="p-3 text-center font-bold text-emerald-700 dark:text-emerald-400">{s.highest}%</td>
                              <td className="p-3 text-center font-bold text-rose-700 dark:text-rose-400">{s.lowest}%</td>
                              <td className="p-3 text-center font-bold text-slate-800 dark:text-slate-200">{s.pass_rate}%</td>
                              <td className="p-3 text-center">
                                <button
                                  onClick={() => handleDownloadSubjectPdf(sbObj)}
                                  className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-md text-[11px] border border-slate-300 dark:border-slate-700 transition flex items-center justify-center space-x-1 mx-auto"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  <span>PDF Report</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 6: GRADE DISTRIBUTION */}
              {reportTab === 'grades' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Chart Card */}
                  <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">
                      Grade Distribution Chart (CBE 8-Point Scale)
                    </h2>
                    <ChartWrapper className="h-64 w-full" hasData={pieData.some(d => d.value > 0)}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieData}
                            dataKey="value"
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            label
                          >
                            {pieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </ChartWrapper>
                  </div>

                  {/* Level Breakdown Card */}
                  <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">
                      CBE Performance Level Breakdown
                    </h2>
                    <div className="space-y-3">
                      {grades.map((g) => {
                        const code = g.grade_code || g.grade || '';
                        const count = analysis?.grade_counts[code] || 0;
                        const min = g.minimum_score ?? g.minimum_marks ?? 0;
                        const max = g.maximum_score ?? g.maximum_marks ?? 100;

                        return (
                          <div key={g.id} className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center justify-between">
                            <div>
                              <span className="font-extrabold text-[#176B45] dark:text-emerald-400 text-sm">{code}</span> &bull;{' '}
                              <span className="text-xs text-slate-700 dark:text-slate-300 font-semibold">{g.performance_level} ({g.descriptor})</span>
                              <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Score Range: {min}% - {max}% &bull; {g.points} Points</div>
                            </div>
                            <div className="text-right">
                              <span className="text-lg font-black text-slate-900 dark:text-slate-100">{count}</span>
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">Learners</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* CBE 8-Point Achievement Scale Reference Table Card */}
                  <div className="md:col-span-2 bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-2 flex items-center justify-between">
                      <span>CBE 8-Point Achievement Scale Reference Table</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Junior School Standard</span>
                    </h2>

                    <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-900 dark:bg-slate-800 text-white font-bold uppercase text-[10px] tracking-wider text-center">
                            <th className="p-2 border-r border-slate-800 dark:border-slate-700">CODE</th>
                            <th className="p-2 border-r border-slate-800 dark:border-slate-700 text-left">PERFORMANCE LEVEL</th>
                            <th className="p-2 border-r border-slate-800 dark:border-slate-700">SCORE RANGE</th>
                            <th className="p-2">POINTS</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-800 dark:text-slate-200">
                          <tr className="bg-emerald-50/40 dark:bg-emerald-950/40">
                            <td className="p-2 text-center font-extrabold text-emerald-800 dark:text-emerald-300">EE1</td>
                            <td className="p-2 font-bold text-emerald-900 dark:text-emerald-200">Exceeding Expectations (Level 1)</td>
                            <td className="p-2 text-center font-mono font-bold text-emerald-800 dark:text-emerald-300">90 – 100%</td>
                            <td className="p-2 text-center font-black text-emerald-900 dark:text-emerald-200">8 Pts</td>
                          </tr>
                          <tr className="bg-emerald-50/20 dark:bg-emerald-950/20">
                            <td className="p-2 text-center font-extrabold text-emerald-700 dark:text-emerald-400">EE2</td>
                            <td className="p-2 font-bold text-emerald-900 dark:text-emerald-200">Exceeding Expectations (Level 2)</td>
                            <td className="p-2 text-center font-mono font-bold text-emerald-700 dark:text-emerald-400">75 – 89%</td>
                            <td className="p-2 text-center font-black text-emerald-900 dark:text-emerald-200">7 Pts</td>
                          </tr>
                          <tr className="bg-blue-50/40 dark:bg-blue-950/40">
                            <td className="p-2 text-center font-extrabold text-blue-800 dark:text-blue-300">ME1</td>
                            <td className="p-2 font-bold text-blue-900 dark:text-blue-200">Meeting Expectations (Level 1)</td>
                            <td className="p-2 text-center font-mono font-bold text-blue-800 dark:text-blue-300">58 – 74%</td>
                            <td className="p-2 text-center font-black text-blue-900 dark:text-blue-200">6 Pts</td>
                          </tr>
                          <tr className="bg-blue-50/20 dark:bg-blue-950/20">
                            <td className="p-2 text-center font-extrabold text-blue-700 dark:text-blue-400">ME2</td>
                            <td className="p-2 font-bold text-blue-900 dark:text-blue-200">Meeting Expectations (Level 2)</td>
                            <td className="p-2 text-center font-mono font-bold text-blue-700 dark:text-blue-400">41 – 57%</td>
                            <td className="p-2 text-center font-black text-blue-900 dark:text-blue-200">5 Pts</td>
                          </tr>
                          <tr className="bg-amber-50/40 dark:bg-amber-950/40">
                            <td className="p-2 text-center font-extrabold text-amber-800 dark:text-amber-300">AE1</td>
                            <td className="p-2 font-bold text-amber-900 dark:text-amber-200">Approaching Expectations (Level 1)</td>
                            <td className="p-2 text-center font-mono font-bold text-amber-800 dark:text-amber-300">31 – 40%</td>
                            <td className="p-2 text-center font-black text-amber-900 dark:text-amber-200">4 Pts</td>
                          </tr>
                          <tr className="bg-amber-50/20 dark:bg-amber-950/20">
                            <td className="p-2 text-center font-extrabold text-amber-700 dark:text-amber-400">AE2</td>
                            <td className="p-2 font-bold text-amber-900 dark:text-amber-200">Approaching Expectations (Level 2)</td>
                            <td className="p-2 text-center font-mono font-bold text-amber-700 dark:text-amber-400">21 – 30%</td>
                            <td className="p-2 text-center font-black text-amber-900 dark:text-amber-200">3 Pts</td>
                          </tr>
                          <tr className="bg-rose-50/40 dark:bg-rose-950/40">
                            <td className="p-2 text-center font-extrabold text-rose-800 dark:text-rose-300">BE1</td>
                            <td className="p-2 font-bold text-rose-900 dark:text-rose-200">Below Expectations (Level 1)</td>
                            <td className="p-2 text-center font-mono font-bold text-rose-800 dark:text-rose-300">11 – 20%</td>
                            <td className="p-2 text-center font-black text-rose-900 dark:text-rose-200">2 Pts</td>
                          </tr>
                          <tr className="bg-rose-50/20 dark:bg-rose-950/20">
                            <td className="p-2 text-center font-extrabold text-rose-700 dark:text-rose-400">BE2</td>
                            <td className="p-2 font-bold text-rose-900 dark:text-rose-200">Below Expectations (Level 2)</td>
                            <td className="p-2 text-center font-mono font-bold text-rose-700 dark:text-rose-400">0 – 10%</td>
                            <td className="p-2 text-center font-black text-rose-900 dark:text-rose-200">1 Pt</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};
