import React, { useState, useEffect } from 'react';
import {
  School,
  Student,
  Subject,
  Examination,
  Mark,
  Grade,
  ClassStream,
  Teacher,
  LearnerReportComment,
  getApplicableSubjectsForGrade,
  getEducationLevelForGrade,
  User as UserType,
} from '../types';
import {
  calculateExamResults,
  getGradeForMark,
  calculateSubjectRank,
  getLearnerReportSubjects,
} from '../services/analysisEngine';
import { generatePersonalizedLearnerComment } from '../services/learnerCommentGenerator';
import { getLearnerClassAtExamTime } from '../services/historicalContextResolver';
import { evaluateMark } from '../utils/markUtils';
import { Award, CheckCircle, Edit3, User, Calendar, Shield, Save, Download, Loader2 } from 'lucide-react';
import { downloadSingleReportCardPDF } from '../services/pdfReportGenerator';
import { getFilteredStudents, stripSurroundingQuotes } from '../utils/filterUtils';
import {
  getActiveTeacher,
  canUserEditSubjectMarks,
  canUserEditClassTeacherRemarks,
} from '../utils/rbacUtils';

interface LearnerReportCardProps {
  student: Student;
  school: School;
  classes: ClassStream[];
  subjects: Subject[];
  exams: Examination[];
  marks: Mark[];
  grades: Grade[];
  teachers?: Teacher[];
  currentUser?: UserType;
  selectedExamId: string;
  allStudents: Student[];
  isBatchMode?: boolean;
  onSaveRemarks?: (studentId: string, examId: string, remarks: Partial<LearnerReportComment>) => void;
  savedRemarks?: LearnerReportComment;
  canModify?: boolean;
}

export const LearnerReportCard: React.FC<LearnerReportCardProps> = ({
  canModify = false,
  student,
  school,
  classes = [],
  subjects = [],
  exams = [],
  marks = [],
  grades = [],
  teachers = [],
  currentUser,
  selectedExamId,
  allStudents = [],
  isBatchMode = false,
  onSaveRemarks,
  savedRemarks,
}) => {
  const activeTeacher = getActiveTeacher(currentUser || null, teachers || []);
  const isAdmin = currentUser?.role === 'admin';
  const selectedExam = (exams || []).find((e) => e.id === selectedExamId);

  // Resolve learner historical class, stream, and grade context for selected exam
  const examContext = selectedExam
    ? getLearnerClassAtExamTime(student, selectedExam, classes)
    : null;
  const isHistoricalContext = examContext?.is_historical === true;

  let targetClass = (classes || []).find((c) => c.id === student.class_id);
  if (isHistoricalContext) {
    if (examContext.historical_context_resolved && examContext.class_id) {
      targetClass = (classes || []).find((c) => c.id === examContext.class_id) || {
        id: examContext.class_id,
        class_name: examContext.class_name,
        stream: examContext.stream_name,
        education_level: getEducationLevelForGrade(examContext.grade),
      } as ClassStream;
    } else {
      // Unresolved historical context - MUST NOT leak current student.class_id
      targetClass = undefined;
    }
  }

  const targetClassId = isHistoricalContext
    ? (examContext?.class_id || '')
    : (student.class_id || '');

  const classNameStr = isHistoricalContext
    ? (examContext?.full_class_name || 'Unknown Grade')
    : (targetClass
        ? `${targetClass.class_name} - ${targetClass.stream}`
        : student.class_id || student.grade || 'Grade 7');

  const studentGrade = isHistoricalContext
    ? (examContext?.grade || 'Unknown Grade')
    : (student.grade || targetClass?.class_name || '');

  const studentLevel = getEducationLevelForGrade(studentGrade);

  const effectiveStudent: Student = isHistoricalContext
    ? { ...student, class_id: targetClassId, grade: studentGrade }
    : student;

  const learnerSubjects = getLearnerReportSubjects(effectiveStudent, targetClass, subjects, teachers);
  const isClassTeacher = canUserEditClassTeacherRemarks(currentUser || null, activeTeacher, targetClassId || student.class_id, classes);

  // Find class teacher name for historical or current target class
  const classTeacher = targetClassId
    ? (teachers.find((t) => t.id === targetClass?.class_teacher_id) ||
       teachers.find(
         (t) =>
           t.is_class_teacher &&
           (t.class_teacher_of_id === targetClassId || (t.allocations || []).some(a => a.class_id === targetClassId))
       ) ||
       teachers.find((t) => (t.allocations || []).some(a => a.class_id === targetClassId)))
    : undefined;

  const defaultClassTeacherName = classTeacher
    ? classTeacher.teacher_name
    : `${targetClass?.stream || examContext?.stream_name || ''} Class Teacher`.trim() || 'Class Teacher';

  // Calculate overall student results for this exam
  const examResults = calculateExamResults(selectedExamId, allStudents, marks, grades, classes, subjects);
  const studentResult = examResults.find((r) => r.student_id === student.id);

  // Auto-calculated defaults
  const isAssessmentComplete = studentResult ? studentResult.is_complete !== false : false;
  const totalMarks = studentResult?.total_marks || 0;
  const averageScore = studentResult?.average || 0;
  const totalPoints = isAssessmentComplete ? (studentResult?.total_points || 0) : 0;
  const overallLevel = isAssessmentComplete ? (studentResult?.performance_level || 'ME') : 'Pending';
  const overallGradeCode = isAssessmentComplete ? (studentResult?.grade_code || studentResult?.grade || 'ME1') : 'Pending';
  const overallRank = isAssessmentComplete && studentResult?.position ? `#${studentResult.position}` : 'Not Yet Ranked';
  const streamRank = isAssessmentComplete && (studentResult?.class_position || studentResult?.position) ? `#${studentResult.class_position || studentResult.position}` : 'Not Yet Ranked';
  const totalAssessedStudents = examResults.filter(r => r.is_complete !== false).length || 1;

  // Stream total students
  const streamStudentsCount = targetClassId
    ? (getFilteredStudents(allStudents, classes, targetClassId, targetClassId, selectedExam).length || 1)
    : 1;

  // Maximum possible score & points calculation
  const evaluatedSubjectCount = learnerSubjects.length || 1;
  const maxPossibleMarks = evaluatedSubjectCount * 100;
  const maxPossiblePoints = evaluatedSubjectCount * 8;

  // Dynamic Personalised Remark Builders based on actual learner data
  const getDefaultClassTeacherComment = () => {
    return generatePersonalizedLearnerComment({
      student: effectiveStudent,
      examId: selectedExamId,
      marks,
      subjects: learnerSubjects,
      grades,
      exams,
      averageScore,
      averagePoints: studentResult?.average_points || 0,
      overallLevel,
      commentType: 'class_teacher',
      isProvisional: !isAssessmentComplete,
    });
  };

  const getDefaultHOIComment = () => {
    return generatePersonalizedLearnerComment({
      student: effectiveStudent,
      examId: selectedExamId,
      marks,
      subjects: learnerSubjects,
      grades,
      exams,
      averageScore,
      averagePoints: studentResult?.average_points || 0,
      overallLevel,
      commentType: 'hoi',
      isProvisional: !isAssessmentComplete,
    });
  };

  // Editable Remarks State
  const [classTeacherComment, setClassTeacherComment] = useState(
    savedRemarks?.class_teacher_comment || getDefaultClassTeacherComment()
  );
  const [classTeacherName, setClassTeacherName] = useState(
    savedRemarks?.class_teacher_name || defaultClassTeacherName
  );
  const [hoiComment, setHoiComment] = useState(
    savedRemarks?.hoi_comment || getDefaultHOIComment()
  );
  const [hoiName, setHoiName] = useState(
    savedRemarks?.hoi_name || school.principal_name || 'Head of Institution'
  );
  const [nextTermOpeningDate, setNextTermOpeningDate] = useState(
    savedRemarks?.next_term_opening_date || '12th September 2026'
  );

  // Subject Comments State
  const [customSubjectComments, setCustomSubjectComments] = useState<Record<string, string>>(
    savedRemarks?.subject_comments || {}
  );

  const [isEditing, setIsEditing] = useState(false);
  const [isApproved, setIsApproved] = useState(savedRemarks?.is_approved ?? true);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const handleDownloadPdf = async () => {
    setIsDownloadingPdf(true);
    try {
      await downloadSingleReportCardPDF({
        student,
        school,
        exam: selectedExam,
        classes,
        subjects,
        marks,
        grades,
        teachers,
        allStudents,
        savedRemarks: {
          student_id: student.id,
          exam_id: selectedExamId,
          class_teacher_comment: classTeacherComment,
          class_teacher_name: classTeacherName,
          hoi_comment: hoiComment,
          hoi_name: hoiName,
          next_term_opening_date: nextTermOpeningDate,
          subject_comments: customSubjectComments,
          is_approved: isApproved,
        },
      });
    } catch (err) {
      console.error('Failed to generate PDF:', err);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  // Sync state if props change
  useEffect(() => {
    if (savedRemarks) {
      if (savedRemarks.class_teacher_comment) setClassTeacherComment(savedRemarks.class_teacher_comment);
      if (savedRemarks.class_teacher_name) setClassTeacherName(savedRemarks.class_teacher_name);
      if (savedRemarks.hoi_comment) setHoiComment(savedRemarks.hoi_comment);
      if (savedRemarks.hoi_name) setHoiName(savedRemarks.hoi_name);
      if (savedRemarks.next_term_opening_date) setNextTermOpeningDate(savedRemarks.next_term_opening_date);
      if (savedRemarks.subject_comments) setCustomSubjectComments(savedRemarks.subject_comments);
      if (savedRemarks.is_approved !== undefined) setIsApproved(savedRemarks.is_approved);
    } else {
      setClassTeacherComment(getDefaultClassTeacherComment());
      setHoiComment(getDefaultHOIComment());
    }
  }, [student.id, selectedExamId, savedRemarks, averageScore]);

  // Handle Save
  const handleSave = () => {
    if (onSaveRemarks) {
      onSaveRemarks(student.id, selectedExamId, {
        class_teacher_comment: classTeacherComment,
        class_teacher_name: classTeacherName,
        hoi_comment: hoiComment,
        hoi_name: hoiName,
        next_term_opening_date: nextTermOpeningDate,
        subject_comments: customSubjectComments,
        is_approved: isApproved,
      });
    }
    setIsEditing(false);
  };

  // Helper for default subject comment
  const getSubjectDefaultComment = (score: number) => {
    if (score >= 90) return "Outstanding Performance";
    if (score >= 75) return "Excellent Performance";
    if (score >= 58) return "Good Performance";
    if (score >= 41) return "Satisfactory Performance";
    if (score >= 31) return "Developing Competency";
    if (score >= 21) return "Needs More Practice";
    if (score >= 11) return "Requires Intervention";
    return "Immediate Support Required";
  };

  const currentDateStr = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-slate-800 dark:border-slate-700 shadow-xl p-6 sm:p-8 max-w-4xl mx-auto font-sans text-slate-900 dark:text-slate-100 print:shadow-none print:border-none print:p-0 print:m-0 print:max-w-none print:w-full space-y-6 page-break-after-always">
      {/* Screen Mode Edit & Control Bar */}
      {!isBatchMode && (
        <div className="print:hidden bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2">
            <span
              className={`px-2.5 py-1 rounded-full font-bold uppercase tracking-wider text-[10px] ${
                isApproved ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300' : 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300'
              }`}
            >
              {isApproved ? 'Official Report Approved' : 'Draft Report'}
            </span>
            <span className="text-slate-500 dark:text-slate-400 font-semibold">
              Learner: <strong className="text-slate-900 dark:text-slate-100">{student.full_name}</strong>
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsEditing(!isEditing)}
              disabled={!canModify}
              className="bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 text-white px-3 py-1.5 rounded-lg font-bold flex items-center space-x-1 transition"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{isEditing ? 'Preview Mode' : 'Edit Remarks'}</span>
            </button>

            {isEditing && (
              <button
                onClick={handleSave}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-bold flex items-center space-x-1 transition shadow-xs"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Remarks</span>
              </button>
            )}

            <button
              onClick={() => setIsApproved(!isApproved)}
              className={`px-3 py-1.5 rounded-lg font-bold transition ${
                isApproved
                  ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-900'
                  : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-200 hover:bg-emerald-200 dark:hover:bg-emerald-900'
              }`}
            >
              {isApproved ? 'Mark as Draft' : 'Approve Report'}
            </button>

            <button
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              className="bg-[#176B45] hover:bg-[#0F5132] disabled:opacity-50 text-white px-3 py-1.5 rounded-lg font-bold flex items-center space-x-1.5 transition shadow-xs"
            >
              {isDownloadingPdf ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              <span>{isDownloadingPdf ? 'Generating PDF...' : 'Download PDF'}</span>
            </button>
          </div>
        </div>
      )}

      {/* SECTION 1: REPORT HEADER */}
      <div className="border-b-2 border-slate-900 dark:border-slate-700 pb-4 flex flex-col items-center justify-center text-center space-y-2">
        {/* Logo & School Name */}
        <div className="flex items-center justify-center space-x-3">
          {school.logo_url && (
            <img
              src={school.logo_url}
              alt="School Logo"
              className="w-14 h-14 object-contain"
              referrerPolicy="no-referrer"
            />
          )}
          <div>
            <h1 className="text-xl sm:text-2xl font-black uppercase text-slate-900 dark:text-slate-100 tracking-tight leading-none">
              {school.school_name || 'School Name Not Configured'}
            </h1>
            {school.motto && (
              <p className="text-[10px] italic font-semibold text-amber-700 dark:text-amber-400 mt-1">"{school.motto}"</p>
            )}
            {school.phone && (
              <p className="text-[10px] font-medium text-slate-600 dark:text-slate-400 mt-0.5">
                Tel: {school.phone}
              </p>
            )}
          </div>
        </div>

        <div>
          <span className="bg-slate-900 dark:bg-slate-800 text-white text-xs font-black uppercase tracking-widest px-4 py-1 rounded-md inline-block shadow-xs">
            LEARNER ASSESSMENT REPORT
          </span>
        </div>

        {/* Assessment & Date Details Bar */}
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200 pt-1">
          <span className="bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded border border-slate-300 dark:border-slate-700">
            Assessment: {selectedExam?.exam_name || 'End-Term Assessment'}
          </span>
          <span className="bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded border border-slate-300 dark:border-slate-700">
            Term: {selectedExam?.term || 'Term 2'} &bull; Academic Year: {selectedExam?.year || 2026}
          </span>
          <span className="bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded border border-slate-300 dark:border-slate-700">
            Class/Stream: {classNameStr}
          </span>
          <span className="bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400">
            Date Generated: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        </div>
      </div>

      {/* SECTION 2: LEARNER PROFILE SECTION */}
      <div className="bg-slate-50 dark:bg-slate-800/80 border-2 border-slate-800 dark:border-slate-700 rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div>
          <span className="text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] block">Learner Name</span>
          <span className="font-black text-sm text-slate-900 dark:text-slate-100">{student.full_name}</span>
        </div>

        <div>
          <span className="text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] block">Admission Number</span>
          <span className="font-mono font-black text-sm text-[#0F5132] dark:text-emerald-400">{student.admission_number}</span>
        </div>

        <div>
          <span className="text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] block">Grade & Stream</span>
          <span className="font-bold text-slate-900 dark:text-slate-100">{classNameStr}</span>
        </div>

        <div>
          <span className="text-slate-500 dark:text-slate-400 font-bold uppercase text-[10px] block">Gender</span>
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            {student.gender === 'M' ? 'Male' : 'Female'}
          </span>
        </div>
      </div>

      {/* SECTION 3: OVERALL PERFORMANCE SUMMARY CARD */}
      <div className="bg-slate-900 text-white rounded-xl p-4 border-2 border-slate-900 shadow-md">
        {!isAssessmentComplete && (
          <div className="bg-amber-500/20 border border-amber-500/40 text-amber-200 text-xs px-3 py-1.5 rounded-lg mb-3 flex items-center justify-between font-medium">
            <span>⚠️ <strong>Incomplete Assessment:</strong> Learner has pending subject marks. Final overall level & rank will be assigned upon complete evaluation.</span>
            <span className="bg-amber-500 text-slate-950 text-[10px] font-black uppercase px-2 py-0.5 rounded">Provisional</span>
          </div>
        )}
        <div className="text-[11px] font-bold text-amber-400 uppercase tracking-widest border-b border-slate-800 pb-1.5 mb-3 text-center sm:text-left flex items-center justify-between">
          <span>Overall Competency Performance Summary</span>
          {!isAssessmentComplete && <span className="text-amber-400 text-[10px] font-bold">Status: Provisional</span>}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-center text-xs">
          <div className="bg-slate-800/80 p-2 rounded-lg border border-slate-700">
            <div className="text-[10px] text-slate-400 font-medium">TOTAL SCORE</div>
            <div className="text-sm font-black text-white mt-0.5">
              {totalMarks} <span className="text-[10px] text-slate-400 font-normal">/ {maxPossibleMarks}</span>
            </div>
          </div>

          <div className="bg-slate-800/80 p-2 rounded-lg border border-slate-700">
            <div className="text-[10px] text-slate-400 font-medium">AVERAGE MARK</div>
            <div className="text-sm font-black text-amber-400 mt-0.5">
              {averageScore}% {!isAssessmentComplete && <span className="text-[9px] text-amber-300 font-normal block">(Provisional)</span>}
            </div>
          </div>

          <div className="bg-slate-800/80 p-2 rounded-lg border border-slate-700">
            <div className="text-[10px] text-slate-400 font-medium">CBE LEVEL</div>
            <div className="text-sm font-black text-emerald-400 mt-0.5">
              {overallLevel} <span className="text-[10px] font-bold text-slate-300">({overallGradeCode})</span>
            </div>
          </div>

          <div className="bg-slate-800/80 p-2 rounded-lg border border-slate-700">
            <div className="text-[10px] text-slate-400 font-medium">TOTAL POINTS</div>
            <div className="text-sm font-black text-purple-300 mt-0.5">
              {isAssessmentComplete ? totalPoints : '-'} {isAssessmentComplete && <span className="text-[10px] text-slate-400 font-normal">/ {maxPossiblePoints}</span>}
            </div>
          </div>

          <div className="bg-slate-800/80 p-2 rounded-lg border border-slate-700">
            <div className="text-[10px] text-slate-400 font-medium">STREAM RANK</div>
            <div className="text-xs sm:text-sm font-black text-rose-300 mt-0.5">
              {streamRank} {isAssessmentComplete && <span className="text-[10px] text-slate-400 font-normal block">of {streamStudentsCount}</span>}
            </div>
          </div>

          <div className="bg-slate-800/80 p-2 rounded-lg border border-slate-700">
            <div className="text-[10px] text-slate-400 font-medium">OVERALL RANK</div>
            <div className="text-xs sm:text-sm font-black text-cyan-300 mt-0.5">
              {overallRank} {isAssessmentComplete && <span className="text-[10px] text-slate-400 font-normal block">of {totalAssessedStudents}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 4 & 5: LEARNING AREA PERFORMANCE TABLE (CBE GRADING) */}
      <div className="space-y-2">
        <h3 className="text-xs font-black uppercase text-slate-900 dark:text-slate-100 tracking-wider flex items-center justify-between border-b border-slate-300 dark:border-slate-700 pb-1">
          <span>Learning Area (Subject) Performance Breakdown</span>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold uppercase">
            8-Point KNEC CBE Assessment Scale
          </span>
        </h3>

        <div className="overflow-x-auto border-2 border-slate-900 dark:border-slate-700 rounded-xl">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-200 dark:bg-slate-800 border-b-2 border-slate-900 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-extrabold uppercase tracking-tight text-[11px]">
                <th className="p-2 border-r border-slate-300 dark:border-slate-700 w-12 text-center">Code</th>
                <th className="p-2 border-r border-slate-300 dark:border-slate-700">Learning Area / Subject</th>
                <th className="p-2 text-center border-r border-slate-300 dark:border-slate-700 w-20">Score</th>
                <th className="p-2 text-center border-r border-slate-300 dark:border-slate-700 w-16">%</th>
                <th className="p-2 text-center border-r border-slate-300 dark:border-slate-700 w-20">CBE Level</th>
                <th className="p-2 text-center border-r border-slate-300 dark:border-slate-700 w-16">Code</th>
                <th className="p-2 text-center border-r border-slate-300 dark:border-slate-700 w-16">Points</th>
                <th className="p-2 text-center border-r border-slate-300 dark:border-slate-700 w-16">Rank</th>
                <th className="p-2 border-r border-slate-300 dark:border-slate-700">Subject Teacher Comment</th>
                <th className="p-2 w-28">Teacher</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-300 dark:divide-slate-700 font-medium">
              {learnerSubjects.map((sb) => {
                const stdMark = marks.find(
                  (m) =>
                    m.student_id === student.id &&
                    m.subject_id === sb.id &&
                    m.exam_id === selectedExamId
                );
                
                const markInfo = evaluateMark(stdMark);

                let scoreStr = '-';
                let pctStr = '-';
                let levelStr = '-';
                let gradeCodeStr = '-';
                let pointsStr = '-';
                let autoComment = 'Not Assessed';

                if (markInfo.status === 'Normal' && markInfo.percentage !== null) {
                  const gr = getGradeForMark(markInfo.percentage, grades);
                  scoreStr = markInfo.displayScore;
                  pctStr = `${Math.round(markInfo.percentage)}%`;
                  levelStr = gr.performance_level;
                  gradeCodeStr = gr.grade_code || gr.grade || '-';
                  pointsStr = `${gr.points} Pts`;
                  autoComment = getSubjectDefaultComment(markInfo.percentage);
                } else if (markInfo.status === 'Y') {
                  scoreStr = 'Y';
                  pctStr = 'Y';
                  levelStr = 'Y';
                  gradeCodeStr = 'Y';
                  pointsStr = 'Y';
                  autoComment = `Irregularity (${markInfo.irregularityReason || 'Absent'})`;
                } else {
                  // Missing Assessment ('X' or unentered/blank for an applicable learning area)
                  scoreStr = 'X';
                  pctStr = 'X';
                  levelStr = 'X';
                  gradeCodeStr = 'X';
                  pointsStr = 'X';
                  autoComment = 'Missing Assessment (X)';
                }

                // Grade-wide Subject Rank
                const subjectRankStr = calculateSubjectRank(
                  student,
                  sb.id,
                  selectedExamId,
                  allStudents,
                  classes,
                  marks
                );

                // Assigned Subject Teacher
                const subjTeacher = teachers.find(
                  (t) =>
                    (t.allocations || []).some(a => a.subject_id === sb.id) &&
                    ((t.allocations || []).some(a => a.class_id === student.class_id) || (t.allocations || []).length === 0)
                );
                const teacherNameStr = subjTeacher ? subjTeacher.teacher_name : 'Tr. Assigned';
                const currentComment = customSubjectComments[sb.id] || autoComment;

                return (
                  <tr key={sb.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/60 transition ${markInfo.status === 'X' ? 'bg-rose-50/40 dark:bg-rose-950/30' : markInfo.status === 'Y' ? 'bg-purple-50/40 dark:bg-purple-950/30' : ''}`}>
                    <td className="p-2 text-center border-r border-slate-300 dark:border-slate-700 font-mono font-bold text-slate-700 dark:text-slate-300 text-[11px]">
                      {sb.subject_code}
                    </td>

                    <td className="p-2 border-r border-slate-300 dark:border-slate-700 font-bold text-slate-900 dark:text-slate-100 text-[11px]">
                      {sb.subject_name}
                    </td>

                    <td className="p-2 text-center border-r border-slate-300 dark:border-slate-700 font-mono font-extrabold text-blue-900 dark:text-blue-400">
                      {scoreStr}
                    </td>

                    <td className="p-2 text-center border-r border-slate-300 dark:border-slate-700 font-black text-slate-900 dark:text-slate-100">
                      {pctStr}
                    </td>

                    <td className="p-2 text-center border-r border-slate-300 dark:border-slate-700">
                      {levelStr !== '-' ? (
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-extrabold inline-block ${
                            levelStr === 'EE'
                              ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                              : levelStr === 'ME'
                              ? 'bg-sky-100 dark:bg-sky-950/80 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-800'
                              : levelStr === 'AE'
                              ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                              : levelStr === 'BE'
                              ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                              : levelStr === 'X'
                              ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-900 dark:text-rose-200 border border-rose-300 dark:border-rose-800 font-black'
                              : 'bg-purple-100 dark:bg-purple-950/80 text-purple-900 dark:text-purple-200 border border-purple-300 dark:border-purple-800 font-black'
                          }`}
                        >
                          {levelStr}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>

                    <td className="p-2 text-center border-r border-slate-300 dark:border-slate-700 font-black text-purple-700 dark:text-purple-400 text-[11px]">
                      {gradeCodeStr}
                    </td>

                    <td className="p-2 text-center border-r border-slate-300 dark:border-slate-700 font-bold font-mono text-slate-800 dark:text-slate-200">
                      {pointsStr}
                    </td>

                    <td className="p-2 text-center border-r border-slate-300 dark:border-slate-700 font-bold text-slate-800 dark:text-slate-200 text-[11px]">
                      {subjectRankStr}
                    </td>

                    <td className="p-2 border-r border-slate-300 dark:border-slate-700 text-[10px] text-slate-700 dark:text-slate-300 italic">
                      {(() => {
                        const canEditSubjectComment = isAdmin || canUserEditSubjectMarks(currentUser || null, activeTeacher, sb.id);
                        if (isEditing) {
                          return (
                            <input
                              type="text"
                              value={currentComment}
                              disabled={!canEditSubjectComment}
                              onChange={(e) =>
                                setCustomSubjectComments({
                                  ...customSubjectComments,
                                  [sb.id]: e.target.value,
                                })
                              }
                              placeholder={canEditSubjectComment ? "Enter comment..." : "Read-only (Unassigned subject)"}
                              className={`w-full border rounded p-1 font-sans not-italic text-[10px] ${
                                !canEditSubjectComment ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border-slate-200 dark:border-slate-700' : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100'
                              }`}
                            />
                          );
                        }
                        return stripSurroundingQuotes(currentComment);
                      })()}
                    </td>

                    <td className="p-2 text-[10px] font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {teacherNameStr}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ASSESSMENT STATUS KEY / LEGEND BOX */}
        <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded-xl p-3 text-[11px] space-y-1">
          <div className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[10px]">
            Assessment Status Key / Legend:
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-slate-600 dark:text-slate-300 text-[10px]">
            <div><strong className="text-rose-700 dark:text-rose-400">X</strong> = Missing Mark (Report marked Provisional)</div>
            <div><strong className="text-purple-700 dark:text-purple-400">Y</strong> = Examination Irregularity (Absent, Malpractice, Medical)</div>
            <div><strong className="text-slate-700 dark:text-slate-300">Blank / "-"</strong> = Subject Not Offered / Not Examined</div>
          </div>
        </div>
      </div>

      {/* PRE-PRIMARY EARLY CHILDHOOD DEVELOPMENT INDICATORS */}
      {studentLevel === 'Pre-Primary' && (
        <div className="bg-slate-50 dark:bg-slate-800/80 border-2 border-slate-800 dark:border-slate-700 rounded-xl p-3.5 space-y-2 text-xs">
          <div className="font-extrabold text-xs uppercase text-slate-900 dark:text-slate-100 border-b border-slate-300 dark:border-slate-700 pb-1 flex items-center justify-between">
            <span>Early Childhood Development & Psychomotor Indicators</span>
            <span className="text-[10px] text-blue-800 dark:text-blue-400 font-bold uppercase">Competency Growth Summary</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-xs">
              <span className="font-bold text-blue-900 dark:text-blue-300 block text-[11px]">Motor & Physical Development</span>
              <p className="text-slate-600 dark:text-slate-400 text-[10px] mt-0.5">Demonstrates excellent fine & gross motor skills, active physical participation and spatial coordination.</p>
            </div>
            <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-xs">
              <span className="font-bold text-blue-900 dark:text-blue-300 block text-[11px]">Social-Emotional Growth</span>
              <p className="text-slate-600 dark:text-slate-400 text-[10px] mt-0.5">Interacts harmoniously with peers, shares learning tools willingly, and exhibits emotional stability.</p>
            </div>
            <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-xs">
              <span className="font-bold text-blue-900 dark:text-blue-300 block text-[11px]">Language & Listening Skills</span>
              <p className="text-slate-600 dark:text-slate-400 text-[10px] mt-0.5">Expresses thoughts clearly, listens attentively during story time and follows simple instructions.</p>
            </div>
            <div className="bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-xs">
              <span className="font-bold text-blue-900 dark:text-blue-300 block text-[11px]">Creative & Psychomotor Expression</span>
              <p className="text-slate-600 dark:text-slate-400 text-[10px] mt-0.5">Enthusiastic engagement in music, drawing, color identification, and imaginative play activities.</p>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 6 & 7: CLASS TEACHER REMARKS */}
      <div className="space-y-3 pt-2">
        <div className="border border-slate-300 dark:border-slate-700 rounded-xl p-3 bg-slate-50/80 dark:bg-slate-800/80">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-1.5 mb-2">
            <span className="font-extrabold text-xs uppercase text-slate-900 dark:text-slate-100 flex items-center space-x-1.5">
              <CheckCircle className="w-4 h-4 text-blue-700 dark:text-blue-400" />
              <span>Class Teacher's Assessment & Comments</span>
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
              Teacher Name: <strong className="text-slate-900 dark:text-slate-100">{classTeacherName}</strong>
            </span>
          </div>

          {isEditing ? (
            <textarea
              value={classTeacherComment}
              disabled={!isAdmin && !isClassTeacher}
              onChange={(e) => setClassTeacherComment(e.target.value)}
              rows={2}
              placeholder={isAdmin || isClassTeacher ? "Enter Class Teacher remarks..." : "Read-only: Only assigned Class Teacher or Administrator can edit."}
              className={`w-full border rounded-lg p-2 text-xs text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 font-medium ${
                !isAdmin && !isClassTeacher ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border-slate-200 dark:border-slate-700' : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700'
              }`}
            />
          ) : (
            <div className="text-xs italic text-slate-800 dark:text-slate-200 font-medium leading-relaxed bg-white dark:bg-slate-900 p-2.5 rounded border border-slate-200 dark:border-slate-700">
              {stripSurroundingQuotes(classTeacherComment)}
            </div>
          )}

          <div className="mt-3 flex items-center justify-between text-[10px] font-bold text-slate-600 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-700">
            <div>
              <span>Class Teacher Name: </span>
              {isEditing ? (
                <input
                  type="text"
                  value={classTeacherName}
                  onChange={(e) => setClassTeacherName(e.target.value)}
                  className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded p-1 ml-1 font-bold"
                />
              ) : (
                <span className="text-slate-900 dark:text-slate-100 underline font-black">{classTeacherName}</span>
              )}
            </div>
          </div>
        </div>

        {/* SECTION 8: HEAD OF INSTITUTION REMARKS */}
        <div className="border border-slate-300 dark:border-slate-700 rounded-xl p-3 bg-amber-50/50 dark:bg-amber-950/30">
          <div className="flex items-center justify-between border-b border-amber-200 dark:border-amber-800 pb-1.5 mb-2">
            <span className="font-extrabold text-xs uppercase text-slate-900 dark:text-slate-100 flex items-center space-x-1.5">
              <Award className="w-4 h-4 text-amber-700 dark:text-amber-400" />
              <span>Head of Institution (Principal/Headteacher) Remarks</span>
            </span>
            <span className="text-[10px] text-slate-600 dark:text-slate-400 font-semibold">
              HOI: <strong className="text-slate-900 dark:text-slate-100">{hoiName}</strong>
            </span>
          </div>

          {isEditing ? (
            <textarea
              value={hoiComment}
              disabled={!isAdmin}
              onChange={(e) => setHoiComment(e.target.value)}
              rows={2}
              placeholder={isAdmin ? "Enter Head of Institution remarks..." : "Read-only: Only Administrator / Head of Institution can edit."}
              className={`w-full border rounded-lg p-2 text-xs text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 font-medium ${
                !isAdmin ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border-amber-200 dark:border-amber-800' : 'bg-white dark:bg-slate-900 border-amber-300 dark:border-amber-700'
              }`}
            />
          ) : (
            <div className="text-xs italic text-slate-900 dark:text-slate-100 font-bold leading-relaxed bg-white dark:bg-slate-900 p-2.5 rounded border border-amber-200 dark:border-amber-800">
              {stripSurroundingQuotes(hoiComment)}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center justify-between text-[10px] font-bold text-slate-700 dark:text-slate-300 pt-2 border-t border-amber-200 dark:border-amber-800 gap-2">
            <div>
              <span>HOI Name: </span>
              {isEditing ? (
                <input
                  type="text"
                  value={hoiName}
                  onChange={(e) => setHoiName(e.target.value)}
                  className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded p-1 ml-1 font-bold"
                />
              ) : (
                <span className="text-slate-900 dark:text-slate-100 font-black">{hoiName}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 9: GRADING KEY LEGEND */}
      <div className="space-y-1 pt-1">
        <div className="text-[10px] font-extrabold uppercase text-slate-700 dark:text-slate-300 tracking-wider">
          CBE Assessment Grading Scale Key (8-Point KNEC Scale)
        </div>
        <div className="overflow-x-auto border border-slate-400 dark:border-slate-700 rounded-lg">
          <table className="w-full text-center text-[9px] font-bold border-collapse">
            <thead>
              <tr className="bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-b border-slate-400 dark:border-slate-700 uppercase">
                <th className="p-1 border-r border-slate-300 dark:border-slate-700">Code</th>
                <th className="p-1 border-r border-slate-300 dark:border-slate-700">Performance Level</th>
                <th className="p-1 border-r border-slate-300 dark:border-slate-700">Score Range</th>
                <th className="p-1 border-r border-slate-300 dark:border-slate-700">Points</th>
                <th className="p-1">Official Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-slate-800 dark:text-slate-200">
              <tr className="bg-emerald-50/60 dark:bg-emerald-950/40">
                <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-black text-emerald-900 dark:text-emerald-300">EE1</td>
                <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-black text-emerald-800 dark:text-emerald-300">Exceeding Expectations</td>
                <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-mono">90–100</td>
                <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-mono">8</td>
                <td className="p-1 text-left px-2 font-semibold text-emerald-900 dark:text-emerald-200">Outstanding Performance</td>
              </tr>
              <tr className="bg-emerald-50/30 dark:bg-emerald-950/20">
                <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-black text-emerald-800 dark:text-emerald-400">EE2</td>
                <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-bold text-emerald-700 dark:text-emerald-400">Exceeding Expectations</td>
                <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-mono">75–89</td>
                <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-mono">7</td>
                <td className="p-1 text-left px-2 font-semibold text-emerald-800 dark:text-emerald-300">Excellent Performance</td>
              </tr>
              <tr className="bg-blue-50/60 dark:bg-blue-950/40">
                <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-black text-blue-900 dark:text-blue-300">ME1</td>
                <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-black text-blue-800 dark:text-blue-300">Meeting Expectations</td>
                <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-mono">58–74</td>
                <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-mono">6</td>
                <td className="p-1 text-left px-2 font-semibold text-blue-900 dark:text-blue-200">Good Performance</td>
              </tr>
              <tr className="bg-blue-50/30 dark:bg-blue-950/20">
                <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-black text-blue-800 dark:text-blue-400">ME2</td>
                <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-bold text-blue-700 dark:text-blue-400">Meeting Expectations</td>
                <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-mono">41–57</td>
                <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-mono">5</td>
                <td className="p-1 text-left px-2 font-semibold text-blue-800 dark:text-blue-300">Satisfactory Performance</td>
              </tr>
              <tr className="bg-amber-50/60 dark:bg-amber-950/40">
                <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-black text-amber-900 dark:text-amber-300">AE1</td>
                <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-black text-amber-800 dark:text-amber-300">Approaching Expectations</td>
                <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-mono">31–40</td>
                <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-mono">4</td>
                <td className="p-1 text-left px-2 font-semibold text-amber-900 dark:text-amber-200">Developing Competency</td>
              </tr>
              <tr className="bg-amber-50/30 dark:bg-amber-950/20">
                <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-black text-amber-800 dark:text-amber-400">AE2</td>
                <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-bold text-amber-700 dark:text-amber-400">Approaching Expectations</td>
                <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-mono">21–30</td>
                <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-mono">3</td>
                <td className="p-1 text-left px-2 font-semibold text-amber-800 dark:text-amber-300">Needs More Practice</td>
              </tr>
              <tr className="bg-rose-50/60 dark:bg-rose-950/40">
                <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-black text-rose-900 dark:text-rose-300">BE1</td>
                <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-black text-rose-800 dark:text-rose-300">Below Expectations</td>
                <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-mono">11–20</td>
                <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-mono">2</td>
                <td className="p-1 text-left px-2 font-semibold text-rose-900 dark:text-rose-200">Requires Intervention</td>
              </tr>
              <tr className="bg-rose-50/30 dark:bg-rose-950/20">
                <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-black text-rose-800 dark:text-rose-400">BE2</td>
                <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-bold text-rose-700 dark:text-rose-400">Below Expectations</td>
                <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-mono">0–10</td>
                <td className="p-1 border-r border-slate-300 dark:border-slate-700 font-mono">1</td>
                <td className="p-1 text-left px-2 font-semibold text-rose-800 dark:text-rose-300">Immediate Support Required</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 10: SIGNATURE SECTION */}
      <div className="grid grid-cols-3 gap-4 pt-3 text-[10px] font-bold text-slate-800 dark:text-slate-200 border-t-2 border-slate-900 dark:border-slate-700">
        <div className="border border-slate-300 dark:border-slate-700 rounded p-2 text-center space-y-3 bg-slate-50 dark:bg-slate-800/80">
          <div className="uppercase text-slate-500 dark:text-slate-400 font-extrabold text-[9px]">Class Teacher Signature</div>
          <div className="h-6 border-b border-dashed border-slate-400 dark:border-slate-600"></div>
          <div className="flex justify-between text-[9px] text-slate-600 dark:text-slate-400">
            <span>Sign: ____________</span>
            <span>Date: _________</span>
          </div>
        </div>

        <div className="border border-slate-300 dark:border-slate-700 rounded p-2 text-center space-y-3 bg-slate-50 dark:bg-slate-800/80">
          <div className="uppercase text-slate-500 dark:text-slate-400 font-extrabold text-[9px]">Head of Institution & Stamp</div>
          <div className="h-6 border-b border-dashed border-slate-400 dark:border-slate-600"></div>
          <div className="flex justify-between text-[9px] text-slate-600 dark:text-slate-400">
            <span>Sign: ____________</span>
            <span>Date: _________</span>
          </div>
        </div>

        <div className="border border-slate-300 dark:border-slate-700 rounded p-2 text-center space-y-3 bg-slate-50 dark:bg-slate-800/80">
          <div className="uppercase text-slate-500 dark:text-slate-400 font-extrabold text-[9px]">Parent / Guardian Signature</div>
          <div className="h-6 border-b border-dashed border-slate-400 dark:border-slate-600"></div>
          <div className="flex justify-between text-[9px] text-slate-600 dark:text-slate-400">
            <span>Sign: ____________</span>
            <span>Date: _________</span>
          </div>
        </div>
      </div>

      {/* SECTION 11: REPORT FOOTER */}
      <div className="pt-2 border-t border-slate-300 dark:border-slate-700 text-[10px] font-semibold text-slate-600 dark:text-slate-400 flex flex-wrap items-center justify-between gap-2">
        <div>
          <span>Next Term Opening Date: </span>
          {isEditing ? (
            <input
              type="text"
              value={nextTermOpeningDate}
              onChange={(e) => setNextTermOpeningDate(e.target.value)}
              className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded p-1 font-bold"
            />
          ) : (
            <strong className="text-slate-900 dark:text-slate-100 font-extrabold underline">{nextTermOpeningDate}</strong>
          )}
        </div>

        <div className="font-mono text-[9px] text-slate-500 dark:text-slate-400">
          Generated on {currentDateStr}
        </div>

        <div className="font-black text-[9px] text-slate-800 dark:text-slate-200 uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700">
          Generated by: <span className="text-blue-800 dark:text-blue-400">CBE GENERATOR SYSTEM</span>
        </div>
      </div>
    </div>
  );
};
