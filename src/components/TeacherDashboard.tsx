import React from 'react';
import {
  BookOpen,
  Building2,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { Users, FileBarChart, Calendar as CalendarIcon } from 'lucide-react';
import {
  Teacher,
  ClassStream,
  Subject,
  Examination,
  Mark,
  Student,
} from '../types';
import { getTeacherAssignedClassIds, getTeacherAssignedSubjectIds, isClassTeacherFor } from '../utils/rbacUtils';

interface TeacherDashboardProps {
  teacher: Teacher;
  classes: ClassStream[];
  subjects: Subject[];
  exams: Examination[];
  marks: Mark[];
  students: Student[];
  onNavigate: (tab: any) => void;
}

import { api } from "../lib/storage";
import { canViewTermData, getTermStatusMessage } from "../utils/termStatusUtils";
import { useAcademicSession } from "../contexts/AcademicSessionContext";

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  teacher,
  classes = [],
  subjects = [],
  exams = [],
  marks = [],
  students = [],
  onNavigate,
}) => {
  const isClassTeacher = teacher.is_class_teacher;
  const classTeacherOf = (classes||[]).find(c => c.id === teacher.class_teacher_of_id) || (classes||[]).find(c => c.class_teacher_id === teacher.id);
  const classTeacherStudents = classTeacherOf ? (students||[]).filter(s => s.class_id === classTeacherOf.id) : [];

  const { viewingTerm: activeTermObj } = useAcademicSession();
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
  // Assigned subjects & classes
  const assignedClassIds = getTeacherAssignedClassIds(teacher, classes);
  const assignedSubjectIds = getTeacherAssignedSubjectIds(teacher);

  const assignedClasses = (classes || []).filter((c) => assignedClassIds.includes(c.id));
  const assignedSubjects = (subjects || []).filter((s) => assignedSubjectIds.includes(s.id));

  // Current active or provisional exam
  const activeExam = (exams || []).find((e) => e.status === 'Provisional' || e.status === 'Draft' || e.status === 'Published') || (exams || [])[0];

  return (
    <div className="space-y-6">
      {/* Welcome Banner / Teacher Identity Card */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-5 sm:p-6 border border-[#D9E0E7] dark:border-slate-800 shadow-xs">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-[#075E42] dark:text-emerald-400 uppercase tracking-wider">
                Teacher Workspace &bull; CBE Marks Entry Portal
              </span>
              {classes.find(
                (c) => c.class_teacher_id === teacher.id || (teacher.is_class_teacher && teacher.class_teacher_of_id === c.id)
              ) && (
                <span className="bg-[#E6F4EA] dark:bg-emerald-950/80 text-[#075E42] dark:text-emerald-300 text-[10px] font-bold px-2.5 py-0.5 rounded-md border border-[#075E42]/20 dark:border-emerald-800">
                  CLASS TEACHER:{' '}
                  {
                    classes.find(
                      (c) => c.class_teacher_id === teacher.id || (teacher.is_class_teacher && teacher.class_teacher_of_id === c.id)
                    )?.class_name
                  }{' '}
                  {
                    classes.find(
                      (c) => c.class_teacher_id === teacher.id || (teacher.is_class_teacher && teacher.class_teacher_of_id === c.id)
                    )?.stream
                  }
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold tracking-tight mt-1.5 text-[#1F2937] dark:text-slate-100">{teacher.teacher_name}</h1>
            <p className="text-[#667085] dark:text-slate-400 text-xs sm:text-sm mt-1">
              Phone: <span className="font-medium text-[#374151] dark:text-slate-300">{teacher.phone || 'N/A'}</span> &bull; Email: <span className="font-medium text-[#374151] dark:text-slate-300">{teacher.email || 'N/A'}</span>
            </p>
          </div>

          <button
            onClick={() => onNavigate('marks-entry')}
            className="bg-[#075E42] hover:bg-[#054531] text-white px-4 py-2.5 rounded-lg text-xs font-semibold shadow-xs transition flex items-center space-x-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 shrink-0"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-100" />
            <span>Enter Marks Now</span>
          </button>
        </div>
      </div>

      {/* Grid: Class Teacher Summary */}
      {isClassTeacher && classTeacherOf && (
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-[#D9E0E7] dark:border-slate-800 shadow-xs mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-[#1F2937] dark:text-slate-100 flex items-center space-x-2">
              <Users className="w-5 h-5 text-[#2F5D7E] dark:text-blue-400" />
              <span>My Class Summary &bull; {classTeacherOf.class_name} {classTeacherOf.stream}</span>
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-[#F6F8FA] dark:bg-slate-800 p-4 rounded-lg border border-[#D9E0E7] dark:border-slate-700 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold text-[#667085] dark:text-slate-400 uppercase tracking-wide">Total Learners</span>
                <div className="text-2xl font-bold text-[#1F2937] dark:text-slate-100 mt-1">{classTeacherStudents.length}</div>
              </div>
              <button onClick={() => onNavigate('students')} className="mt-4 text-xs font-semibold text-[#17324D] dark:text-blue-400 hover:underline flex items-center space-x-1 cursor-pointer">
                <Users className="w-4 h-4" /> <span>Manage Roster</span>
              </button>
            </div>
            <div className="bg-[#F6F8FA] dark:bg-slate-800 p-4 rounded-lg border border-[#D9E0E7] dark:border-slate-700 shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-xs font-semibold text-[#667085] dark:text-slate-400 uppercase tracking-wide">Report Forms</span>
                <div className="text-xs font-medium text-[#1F2937] dark:text-slate-100 mt-1">Generate official reports</div>
              </div>
              <button onClick={() => onNavigate('reports')} className="mt-4 text-xs font-semibold text-[#17324D] dark:text-blue-400 hover:underline flex items-center space-x-1 cursor-pointer">
                <FileBarChart className="w-4 h-4" /> <span>View Reports</span>
              </button>
            </div>
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Assigned Classes */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-[#D9E0E7] dark:border-slate-800 shadow-xs md:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-[#1F2937] dark:text-slate-100 flex items-center space-x-2">
              <Building2 className="w-5 h-5 text-[#2F5D7E] dark:text-blue-400" />
              <span>Teaching Allocations</span>
            </h2>
            <span className="text-xs bg-slate-100 dark:bg-slate-800 text-[#17324D] dark:text-slate-300 font-semibold px-2.5 py-0.5 rounded-md border border-[#D9E0E7] dark:border-slate-700">
              {teacher.allocations?.length || 0} Allocations
            </span>
          </div>

          {(teacher.allocations || []).length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(teacher.allocations || []).map((alloc) => {
                const cls = classes.find(c => c.id === alloc.class_id);
                const subj = subjects.find(s => s.id === alloc.subject_id);
                
                if (!cls || !subj) return null;

                const classStudentsCount = students.filter((s) => s.class_id === cls.id).length;
                const isClassTeacher =
                  cls.class_teacher_id === teacher.id ||
                  (teacher.is_class_teacher && teacher.class_teacher_of_id === cls.id);

                return (
                  <div
                    key={alloc.id}
                    className="p-3.5 bg-[#F6F8FA] dark:bg-slate-800 rounded-lg border border-[#D9E0E7] dark:border-slate-700 flex items-center justify-between hover:border-[#17324D] dark:hover:border-slate-500 transition"
                  >
                    <div>
                      <div className="text-sm font-bold text-[#1F2937] dark:text-slate-100 flex items-center space-x-2">
                        <span>
                          {cls.class_name} {cls.stream} &mdash; {subj.subject_name}
                        </span>
                        {isClassTeacher && (
                          <span className="bg-[#2F5D7E] text-white text-[10px] font-semibold px-2 py-0.5 rounded">
                            Class Teacher
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[#667085] dark:text-slate-400 mt-0.5">
                        {alloc.education_level} &bull; Enrolled: {classStudentsCount} Learners
                      </div>
                    </div>

                    <button
                      onClick={() => onNavigate('marks-entry')}
                      className="p-1.5 text-[#17324D] dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition"
                      title="Enter Marks for Allocation"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-4 bg-[#F6F8FA] dark:bg-slate-800 border border-[#D9E0E7] dark:border-slate-700 rounded-lg text-center text-[#667085] dark:text-slate-400 text-xs">
              You have not been assigned any teaching allocations yet.
            </div>
          )}
        </div>
      </div>

      {/* Marks Entry & Verification Workflow Status */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-[#D9E0E7] dark:border-slate-800 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-[#1F2937] dark:text-slate-100 flex items-center space-x-2">
            <Clock className="w-5 h-5 text-[#2F5D7E] dark:text-blue-400" />
            <span>Active Assessment Status: {activeExam?.exam_name || 'N/A'}</span>
          </h2>
          <span
            className={`px-3 py-1 rounded text-xs font-semibold ${
              activeExam?.status === 'Approved'
                ? 'bg-emerald-50 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                : activeExam?.status === 'Provisional'
                ? 'bg-amber-50 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
            }`}
          >
            {activeExam?.status || 'Draft'}
          </span>
        </div>

        <p className="text-xs text-[#667085] dark:text-slate-400 leading-relaxed mb-4">
          Teachers can enter and modify marks during <span className="font-semibold text-[#1F2937] dark:text-slate-200">Draft</span> or{' '}
          <span className="font-semibold text-amber-800 dark:text-amber-400">Provisional</span> status. Once the administrator approves and locks the assessment, results become official.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => onNavigate('marks-entry')}
            className="cbe-btn-primary text-xs font-semibold px-4 py-2 flex items-center space-x-2"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Open Bulk Marks Spreadsheet</span>
          </button>

          <button
            onClick={() => onNavigate('provisional')}
            className="cbe-btn-secondary text-xs font-semibold px-4 py-2 flex items-center space-x-2"
          >
            <CheckCircle className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            <span>View Draft Merit Verification</span>
          </button>
        </div>
      </div>
    </div>
  );
};
