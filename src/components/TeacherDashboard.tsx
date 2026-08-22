import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  Building2,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  Clock,
  ArrowRight,
  Users,
  FileBarChart,
  Calendar,
  Award,
  TrendingUp,
  PieChart as PieChartIcon,
  BarChart3,
  HelpCircle,
  Sparkles,
  X,
} from 'lucide-react';
import {
  Teacher,
  ClassStream,
  Subject,
  Examination,
  Mark,
  Student,
  Grade,
  User,
  getAllocatedSubjectsForClass,
  getApplicableSubjectsForGrade,
} from '../types';
import {
  formatGreeting,
  formatGreetingFirstName,
} from '../utils/greetingUtils';
import { getTeacherAssignedClassIds, getTeacherAssignedSubjectIds } from '../utils/rbacUtils';
import { generateExamAnalysisSummary } from '../services/analysisEngine';
import { BarChart, Bar, PieChart, Pie, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ChartWrapper } from './ChartWrapper';
import { api } from '../lib/storage';
import { canViewTermData, getTermStatusMessage } from '../utils/termStatusUtils';
import { useAcademicSession } from '../contexts/AcademicSessionContext';

import { SubjectTeacherCockpit } from './SubjectTeacherCockpit';

interface TeacherDashboardProps {
  teacher: Teacher;
  classes: ClassStream[];
  subjects: Subject[];
  exams: Examination[];
  marks: Mark[];
  students: Student[];
  grades?: Grade[];
  onNavigate: (tab: any) => void;
  currentUser?: User | null;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  teacher,
  classes = [],
  subjects = [],
  exams = [],
  marks = [],
  students = [],
  grades = [],
  onNavigate,
  currentUser,
}) => {
  const { viewingTerm: activeTermObj } = useAcademicSession();

  // Primary Assigned Class/Streams where this teacher is the designated Class Teacher
  const primaryClasses = useMemo(() => {
    return (classes || []).filter(
      (c) =>
        c.class_teacher_id === teacher.id ||
        (teacher.is_class_teacher &&
          teacher.class_teacher_of_id &&
          ((c.stream_id && c.stream_id === teacher.class_teacher_of_id) ||
            c.id === teacher.class_teacher_of_id))
    );
  }, [classes, teacher]);

  const isClassTeacher = Boolean(
    primaryClasses.length > 0 &&
    (currentUser?.role === 'class_teacher' || teacher.is_class_teacher || (currentUser?.role as string) !== 'subject_teacher')
  );

  // Authoritative learners strictly in the teacher's assigned class/stream(s)
  const classTeacherStudents = useMemo(() => {
    if (primaryClasses.length === 0) return [];
    const primaryStreamIds = new Set(primaryClasses.map((c) => c.stream_id).filter(Boolean));
    const primaryClassIds = new Set(primaryClasses.map((c) => c.id));

    return (students || []).filter((s) => {
      if (s.stream_id && primaryStreamIds.has(s.stream_id)) return true;
      if (primaryClassIds.has(s.class_id)) {
        const matchedClass = primaryClasses.find((c) => c.id === s.class_id);
        if (matchedClass?.stream_id && s.stream_id && s.stream_id !== matchedClass.stream_id) {
          return false;
        }
        return true;
      }
      return false;
    });
  }, [students, primaryClasses]);

  // Primary class subjects
  const classTeacherSubjects = useMemo(() => {
    const subjectMap = new Map<string, Subject>();
    primaryClasses.forEach((cls) => {
      const classSubs = getAllocatedSubjectsForClass(cls, subjects);
      classSubs.forEach((sub) => subjectMap.set(sub.id, sub));
    });
    if (subjectMap.size === 0 && primaryClasses.length > 0) {
      primaryClasses.forEach((cls) => {
        const gradeSubs = getApplicableSubjectsForGrade(cls.class_name, subjects);
        gradeSubs.forEach((sub) => subjectMap.set(sub.id, sub));
      });
    }
    return Array.from(subjectMap.values());
  }, [primaryClasses, subjects]);

  // Safe grades resolution
  const safeGrades = useMemo(() => {
    return grades && grades.length > 0 ? grades : typeof api !== 'undefined' ? api.getGrades() : [];
  }, [grades]);

  // Active examination for analytical scope
  const activeExam = useMemo(() => {
    return (
      (exams || []).find(
        (e) => e.status === 'Provisional' || e.status === 'Approved' || e.status === 'Published'
      ) || (exams || [])[0]
    );
  }, [exams]);

  // Authoritative class-scoped CBE performance analysis
  const classAnalysis = useMemo(() => {
    if (!activeExam || classTeacherStudents.length === 0) return null;
    return generateExamAnalysisSummary(
      activeExam.id,
      activeExam.exam_name,
      classTeacherStudents,
      classTeacherSubjects,
      marks,
      safeGrades
    );
  }, [activeExam, classTeacherStudents, classTeacherSubjects, marks, safeGrades]);

  // 1. Gender Distribution Calculation
  const isMale = (s: Student) => {
    if (!s.gender) return false;
    const g = String(s.gender).trim().toUpperCase();
    return g === 'M' || g === 'MALE' || g === 'BOY';
  };

  const isFemale = (s: Student) => {
    if (!s.gender) return false;
    const g = String(s.gender).trim().toUpperCase();
    return g === 'F' || g === 'FEMALE' || g === 'GIRL';
  };

  const maleCount = classTeacherStudents.filter(isMale).length;
  const femaleCount = classTeacherStudents.filter(isFemale).length;
  const unknownCount = classTeacherStudents.length - maleCount - femaleCount;
  const totalGenderLearners = classTeacherStudents.length;

  const genderChartData = useMemo(() => {
    return [
      {
        name: 'Boys',
        count: maleCount,
        percentage: totalGenderLearners > 0 ? ((maleCount / totalGenderLearners) * 100).toFixed(1) : '0',
        color: '#2563EB',
      },
      {
        name: 'Girls',
        count: femaleCount,
        percentage: totalGenderLearners > 0 ? ((femaleCount / totalGenderLearners) * 100).toFixed(1) : '0',
        color: '#DC2626',
      },
      ...(unknownCount > 0
        ? [
            {
              name: 'Unspecified',
              count: unknownCount,
              percentage: ((unknownCount / totalGenderLearners) * 100).toFixed(1),
              color: '#64748B',
            },
          ]
        : []),
    ].filter((item) => item.count > 0 || totalGenderLearners === 0);
  }, [maleCount, femaleCount, unknownCount, totalGenderLearners]);

  // 2. Student Distribution (Stream-level Population)
  const studentDistributionData = useMemo(() => {
    return primaryClasses.map((cls) => {
      const name = cls.stream ? `${cls.class_name} ${cls.stream}` : cls.class_name;
      const count = classTeacherStudents.filter(
        (s) => (cls.stream_id && s.stream_id === cls.stream_id) || s.class_id === cls.id
      ).length;
      return {
        streamName: name,
        count,
      };
    });
  }, [primaryClasses, classTeacherStudents]);

  // 3. Grade Distribution Analysis (EE, ME, AE, BE)
  const eeCount = classAnalysis?.level_counts?.EE || 0;
  const meCount = classAnalysis?.level_counts?.ME || 0;
  const aeCount = classAnalysis?.level_counts?.AE || 0;
  const beCount = classAnalysis?.level_counts?.BE || 0;

  const performanceLevelData = useMemo(() => {
    return [
      { level: 'EE', label: 'Exceeding Expectations (EE)', count: eeCount, color: '#059669', desc: '75 - 100%' },
      { level: 'ME', label: 'Meeting Expectations (ME)', count: meCount, color: '#475569', desc: '41 - 74%' },
      { level: 'AE', label: 'Approaching Expectations (AE)', count: aeCount, color: '#D97706', desc: '21 - 40%' },
      { level: 'BE', label: 'Below Expectations (BE)', count: beCount, color: '#DC2626', desc: '0 - 20%' },
    ];
  }, [eeCount, meCount, aeCount, beCount]);

  // Assigned teaching allocations
  const assignedClassIds = getTeacherAssignedClassIds(teacher, classes);
  const assignedSubjectIds = getTeacherAssignedSubjectIds(teacher);
  const assignedClasses = (classes || []).filter(
    (c) => assignedClassIds.includes(c.id) || (c.stream_id && assignedClassIds.includes(c.stream_id))
  );

  // Term view restriction check
  if (!canViewTermData(activeTermObj.status)) {
    return (
      <div className="p-8 text-center space-y-4">
        <div className="bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-200 p-6 rounded-2xl max-w-md mx-auto border border-amber-200 dark:border-amber-800">
          <h2 className="text-lg font-bold mb-2">Term {activeTermObj.status}</h2>
          <p className="text-sm">{getTermStatusMessage(activeTermObj.status)}</p>
        </div>
      </div>
    );
  }

  const primaryClassTitle =
    primaryClasses.length > 0
      ? primaryClasses.map((c) => (c.stream ? `${c.class_name} ${c.stream}` : c.class_name)).join(', ')
      : 'Class Teacher';

  const [activeModal, setActiveModal] = useState<'none' | 'classes' | 'subjects'>('none');

  // Unique assigned classes for this teacher
  const uniqueAssignedClasses = useMemo(() => {
    const map = new Map<string, { cls: ClassStream; studentCount: number; allocations: any[] }>();
    (teacher.allocations || []).forEach((alloc) => {
      const cls =
        (alloc.stream_id
          ? classes.find((c) => c.stream_id === alloc.stream_id || c.id === alloc.stream_id)
          : undefined) ||
        (alloc.stream
          ? classes.find(
              (c) =>
                (c.class_name === alloc.class_name || c.id === alloc.class_id) &&
                c.stream.toLowerCase() === alloc.stream.toLowerCase()
            )
          : undefined) ||
        classes.find((c) => c.id === alloc.class_id);

      if (cls) {
        const key = cls.id + (cls.stream_id || '');
        if (map.has(key)) {
          map.get(key)!.allocations.push(alloc);
        } else {
          const count = (students || []).filter(
            (s) => (cls.stream_id && s.stream_id === cls.stream_id) || s.class_id === cls.id
          ).length;
          map.set(key, { cls, studentCount: count, allocations: [alloc] });
        }
      }
    });
    return Array.from(map.values());
  }, [teacher.allocations, classes, students]);

  // Unique assigned learning areas / subjects for this teacher
  const uniqueAssignedSubjects = useMemo(() => {
    const map = new Map<string, { subject: Subject; allocations: any[] }>();
    (teacher.allocations || []).forEach((alloc) => {
      const subj = subjects.find((s) => s.id === alloc.subject_id);
      if (subj) {
        const existing = map.get(subj.id);
        if (existing) {
          existing.allocations.push(alloc);
        } else {
          map.set(subj.id, { subject: subj, allocations: [alloc] });
        }
      }
    });
    return Array.from(map.values());
  }, [teacher.allocations, subjects]);

  const teacherInitials = useMemo(() => {
    if (!teacher?.teacher_name) return 'TR';
    const parts = teacher.teacher_name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'TR';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }, [teacher?.teacher_name]);

  // =========================================================================
  // SUBJECT TEACHER WORKSPACE PRESENTATION (STRICT ROLE SCOPE)
  // =========================================================================
  if (!isClassTeacher) {
    return (
      <SubjectTeacherCockpit
        teacher={teacher}
        classes={classes}
        subjects={subjects}
        exams={exams}
        marks={marks}
        students={students}
        grades={grades}
        onNavigate={onNavigate}
        currentUser={currentUser}
      />
    );
  }

  // =========================================================================
  // CLASS TEACHER DASHBOARD PRESENTATION (RETAINS FULL KPIS, CHARTS & ACTIONS)
  // =========================================================================

  return (
    <div className="space-y-6">
      {/* Teacher Workspace Header Card */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-4 sm:p-5 border border-[#D9E0E7] dark:border-slate-800 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Workspace Title & Info */}
          <div className="min-w-0 flex-1 space-y-1">
            {/* Primary Heading */}
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-[#1F2937] dark:text-slate-100">
              {formatGreetingFirstName(teacher.teacher_name)}
            </h1>

            {/* Context & Role Badge */}
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <span className="text-xs font-semibold text-[#075E42] dark:text-emerald-400 uppercase tracking-wider">
                Teacher Workspace
              </span>
              <span className="text-slate-300 dark:text-slate-700">&bull;</span>
              <span className="inline-flex items-center text-xs font-medium text-[#075E42] dark:text-emerald-300 bg-[#E6F4EA] dark:bg-emerald-950/80 px-2 py-0.5 rounded-md border border-[#075E42]/20 dark:border-emerald-800">
                {isClassTeacher && primaryClasses.length > 0
                  ? `Class Teacher • ${primaryClassTitle}`
                  : isClassTeacher
                  ? 'Class Teacher'
                  : 'Subject Teacher'}
              </span>
            </div>

            {/* Supporting Description */}
            <p className="text-xs text-[#667085] dark:text-slate-400 pt-0.5">
              Manage your assessments, learners and results.
            </p>
          </div>

          {/* Core Workspace Actions */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100 dark:border-slate-800/80">
            <button
              onClick={() => onNavigate('marks-entry')}
              className="bg-[#075E42] hover:bg-[#054531] text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-xs transition flex items-center space-x-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-100" />
              <span>Enter Marks Now</span>
            </button>
            {isClassTeacher && (
              <button
                onClick={() => onNavigate('reports')}
                className="cbe-btn-secondary text-xs font-semibold px-4 py-2 flex items-center space-x-2 cursor-pointer"
              >
                <FileBarChart className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                <span>Class Reports</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Class Teacher KPI Metrics Grid */}
      {isClassTeacher && primaryClasses.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-[#D9E0E7] dark:border-slate-800 shadow-xs flex items-center space-x-3.5">
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 text-[#075E42] dark:text-emerald-400 rounded-lg flex-shrink-0 border border-emerald-100 dark:border-emerald-800/60">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-medium text-[#667085] dark:text-slate-400 uppercase tracking-wide">
                Class Enrolment
              </div>
              <div className="text-2xl font-bold text-[#1F2937] dark:text-slate-100 mt-0.5">
                {classTeacherStudents.length}
              </div>
              <div className="text-[10px] text-[#667085] dark:text-slate-400 font-medium">
                {primaryClasses.length} Assigned Stream{primaryClasses.length > 1 ? 's' : ''}
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-[#D9E0E7] dark:border-slate-800 shadow-xs flex items-center space-x-3.5">
            <div className="p-3 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 rounded-lg flex-shrink-0 border border-blue-100 dark:border-blue-800/60">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-medium text-[#667085] dark:text-slate-400 uppercase tracking-wide">
                Class Mean Score
              </div>
              <div className="text-2xl font-bold text-[#1F2937] dark:text-slate-100 mt-0.5">
                {classAnalysis && classAnalysis.mean_score > 0 ? `${classAnalysis.mean_score}%` : 'N/A'}
              </div>
              <div className="text-[10px] text-[#667085] dark:text-slate-400 font-medium">
                {classAnalysis && classAnalysis.mean_score > 0
                  ? `${classAnalysis.mean_performance_level} (${classAnalysis.mean_grade_code})`
                  : activeExam?.exam_name || 'Active Exam'}
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-[#D9E0E7] dark:border-slate-800 shadow-xs flex items-center space-x-3.5">
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 rounded-lg flex-shrink-0 border border-indigo-100 dark:border-indigo-800/60">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-medium text-[#667085] dark:text-slate-400 uppercase tracking-wide">
                Learning Areas
              </div>
              <div className="text-2xl font-bold text-[#1F2937] dark:text-slate-100 mt-0.5">
                {classTeacherSubjects.length}
              </div>
              <div className="text-[10px] text-[#667085] dark:text-slate-400 font-medium">
                Applicable Curriculum Subjects
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-[#D9E0E7] dark:border-slate-800 shadow-xs flex items-center space-x-3.5">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 rounded-lg flex-shrink-0 border border-amber-100 dark:border-amber-800/60">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-medium text-[#667085] dark:text-slate-400 uppercase tracking-wide">
                Assessment Status
              </div>
              <div className="text-sm font-bold text-[#1F2937] dark:text-slate-100 mt-1">
                {activeExam?.status || 'Draft'}
              </div>
              <div className="text-[10px] text-[#667085] dark:text-slate-400 font-medium truncate max-w-[150px]">
                {activeExam?.exam_name || 'No active exam'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Class Visualisations: Gender Distribution & Student Distribution */}
      {isClassTeacher && primaryClasses.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 1. GENDER DISTRIBUTION PIE CHART */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-[#D9E0E7] dark:border-slate-800 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-bold text-[#1F2937] dark:text-slate-100 flex items-center space-x-2">
                    <PieChartIcon className="w-5 h-5 text-[#2563EB] dark:text-blue-400" />
                    <span>Gender Distribution</span>
                  </h2>
                  <p className="text-xs text-[#667085] dark:text-slate-400 mt-0.5">
                    Learner breakdown for {primaryClassTitle}
                  </p>
                </div>
                <span className="text-xs font-bold bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 px-2.5 py-1 rounded-md border border-blue-200 dark:border-blue-800">
                  {totalGenderLearners} Total
                </span>
              </div>

              <ChartWrapper
                className="h-56 w-full"
                hasData={totalGenderLearners > 0}
                emptyTitle="No Gender Data Available"
                emptySubtext="Ensure learner gender records are populated."
              >
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={genderChartData}
                      dataKey="count"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={3}
                    >
                      {genderChartData.map((entry, index) => (
                        <Cell key={`gender-cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: any, name: any) => [`${value} Learners`, name]}
                      contentStyle={{
                        borderRadius: '8px',
                        borderColor: '#334155',
                        backgroundColor: '#1E293B',
                        color: '#F8FAFC',
                        fontSize: '12px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </ChartWrapper>
            </div>

            {totalGenderLearners > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4 pt-3 border-t border-[#D9E0E7] dark:border-slate-800 text-xs">
                <div className="flex items-center space-x-2 bg-blue-50/60 dark:bg-blue-950/40 p-2.5 rounded-lg border border-blue-100 dark:border-blue-900/40">
                  <div className="w-3 h-3 rounded-full bg-[#2563EB] shrink-0" />
                  <div>
                    <div className="text-[10px] text-[#667085] dark:text-slate-400 font-medium">Boys (Male)</div>
                    <div className="font-bold text-[#1F2937] dark:text-slate-100">
                      {maleCount}{' '}
                      <span className="text-[10px] font-normal text-[#667085] dark:text-slate-400">
                        ({totalGenderLearners > 0 ? ((maleCount / totalGenderLearners) * 100).toFixed(1) : 0}%)
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 bg-red-50/60 dark:bg-red-950/40 p-2.5 rounded-lg border border-red-100 dark:border-red-900/40">
                  <div className="w-3 h-3 rounded-full bg-[#DC2626] shrink-0" />
                  <div>
                    <div className="text-[10px] text-[#667085] dark:text-slate-400 font-medium">Girls (Female)</div>
                    <div className="font-bold text-[#1F2937] dark:text-slate-100">
                      {femaleCount}{' '}
                      <span className="text-[10px] font-normal text-[#667085] dark:text-slate-400">
                        ({totalGenderLearners > 0 ? ((femaleCount / totalGenderLearners) * 100).toFixed(1) : 0}%)
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 bg-slate-50 dark:bg-slate-800/80 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 col-span-2 sm:col-span-1">
                  <div className="w-3 h-3 rounded-full bg-[#075E42] dark:bg-emerald-400 shrink-0" />
                  <div>
                    <div className="text-[10px] text-[#667085] dark:text-slate-400 font-medium">Total Roster</div>
                    <div className="font-bold text-[#1F2937] dark:text-slate-100">{totalGenderLearners} Learners</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-3 text-xs text-[#667085] dark:text-slate-400 font-medium">
                No learner gender records found for this class.
              </div>
            )}
          </div>

          {/* 2. STUDENT DISTRIBUTION BAR CHART (Stream-level Population) */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-[#D9E0E7] dark:border-slate-800 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-bold text-[#1F2937] dark:text-slate-100 flex items-center space-x-2">
                    <BarChart3 className="w-5 h-5 text-[#075E42] dark:text-emerald-400" />
                    <span>Student Distribution</span>
                  </h2>
                  <p className="text-xs text-[#667085] dark:text-slate-400 mt-0.5">
                    Learner population across assigned stream(s)
                  </p>
                </div>
                <span className="text-xs font-bold bg-emerald-50 dark:bg-emerald-950/80 text-[#075E42] dark:text-emerald-300 px-2.5 py-1 rounded-md border border-emerald-200 dark:border-emerald-800">
                  {classTeacherStudents.length} Enrolled
                </span>
              </div>

              <ChartWrapper
                className="h-56 w-full"
                hasData={studentDistributionData.some((d) => d.count > 0)}
                emptyTitle="No Student Distribution Data"
                emptySubtext="Add learners to view population by stream."
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={studentDistributionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <XAxis dataKey="streamName" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94A3B8' }} />
                    <Tooltip
                      formatter={(value: any) => [`${value} Learners`, 'Enrolment']}
                      contentStyle={{
                        borderRadius: '8px',
                        borderColor: '#334155',
                        backgroundColor: '#1E293B',
                        color: '#F8FAFC',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="count" fill="#075E42" radius={[4, 4, 0, 0]}>
                      {studentDistributionData.map((entry, index) => (
                        <Cell
                          key={`stream-dist-cell-${index}`}
                          fill={['#075E42', '#059669', '#10B981', '#2563EB', '#3B82F6'][index % 5]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartWrapper>
            </div>

            <div className="mt-4 pt-3 border-t border-[#D9E0E7] dark:border-slate-800 flex items-center justify-between text-xs text-[#667085] dark:text-slate-400 font-medium">
              <span>Authoritative stream allocation</span>
              <span className="font-bold text-[#1F2937] dark:text-slate-200">
                {primaryClasses.length} Assigned Stream{primaryClasses.length > 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Grade Distribution & Top Performers Grid */}
      {isClassTeacher && primaryClasses.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 3. GRADE DISTRIBUTION ANALYSIS (EE, ME, AE, BE) */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl p-5 border border-[#D9E0E7] dark:border-slate-800 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-bold text-[#1F2937] dark:text-slate-100 flex items-center space-x-2">
                    <TrendingUp className="w-5 h-5 text-[#075E42] dark:text-emerald-400" />
                    <span>Grade Distribution Analysis</span>
                  </h2>
                  <p className="text-xs text-[#667085] dark:text-slate-400 mt-0.5">
                    Performance breakdown for <span className="font-semibold">{activeExam?.exam_name || 'Active Exam'}</span> ({primaryClassTitle})
                  </p>
                </div>
                <button
                  onClick={() => onNavigate('reports')}
                  className="text-xs font-semibold text-[#075E42] dark:text-emerald-400 hover:underline flex items-center space-x-1 cursor-pointer"
                >
                  <span>Class Reports</span> &rarr;
                </button>
              </div>

              <ChartWrapper
                className="h-64 w-full"
                hasData={performanceLevelData.some((d) => d.count > 0)}
                emptyTitle="No marks entered yet"
                emptySubtext="Grade distribution will appear once learner marks have been entered."
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={performanceLevelData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <XAxis dataKey="level" tick={{ fontSize: 12, fill: '#94A3B8' }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#94A3B8' }} />
                    <Tooltip
                      formatter={(value: any, name: any, item: any) => [
                        `${value} Learners`,
                        item.payload.label,
                      ]}
                      contentStyle={{
                        borderRadius: '8px',
                        borderColor: '#334155',
                        backgroundColor: '#1E293B',
                        color: '#F8FAFC',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {performanceLevelData.map((entry, index) => (
                        <Cell key={`perf-cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </ChartWrapper>
            </div>

            {/* Performance Legend */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 pt-4 border-t border-[#D9E0E7] dark:border-slate-800 text-xs">
              {performanceLevelData.map((item) => (
                <div key={item.level} className="flex items-center space-x-2">
                  <span className="w-3 h-3 rounded shrink-0" style={{ backgroundColor: item.color }} />
                  <div>
                    <span className="font-bold text-[#1F2937] dark:text-slate-200">{item.level}</span>: {item.desc}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 4. TOP CLASS PERFORMERS */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-[#D9E0E7] dark:border-slate-800 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-[#1F2937] dark:text-slate-100 flex items-center space-x-2">
                  <Award className="w-5 h-5 text-[#075E42] dark:text-emerald-400" />
                  <span>Top Class Performers</span>
                </h2>
                <span className="text-[11px] font-semibold text-[#667085] dark:text-slate-400">
                  {primaryClassTitle}
                </span>
              </div>

              {classAnalysis && classAnalysis.top_performers.length > 0 ? (
                <div className="space-y-2.5">
                  {classAnalysis.top_performers.slice(0, 4).map((tp, idx) => (
                    <div
                      key={tp.student_id}
                      className="p-3 bg-[#F6F8FA] dark:bg-slate-800/70 rounded-lg border border-[#D9E0E7] dark:border-slate-700/60 flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-3">
                        <span
                          className={`w-6 h-6 rounded flex items-center justify-center font-bold text-xs ${
                            idx === 0
                              ? 'bg-[#075E42] text-white'
                              : idx === 1
                              ? 'bg-[#054531] text-white'
                              : 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'
                          }`}
                        >
                          {tp.position && tp.position > 0 ? tp.position : idx + 1}
                        </span>
                        <div>
                          <div className="text-sm font-bold text-[#1F2937] dark:text-slate-100">
                            {tp.student_name}
                          </div>
                          <div className="text-xs text-[#667085] dark:text-slate-400">
                            Adm: {tp.admission_number}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-[#075E42] dark:text-emerald-400">{tp.average}%</div>
                        <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                          {tp.performance_level} ({tp.grade_code})
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-[#667085] dark:text-slate-400 text-xs">
                  No marks compiled for top performers in this class yet.
                </div>
              )}
            </div>

            <button
              onClick={() => onNavigate('reports')}
              className="w-full mt-4 cbe-btn-secondary text-xs font-semibold text-center cursor-pointer"
            >
              Generate Class Merit List
            </button>
          </div>
        </div>
      )}

      {/* 5. CLASS TEACHER QUICK ACTION PANEL */}
      {isClassTeacher && (
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-[#D9E0E7] dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-[#1F2937] dark:text-slate-100">
                Class Teacher Quick Action Panel
              </h2>
              <p className="text-xs text-[#667085] dark:text-slate-400">
                Fast navigation shortcuts for authorized class teacher operations
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <button
              onClick={() => onNavigate('students')}
              className="p-4 rounded-lg border border-[#D9E0E7] dark:border-slate-800 hover:border-[#075E42] dark:hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-slate-800/80 text-[#1F2937] dark:text-slate-200 transition flex flex-col items-center text-center space-y-2 group cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#075E42]"
            >
              <Users className="w-6 h-6 text-[#075E42] dark:text-emerald-400 transition-transform group-hover:scale-110" />
              <div>
                <span className="text-xs font-semibold block">View Class Learners</span>
                <span className="text-[10px] text-[#667085] dark:text-slate-400">Roster & Profiles</span>
              </div>
            </button>

            <button
              onClick={() => onNavigate('marks-entry')}
              className="p-4 rounded-lg border border-[#D9E0E7] dark:border-slate-800 hover:border-[#075E42] dark:hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-slate-800/80 text-[#1F2937] dark:text-slate-200 transition flex flex-col items-center text-center space-y-2 group cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#075E42]"
            >
              <FileSpreadsheet className="w-6 h-6 text-[#075E42] dark:text-emerald-400 transition-transform group-hover:scale-110" />
              <div>
                <span className="text-xs font-semibold block">View Class Marks</span>
                <span className="text-[10px] text-[#667085] dark:text-slate-400">Fast Marks Entry</span>
              </div>
            </button>

            <button
              onClick={() => onNavigate('marks-entry')}
              className="p-4 rounded-lg border border-[#D9E0E7] dark:border-slate-800 hover:border-[#075E42] dark:hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-slate-800/80 text-[#1F2937] dark:text-slate-200 transition flex flex-col items-center text-center space-y-2 group cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#075E42]"
            >
              <AlertCircle className="w-6 h-6 text-amber-600 dark:text-amber-400 transition-transform group-hover:scale-110" />
              <div>
                <span className="text-xs font-semibold block">Monitor Missing Marks</span>
                <span className="text-[10px] text-[#667085] dark:text-slate-400">Audit Incomplete Entries</span>
              </div>
            </button>

            <button
              onClick={() => onNavigate('reports')}
              className="p-4 rounded-lg border border-[#D9E0E7] dark:border-slate-800 hover:border-[#075E42] dark:hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-slate-800/80 text-[#1F2937] dark:text-slate-200 transition flex flex-col items-center text-center space-y-2 group cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#075E42]"
            >
              <FileBarChart className="w-6 h-6 text-[#075E42] dark:text-emerald-400 transition-transform group-hover:scale-110" />
              <div>
                <span className="text-xs font-semibold block">View Class Performance</span>
                <span className="text-[10px] text-[#667085] dark:text-slate-400">Reports & Merit Lists</span>
              </div>
            </button>

            <button
              onClick={() => onNavigate('academic-session')}
              className="p-4 rounded-lg border border-[#D9E0E7] dark:border-slate-800 hover:border-[#075E42] dark:hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-slate-800/80 text-[#1F2937] dark:text-slate-200 transition flex flex-col items-center text-center space-y-2 group cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#075E42]"
            >
              <Calendar className="w-6 h-6 text-[#075E42] dark:text-emerald-400 transition-transform group-hover:scale-110" />
              <div>
                <span className="text-xs font-semibold block">Academic Session</span>
                <span className="text-[10px] text-[#667085] dark:text-slate-400">Term Dates & Status</span>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Teaching Allocations Grid */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-[#D9E0E7] dark:border-slate-800 shadow-xs">
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
              const cls =
                (alloc.stream_id
                  ? classes.find((c) => c.stream_id === alloc.stream_id || c.id === alloc.stream_id)
                  : undefined) ||
                (alloc.stream
                  ? classes.find(
                      (c) =>
                        (c.class_name === alloc.class_name || c.id === alloc.class_id) &&
                        c.stream.toLowerCase() === alloc.stream.toLowerCase()
                    )
                  : undefined) ||
                classes.find((c) => c.id === alloc.class_id);
              const subj = subjects.find((s) => s.id === alloc.subject_id);

              if (!cls || !subj) return null;

              const classStudentsCount = students.filter(
                (s) => (cls.stream_id && s.stream_id === cls.stream_id) || s.class_id === cls.id
              ).length;
              const isAllocClassTeacher =
                cls.class_teacher_id === teacher.id ||
                (teacher.is_class_teacher &&
                  ((cls.stream_id && teacher.class_teacher_of_id === cls.stream_id) ||
                    teacher.class_teacher_of_id === cls.id));

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
                      {isAllocClassTeacher && (
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
                    className="p-1.5 text-[#17324D] dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition cursor-pointer"
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
            onClick={() => onNavigate('reports')}
            className="cbe-btn-secondary text-xs font-semibold px-4 py-2 flex items-center space-x-2"
          >
            <FileBarChart className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            <span>View Performance & Reports</span>
          </button>
        </div>
      </div>
    </div>
  );
};
