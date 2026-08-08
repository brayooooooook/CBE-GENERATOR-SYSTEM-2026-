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
    const compResults = calculateExamResults(comparisonExamId, targetStudents, marks, grades, classes, activeSubjects);
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
  const isJuniorSchool = eduLevel === 'Junior School';

  // Sort learners for display
  if (isJuniorSchool) {
    results.sort((a, b) => (a.position || 999) - (b.position || 999) || (b.total_marks || 0) - (a.total_marks || 0));
  } else {
    results.sort((a, b) => {
      if ((b.average_points || 0) !== (a.average_points || 0)) {
        return (b.average_points || 0) - (a.average_points || 0);
      }
      if ((b.total_points || 0) !== (a.total_points || 0)) {
        return (b.total_points || 0) - (a.total_points || 0);
      }
      return (b.average || 0) - (a.average || 0);
    });
  }

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
  const overallClassAverage = overallClassAverageNum.toFixed(1);

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
    const avg = count > 0 ? parseFloat((sumPct / count).toFixed(1)) : 0;
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
  const displayGrade = targetGrade || (selectedClassId !== 'all' ? selectedClassId : 'All Classes');
  let displayStream = 'All Streams';
  if (selectedStreamId && selectedStreamId !== 'all') {
    const streamObj = classes.find((c) => c.id === selectedStreamId);
    const rawStream = streamObj ? streamObj.stream : selectedStreamId;
    const sStr = String(rawStream || '');
    displayStream = sStr.toLowerCase().includes('stream') ? sStr : `${sStr} Stream`;
  } else if (selectedClassId && selectedClassId !== 'all') {
    const classObj = classes.find(
      (c) => c.id === selectedClassId || (c.class_name && c.class_name.toLowerCase() === selectedClassId.toLowerCase())
    );
    if (classObj && classObj.stream) {
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
      alert(errMsg);
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
      alert(`Error generating Merit List PDF: ${errMsg}`);
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
      <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-lg font-black tracking-tight flex items-center space-x-2 text-white">
              <Award className="w-5 h-5 text-amber-400" />
              <span>Students' Performance Merit List</span>
            </h2>
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
              {viewingSummaryText}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 mb-3">
            Official Kenyan CBE Assessment Merit Standings &bull; Ranked strictly by Total Score
          </p>
          <div className="flex items-center space-x-2">
            <label className="text-xs font-semibold text-slate-400">Compare With:</label>
            <select
              value={comparisonExamId}
              onChange={(e) => setComparisonExamId(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-white text-xs font-semibold rounded-lg p-1.5 focus:outline-none"
            >
              <option value="">None</option>
              {exams
                .filter((e) => e.id !== examId && e.status === 'Completed')
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.exam_name}
                  </option>
                ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleExportPDF}
            disabled={isExportingPdf}
            className="bg-[#176B45] hover:bg-[#0F5132] text-white font-bold text-xs px-4 py-2 rounded-xl transition shadow-md flex items-center space-x-1.5 disabled:opacity-50"
          >
            {isExportingPdf ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            <span>{isExportingPdf ? 'Exporting PDF...' : 'Download Merit List PDF'}</span>
          </button>

          <button
            onClick={handleExportProvisionalApprovalPDF}
            disabled={isExportingApprovalPdf}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2 rounded-xl transition shadow-md flex items-center space-x-1.5 disabled:opacity-50"
          >
            {isExportingApprovalPdf ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileText className="w-4 h-4 text-indigo-200" />
            )}
            <span>{isExportingApprovalPdf ? 'Generating...' : 'Approval Report PDF'}</span>
          </button>

          <button
            onClick={handleExportExcel}
            disabled={isExportingExcel}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition shadow-md flex items-center space-x-1.5 disabled:opacity-50"
          >
            {isExportingExcel ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="w-4 h-4" />
            )}
            <span>Excel</span>
          </button>

          <button
            onClick={handleExportCSV}
            disabled={isExportingCsv}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs px-3.5 py-2 rounded-xl transition flex items-center space-x-1.5 disabled:opacity-50"
          >
            {isExportingCsv ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileCode className="w-4 h-4" />
            )}
            <span>CSV</span>
          </button>
        </div>
      </div>

      {pdfError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl text-xs font-semibold flex items-center justify-between shadow-sm">
          <span>⚠️ {pdfError}</span>
          <button
            onClick={() => setPdfError(null)}
            className="text-rose-600 hover:text-rose-900 font-bold ml-4 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* DOCUMENT PAPER PREVIEW CONTAINER */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
        {/* REPORT HEADER */}
        {isPrimaryLevel ? (
          /* PRIMARY MERIT LIST HEADER (STRICTLY ONLY REQUIRED FIELDS) */
          <div className="border border-slate-900 rounded-xl overflow-hidden shadow-sm">
            <div className="bg-white p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center space-x-4">
                {school.logo_url ? (
                  <img
                    src={school.logo_url}
                    alt={school.school_name}
                    className="w-16 h-16 object-contain rounded border border-slate-200"
                  />
                ) : (
                  <div className="w-14 h-14 bg-emerald-700 text-white font-black flex items-center justify-center rounded text-base shadow-inner">
                    CBE
                  </div>
                )}
                <div>
                  <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                    {school.school_name || 'School Name Not Configured'}
                  </h1>
                  <p className="text-xs font-black text-emerald-800 tracking-wider mt-0.5 uppercase">
                    REPORT: STUDENTS' PERFORMANCE MERIT LIST
                  </p>
                </div>
              </div>
              <div className="text-right text-xs font-semibold text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <span className="block text-[10px] font-extrabold text-slate-700 uppercase">Document Metadata</span>
                <span className="block font-mono font-bold text-slate-900">{dateGeneratedStr}</span>
                <span className="text-[10px] text-slate-500">{eduLevel.toUpperCase()} COHORT</span>
              </div>
            </div>

            {/* ASSESSMENT METADATA BAR */}
            <div className="bg-slate-900 text-white p-3 grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs font-bold text-center border-t border-slate-800">
              <div>
                <span className="block text-[9px] text-slate-400 uppercase font-semibold">Grade</span>
                <span className="text-amber-400 font-black">{targetGrade}</span>
              </div>
              <div>
                <span className="block text-[9px] text-slate-400 uppercase font-semibold">Stream</span>
                <span>{streamNameStr}</span>
              </div>
              <div>
                <span className="block text-[9px] text-slate-400 uppercase font-semibold">Academic Year</span>
                <span>{exam?.year || 2026}</span>
              </div>
              <div>
                <span className="block text-[9px] text-slate-400 uppercase font-semibold">Term</span>
                <span>{exam?.term || 'Term 2'}</span>
              </div>
              <div>
                <span className="block text-[9px] text-slate-400 uppercase font-semibold">Assessment Name</span>
                <span className="text-blue-300 font-black">{exam?.exam_name || 'End-Term Assessment'}</span>
              </div>
              <div>
                <span className="block text-[9px] text-slate-400 uppercase font-semibold">Assessment Code</span>
                <span className="text-emerald-400 font-mono">{(exam as any)?.exam_code || (exam as any)?.code || `${targetGrade.replace(/\s+/g, '')}T${exam?.term || '2'}EX`}</span>
              </div>
            </div>
          </div>
        ) : (
          /* JUNIOR SCHOOL HEADER */
          <div className="border-b border-slate-200 pb-5 space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
              <div className="flex items-center space-x-4">
                {school.logo_url ? (
                  <img
                    src={school.logo_url}
                    alt={school.school_name}
                    className="w-16 h-16 object-contain rounded-lg border border-slate-200"
                  />
                ) : (
                  <div className="w-14 h-14 bg-amber-500 text-slate-950 font-black flex items-center justify-center rounded-xl text-lg shadow-inner">
                    CBE
                  </div>
                )}

                <div>
                  <h1 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                    {school.school_name || 'School Name Not Configured'}
                  </h1>
                  {([
                    school.school_code ? `CODE: ${school.school_code}` : null,
                    school.county ? `COUNTY: ${school.county}` : null,
                    school.sub_county ? `SUB-COUNTY: ${school.sub_county}` : null,
                  ].filter(Boolean).length > 0) && (
                    <p className="text-xs text-slate-600 font-bold mt-0.5">
                      {[
                        school.school_code ? `CODE: ${school.school_code}` : null,
                        school.county ? `COUNTY: ${school.county}` : null,
                        school.sub_county ? `SUB-COUNTY: ${school.sub_county}` : null,
                      ].filter(Boolean).join(' • ')}
                    </p>
                  )}
                </div>
              </div>

              <div className="sm:text-right bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="block text-[10px] font-extrabold text-amber-700 uppercase tracking-wider">Official Document</span>
                <span className="block text-sm font-black text-slate-900">STUDENTS' PERFORMANCE MERIT LIST</span>
                <span className="text-[11px] text-slate-500 font-semibold">{dateGeneratedStr}</span>
              </div>
            </div>

            <div className="bg-slate-900 text-white rounded-xl p-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-bold text-center">
              <div>
                <span className="block text-[10px] text-slate-400 font-semibold uppercase">Assessment</span>
                <span className="text-amber-400 font-black">{exam?.exam_name || 'End-Term Assessment'}</span>
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 font-semibold uppercase">Term & Year</span>
                <span>{exam?.term || 'Term 2'} ({exam?.year || 2026})</span>
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 font-semibold uppercase">Grade / Stream</span>
                <span>{streamNameStr}</span>
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 font-semibold uppercase">Generated By</span>
                <span className="text-emerald-400">{generatedBy}</span>
              </div>
            </div>
          </div>
        )}

        {/* TOP SUMMARY CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-center">
            <span className="text-[10px] font-extrabold text-slate-500 uppercase">Learners</span>
            <span className="block text-lg font-black text-slate-900">{totalLearners}</span>
            <span className="text-[10px] text-slate-500 font-semibold">M: {boysCount} | F: {girlsCount}</span>
          </div>

          <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl text-center">
            <span className="text-[10px] font-extrabold text-blue-700 uppercase">Class Average</span>
            <span className="block text-lg font-black text-blue-900">{formatPercentage(overallClassAverageNum, true)}</span>
            <span className="text-[10px] text-blue-700 font-semibold">Cohort Mean</span>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-center">
            <span className="text-[10px] font-extrabold text-emerald-700 uppercase">Highest Score</span>
            <span className="block text-lg font-black text-emerald-900">{highestTotalMarks}</span>
            <span className="text-[10px] text-emerald-700 font-semibold">Avg: {formatPercentage(highestAverage, true)}</span>
          </div>

          <div className="bg-amber-50 border border-amber-200 p-3 rounded-xl text-center">
            <span className="text-[10px] font-extrabold text-amber-700 uppercase">Mean Points</span>
            <span className="block text-lg font-black text-amber-900">{meanPoints}</span>
            <span className="text-[10px] text-amber-700 font-semibold">Out of 8.0</span>
          </div>

          <div className="bg-purple-50 border border-purple-200 p-3 rounded-xl text-center">
            <span className="text-[10px] font-extrabold text-purple-700 uppercase">EE Learners</span>
            <span className="block text-lg font-black text-purple-900">{eeCount}</span>
            <span className="text-[10px] text-purple-700 font-semibold">
              {totalLearners > 0 ? formatPercentage((eeCount / totalLearners) * 100) : 0}% Exceeding
            </span>
          </div>

          <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl text-center">
            <span className="text-[10px] font-extrabold text-rose-700 uppercase">BE Learners</span>
            <span className="block text-lg font-black text-rose-900">{beCount}</span>
            <span className="text-[10px] text-rose-700 font-semibold">Need Support</span>
          </div>
        </div>

        {/* MERIT LIST TABLE */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
            <thead>
              <tr className="bg-slate-900 text-white font-extrabold uppercase text-[10px] tracking-wider text-center">
                <th className="p-2.5 border-r border-slate-800 sticky left-0 z-20 bg-slate-900 min-w-[50px]">SERIAL NO</th>
                <th className="p-2.5 border-r border-slate-800 sticky left-[50px] z-20 bg-slate-900 min-w-[75px]">ADM NO</th>
                <th className="p-2.5 border-r border-slate-800 text-left sticky left-[125px] z-20 bg-slate-900 min-w-[150px] shadow-[4px_0_8px_-2px_rgba(0,0,0,0.3)]">LEARNER NAME</th>
                <th className="p-2.5 border-r border-slate-800">ASS NO</th>
                <th className="p-2.5 border-r border-slate-800">STREAM</th>
                <th className="p-2.5 border-r border-slate-800">STR. POS.</th>
                <th className="p-2.5 border-r border-slate-800 text-amber-300">OVR POS</th>
                <th className="p-2.5 border-r border-slate-800">PRV STR POS</th>
                <th className="p-2.5 border-r border-slate-800">PRV OVR POS</th>

                {/* Grade-Specific Learning Areas */}
                {activeSubjects.map((sb) => (
                  <th key={sb.id} className="p-2 border-r border-slate-800 min-w-[65px]">
                    <span className="block font-black text-amber-400">{getMeritListDisplayCode(sb.subject_code, sb.subject_name)}</span>
                  </th>
                ))}

                {!isPrimaryLevel && (
                  <th className="p-2.5 border-r border-slate-800 bg-slate-800">SUB. ENTRY</th>
                )}
                <th className="p-2.5 border-r border-slate-800 bg-slate-800 text-amber-300">TOTAL MARKS</th>
                <th className="p-2.5 border-r border-slate-800 bg-slate-800 text-blue-300">{isPrimaryLevel ? 'AVG %' : 'AVG MARKS'}</th>
                <th className="p-2.5 border-r border-slate-800 bg-slate-800">TOTAL PTS</th>
                <th className="p-2.5 border-r border-slate-800 bg-slate-800">AVG PTS</th>
                <th className="p-2.5 border-r border-slate-800 bg-slate-800 text-emerald-300">CBE LEVEL</th>
                <th className="p-2.5 bg-slate-800">GRADE CODE</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 text-slate-800 font-medium">
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
                }).length || r.subject_count || 1;
                const assessedCount = subEntryCount || 1;
                const avgPtsNum = r.average_points !== undefined && r.average_points !== null && r.average_points > 0
                  ? r.average_points
                  : (r.total_points / assessedCount);
                const avgPts = avgPtsNum.toFixed(2);

                const overallLevelObj = getGradeForMark(r.average, grades);
                const overallLevelDisplay = isComplete
                  ? (overallLevelObj.grade_code || overallLevelObj.performance_level || 'ME1')
                  : `Prov (${overallLevelObj.grade_code || overallLevelObj.performance_level || 'ME1'})`;

                return (
                  <tr key={r.id} className={`hover:bg-slate-50 transition ${!isComplete ? 'bg-amber-50/40' : ''}`}>
                    <td className="p-2 text-center font-normal text-slate-500 sticky left-0 z-10 bg-white border-r border-slate-100">{idx + 1}</td>
                    <td className="p-2 text-center font-mono font-normal text-slate-700 sticky left-[50px] z-10 bg-white border-r border-slate-100">{std?.admission_number || '-'}</td>
                    <td className="p-2 font-normal text-slate-900 uppercase sticky left-[125px] z-10 bg-white border-r border-slate-100 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)]">
                      {std?.full_name}
                      {!isComplete && (
                        <span className="ml-2 bg-amber-200 text-amber-900 text-[9px] px-1.5 py-0.5 rounded font-medium uppercase">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="p-2 text-center font-mono font-normal text-slate-600">
                      {(std as any)?.assessment_number || (std as any)?.ass_no || '-'}
                    </td>
                    <td className="p-2 text-center text-slate-700 font-normal uppercase">
                      {streamDisplay}
                    </td>
                    <td className="p-2 text-center font-normal text-slate-800">
                      {streamRankDisplay}
                    </td>
                    <td className="p-2 text-center font-bold text-blue-700 bg-blue-50/50">
                      {overallPosDisplay}
                    </td>
                    <td className="p-2 text-center text-slate-400 font-normal text-[11px]">
                      {prevStrDisplay}
                    </td>
                    <td className="p-2 text-center text-slate-400 font-normal text-[11px]">
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

                        return (
                          <td key={sb.id} className="p-1.5 text-center border-r border-slate-100 whitespace-nowrap">
                            <div className="inline-flex items-center justify-center gap-1 text-[10.5px]">
                              <span className="font-semibold text-slate-900">{displayedPct}</span>
                              <span
                                className={`text-[9.5px] font-bold px-1 py-0.2 rounded ${
                                  gr?.performance_level === 'EE'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : gr?.performance_level === 'ME'
                                    ? 'bg-blue-100 text-blue-800'
                                    : gr?.performance_level === 'AE'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {cbeCode}
                              </span>
                            </div>
                          </td>
                        );
                      } else if (markInfo.status === 'X') {
                        return (
                          <td key={sb.id} className="p-1.5 text-center border-r border-slate-100 whitespace-nowrap text-[10.5px] font-semibold text-rose-700">
                            X
                          </td>
                        );
                      } else if (markInfo.status === 'Y') {
                        return (
                          <td key={sb.id} className="p-1.5 text-center border-r border-slate-100 whitespace-nowrap text-[10.5px] font-semibold text-purple-700">
                            Y
                          </td>
                        );
                      } else {
                        return (
                          <td key={sb.id} className="p-1.5 text-center border-r border-slate-100 whitespace-nowrap text-slate-300 font-normal">
                            -
                          </td>
                        );
                      }
                    })}

                    {!isPrimaryLevel && (
                      <td className="p-2 text-center font-normal text-slate-800 border-r border-slate-100">
                        {subEntryCount}
                      </td>
                    )}

                    <td className="p-2 text-center font-bold text-slate-900 bg-slate-100/70">
                      {r.total_marks}
                    </td>
                    <td className="p-2 text-center font-bold text-blue-700 bg-blue-50">
                      {formatPercentage(r.average, true)} {!isComplete && <span className="text-[9px] text-amber-600 font-normal block">(Prov)</span>}
                    </td>
                    <td className="p-2 text-center font-normal text-slate-800">
                      {r.total_points}
                    </td>
                    <td className="p-2 text-center font-normal text-indigo-700">
                      {avgPts}
                    </td>
                    <td className="p-2 text-center font-medium text-emerald-800">
                      {overallLevelObj.performance_level || 'ME'}
                    </td>
                    <td className="p-2 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          !isComplete
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : overallLevelObj.performance_level === 'EE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : overallLevelObj.performance_level === 'ME'
                            ? 'bg-blue-100 text-blue-800'
                            : overallLevelObj.performance_level === 'AE'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
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
              <div className="space-y-2.5 bg-slate-50 border border-slate-200 rounded-xl p-4">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center space-x-2">
                  <BarChart3 className="w-4 h-4 text-blue-600" />
                  <span>Subject Average Marks</span>
                </h3>
                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px]">
                        <th className="p-2">Learning Area</th>
                        <th className="p-2 text-center">Code</th>
                        <th className="p-2 text-center">Class Average (%)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {subjectStats.map((sb) => (
                        <tr key={sb.subject_id} className="hover:bg-slate-50">
                          <td className="p-2 font-bold text-slate-900">{sb.subject_name}</td>
                          <td className="p-2 text-center font-mono text-purple-700 font-bold">{sb.subject_code}</td>
                          <td className="p-2 text-center font-black text-blue-700">{formatPercentage(sb.average, true)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Subject Average Points & Overall Level Table */}
              <div className="space-y-2.5 bg-slate-50 border border-slate-200 rounded-xl p-4">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center space-x-2">
                  <Award className="w-4 h-4 text-emerald-600" />
                  <span>Subject Average Points & Overall Level</span>
                </h3>
                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px]">
                        <th className="p-2">Learning Area</th>
                        <th className="p-2 text-center">Average Points</th>
                        <th className="p-2 text-center">Overall Level</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {subjectStats.map((sb) => (
                        <tr key={sb.subject_id} className="hover:bg-slate-50">
                          <td className="p-2 font-bold text-slate-900">{sb.subject_name}</td>
                          <td className="p-2 text-center font-bold text-slate-800">{sb.points} Pts</td>
                          <td className="p-2 text-center font-black text-purple-700">{sb.grade_code}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* CLASS SUMMARY & NOTES BLOCK */}
            <div className="bg-slate-900 text-white rounded-xl p-5 border border-slate-800 space-y-4">
              <h3 className="text-xs font-black text-amber-400 uppercase tracking-wider">
                Official Class Performance Summary & Notes
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 text-xs border-t border-b border-slate-800 py-3">
                <div>
                  <span className="block text-[10px] text-slate-400 font-semibold">Total Learners</span>
                  <span className="font-black text-white text-base">{totalLearners}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400 font-semibold">Assessed</span>
                  <span className="font-black text-emerald-400 text-base">{results.length}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400 font-semibold">Mean Marks</span>
                  <span className="font-black text-blue-300 text-base">{overallClassAverage}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400 font-semibold">Mean %</span>
                  <span className="font-black text-amber-300 text-base">{formatPercentage(overallClassAverageNum, true)}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400 font-semibold">Mean Points</span>
                  <span className="font-black text-purple-300 text-base">{meanPoints}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400 font-semibold">Highest Score</span>
                  <span className="font-black text-emerald-300 text-base">{highestTotalMarks}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400 font-semibold">Lowest Score</span>
                  <span className="font-black text-rose-300 text-base">{lowestTotalMarks}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400 font-semibold">Best Learner</span>
                  <span className="font-bold text-amber-400 text-xs truncate block">{results[0] ? targetStudents.find(s=>s.id===results[0].student_id)?.full_name || '-' : '-'}</span>
                </div>
              </div>

              <div className="text-xs text-slate-400 space-y-1 font-medium italic">
                <p>• Student positions are determined using Total Marks.</p>
                <p>• Overall Performance Level is calculated using the learner's Average Mark.</p>
              </div>
            </div>
          </div>
        ) : (
          /* JUNIOR SCHOOL FOOTER SECTION */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
            <div className="lg:col-span-2 space-y-3">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center space-x-2">
                <BarChart3 className="w-4 h-4 text-blue-600" />
                <span>Subject Performance Analysis (Ranked by Class Average)</span>
              </h3>

              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px]">
                      <th className="p-2.5">Rank</th>
                      <th className="p-2.5">Learning Area / Subject</th>
                      <th className="p-2.5 text-center">Code</th>
                      <th className="p-2.5 text-center">Class Avg (%)</th>
                      <th className="p-2.5 text-center">CBE Level</th>
                      <th className="p-2.5 text-center">Grade Code</th>
                      <th className="p-2.5 text-center">Avg Points</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                    {subjectStats.map((sb, idx) => (
                      <tr key={sb.subject_id} className="hover:bg-slate-50">
                        <td className="p-2.5 font-bold text-blue-700">#{idx + 1}</td>
                        <td className="p-2.5 font-bold text-slate-900">{sb.subject_name}</td>
                        <td className="p-2.5 text-center font-mono font-bold text-purple-700">{sb.subject_code}</td>
                        <td className="p-2.5 text-center font-black text-blue-700">{sb.average}%</td>
                        <td className="p-2.5 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              sb.performance_level === 'EE'
                                ? 'bg-emerald-100 text-emerald-800'
                                : sb.performance_level === 'ME'
                                ? 'bg-blue-100 text-blue-800'
                                : sb.performance_level === 'AE'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {sb.performance_level}
                          </span>
                        </td>
                        <td className="p-2.5 text-center font-bold text-purple-800">{sb.grade_code}</td>
                        <td className="p-2.5 text-center font-bold text-slate-800">{sb.points} Pts</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                Kenya CBE 8-Point Achievement Scale
              </h3>

              <div className="space-y-1.5 text-[11px]">
                {CBE_8_POINT_GRADES.map((g) => (
                  <div
                    key={g.id}
                    className="flex items-center justify-between p-1.5 rounded border border-slate-200 bg-white"
                  >
                    <div className="flex items-center space-x-2">
                      <span
                        className={`font-black px-1.5 py-0.5 rounded text-[10px] ${
                          g.performance_level === 'EE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : g.performance_level === 'ME'
                            ? 'bg-blue-100 text-blue-800'
                            : g.performance_level === 'AE'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {g.grade_code}
                      </span>
                      <span className="font-semibold text-slate-700">{g.descriptor}</span>
                    </div>

                    <div className="text-right font-mono font-bold text-slate-800">
                      <span>{g.minimum_score}–{g.maximum_score}%</span>
                      <span className="text-[10px] text-slate-500 ml-1.5">({g.points} Pts)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
