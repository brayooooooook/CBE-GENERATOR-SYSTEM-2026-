import React, { useState } from 'react';
import {
  AlertTriangle,
  Download,
  FileText,
  Loader2,
  Info,
  CheckCircle2,
  ShieldAlert,
  UserX,
  Filter,
} from 'lucide-react';
import {
  Examination,
  Student,
  Subject,
  Mark,
  Grade,
  ClassStream,
  School,
  User,
  Teacher,
  sortGrades,
  sortClasses,
} from '../types';
import { getFilteredStudents, getClassStreamLabel } from '../utils/filterUtils';
import { exportProvisionalStudentResultsPDF } from '../services/provisionalStudentResultsPdfExporter';
import { sortSubjectsByStandardOrder, getMeritListDisplayCode } from '../services/meritListExporter';
import { evaluateMark, formatPercentage } from '../utils/markUtils';
import { getGradeForMark } from '../services/analysisEngine';
import { getActiveTeacher, getAccessibleClasses } from '../utils/rbacUtils';
import { useAcademicSession } from '../contexts/AcademicSessionContext';

interface ProvisionalResultsViewProps {
  school?: School;
  exams?: Examination[];
  students?: Student[];
  subjects?: Subject[];
  marks?: Mark[];
  grades?: Grade[];
  classes?: ClassStream[];
  teachers?: Teacher[];
  currentUser?: User;
  selectedExamId?: string;
  selectedClassId?: string;
  selectedStreamId?: string;
}

export const ProvisionalResultsView: React.FC<ProvisionalResultsViewProps> = ({
  school,
  exams = [],
  students = [],
  subjects = [],
  marks = [],
  grades = [],
  classes = [],
  teachers = [],
  currentUser,
  selectedExamId: propExamId,
  selectedClassId: propClassId,
  selectedStreamId: propStreamId,
}) => {
  const activeTeacher = getActiveTeacher(currentUser || null, teachers);
  const accessibleClasses = getAccessibleClasses(currentUser || null, activeTeacher, classes);
  const uniqueClasses = sortGrades(Array.from(new Set((accessibleClasses || []).map((c) => c.class_name))));

  const [internalExamId, setInternalExamId] = useState<string>(
    (exams || []).find((e) => e.status === 'Provisional' || e.status === 'Verification')?.id || (exams || [])[0]?.id || ''
  );
  const [internalClassId, setInternalClassId] = useState<string>(() => uniqueClasses[0] || '');
  const [internalStreamId, setInternalStreamId] = useState<string>('all');
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const activeExamId = propExamId !== undefined ? propExamId : internalExamId;
  const activeClassId = propClassId !== undefined ? propClassId : internalClassId;
  const activeStreamId = propStreamId !== undefined ? propStreamId : internalStreamId;

  const selectedExam = (exams || []).find((e) => e.id === activeExamId);
  const { viewingTerm: activeTermObj } = useAcademicSession();

  // Filter students by selected class & stream (historical exam context aware)
  const targetStudents = getFilteredStudents(
    students,
    classes,
    activeClassId,
    activeStreamId,
    selectedExam
  );

  // Sort students by admission number / name for standard verification roster order (NO RANKING)
  const sortedStudents = [...targetStudents].sort((a, b) => {
    const admA = (a.admission_number || '').toString().toLowerCase();
    const admB = (b.admission_number || '').toString().toLowerCase();
    if (admA && admB) {
      return admA.localeCompare(admB, undefined, { numeric: true });
    }
    return (a.full_name || '').localeCompare(b.full_name || '');
  });

  const activeSubjects = sortSubjectsByStandardOrder(subjects);

  const handleDownloadPdf = async () => {
    if (!selectedExam || sortedStudents.length === 0 || isExportingPdf) return;
    setIsExportingPdf(true);
    try {
      const activeSchool = school || {
        school_name: 'School',
        address: '',
        email: '',
        phone: '',
      };
      await exportProvisionalStudentResultsPDF({
        school: activeSchool,
        exam: selectedExam,
        selectedClassId: activeClassId,
        selectedStreamId: activeStreamId,
        classes,
        students,
        subjects,
        marks,
        grades,
        teachers,
        generatedBy: currentUser?.name || 'Administrator',
      });
    } catch (err) {
      console.error('Error generating Provisional Student Results PDF:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const classStreamLabel = getClassStreamLabel(classes, activeClassId, activeStreamId);
  const isPdfDisabled = isExportingPdf || !selectedExam || sortedStudents.length === 0;
  const pdfTooltipText = sortedStudents.length === 0
    ? 'No results available to export.'
    : !selectedExam
    ? 'Please select an assessment to export.'
    : 'Download Provisional PDF';

  return (
    <div className="space-y-6">
      {/* Standalone Selectors (Only shown if props were not provided by parent component) */}
      {(propExamId === undefined || propClassId === undefined) && (
        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 shadow-xs border border-slate-200 dark:border-slate-800 border-l-4 border-l-[#176B45] dark:border-l-emerald-500 space-y-3 w-full max-w-full">
          <div className="flex items-center space-x-2 text-[#176B45] dark:text-emerald-400 font-extrabold text-xs">
            <Filter className="w-4 h-4 text-[#176B45] dark:text-emerald-400" />
            <span>Filter results</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs w-full">
            {/* Assessment Selection */}
            <div className="md:col-span-2 space-y-1">
              <label className="block text-slate-700 dark:text-slate-300 font-semibold text-xs">Assessment</label>
              <select
                value={internalExamId}
                onChange={(e) => setInternalExamId(e.target.value)}
                className="w-full h-11 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#176B45]/20 focus:border-[#176B45] dark:focus:border-emerald-500 transition-colors cursor-pointer"
              >
                <option value="">Select Assessment...</option>
                {exams.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.exam_name} [{ex.status}]
                  </option>
                ))}
              </select>
            </div>

            {/* Class Selection */}
            <div className="space-y-1">
              <label className="block text-slate-700 dark:text-slate-300 font-semibold text-xs">Class</label>
              <select
                value={internalClassId}
                onChange={(e) => {
                  setInternalClassId(e.target.value);
                  setInternalStreamId('all');
                }}
                className="w-full h-11 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#176B45]/20 focus:border-[#176B45] dark:focus:border-emerald-500 transition-colors cursor-pointer"
              >
                <option value="">Select Class...</option>
                {uniqueClasses.map((cn) => (
                  <option key={cn} value={cn}>
                    {cn}
                  </option>
                ))}
              </select>
            </div>

            {/* Stream Selection */}
            <div className="space-y-1">
              <label className="block text-slate-700 dark:text-slate-300 font-semibold text-xs">Stream</label>
              <select
                value={internalStreamId}
                onChange={(e) => setInternalStreamId(e.target.value)}
                className="w-full h-11 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#176B45]/20 focus:border-[#176B45] dark:focus:border-emerald-500 transition-colors cursor-pointer"
              >
                <option value="all">All Streams</option>
                {sortClasses(
                  classes.filter(
                    (c) =>
                      c.class_name.toLowerCase() === internalClassId.toLowerCase() ||
                      c.id === internalClassId
                  )
                ).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.class_name} - {c.stream}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Main Header Card */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-[#176B45] dark:text-emerald-400 font-bold text-xs uppercase tracking-wider mb-1">
            <span className="bg-emerald-100 dark:bg-emerald-950/80 text-[#176B45] dark:text-emerald-300 px-2 py-0.5 rounded font-extrabold border border-emerald-200 dark:border-emerald-800">
              MARK VERIFICATION REPORT
            </span>
          </div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
            PROVISIONAL STUDENT RESULTS
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 font-medium">
            <span className="font-bold text-slate-800 dark:text-slate-200">{selectedExam?.exam_name || 'Selected Assessment'}</span>
            {classStreamLabel ? ` • Class: ${classStreamLabel}` : ''}
            {activeTermObj?.name ? ` • Term: ${activeTermObj.name}` : ''}
            {` • Total Candidates: ${sortedStudents.length}`}
          </p>
        </div>

        <button
          type="button"
          onClick={handleDownloadPdf}
          disabled={isPdfDisabled}
          title={pdfTooltipText}
          aria-label={pdfTooltipText}
          className="bg-[#176B45] dark:bg-emerald-600 hover:bg-[#0F5132] dark:hover:bg-emerald-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-500 dark:disabled:text-slate-500 disabled:border-slate-300 dark:disabled:border-slate-700 disabled:opacity-75 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-lg text-xs font-bold shadow-sm transition flex items-center justify-center space-x-2 shrink-0 cursor-pointer"
        >
          {isExportingPdf ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          <span>{isExportingPdf ? 'Generating PDF...' : 'Download Provisional PDF'}</span>
        </button>
      </div>

      {/* Provisional Results Warning Banner */}
      <div className="bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/60 rounded-xl p-4 flex items-start space-x-3 text-amber-900 dark:text-amber-300 text-xs">
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-amber-950 dark:text-amber-200 uppercase tracking-wide">
            PROVISIONAL RESULTS &bull; FOR VERIFICATION ONLY
          </p>
          <p className="text-amber-900 dark:text-amber-300/90 leading-relaxed font-medium">
            This mark verification report contains provisional student assessment results compiled for administrative and academic audit. Results are subject to correction and are not official or final until formally verified and approved by school administration.
          </p>
        </div>
      </div>

      {/* Learner Results Roster Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <h2 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
            Learner Marks & Assessment Summary ({sortedStudents.length} Candidates)
          </h2>
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            Sorted by Admission Number / Student Name
          </span>
        </div>

        {sortedStudents.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
              <thead>
                <tr className="bg-slate-900 dark:bg-slate-950 text-white font-extrabold uppercase text-[10px] tracking-wider text-center">
                  <th className="p-2.5 border-r border-slate-800 dark:border-slate-800 sticky left-0 z-20 bg-slate-900 dark:bg-slate-950 min-w-[45px]">NO.</th>
                  <th className="p-2.5 border-r border-slate-800 dark:border-slate-800 sticky left-[45px] z-20 bg-slate-900 dark:bg-slate-950 min-w-[85px]">ADM NO</th>
                  <th className="p-2.5 border-r border-slate-800 dark:border-slate-800 text-left sticky left-[130px] z-20 bg-slate-900 dark:bg-slate-950 min-w-[160px] shadow-[4px_0_8px_-2px_rgba(0,0,0,0.3)]">STUDENT NAME</th>

                  {/* Subject Columns */}
                  {activeSubjects.map((sb) => (
                    <th key={sb.id} className="p-2 border-r border-slate-800 dark:border-slate-800 min-w-[65px]">
                      <span className="block font-black text-amber-400">
                        {getMeritListDisplayCode(sb.subject_code, sb.subject_name)}
                      </span>
                      <span className="text-[8px] text-slate-400 font-normal">Score / Code</span>
                    </th>
                  ))}

                  <th className="p-2.5 border-r border-slate-800 dark:border-slate-800 bg-slate-800 dark:bg-slate-900 text-amber-300">TOTAL</th>
                  <th className="p-2.5 border-r border-slate-800 dark:border-slate-800 bg-slate-800 dark:bg-slate-900 text-blue-300">AVG %</th>
                  <th className="p-2.5 bg-slate-800 dark:bg-slate-900 text-emerald-300">CBE LEVEL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium text-slate-800 dark:text-slate-200">
                {sortedStudents.map((student, idx) => {
                  let totalScore = 0;
                  let enteredCount = 0;

                  return (
                    <tr key={student.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                      <td className="p-2 text-center font-semibold text-slate-500 dark:text-slate-400 sticky left-0 z-10 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800">
                        {idx + 1}
                      </td>
                      <td className="p-2 text-center font-mono font-bold text-slate-700 dark:text-slate-300 sticky left-[45px] z-10 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800">
                        {student.admission_number || '-'}
                      </td>
                      <td className="p-2 font-bold text-slate-900 dark:text-slate-100 uppercase sticky left-[130px] z-10 bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.1)]">
                        {student.full_name}
                      </td>

                      {/* Subject Marks */}
                      {activeSubjects.map((sb) => {
                        const stdMark = marks.find(
                          (m) =>
                            String(m.student_id) === String(student.id) &&
                            String(m.subject_id) === String(sb.id) &&
                            String(m.exam_id) === String(activeExamId)
                        );
                        const markInfo = evaluateMark(stdMark);

                        if (markInfo.status === 'Normal' && markInfo.percentage !== null) {
                          totalScore += markInfo.percentage;
                          enteredCount += 1;
                          const roundedVal = Math.round(markInfo.percentage);
                          const gr = getGradeForMark(markInfo.percentage, grades);
                          const cbeCode = gr.grade_code || 'ME1';

                          return (
                            <td key={sb.id} className="p-1.5 text-center border-r border-slate-100 dark:border-slate-800 whitespace-nowrap">
                              <span className="font-semibold text-slate-900 dark:text-slate-100">{roundedVal} </span>
                              <span className="text-[9.5px] font-bold px-1 py-0.2 rounded bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border border-transparent dark:border-blue-800">
                                {cbeCode}
                              </span>
                            </td>
                          );
                        } else if (markInfo.status === 'X') {
                          return (
                            <td key={sb.id} className="p-1.5 text-center border-r border-slate-100 dark:border-slate-800 whitespace-nowrap text-[10.5px] font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60">
                              X
                            </td>
                          );
                        } else if (markInfo.status === 'Y') {
                          return (
                            <td key={sb.id} className="p-1.5 text-center border-r border-slate-100 dark:border-slate-800 whitespace-nowrap text-[10.5px] font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60">
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

                      {/* Summary Totals */}
                      {(() => {
                        const avg = enteredCount > 0 ? totalScore / enteredCount : 0;
                        const overallGrade = getGradeForMark(avg, grades);
                        const level = overallGrade.performance_level || 'ME';

                        return (
                          <>
                            <td className="p-2 text-center font-bold text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-800/80">
                              {enteredCount > 0 ? Math.round(totalScore) : '-'}
                            </td>
                            <td className="p-2 text-center font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60">
                              {enteredCount > 0 ? `${formatPercentage(avg)}%` : '-'}
                            </td>
                            <td className="p-2 text-center">
                              {enteredCount > 0 ? (
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    level === 'EE'
                                      ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-transparent dark:border-emerald-800'
                                      : level === 'ME'
                                      ? 'bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border border-transparent dark:border-blue-800'
                                      : level === 'AE'
                                      ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-transparent dark:border-amber-800'
                                      : 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-transparent dark:border-rose-800'
                                  }`}
                                >
                                  {level} ({overallGrade.grade_code || 'ME1'})
                                </span>
                              ) : (
                                <span className="text-slate-400 dark:text-slate-500 font-normal">-</span>
                              )}
                            </td>
                          </>
                        );
                      })()}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 px-4 flex flex-col items-center justify-center text-center space-y-3 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
            <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-100 dark:border-emerald-800 flex items-center justify-center text-[#176B45] dark:text-emerald-400">
              <UserX className="w-6 h-6" />
            </div>
            <div className="max-w-md space-y-1">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">No learners found</h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
                There are currently no learners registered for this assessment and class. Add learners to view their assessment results.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Warning & Missing Marks Audit Notice Banner */}
      <div className="bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/60 rounded-xl p-4 flex items-start space-x-3 text-blue-900 dark:text-blue-300 text-xs">
        <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-blue-950 dark:text-blue-200 uppercase tracking-wide">
            AUDIT NOTICE &bull; REPORT MISSING OR INCORRECT MARKS
          </p>
          <p className="text-blue-900 dark:text-blue-300/90 leading-relaxed font-medium">
            Please inspect all recorded scores carefully. Any missing marks (X/Y), unentered subjects, or score discrepancies must be reported immediately to your Class Teacher or the Examination Officer before final result approval and official report card publication.
          </p>
        </div>
      </div>
    </div>
  );
};
