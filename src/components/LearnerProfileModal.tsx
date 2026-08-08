import React from 'react';
import { X, User as UserIcon, BookOpen, Award, Phone, Calendar, TrendingUp } from 'lucide-react';
import { Student, Mark, Examination, Subject, Grade, ClassStream, Teacher, User } from '../types';
import { getGradeForMark } from '../services/analysisEngine';
import { evaluateMark } from '../utils/markUtils';
import { stripSurroundingQuotes } from '../utils/filterUtils';

interface LearnerProfileModalProps {
  student: Student | null;
  classes: ClassStream[];
  subjects: Subject[];
  exams: Examination[];
  marks: Mark[];
  grades: Grade[];
  teachers: Teacher[];
  currentUser: User | null;
  onClose: () => void;
}

export const LearnerProfileModal: React.FC<LearnerProfileModalProps> = ({
  student,
  classes = [],
  subjects = [],
  exams = [],
  marks = [],
  grades = [],
  teachers = [],
  currentUser,
  onClose,
}) => {
  if (!student) return null;
  
  // Security check for unauthorized URL access or direct modal opening
  const isAuthorized = () => {
    if (currentUser?.role === 'admin') return true;
    const activeTeacher = teachers.find(
      t => (t.id && t.id === currentUser?.teacher_id) ||
        (t.email && currentUser?.email && t.email.toLowerCase() === currentUser.email.toLowerCase())
    );
    if (!activeTeacher) return false;
    
    if (currentUser?.role === 'class_teacher') {
      const primarySet = new Set<string>();
      if (activeTeacher.is_class_teacher && activeTeacher.class_teacher_of_id) primarySet.add(activeTeacher.class_teacher_of_id);
      classes.forEach((c) => {
        if (c.class_teacher_id === activeTeacher.id) primarySet.add(c.id);
      });
      return primarySet.has(student.class_id) || (student.stream_id && primarySet.has(student.stream_id));
    }
    
    // Subject Teachers are not permitted to view full learner profiles (PII), only marks data.
    return false;
  };

  if (!isAuthorized()) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 p-6 text-center space-y-4">
           <div className="mx-auto w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mb-4">
             <X className="w-8 h-8" />
           </div>
           <h2 className="text-xl font-bold text-slate-900">Access Denied</h2>
           <p className="text-sm text-slate-500">You are not authorized to view the profile of this learner because they are not in your assigned class or stream.</p>
           <button onClick={onClose} className="mt-4 px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition">
             Close
           </button>
        </div>
      </div>
    );
  }

  const classObj = (classes || []).find((c) => c.id === student.class_id);
  const classNameStr = classObj ? `${classObj.class_name} ${classObj.stream}` : student.class_id;

  const studentMarks = (marks || []).filter((m) => m.student_id === student.id);

  // Group marks by examination
  const examBreakdown = exams.map((exam) => {
    const eMarks = studentMarks.filter((m) => m.exam_id === exam.id);
    const subjectDetails = eMarks.map((m) => {
      const subObj = subjects.find((s) => s.id === m.subject_id);
      const ev = evaluateMark(m);
      const isAssessed = ev.status === 'Normal' && ev.percentage !== null;
      const gradeObj = isAssessed ? getGradeForMark(ev.percentage!, grades) : null;

      let remarks = 'Not Assessed';
      if (isAssessed && gradeObj) {
        remarks = stripSurroundingQuotes(gradeObj.remarks);
      } else if (ev.status === 'X') {
        remarks = 'Missing Assessment (X)';
      } else if (ev.status === 'Y') {
        remarks = ev.irregularityReason ? `Irregularity (${ev.irregularityReason})` : 'Examination Irregularity (Y)';
      }

      return {
        subject_name: subObj?.subject_name || 'Subject',
        subject_code: subObj?.subject_code || 'SUB',
        marks: m.marks,
        ev,
        isAssessed,
        percentage: ev.percentage,
        gradeObj,
        remarks,
      };
    });

    const assessedDetails = subjectDetails.filter((sd) => sd.isAssessed && sd.percentage !== null && sd.gradeObj !== null);
    const totalMarks = assessedDetails.reduce((sum, item) => sum + item.percentage!, 0);
    const count = assessedDetails.length;
    const avg = count > 0 ? Math.round((totalMarks / count) * 10) / 10 : 0;
    const totalPoints = assessedDetails.reduce((sum, item) => sum + item.gradeObj!.points, 0);
    const avgPoints = count > 0 ? Math.round((totalPoints / count) * 100) / 100 : 0;
    const overallGrade = count > 0 ? getGradeForMark(avg, grades) : null;

    return {
      exam,
      totalRecorded: subjectDetails.length,
      count,
      totalMarks,
      avg,
      totalPoints,
      avgPoints,
      overallGrade,
      subjectDetails,
    };
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-300 hover:text-white p-2 rounded-full hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-2xl font-black font-mono shadow-inner">
              {student.full_name.charAt(0)}
            </div>
            <div>
              <span className="text-xs font-bold tracking-widest text-blue-300 uppercase">Learner Performance Profile</span>
              <h2 className="text-2xl font-black tracking-tight">{student.full_name}</h2>
              <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-blue-100 font-medium">
                <span className="bg-white/10 px-2.5 py-0.5 rounded-full font-mono font-bold">Adm: {student.admission_number}</span>
                <span>•</span>
                <span>Class: {classNameStr}</span>
                <span>•</span>
                <span>Gender: {student.gender === 'M' ? 'Male' : 'Female'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">

          {/* Performance Overview Across Examinations */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-indigo-600" /> CBE Assessment Performance & Progress Trends
            </h3>

            {examBreakdown.length === 0 || examBreakdown.every((e) => e.totalRecorded === 0) ? (
              <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs">
                No examination scores recorded for this learner yet.
              </div>
            ) : (
              <div className="space-y-6">
                {examBreakdown
                  .filter((eb) => eb.totalRecorded > 0)
                  .map(({ exam, count, avg, avgPoints, overallGrade, subjectDetails }) => {
                    const level = overallGrade?.performance_level || 'N/A';
                    const code = overallGrade?.grade_code || overallGrade?.grade || 'N/A';

                    return (
                      <div
                        key={exam.id}
                        className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white"
                      >
                        {/* Exam Header */}
                        <div className="bg-slate-100 p-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">{exam.term} {exam.year}</span>
                            <h4 className="font-bold text-slate-900 text-sm">{exam.exam_name}</h4>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-right">
                              <div className="text-xs font-bold text-slate-900">{count > 0 ? `${avg}% Mean` : 'N/A Mean'}</div>
                              <div className="text-[10px] text-slate-500 font-mono">{count > 0 ? `${avgPoints} Mean Pts` : '0 Mean Pts'}</div>
                            </div>
                            {overallGrade ? (
                              <span
                                className={`px-3 py-1 rounded-lg text-xs font-black border ${
                                  level === 'EE'
                                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                    : level === 'ME'
                                    ? 'bg-[#E8F3EE] text-[#0F5132] border-[#2E7D5B]/30'
                                    : level === 'AE'
                                    ? 'bg-amber-100 text-amber-900 border-amber-300'
                                    : 'bg-rose-100 text-rose-900 border-rose-300'
                                }`}
                              >
                                {level} ({code}) • {overallGrade.points} Pts
                              </span>
                            ) : (
                              <span className="px-3 py-1 rounded-lg text-xs font-black border bg-slate-100 text-slate-600 border-slate-300">
                                Not Assessed
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Subject Breakdown Table */}
                        <div className="p-3">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="text-slate-500 border-b border-slate-200 text-[10px] uppercase font-bold">
                                <th className="pb-2">Learning Area (Subject)</th>
                                <th className="pb-2 text-center">Score %</th>
                                <th className="pb-2 text-center">CBE Level</th>
                                <th className="pb-2 text-center">Grade Code</th>
                                <th className="pb-2 text-center">Points</th>
                                <th className="pb-2">Remarks</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-medium">
                              {subjectDetails.map((sd, i) => {
                                const isAssessed = sd.isAssessed && sd.gradeObj;
                                const sLevel = isAssessed ? (sd.gradeObj!.performance_level || 'ME') : sd.ev.status;
                                const sCode = isAssessed ? (sd.gradeObj!.grade_code || sd.gradeObj!.grade || 'ME1') : (sd.ev.status === 'X' || sd.ev.status === 'Y' ? sd.ev.status : '-');
                                const pointsStr = isAssessed ? String(sd.gradeObj!.points) : '-';
                                const displayScoreStr = isAssessed ? `${Math.round(sd.percentage!)}%` : (sd.ev.displayScore || '-');

                                return (
                                  <tr key={i} className="hover:bg-slate-50">
                                    <td className="py-2.5 font-bold text-slate-800">
                                      {sd.subject_name} <span className="text-[10px] text-slate-400 font-normal">({sd.subject_code})</span>
                                    </td>
                                    <td className="py-2.5 text-center font-mono font-bold text-slate-900">{displayScoreStr}</td>
                                    <td className="py-2.5 text-center">
                                      {isAssessed ? (
                                        <span
                                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                            sLevel === 'EE'
                                              ? 'bg-emerald-100 text-emerald-800'
                                              : sLevel === 'ME'
                                              ? 'bg-[#E8F3EE] text-[#176B45]'
                                              : sLevel === 'AE'
                                              ? 'bg-amber-100 text-amber-800'
                                              : 'bg-rose-100 text-rose-800'
                                          }`}
                                        >
                                          {sLevel}
                                        </span>
                                      ) : (
                                        <span
                                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                            sd.ev.status === 'Y'
                                              ? 'bg-rose-100 text-rose-800'
                                              : sd.ev.status === 'X'
                                              ? 'bg-amber-100 text-amber-800'
                                              : 'bg-slate-100 text-slate-600'
                                          }`}
                                        >
                                          {sd.ev.status === 'X' ? 'Absent (X)' : sd.ev.status === 'Y' ? 'Irregularity (Y)' : 'Blank'}
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-2.5 text-center font-black text-purple-700">{sCode}</td>
                                    <td className="py-2.5 text-center font-mono font-bold text-slate-800">{pointsStr}</td>
                                    <td className="py-2.5 text-slate-600 font-semibold">{sd.remarks}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition"
          >
            Close Profile
          </button>
        </div>
      </div>
    </div>
  );
};
