import React, { useState } from 'react';
import {
  FileText,
  Download,
  FileSpreadsheet,
  FileCode,
  Award,
  Users,
  TrendingUp,
  BarChart3,
  Loader2,
  CheckCircle,
  Building2,
  Calendar,
  Layers,
  Info,
  ChevronDown,
  ChevronUp,
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
  getEducationLevelForGrade,
} from '../types';
import {
  calculateExamResults,
  getGradeForMark,
  CBE_8_POINT_GRADES,
  getLearnerReportSubjects,
} from '../services/analysisEngine';
import { evaluateMark, formatPercentage } from '../utils/markUtils';
import {
  downloadMeritListPDF,
  downloadMeritListExcel,
  downloadMeritListCSV,
  MeritListData,
  getShortCbeCode,
  getMeritListDisplayCode,
  sortSubjectsByStandardOrder,
} from '../services/meritListExporter';
import { generateProvisionalApprovalPDF } from '../services/provisionalApprovalPdfExporter';
import { getFilteredStudents, getClassStreamLabel } from '../utils/filterUtils';
import { getLearnerClassAtExamTime } from '../services/historicalContextResolver';
import { isUUID } from '../lib/storage';

interface CbeMeritListReportProps {
  school: School;
  students: Student[];
  subjects: Subject[];
  exam?: Examination;
  exams?: Examination[];
  marks: Mark[];
  grades: Grade[];
  classes: ClassStream[];
  teachers?: Teacher[];
  selectedClassId: string;
  selectedStreamId?: string;
  onClassChange?: (classId: string) => void;
  generatedBy?: string;
}

export const CbeMeritListReport: React.FC<CbeMeritListReportProps> = ({
  school,
  students = [],
  subjects = [],
  exam,
  exams = [],
  marks = [],
  grades = [],
  classes = [],
  teachers = [],
  selectedClassId,
  selectedStreamId = 'all',
  onClassChange,
  generatedBy = 'Administrator',
}) => {
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingApprovalPdf, setIsExportingApprovalPdf] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [comparisonExamId, setComparisonExamId] = useState<string>('');
  const [isCbeScaleOpen, setIsCbeScaleOpen] = useState(false);

  const examId = exam?.id || '';

  // Filter students based on selected class and stream (historical exam context aware)
  const targetStudents = getFilteredStudents(students, classes, selectedClassId, selectedStreamId, exam);
  const streamNameStr = getClassStreamLabel(classes, selectedClassId, selectedStreamId);

  // Determine applicable subjects for the target cohort
  const firstTargetStudent = targetStudents[0];
  const firstHistCtx = firstTargetStudent && exam ? getLearnerClassAtExamTime(firstTargetStudent, exam, classes) : null;
  const targetClass = classes.find(
    (c) => c.id === (selectedClassId !== 'all' ? selectedClassId : (firstHistCtx?.class_id || firstTargetStudent?.class_id))
  );
  const targetGrade = targetClass?.class_name || firstHistCtx?.class_name || firstHistCtx?.grade || firstTargetStudent?.grade || '';
  const rawActiveSubjects = targetClass ? getLearnerReportSubjects(firstTargetStudent || {} as any, targetClass, subjects, teachers) : [];
  const activeSubjects = sortSubjectsByStandardOrder(rawActiveSubjects);

  // Calculate results for all students in target cohort
  const results = calculateExamResults(examId, targetStudents, marks, grades, classes, activeSubjects);
  
  const comparisonMap = new Map();
  if (comparisonExamId) {
    const compResults = calculateExamResults(comparisonExamId, students, marks, grades, classes, subjects);
    compResults.forEach(r => comparisonMap.set(r.student_id, r));
  }

  results.forEach(r => {
    const prev = comparisonMap.get(r.student_id);
    if (prev) {
      (r as any).previous_position = prev.position;
      (r as any).previous_class_position = prev.class_position || prev.stream_position;
    } else {
      (r as any).previous_position = null;
      (r as any).previous_class_position = null;
    }
  });

  const eduLevel = getEducationLevelForGrade(targetGrade);

  // Sort learners for display by authoritative position ascending (complete learners first), with total_marks descending as fallback
  results.sort((a, b) => (a.position || 999) - (b.position || 999) || (b.total_marks || 0) - (a.total_marks || 0));

  // Statistics Calculations
  const assessedResults = results.filter((r) => (r.subject_count || 0) > 0);
  const countAssessed = assessedResults.length;
  const totalLearners = targetStudents.length;
  const boysCount = targetStudents.filter(
    (s) => (s.gender as string) === 'M' || (s.gender as string) === 'Male'
  ).length;
  const girlsCount = targetStudents.filter(
    (s) => (s.gender as string) === 'F' || (s.gender as string) === 'Female'
  ).length;

  const totalStudentAverages = assessedResults.reduce((acc, r) => acc + r.average, 0);
  const overallClassAverageNum = countAssessed > 0 ? totalStudentAverages / countAssessed : 0;
  const overallClassAverage = String(Math.round(overallClassAverageNum));

  const highestTotalMarks = assessedResults[0]?.total_marks || 0;
  const lowestTotalMarks = assessedResults[assessedResults.length - 1]?.total_marks || 0;
  const highestAverage = assessedResults[0]?.average || 0;
  const lowestAverage = assessedResults[assessedResults.length - 1]?.average || 0;

  const totalPointsSum = assessedResults.reduce((acc, r) => acc + (r.average_points || (r.subject_count > 0 ? r.total_points / r.subject_count : 0)), 0);
  const meanPoints = countAssessed > 0 ? (totalPointsSum / countAssessed).toFixed(2) : '0.00';

  const eeCount = results.filter((r) => r.performance_level === 'EE').length;
  const meCount = results.filter((r) => r.performance_level === 'ME').length;
  const aeCount = results.filter((r) => r.performance_level === 'AE').length;
  const beCount = results.filter((r) => r.performance_level === 'BE').length;

  // Subject Analysis (Sorted highest average to lowest average)
  const subjectStats = activeSubjects.map((sb) => {
    const targetSubjMarks = marks.filter(
      (m) =>
        String(m.exam_id) === String(examId) &&
        String(m.subject_id) === String(sb.id) &&
        targetStudents.some((s) => s.id === m.student_id)
    );
    const validMarks = targetSubjMarks
      .map((m) => evaluateMark(m))
      .filter((info) => info.status === 'Normal' && info.percentage !== null);

    const count = validMarks.length;
    const sumPct = validMarks.reduce((acc, info) => acc + info.percentage!, 0);
    const avg = count > 0 ? Math.round(sumPct / count) : 0;
    const gr = getGradeForMark(avg, grades);

    return {
      subject_id: sb.id,
      subject_code: sb.subject_code,
      subject_name: sb.subject_name,
      average: avg,
      grade_code: gr.grade_code,
      performance_level: gr.performance_level,
      points: gr.points,
      count,
    };
  });

  subjectStats.sort((a, b) => b.average - a.average);

  const isPrimaryLevel = eduLevel === 'Lower Primary' || eduLevel === 'Upper Primary';

  // Determine Grade & Stream label summary
  const rawGrade = targetGrade || (selectedClassId !== 'all' ? selectedClassId : 'All Classes');
  let displayGrade = rawGrade;
  if (isUUID(rawGrade)) {
    const clsObj = classes.find((c) => c.id === rawGrade || (c.class_name && c.class_name.toLowerCase() === rawGrade.toLowerCase()));
    displayGrade = clsObj?.class_name || 'All Classes';
  }

  let displayStream = 'All Streams';
  if (selectedStreamId && selectedStreamId !== 'all') {
    const streamObj = classes.find(
      (c) => c.id === selectedStreamId || c.stream_id === selectedStreamId || (c.stream && c.stream.toLowerCase() === selectedStreamId.toLowerCase())
    );
    if (streamObj && streamObj.stream && !isUUID(streamObj.stream)) {
      const sStr = String(streamObj.stream || '');
      displayStream = sStr.toLowerCase().includes('stream') ? sStr : `${sStr} Stream`;
    } else if (!isUUID(selectedStreamId)) {
      const sStr = String(selectedStreamId || '');
      displayStream = sStr.toLowerCase().includes('stream') ? sStr : `${sStr} Stream`;
    } else {
      displayStream = 'All Streams';
    }
  } else if (selectedClassId && selectedClassId !== 'all') {
    const classObj = classes.find(
      (c) => c.id === selectedClassId || (c.class_name && c.class_name.toLowerCase() === selectedClassId.toLowerCase())
    );
    if (classObj && classObj.stream && !isUUID(classObj.stream)) {
      const sStr = String(classObj.stream || '');
      displayStream = sStr.toLowerCase().includes('stream') ? sStr : `${sStr} Stream`;
    }
  }

  const viewingSummaryText = `Viewing: ${displayGrade} • ${displayStream} • ${targetStudents.length} Learners`;

  const getExporterData = (): MeritListData => ({
    school,
    exam,
    comparisonExamId,
    selectedClassId,
    selectedStreamId,
    classes,
    teachers,
    students,
    subjects,
    marks,
    grades,
    generatedBy,
  });

  const handleExportPDF = async () => {
    setPdfError(null);
    if (!targetStudents || targetStudents.length === 0) {
      const errMsg = 'No learners found for the selected class/stream filter. Cannot generate PDF.';
      console.warn(errMsg);
      setPdfError(errMsg);
      return;
    }
    setIsExportingPdf(true);
    try {
      const exporterData = getExporterData();
      await downloadMeritListPDF(exporterData);
    } catch (err: any) {
      const errMsg = err?.message || 'An unexpected error occurred while generating the Merit List PDF.';
      console.error('Failed to export Merit List PDF:', err);
      setPdfError(errMsg);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportProvisionalApprovalPDF = async () => {
    if (!exam) return;
    setIsExportingApprovalPdf(true);
    try {
      await generateProvisionalApprovalPDF({
        exam,
        school,
        students,
        subjects,
        marks,
        grades,
        classes,
        teachers,
        selectedClassId,
        selectedStreamId,
        generatedBy,
        approvalStatus: exam.status === 'Approved' ? 'Approved' : 'Provisional',
      });
    } catch (err) {
      console.error('Failed to export Provisional Approval PDF:', err);
    } finally {
      setIsExportingApprovalPdf(false);
    }
  };

  const handleExportExcel = () => {
    setIsExportingExcel(true);
    try {
      downloadMeritListExcel(getExporterData());
    } catch (err) {
      console.error('Failed to export Merit List Excel:', err);
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleExportCSV = () => {
    setIsExportingCsv(true);
    try {
      downloadMeritListCSV(getExporterData());
    } catch (err) {
      console.error('Failed to export Merit List CSV:', err);
    } finally {
      setIsExportingCsv(false);
    }
  };

  const dateGeneratedStr = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="space-y-6">
      {/* EXPORT ACTION TOOLBAR */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-3.5 sm:p-4 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-bold tracking-tight flex items-center space-x-2 text-slate-900 dark:text-white">
              <Award className="w-4 h-4 text-[#176B45] dark:text-emerald-400" />
              <span>{targetGrade ? `${targetGrade} · Merit List` : "Merit List"}</span>
            </h2>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              ({viewingSummaryText})
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-slate-500 dark:text-slate-400">
            <span>Ranked by Total Score</span>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <div className="flex items-center space-x-1.5">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Compare:</label>
              <select
                value={comparisonExamId}
                onChange={(e) => setComparisonExamId(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-medium rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-[#176B45]"
              >
                <option value="">None</option>
                {exams
                  .filter((e) => e.id !== examId && e.status !== 'Archived')
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.exam_name}{e.term ? ` (${e.term} ${e.year || ''})` : ''}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportPDF}
            disabled={isExportingPdf}
            className="bg-[#176B45] hover:bg-[#0F5132] text-white font-medium text-xs px-3 py-1.5 rounded-lg transition shadow-xs flex items-center space-x-1.5 disabled:opacity-50"
          >
            {isExportingPdf ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Download className="w-3.5 h-3.5" />
            )}
            <span>{isExportingPdf ? 'Exporting...' : 'Merit PDF'}</span>
          </button>

          <button
            onClick={handleExportProvisionalApprovalPDF}
            disabled={isExportingApprovalPdf}
            className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 font-medium text-xs px-3 py-1.5 rounded-lg transition flex items-center space-x-1.5 disabled:opacity-50"
          >
            {isExportingApprovalPdf ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FileText className="w-3.5 h-3.5 text-[#176B45] dark:text-emerald-400" />
            )}
            <span>{isExportingApprovalPdf ? 'Generating...' : 'Approval PDF'}</span>
          </button>

          <button
            onClick={handleExportExcel}
            disabled={isExportingExcel}
            className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 font-medium text-xs px-2.5 py-1.5 rounded-lg transition flex items-center space-x-1 disabled:opacity-50"
          >
            {isExportingExcel ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            )}
            <span>Excel</span>
          </button>

          <button
            onClick={handleExportCSV}
            disabled={isExportingCsv}
            className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 font-medium text-xs px-2.5 py-1.5 rounded-lg transition flex items-center space-x-1 disabled:opacity-50"
          >
            {isExportingCsv ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FileCode className="w-3.5 h-3.5 text-slate-500" />
            )}
            <span>CSV</span>
          </button>
        </div>
      </div>

      {pdfError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-xl text-xs font-medium flex items-center justify-between shadow-xs">
          <span>⚠️ {pdfError}</span>
          <button
            onClick={() => setPdfError(null)}
            className="text-rose-600 hover:text-rose-900 font-semibold ml-4 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* DOCUMENT PAPER PREVIEW CONTAINER */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-5 text-slate-900 dark:text-slate-100">
        {/* COMPACT STATISTICAL SUMMARY */}
        <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-700 dark:text-slate-300">
          <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-medium">
              <span><strong className="text-slate-900 dark:text-white font-semibold">{totalLearners}</strong> Learners ({boysCount}M · {girlsCount}F)</span>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span>Mean <strong className="text-slate-900 dark:text-white font-semibold">{formatPercentage(overallClassAverageNum, true)}</strong></span>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span>Highest <strong className="text-slate-900 dark:text-white font-semibold">{highestTotalMarks}</strong></span>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span>Mean Pts <strong className="text-slate-900 dark:text-white font-semibold">{meanPoints}</strong>/8</span>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] font-medium">
              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/60">
                EE: <strong>{eeCount}</strong>
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                ME: <strong>{meCount}</strong>
              </span>
              <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/60">
                AE: <strong>{aeCount}</strong>
              </span>
              <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/60">
                BE: <strong>{beCount}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* MERIT LIST TABLE */}
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px] tracking-wider text-center border-b border-slate-200 dark:border-slate-700">
                <th className="p-2.5 border-r border-slate-200 dark:border-slate-700 sticky left-0 z-20 bg-slate-100 dark:bg-slate-800 min-w-[45px]">S/NO</th>
                <th className="p-2.5 border-r border-slate-200 dark:border-slate-700 sticky left-[45px] z-20 bg-slate-100 dark:bg-slate-800 min-w-[70px]">ADM NO</th>
                <th className="p-2.5 border-r border-slate-200 dark:border-slate-700 text-left sticky left-[115px] z-20 bg-slate-100 dark:bg-slate-800 min-w-[150px] shadow-[4px_0_8px_-2px_rgba(0,0,0,0.06)]">LEARNER NAME</th>
                <th className="p-2.5 border-r border-slate-200 dark:border-slate-700">STREAM</th>
                <th className="p-2.5 border-r border-slate-200 dark:border-slate-700">STR POS</th>
                <th className="p-2.5 border-r border-slate-200 dark:border-slate-700 text-[#176B45] dark:text-emerald-400 font-bold">OVR POS</th>
                <th className="p-2.5 border-r border-slate-200 dark:border-slate-700 text-slate-400">PRV STR</th>
                <th className="p-2.5 border-r border-slate-200 dark:border-slate-700 text-slate-400">PRV OVR</th>

                {/* Grade-Specific Learning Areas */}
                {activeSubjects.map((sb) => (
                  <th key={sb.id} className="p-2 border-r border-slate-200 dark:border-slate-700 min-w-[60px]">
                    <span className="block font-bold text-slate-800 dark:text-slate-200">{getMeritListDisplayCode(sb.subject_code, sb.subject_name)}</span>
                  </th>
                ))}

                {!isPrimaryLevel && (
                  <th className="p-2.5 border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">ENTRY</th>
                )}
                <th className="p-2.5 border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-bold text-slate-900 dark:text-white">TOTAL</th>
                <th className="p-2.5 border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[#176B45] dark:text-emerald-400 font-bold">{isPrimaryLevel ? 'AVG %' : 'AVG MARKS'}</th>
                <th className="p-2.5 border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">TOTAL PTS</th>
                <th className="p-2.5 border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">AVG PTS</th>
                <th className="p-2.5 border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-[#176B45] dark:text-emerald-400 font-bold">CBE LEVEL</th>
                <th className="p-2.5 bg-slate-50 dark:bg-slate-800">CODE</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-800 dark:text-slate-200 font-normal">
              {results.map((r, idx) => {
                const std = targetStudents.find((s) => s.id === r.student_id);
                const histCtx = std && exam ? getLearnerClassAtExamTime(std, exam, classes) : null;
                const cls = classes.find((c) => c.id === (histCtx?.class_id || std?.class_id));
                const streamDisplay = histCtx
                  ? (histCtx.historical_context_resolved ? (histCtx.stream_name || cls?.stream || '-') : '-')
                  : (cls ? cls.stream : '-');
                const isComplete = r.is_complete !== false;
                const overallPosDisplay = isComplete && r.position ? `${r.position}` : '-';
                const streamRankDisplay = isComplete && (r.class_position || r.position) ? `${r.class_position || r.position}` : '-';
                const prevOvrDisplay = (r as any).previous_position ? `${(r as any).previous_position}` : `-`;
                const prevStrDisplay = (r as any).previous_class_position ? `${(r as any).previous_class_position}` : `-`;
                const subEntryCount = activeSubjects.filter((sb) => {
                  const stdMark = marks.find(
                    (m) =>
                      String(m.student_id) === String(r.student_id) &&
                      String(m.subject_id) === String(sb.id) &&
                      String(m.exam_id) === String(examId)
                  );
                  const markInfo = evaluateMark(stdMark);
                  return markInfo.status === 'Normal' && markInfo.percentage !== null;
                }).length;
                const isAssessed = subEntryCount > 0;
                const assessedCount = isAssessed ? subEntryCount : 1;
                const avgPtsNum = r.average_points !== undefined && r.average_points !== null && r.average_points > 0
                  ? r.average_points
                  : (r.total_points / assessedCount);
                const avgPts = isComplete && isAssessed ? avgPtsNum.toFixed(2) : '-';

                const overallLevelObj = getGradeForMark(r.average, grades);
                const cbeLevelDisplay = isComplete
                  ? (overallLevelObj.performance_level || 'ME')
                  : isAssessed
                  ? (overallLevelObj.performance_level || 'ME')
                  : '-';

                const overallLevelDisplay = isComplete
                  ? (overallLevelObj.grade_code || overallLevelObj.performance_level || 'ME1')
                  : isAssessed
                  ? `Prov (${overallLevelObj.grade_code || overallLevelObj.performance_level || 'ME1'})`
                  : 'Pending';

                return (
                  <tr key={r.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/60 transition ${!isComplete ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''}`}>
                    <td className="p-2 text-center text-slate-500 dark:text-slate-400 sticky left-0 z-10 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800">{idx + 1}</td>
                    <td className="p-2 text-center font-mono text-slate-700 dark:text-slate-300 sticky left-[45px] z-10 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800">{std?.admission_number || '-'}</td>
                    <td className="p-2 text-slate-900 dark:text-white uppercase sticky left-[115px] z-10 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.04)] font-medium">
                      {std?.full_name}
                      {!isComplete && (
                        <span className="ml-2 bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 text-[9px] px-1.5 py-0.5 rounded font-medium uppercase">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="p-2 text-center text-slate-700 dark:text-slate-300 uppercase">
                      {streamDisplay}
                    </td>
                    <td className="p-2 text-center text-slate-800 dark:text-slate-200">
                      {streamRankDisplay}
                    </td>
                    <td className="p-2 text-center font-bold text-[#176B45] dark:text-emerald-400 bg-emerald-50/30 dark:bg-emerald-950/20">
                      {overallPosDisplay}
                    </td>
                    <td className="p-2 text-center text-slate-400 dark:text-slate-500 text-[11px]">
                      {prevStrDisplay}
                    </td>
                    <td className="p-2 text-center text-slate-400 dark:text-slate-500 text-[11px]">
                      {prevOvrDisplay}
                    </td>

                    {/* Subject Cells: "86 EE2" */}
                    {activeSubjects.map((sb) => {
                      const stdMark = marks.find(
                        (m) =>
                          String(m.student_id) === String(r.student_id) &&
                          String(m.subject_id) === String(sb.id) &&
                          String(m.exam_id) === String(examId)
                      );
                      const markInfo = evaluateMark(stdMark);

                      if (markInfo.status === 'Normal' && markInfo.percentage !== null) {
                        const displayedPct = Math.round(markInfo.percentage);
                        const gr = getGradeForMark(markInfo.percentage, grades);
                        const cbeCode = gr.grade_code || 'ME1';
                        const perfLevel = gr.performance_level || 'ME';

                        const badgeColorClass =
                          perfLevel === 'EE'
                            ? 'bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border-emerald-200/50 dark:border-emerald-800/40'
                            : perfLevel === 'ME'
                            ? 'bg-slate-100/80 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 border-slate-200/60 dark:border-slate-700/60'
                            : perfLevel === 'AE'
                            ? 'bg-amber-50/80 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border-amber-200/50 dark:border-amber-800/40'
                            : 'bg-rose-50/80 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300 border-rose-200/50 dark:border-rose-800/40';

                        return (
                          <td key={sb.id} className="p-1.5 text-center border-r border-slate-100 dark:border-slate-800 whitespace-nowrap">
                            <div className="inline-flex items-center justify-center gap-1 text-[10.5px]">
                              <span className="font-semibold text-slate-900 dark:text-white">{displayedPct}</span>
                              <span className={`text-[9px] font-bold px-1 py-0.5 rounded border ${badgeColorClass}`}>
                                {cbeCode}
                              </span>
                            </div>
                          </td>
                        );
                      } else if (markInfo.status === 'X') {
                        return (
                          <td key={sb.id} className="p-1.5 text-center border-r border-slate-100 dark:border-slate-800 whitespace-nowrap text-[10.5px] font-bold text-rose-600 dark:text-rose-400 bg-rose-100/60 dark:bg-rose-950/50">
                            X
                          </td>
                        );
                      } else if (markInfo.status === 'Y') {
                        return (
                          <td key={sb.id} className="p-1.5 text-center border-r border-slate-100 dark:border-slate-800 whitespace-nowrap text-[10.5px] font-bold text-amber-600 dark:text-amber-400 bg-amber-100/60 dark:bg-amber-950/50">
                            Y
                          </td>
                        );
                      } else {
                        return (
                          <td key={sb.id} className="p-1.5 text-center border-r border-slate-100 dark:border-slate-800 whitespace-nowrap text-slate-300 dark:text-slate-600 font-normal">
                            -
                          </td>
                        );
                      }
                    })}

                    {!isPrimaryLevel && (
                      <td className="p-2 text-center text-slate-800 dark:text-slate-200 border-r border-slate-100 dark:border-slate-800">
                        {subEntryCount}
                      </td>
                    )}

                    <td className="p-2 text-center font-bold text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800/40">
                      {isAssessed ? Math.round(r.total_marks) : '-'}
                    </td>
                    <td className="p-2 text-center font-bold text-[#176B45] dark:text-emerald-400 bg-emerald-50/20 dark:bg-emerald-950/10">
                      {isAssessed ? (
                        <>
                          {formatPercentage(r.average, true)}{' '}
                          {!isComplete && <span className="text-[9px] text-amber-600 dark:text-amber-400 font-normal block">(Prov)</span>}
                        </>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="p-2 text-center text-slate-800 dark:text-slate-200">
                      {isComplete && isAssessed ? r.total_points : '-'}
                    </td>
                    <td className="p-2 text-center text-slate-700 dark:text-slate-300 font-medium">
                      {avgPts}
                    </td>
                    <td className="p-2 text-center font-medium text-[#176B45] dark:text-emerald-400">
                      {cbeLevelDisplay}
                    </td>
                    <td className="p-2 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                          !isComplete
                            ? isAssessed
                              ? 'bg-amber-50/80 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border-amber-200/50 dark:border-amber-800/40'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                            : overallLevelObj.performance_level === 'EE'
                            ? 'bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border-emerald-200/50 dark:border-emerald-800/40'
                            : overallLevelObj.performance_level === 'ME'
                            ? 'bg-slate-100/80 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 border-slate-200/60 dark:border-slate-700/60'
                            : overallLevelObj.performance_level === 'AE'
                            ? 'bg-amber-50/80 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border-amber-200/50 dark:border-amber-800/40'
                            : 'bg-rose-50/80 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300 border-rose-200/50 dark:border-rose-800/40'
                        }`}
                      >
                        {overallLevelDisplay}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* FOOTER & SUBJECT ANALYSIS SECTION */}
        {isPrimaryLevel ? (
          /* LOWER & UPPER PRIMARY FOOTER SECTION */
          <div className="space-y-6 pt-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Subject Average Marks Table */}
              <div className="space-y-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center space-x-2">
                  <BarChart3 className="w-4 h-4 text-[#176B45] dark:text-emerald-400" />
                  <span>Subject Average Marks</span>
                </h3>
                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px]">
                        <th className="p-2">Learning Area</th>
                        <th className="p-2 text-center">Code</th>
                        <th className="p-2 text-center">Class Average (%)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {subjectStats.map((sb) => (
                        <tr key={sb.subject_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="p-2 font-medium text-slate-900 dark:text-white">{sb.subject_name}</td>
                          <td className="p-2 text-center font-mono text-slate-600 dark:text-slate-400 font-semibold">{sb.subject_code}</td>
                          <td className="p-2 text-center font-bold text-[#176B45] dark:text-emerald-400">{formatPercentage(sb.average, true)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Subject Average Points & Overall Level Table */}
              <div className="space-y-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center space-x-2">
                  <Award className="w-4 h-4 text-[#176B45] dark:text-emerald-400" />
                  <span>Subject Average Points & Overall Level</span>
                </h3>
                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px]">
                        <th className="p-2">Learning Area</th>
                        <th className="p-2 text-center">Average Points</th>
                        <th className="p-2 text-center">Overall Level</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {subjectStats.map((sb) => (
                        <tr key={sb.subject_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="p-2 font-medium text-slate-900 dark:text-white">{sb.subject_name}</td>
                          <td className="p-2 text-center font-semibold text-slate-800 dark:text-slate-200">{sb.points} Pts</td>
                          <td className="p-2 text-center font-bold text-slate-700 dark:text-slate-300">{sb.grade_code}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* CLASS SUMMARY & NOTES BLOCK */}
            <div className="bg-slate-50 dark:bg-slate-800/40 text-slate-800 dark:text-slate-200 rounded-xl p-4 border border-slate-200 dark:border-slate-800 space-y-3">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Class Performance Summary
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 text-xs border-t border-b border-slate-200 dark:border-slate-700 py-2.5">
                <div>
                  <span className="block text-[10px] text-slate-500 uppercase">Learners</span>
                  <span className="font-bold text-slate-900 dark:text-white">{totalLearners}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-500 uppercase">Assessed</span>
                  <span className="font-bold text-[#176B45] dark:text-emerald-400">{results.length}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-500 uppercase">Mean Marks</span>
                  <span className="font-bold text-slate-900 dark:text-white">{overallClassAverage}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-500 uppercase">Mean %</span>
                  <span className="font-bold text-[#176B45] dark:text-emerald-400">{formatPercentage(overallClassAverageNum, true)}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-500 uppercase">Mean Pts</span>
                  <span className="font-bold text-slate-900 dark:text-white">{meanPoints}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-500 uppercase">Highest Score</span>
                  <span className="font-bold text-slate-900 dark:text-white">{highestTotalMarks}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-500 uppercase">Lowest Score</span>
                  <span className="font-bold text-slate-900 dark:text-white">{lowestTotalMarks}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-500 uppercase">Best Learner</span>
                  <span className="font-bold text-[#176B45] dark:text-emerald-400 text-xs truncate block">{results[0] ? targetStudents.find(s=>s.id===results[0].student_id)?.full_name || '-' : '-'}</span>
                </div>
              </div>

              <div className="text-[11px] text-slate-500 space-y-0.5">
                <p>• Student positions are determined using Total Marks.</p>
                <p>• Overall Performance Level is calculated using the learner's Average Mark.</p>
              </div>
            </div>
          </div>
        ) : (
          /* JUNIOR SCHOOL FOOTER SECTION */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
            <div className="lg:col-span-2 space-y-3">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center space-x-2">
                <BarChart3 className="w-4 h-4 text-[#176B45] dark:text-emerald-400" />
                <span>Subject Performance Analysis</span>
              </h3>

              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold uppercase text-[10px]">
                      <th className="p-2.5">Rank</th>
                      <th className="p-2.5">Learning Area / Subject</th>
                      <th className="p-2.5 text-center">Code</th>
                      <th className="p-2.5 text-center">Class Avg (%)</th>
                      <th className="p-2.5 text-center">CBE Level</th>
                      <th className="p-2.5 text-center">Grade Code</th>
                      <th className="p-2.5 text-center">Avg Points</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-normal text-slate-800 dark:text-slate-200">
                    {subjectStats.map((sb, idx) => (
                      <tr key={sb.subject_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="p-2.5 font-semibold text-[#176B45] dark:text-emerald-400">{idx + 1}</td>
                        <td className="p-2.5 font-medium text-slate-900 dark:text-white">{sb.subject_name}</td>
                        <td className="p-2.5 text-center font-mono font-semibold text-slate-600 dark:text-slate-400">{sb.subject_code}</td>
                        <td className="p-2.5 text-center font-bold text-[#176B45] dark:text-emerald-400">{sb.average}%</td>
                        <td className="p-2.5 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                              sb.performance_level === 'EE'
                                ? 'bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border-emerald-200/50 dark:border-emerald-800/40'
                                : sb.performance_level === 'ME'
                                ? 'bg-slate-100/80 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 border-slate-200/60 dark:border-slate-700/60'
                                : sb.performance_level === 'AE'
                                ? 'bg-amber-50/80 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border-amber-200/50 dark:border-amber-800/40'
                                : 'bg-rose-50/80 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300 border-rose-200/50 dark:border-rose-800/40'
                            }`}
                          >
                            {sb.performance_level}
                          </span>
                        </td>
                        <td className="p-2.5 text-center font-semibold text-slate-700 dark:text-slate-300">{sb.grade_code}</td>
                        <td className="p-2.5 text-center font-medium text-slate-800 dark:text-slate-200">{sb.points} Pts</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 space-y-2">
              <button
                onClick={() => setIsCbeScaleOpen(!isCbeScaleOpen)}
                className="w-full flex items-center justify-between text-xs font-semibold text-slate-800 dark:text-slate-200 hover:text-[#176B45] transition-colors"
              >
                <span className="flex items-center space-x-1.5">
                  <Info className="w-4 h-4 text-[#176B45] dark:text-emerald-400" />
                  <span>CBE 8-Point Scale</span>
                </span>
                <span className="text-[11px] text-slate-500 font-normal flex items-center space-x-1">
                  <span>{isCbeScaleOpen ? 'Hide reference' : 'Show reference'}</span>
                  {isCbeScaleOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </span>
              </button>

              {isCbeScaleOpen && (
                <div className="space-y-1 text-[11px] pt-2 border-t border-slate-200 dark:border-slate-700">
                  {CBE_8_POINT_GRADES.map((g) => (
                    <div
                      key={g.id}
                      className="flex items-center justify-between p-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    >
                      <div className="flex items-center space-x-2">
                        <span
                          className={`font-semibold px-1.5 py-0.5 rounded text-[10px] border ${
                            g.performance_level === 'EE'
                              ? 'bg-emerald-50/70 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border-emerald-200/50 dark:border-emerald-800/40'
                              : g.performance_level === 'ME'
                              ? 'bg-slate-100/80 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 border-slate-200/60 dark:border-slate-700/60'
                              : g.performance_level === 'AE'
                              ? 'bg-amber-50/80 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border-amber-200/50 dark:border-amber-800/40'
                              : 'bg-rose-50/80 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300 border-rose-200/50 dark:border-rose-800/40'
                          }`}
                        >
                          {g.grade_code}
                        </span>
                        <span className="font-normal text-slate-700 dark:text-slate-300">{g.descriptor}</span>
                      </div>

                      <div className="text-right font-mono font-medium text-slate-800 dark:text-slate-200">
                        <span>{g.minimum_score}–{g.maximum_score}%</span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 ml-1.5">({g.points} Pts)</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
