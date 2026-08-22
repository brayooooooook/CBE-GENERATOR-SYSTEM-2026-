import React, { useState } from 'react';
import {
  Users,
  UserCheck,
  Building2,
  BookMarked,
  Award,
  TrendingUp,
  FileSpreadsheet,
  CheckCircle,
  AlertTriangle,
  Plus,
  Download,
  RotateCcw,
  Calendar,
  Lock,
  ChevronRight,
  Clock,
  Sparkles,
  Filter,
} from 'lucide-react';
import {
  School,
  Student,
  Teacher,
  ClassStream,
  Subject,
  Examination,
  Mark,
  Grade,
  ALL_EDUCATION_LEVELS,
  ALL_GRADES,
  LEVEL_TO_GRADES,
  getEducationLevelForGrade,
  getApplicableSubjectsForGrade,
  sortGrades,
} from '../types';
import { generateExamAnalysisSummary } from '../services/analysisEngine';
import { api } from '../lib/storage';
import { BarChart, Bar, PieChart, Pie, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ChartWrapper } from './ChartWrapper';
import { useAcademicSession } from '../contexts/AcademicSessionContext';
import { formatGreeting } from '../utils/greetingUtils';
import { saveFile } from '../utils/fileDownloader';
import { getUpcomingTermReminder } from '../utils/termReminderUtils';
import { AcademicTermReminderBanner } from './AcademicTermReminderBanner';

interface AdminDashboardProps {
  userName?: string;
  school: School;
  students: Student[];
  teachers: Teacher[];
  classes: ClassStream[];
  subjects: Subject[];
  exams: Examination[];
  marks: Mark[];
  grades: Grade[];
  onNavigate: (tab: any) => void;
  onResetData: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  userName,
  school,
  students = [],
  teachers = [],
  classes = [],
  subjects = [],
  exams = [],
  marks = [],
  grades = [],
  onNavigate,
  onResetData,
}) => {
  const { viewingYear: activeAcademicYear, viewingTerm: activeTerm } = useAcademicSession();

  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);
  const [reminderDismissed, setReminderDismissed] = useState(false);

  const allSchoolTerms = api.getSchoolTerms();
  const termReminder = !reminderDismissed
    ? getUpcomingTermReminder({
        schoolTerms: allSchoolTerms,
        activeTerm,
        activeAcademicYear,
        checkDismissed: true,
      })
    : null;

  // Level & Grade filter states
  const [selectedLevelFilter, setSelectedLevelFilter] = useState<string>('all');
  const [selectedGradeFilter, setSelectedGradeFilter] = useState<string>('all');
  const [selectedExamId, setSelectedExamId] = useState<string>('');

  const availableGrades = selectedLevelFilter === 'all'
    ? ALL_GRADES
    : LEVEL_TO_GRADES[selectedLevelFilter as keyof typeof LEVEL_TO_GRADES] || ALL_GRADES;

  const handleLevelChange = (lvl: string) => {
    setSelectedLevelFilter(lvl);
    setSelectedGradeFilter('all');
  };

  // Filtered sets for dynamic KPIs
  const filteredClasses = classes.filter((c) => {
    const cLevel = c.education_level || getEducationLevelForGrade(c.class_name);
    const matchesLevel = selectedLevelFilter === 'all' || cLevel === selectedLevelFilter;
    const matchesGrade = selectedGradeFilter === 'all' || c.class_name === selectedGradeFilter;
    return matchesLevel && matchesGrade;
  });

  const filteredClassIds = new Set(filteredClasses.map((c) => c.id));

  const filteredStudents = students.filter((s) => {
    const cls = classes.find((c) => c.id === s.class_id);
    const stdGrade = s.grade || cls?.class_name;
    const stdLevel = s.education_level || cls?.education_level || (stdGrade ? getEducationLevelForGrade(stdGrade) : undefined);

    const matchesLevel = selectedLevelFilter === 'all' || stdLevel === selectedLevelFilter;
    const matchesGrade = selectedGradeFilter === 'all' || stdGrade === selectedGradeFilter;
    return matchesLevel && matchesGrade;
  });

  const filteredSubjects = subjects.filter((s) => {
    if (s.status === 'Archived') return false;
    const matchesLevel = selectedLevelFilter === 'all' || s.education_level === selectedLevelFilter;
    const matchesGrade = selectedGradeFilter === 'all' || getApplicableSubjectsForGrade(selectedGradeFilter, subjects).some((sub) => sub.id === s.id);
    if (selectedGradeFilter !== 'all') {
      return matchesGrade;
    }
    return matchesLevel;
  });

  const filteredTeachers = teachers.filter((t) => {
    if (selectedLevelFilter === 'all' && selectedGradeFilter === 'all') return true;
    const teachesClass = (t.allocations || []).some(a => filteredClassIds.has(a.class_id));
    const teachesSubject = (t.allocations || []).some(a => filteredSubjects.some(fs => fs.id === a.subject_id));
    return teachesClass || teachesSubject;
  });

  const activeExam =
    (selectedExamId ? (exams || []).find((e) => e.id === selectedExamId) : null) ||
    (exams || []).find((e) => e.status === 'Provisional' || e.status === 'Approved' || e.status === 'Published') ||
    (exams || [])[0];

  const analysis = activeExam
    ? generateExamAnalysisSummary(
        activeExam.id,
        activeExam.exam_name,
        filteredStudents,
        filteredSubjects,
        marks,
        grades
      )
    : null;

  const formatDateLabel = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  // Gender distribution calculations
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

  const maleCount = filteredStudents.filter(isMale).length;
  const femaleCount = filteredStudents.filter(isFemale).length;
  const unknownCount = filteredStudents.length - maleCount - femaleCount;
  const totalGenderLearners = filteredStudents.length;

  const genderChartData = [
    { name: 'Boys', count: maleCount, percentage: totalGenderLearners > 0 ? ((maleCount / totalGenderLearners) * 100).toFixed(1) : '0', color: '#2563EB' },
    { name: 'Girls', count: femaleCount, percentage: totalGenderLearners > 0 ? ((femaleCount / totalGenderLearners) * 100).toFixed(1) : '0', color: '#DC2626' },
    ...(unknownCount > 0 ? [{ name: 'Unspecified', count: unknownCount, percentage: ((unknownCount / totalGenderLearners) * 100).toFixed(1), color: '#6B7280' }] : []),
  ].filter((item) => item.count > 0 || totalGenderLearners === 0);

  // General class student distribution aggregation (aggregating streams into parent class)
  const generalClassesSet = new Set<string>();

  classes.forEach((c) => {
    if (c.class_name) {
      const cLevel = c.education_level || getEducationLevelForGrade(c.class_name);
      const matchesLevel = selectedLevelFilter === 'all' || cLevel === selectedLevelFilter;
      const matchesGrade = selectedGradeFilter === 'all' || c.class_name === selectedGradeFilter;
      if (matchesLevel && matchesGrade) {
        generalClassesSet.add(c.class_name);
      }
    }
  });

  filteredStudents.forEach((s) => {
    const cls = classes.find((c) => c.id === s.class_id);
    const gName = s.grade || cls?.class_name;
    if (gName) {
      generalClassesSet.add(gName);
    }
  });

  const sortedGeneralClasses = sortGrades(Array.from(generalClassesSet));

  const studentDistributionData = sortedGeneralClasses.map((gName) => {
    const count = filteredStudents.filter((s) => {
      const cls = classes.find((c) => c.id === s.class_id);
      const stdGrade = s.grade || cls?.class_name;
      return stdGrade === gName;
    }).length;

    return {
      className: gName,
      count,
    };
  });

  // Grade counts chart data
  const chartData = grades.map((g) => {
    const code = g.grade_code || g.grade || '';
    return {
      grade: code,
      descriptor: `${g.remarks} (${g.descriptor})`,
      count: analysis?.grade_counts[code] || 0,
    };
  });

  const COLORS = ['#059669', '#10B981', '#2563EB', '#3B82F6', '#D97706', '#F59E0B', '#DC2626', '#EF4444'];

  const handleExportJSON = async () => {
    const academicYears = api.getAcademicYears();
    const terms = api.getSchoolTerms();

    // Sanitize teacher records so no sensitive auth credentials (e.g. temporary_password) are exported
    const sanitizedTeachers = teachers.map((t) => {
      const { temporary_password, ...safeTeacher } = t;
      return safeTeacher;
    });

    const exportTimestamp = new Date().toISOString();
    const schoolId = school?.id || 'sch_default';
    const schoolName = school?.school_name || 'School';

    const backupData = {
      metadata: {
        backup_format_version: '1.0.0',
        app_version: '1.0.0',
        exported_at: exportTimestamp,
        school_id: schoolId,
        school_name: schoolName,
        backup_type: 'manual_admin_export',
        record_counts: {
          learners: students.length,
          teachers: teachers.length,
          classes: classes.length,
          subjects: subjects.length,
          examinations: exams.length,
          marks: marks.length,
          grades: grades.length,
          academic_years: academicYears.length,
          terms: terms.length,
        },
      },
      school,
      academic_years: academicYears,
      terms,
      classes,
      subjects,
      teachers: sanitizedTeachers,
      learners: students,
      students, // backward-compatibility alias
      examinations: exams,
      exams, // backward-compatibility alias
      marks,
      grades,
      exported_at: exportTimestamp, // backward-compatibility top-level field
    };
    const jsonContent = JSON.stringify(backupData, null, 2);
    const fileName = `${schoolName.replace(/\s+/g, '_')}_CBE_Backup_${exportTimestamp.slice(0, 10)}.json`;
    await saveFile(jsonContent, fileName, {
      mimeType: 'application/json',
      dialogTitle: 'Export System Backup',
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-[#075E42] text-white rounded-xl sm:rounded-2xl p-4 sm:p-5 border border-[#087F5B]/60 shadow-2xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="space-y-1">
          {/* Dynamic Time-Based Greeting */}
          <div className="text-emerald-100/95 text-xs sm:text-sm font-semibold tracking-wide">
            {formatGreeting(userName || 'Administrator')}
          </div>
          <div className="flex items-center space-x-1.5 text-emerald-200/90 font-semibold text-[11px] tracking-wider uppercase">
            <Award className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
            <span>Competency-Based Education (CBE) Management System</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white leading-tight">
            {school.school_name || 'Muchorwe Comprehensive School'}
          </h1>
          <p className="text-emerald-100/80 text-xs font-medium italic">
            {school.motto || 'Strive for Excellence'}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 w-full sm:w-auto shrink-0">
          <button
            onClick={() => onNavigate('students')}
            className="flex-1 sm:flex-none bg-[#054531] hover:bg-[#043828] text-white px-3.5 py-2 rounded-lg text-xs font-semibold shadow-2xs transition-all flex items-center justify-center space-x-1.5 border border-emerald-400/30 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-400 active:scale-[0.98]"
          >
            <Plus className="w-4 h-4 text-emerald-200 shrink-0" />
            <span>Register Student</span>
          </button>

          <button
            onClick={handleExportJSON}
            className="flex-1 sm:flex-none bg-emerald-800/50 hover:bg-emerald-800/80 text-emerald-100 hover:text-white border border-emerald-500/30 px-3.5 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center space-x-1.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-400 active:scale-[0.98]"
            title="Export Full System Backup"
          >
            <Download className="w-4 h-4 text-emerald-200 shrink-0" />
            <span>Backup Data</span>
          </button>

          <button
            onClick={() => setShowResetConfirmModal(true)}
            className="flex-1 sm:flex-none bg-amber-950/40 hover:bg-amber-900/60 text-amber-200 hover:text-amber-100 border border-amber-500/40 px-3.5 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center space-x-1.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-400 active:scale-[0.98]"
            title="Reset system to clean initial seed data"
          >
            <RotateCcw className="w-4 h-4 text-amber-300 shrink-0" />
            <span>Reset Seed Data</span>
          </button>
        </div>
      </div>

      {/* Reset Seed Data Confirmation Modal */}
      {showResetConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-5 shadow-xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Reset System Seed Data</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Are you sure you want to reset all records to the clean initial seed data? This operation will restore default sample records and overwrite unsaved changes.
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end space-x-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowResetConfirmModal(false)}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowResetConfirmModal(false);
                  onResetData();
                }}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition shadow-2xs cursor-pointer flex items-center space-x-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Confirm Reset</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Academic Term Transition Reminder Banner */}
      {termReminder && (
        <AcademicTermReminderBanner
          reminder={termReminder}
          onNavigateToSession={() => onNavigate('academic-session')}
          onDismiss={() => setReminderDismissed(true)}
        />
      )}

      {/* --- CURRENT ACADEMIC SESSION CARD --- */}
      <div className="bg-white dark:bg-slate-900 text-[#1F2937] dark:text-slate-100 rounded-xl p-5 border border-[#D9E0E7] dark:border-slate-800 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#075E42] bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                Active Session Status
              </span>
              <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-md ${
                activeTerm.status === 'Active'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border border-amber-200'
              }`}>
                {activeTerm.status}
              </span>
            </div>

            <div className="flex items-baseline space-x-3 pt-1">
              <h2 className="text-xl font-bold text-[#1F2937] dark:text-slate-100">Academic Year {activeAcademicYear.year}</h2>
              <span className="text-base font-semibold text-[#075E42] dark:text-emerald-400">{activeTerm.term_name}</span>
            </div>
            <p className="text-xs text-[#667085] dark:text-slate-400">
              All examinations and marks records are automatically tagged to this session.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs w-full md:w-auto">
            <div className="bg-[#F6F8FA] dark:bg-slate-800 p-2.5 rounded-lg border border-[#D9E0E7] dark:border-slate-700">
              <span className="text-[10px] text-[#667085] dark:text-slate-400 font-semibold block">Opening Date</span>
              <span className="font-bold text-[#1F2937] dark:text-slate-100">{formatDateLabel(activeTerm.opening_date)}</span>
            </div>
            <div className="bg-[#F6F8FA] dark:bg-slate-800 p-2.5 rounded-lg border border-[#D9E0E7] dark:border-slate-700">
              <span className="text-[10px] text-[#667085] dark:text-slate-400 font-semibold block">Closing Date</span>
              <span className="font-bold text-[#1F2937] dark:text-slate-100">{formatDateLabel(activeTerm.closing_date)}</span>
            </div>
            <div className="bg-[#F6F8FA] dark:bg-slate-800 p-2.5 rounded-lg border border-[#D9E0E7] dark:border-slate-700">
              <span className="text-[10px] text-[#667085] dark:text-slate-400 font-semibold block">Mid-Term Opening</span>
              <span className="font-bold text-[#1F2937] dark:text-slate-100">
                {activeTerm.mid_term_opening_date ? formatDateLabel(activeTerm.mid_term_opening_date) : 'N/A'}
              </span>
            </div>
            <div className="bg-[#F6F8FA] dark:bg-slate-800 p-2.5 rounded-lg border border-[#D9E0E7] dark:border-slate-700">
              <span className="text-[10px] text-[#667085] dark:text-slate-400 font-semibold block">Mid-Term Closing</span>
              <span className="font-bold text-[#1F2937] dark:text-slate-100">
                {activeTerm.mid_term_closing_date ? formatDateLabel(activeTerm.mid_term_closing_date) : 'N/A'}
              </span>
            </div>
          </div>

          <button
            onClick={() => onNavigate('academic-session')}
            className="cbe-btn-secondary text-xs font-semibold px-4 py-2 rounded-lg flex items-center space-x-1.5 self-stretch md:self-auto justify-center"
          >
            <span>Session Settings</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-[#D9E0E7] dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center space-x-2 text-xs font-semibold text-[#1F2937] dark:text-slate-200">
          <Filter className="w-4 h-4 text-[#075E42] dark:text-emerald-400" />
          <span>Filter Stats by Education Level & Grade:</span>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="flex items-center space-x-1.5">
            <label className="text-xs font-medium text-[#667085] dark:text-slate-400">Level:</label>
            <select
              value={selectedLevelFilter}
              onChange={(e) => handleLevelChange(e.target.value)}
              className="cbe-input text-xs font-semibold dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
            >
              <option value="all">All Levels (PP1 - Grade 9)</option>
              {ALL_EDUCATION_LEVELS.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {lvl}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-1.5">
            <label className="text-xs font-medium text-[#667085] dark:text-slate-400">Grade:</label>
            <select
              value={selectedGradeFilter}
              disabled={selectedLevelFilter === 'all'}
              onChange={(e) => setSelectedGradeFilter(e.target.value)}
              className="cbe-input text-xs font-semibold dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="all">
                {selectedLevelFilter === 'all' ? 'Select Level first' : 'All Grades'}
              </option>
              {availableGrades.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          {(selectedLevelFilter !== 'all' || selectedGradeFilter !== 'all') && (
            <button
              onClick={() => {
                setSelectedLevelFilter('all');
                setSelectedGradeFilter('all');
              }}
              className="text-[11px] font-semibold text-rose-700 dark:text-rose-400 hover:underline px-2 py-1"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards Grid - 5 Clean Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-[#D9E0E7] dark:border-slate-800 shadow-xs flex items-center space-x-3">
          <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 text-[#075E42] dark:text-emerald-400 rounded-lg flex-shrink-0 border border-emerald-100 dark:border-emerald-800/60">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-[#667085] dark:text-slate-400 uppercase tracking-wide">Total Students</div>
            <div className="text-xl font-bold text-[#1F2937] dark:text-slate-100 mt-0.5">{filteredStudents.length}</div>
            <div className="text-[10px] text-[#667085] dark:text-slate-400 font-medium">{filteredClasses.length} Streams Filtered</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-[#D9E0E7] dark:border-slate-800 shadow-xs flex items-center space-x-3">
          <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 text-[#075E42] dark:text-emerald-400 rounded-lg flex-shrink-0 border border-emerald-100 dark:border-emerald-800/60">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-[#667085] dark:text-slate-400 uppercase tracking-wide">Total Teachers</div>
            <div className="text-xl font-bold text-[#1F2937] dark:text-slate-100 mt-0.5">{filteredTeachers.length}</div>
            <div className="text-[10px] text-[#667085] dark:text-slate-400 font-medium">Assigned Teachers</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-[#D9E0E7] dark:border-slate-800 shadow-xs flex items-center space-x-3">
          <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 text-[#075E42] dark:text-emerald-400 rounded-lg flex-shrink-0 border border-emerald-100 dark:border-emerald-800/60">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-[#667085] dark:text-slate-400 uppercase tracking-wide">Total Classes</div>
            <div className="text-xl font-bold text-[#1F2937] dark:text-slate-100 mt-0.5">{filteredClasses.length}</div>
            <div className="text-[10px] text-[#667085] dark:text-slate-400 font-medium">Class Streams</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-[#D9E0E7] dark:border-slate-800 shadow-xs flex items-center space-x-3">
          <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 text-[#075E42] dark:text-emerald-400 rounded-lg flex-shrink-0 border border-emerald-100 dark:border-emerald-800/60">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-[#667085] dark:text-slate-400 uppercase tracking-wide">Total Subjects</div>
            <div className="text-xl font-bold text-[#1F2937] dark:text-slate-100 mt-0.5">{filteredSubjects.length}</div>
            <div className="text-[10px] text-[#667085] dark:text-slate-400 font-medium">Learning Areas</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-[#D9E0E7] dark:border-slate-800 shadow-xs flex items-center space-x-3">
          <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 text-[#075E42] dark:text-emerald-400 rounded-lg flex-shrink-0 border border-emerald-100 dark:border-emerald-800/60">
            <BookMarked className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-medium text-[#667085] dark:text-slate-400 uppercase tracking-wide">Latest Assessment</div>
            <div className="text-xs font-bold text-[#1F2937] dark:text-slate-100 mt-0.5 truncate max-w-[120px]">
              {exams[0]?.exam_name || 'No Assessment Yet'}
            </div>
            <div className="text-[10px] mt-0.5">
              <span
                className={`px-1.5 py-0.5 rounded font-semibold text-[9px] ${
                  exams[0]?.status === 'Approved'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/80 dark:text-emerald-300 dark:border-emerald-800'
                    : exams[0]?.status === 'Provisional'
                    ? 'bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/80 dark:text-amber-300 dark:border-amber-800'
                    : 'bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                }`}
              >
                {exams[0]?.status || 'Draft'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Gender Distribution & Student Distribution Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gender Distribution Card */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-[#D9E0E7] dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-[#1F2937] dark:text-slate-100 flex items-center space-x-2">
                  <Users className="w-5 h-5 text-[#075E42] dark:text-emerald-400" />
                  <span>Gender Distribution</span>
                </h2>
                <p className="text-xs text-[#667085] dark:text-slate-400">
                  Learner population breakdown by gender
                </p>
              </div>
              <span className="text-xs font-bold bg-emerald-50 dark:bg-emerald-950/80 text-[#075E42] dark:text-emerald-300 px-2.5 py-1 rounded-md border border-emerald-200 dark:border-emerald-800">
                {totalGenderLearners} Learners
              </span>
            </div>

            <ChartWrapper
              className="h-56 w-full"
              hasData={totalGenderLearners > 0}
              emptyTitle="No Learner Data Available"
              emptySubtext="Add learners to view gender distribution."
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={genderChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="count"
                  >
                    {genderChartData.map((entry, index) => (
                      <Cell key={`gender-cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: any, name: any, item: any) => [
                      `${value} (${item.payload.percentage}%)`,
                      item.payload.name,
                    ]}
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

          {/* Gender Legend & Summary Metrics */}
          {totalGenderLearners > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-4 border-t border-[#D9E0E7] dark:border-slate-800 text-xs mt-2">
              <div className="bg-[#F6F8FA] dark:bg-slate-800/80 p-2.5 rounded-lg border border-[#D9E0E7] dark:border-slate-700/80 flex items-center space-x-2.5">
                <span className="w-3.5 h-3.5 rounded-full bg-[#2563EB] shrink-0" />
                <div>
                  <span className="font-bold text-[#1F2937] dark:text-slate-200 block">Boys / Male</span>
                  <span className="text-[11px] text-[#667085] dark:text-slate-400 font-semibold">
                    {maleCount} ({totalGenderLearners > 0 ? ((maleCount / totalGenderLearners) * 100).toFixed(1) : 0}%)
                  </span>
                </div>
              </div>

              <div className="bg-[#F6F8FA] dark:bg-slate-800/80 p-2.5 rounded-lg border border-[#D9E0E7] dark:border-slate-700/80 flex items-center space-x-2.5">
                <span className="w-3.5 h-3.5 rounded-full bg-[#DC2626] shrink-0" />
                <div>
                  <span className="font-bold text-[#1F2937] dark:text-slate-200 block">Girls / Female</span>
                  <span className="text-[11px] text-[#667085] dark:text-slate-400 font-semibold">
                    {femaleCount} ({totalGenderLearners > 0 ? ((femaleCount / totalGenderLearners) * 100).toFixed(1) : 0}%)
                  </span>
                </div>
              </div>

              {unknownCount > 0 && (
                <div className="bg-[#F6F8FA] dark:bg-slate-800/80 p-2.5 rounded-lg border border-[#D9E0E7] dark:border-slate-700/80 flex items-center space-x-2.5">
                  <span className="w-3.5 h-3.5 rounded-full bg-[#6B7280] shrink-0" />
                  <div>
                    <span className="font-bold text-[#1F2937] dark:text-slate-200 block">Unspecified</span>
                    <span className="text-[11px] text-[#667085] dark:text-slate-400 font-semibold">
                      {unknownCount} ({((unknownCount / totalGenderLearners) * 100).toFixed(1)}%)
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-3 text-xs text-[#667085] dark:text-slate-400 font-medium">
              No learner gender data available.
            </div>
          )}
        </div>

        {/* Student Distribution Card */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-[#D9E0E7] dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-[#1F2937] dark:text-slate-100 flex items-center space-x-2">
                  <Building2 className="w-5 h-5 text-[#075E42] dark:text-emerald-400" />
                  <span>Student Distribution</span>
                </h2>
                <p className="text-xs text-[#667085] dark:text-slate-400">
                  Learner population per general class (aggregated streams)
                </p>
              </div>
              <span className="text-xs font-bold bg-emerald-50 dark:bg-emerald-950/80 text-[#075E42] dark:text-emerald-300 px-2.5 py-1 rounded-md border border-emerald-200 dark:border-emerald-800">
                {studentDistributionData.reduce((acc, curr) => acc + curr.count, 0)} Total
              </span>
            </div>

            <ChartWrapper
              className="h-56 w-full"
              hasData={studentDistributionData.some((d) => d.count > 0)}
              emptyTitle="No Student Data Available"
              emptySubtext="Add learners to view student distribution by class."
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={studentDistributionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="className" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94A3B8' }} />
                  <Tooltip
                    formatter={(value: any) => [`${value} Learners`, 'Population']}
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
                        key={`student-dist-cell-${index}`}
                        fill={['#075E42', '#059669', '#10B981', '#2563EB', '#3B82F6', '#D97706', '#087F5B'][index % 7]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartWrapper>
          </div>

          <div className="mt-4 pt-3 border-t border-[#D9E0E7] dark:border-slate-800 flex items-center justify-between text-xs text-[#667085] dark:text-slate-400 font-medium">
            <span>Aggregated by parent general class</span>
            <span className="font-bold text-[#1F2937] dark:text-slate-200">{studentDistributionData.length} General Classes</span>
          </div>
        </div>
      </div>

      {/* Analytics & Top Performers Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* CBE Grade Distribution Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-xl p-5 border border-[#D9E0E7] dark:border-slate-800 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-base font-bold text-[#1F2937] dark:text-slate-100">Grade Distribution Analysis</h2>
              <p className="text-xs text-[#667085] dark:text-slate-400 mt-0.5">
                Performance breakdown for <span className="font-semibold text-slate-800 dark:text-slate-200">{activeExam?.exam_name || 'Current Assessment'}</span>
              </p>
            </div>
            <div className="flex items-center space-x-3">
              {exams && exams.length > 1 && (
                <select
                  value={activeExam?.id || ''}
                  onChange={(e) => setSelectedExamId(e.target.value)}
                  className="text-xs py-1 px-2.5 rounded-lg border border-[#D9E0E7] dark:border-slate-700 bg-[#F6F8FA] dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold focus:outline-none focus:ring-1 focus:ring-[#075E42] cursor-pointer"
                  title="Select assessment"
                >
                  {exams.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.exam_name} {ex.term ? `(${ex.term})` : ''}
                    </option>
                  ))}
                </select>
              )}
              <button
                onClick={() => onNavigate('reports')}
                className="text-xs font-semibold text-[#075E42] dark:text-emerald-400 hover:underline flex items-center space-x-1"
              >
                <span>View Merit Lists</span> &rarr;
              </button>
            </div>
          </div>

          <ChartWrapper
            className="h-64 w-full"
            hasData={chartData.some(d => d.count > 0)}
            emptyTitle="No marks entered yet"
            emptySubtext="Grade distribution will appear once learner marks have been entered."
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="grade" tick={{ fontSize: 12, fill: '#94A3B8' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#94A3B8' }} />
                <Tooltip
                  formatter={(value: any, name: any, item: any) => [
                    `${value} Learners`,
                    item.payload.descriptor,
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
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartWrapper>

          {/* Legend */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 pt-4 border-t border-[#D9E0E7] dark:border-slate-800 text-xs">
            {grades.map((g, idx) => {
              const code = g.grade_code || g.grade || '';
              const min = g.minimum_score ?? g.minimum_marks ?? 0;
              const max = g.maximum_score ?? g.maximum_marks ?? 100;
              return (
                <div key={g.id} className="flex items-center space-x-2">
                  <span
                    className="w-3 h-3 rounded flex-shrink-0"
                    style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                  />
                  <div>
                    <span className="font-bold text-[#1F2937] dark:text-slate-200">{code}</span>: {min}-{max}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Performers */}
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-[#D9E0E7] dark:border-slate-800 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-4">
              <div>
                <h2 className="text-base font-bold text-[#1F2937] dark:text-slate-100 flex items-center space-x-2">
                  <Award className="w-5 h-5 text-[#075E42] dark:text-emerald-400 flex-shrink-0" />
                  <span>Top Overall Performers</span>
                </h2>
                <p className="text-xs text-[#667085] dark:text-slate-400 mt-1">
                  Assessment: <span className="font-semibold text-slate-800 dark:text-slate-200">{activeExam?.exam_name || 'No Assessment Selected'}</span>
                </p>
              </div>

              {exams && exams.length > 1 && (
                <select
                  value={activeExam?.id || ''}
                  onChange={(e) => setSelectedExamId(e.target.value)}
                  className="text-xs py-1 px-2 rounded-lg border border-[#D9E0E7] dark:border-slate-700 bg-[#F6F8FA] dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-semibold focus:outline-none focus:ring-1 focus:ring-[#075E42] cursor-pointer"
                  title="Select assessment"
                >
                  {exams.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.exam_name} {ex.term ? `(${ex.term})` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {analysis && analysis.top_performers.length > 0 ? (
              <div className="space-y-2.5">
                {analysis.top_performers.slice(0, 4).map((tp, idx) => (
                  <div
                    key={tp.student_id}
                    className="p-3 bg-[#F6F8FA] dark:bg-slate-800/70 rounded-lg border border-[#D9E0E7] dark:border-slate-700/60 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <span
                        className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                          idx === 0
                            ? 'bg-[#075E42] text-white shadow-xs'
                            : idx === 1
                            ? 'bg-[#054531] text-white shadow-xs'
                            : 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'
                        }`}
                      >
                        {tp.position && tp.position > 0 ? `#${tp.position}` : `#${idx + 1}`}
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-[#1F2937] dark:text-slate-100 truncate">{tp.student_name}</div>
                        <div className="text-xs text-[#667085] dark:text-slate-400 flex items-center space-x-1.5 flex-wrap">
                          <span>Adm: <span className="font-semibold text-slate-700 dark:text-slate-300">{tp.admission_number}</span></span>
                          {tp.class_name && (
                            <>
                              <span>•</span>
                              <span className="truncate">{tp.class_name}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-bold text-[#075E42] dark:text-emerald-400">
                        {tp.average}%
                      </div>
                      <div className="text-xs text-[#667085] dark:text-slate-400 font-medium">
                        Total Score: <span className="font-bold text-slate-900 dark:text-slate-100">{tp.total_marks}</span>
                      </div>
                      <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                        {tp.performance_level} ({tp.grade_code})
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-[#667085] dark:text-slate-400 text-xs">
                No marks compiled for top performers in {activeExam?.exam_name || 'this assessment'} yet.
              </div>
            )}
          </div>

          <button
            onClick={() => onNavigate('reports')}
            className="w-full mt-4 cbe-btn-secondary text-xs font-semibold text-center"
          >
            Generate Class Merit List
          </button>
        </div>
      </div>

      {/* Quick Action Cards Grid */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-[#D9E0E7] dark:border-slate-800 shadow-xs">
        <h2 className="text-base font-bold text-[#1F2937] dark:text-slate-100 mb-4">Admin Quick Action Panel</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <button
            onClick={() => onNavigate('students')}
            className="p-4 rounded-lg border border-[#D9E0E7] dark:border-slate-800 hover:border-[#075E42] dark:hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-slate-800/80 text-[#1F2937] dark:text-slate-200 transition flex flex-col items-center text-center space-y-2 group cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#075E42]"
          >
            <Users className="w-6 h-6 text-[#075E42] dark:text-emerald-400 transition-transform group-hover:scale-110" />
            <span className="text-xs font-semibold">Learner Roster & CSV</span>
          </button>

          <button
            onClick={() => onNavigate('teachers')}
            className="p-4 rounded-lg border border-[#D9E0E7] dark:border-slate-800 hover:border-[#075E42] dark:hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-slate-800/80 text-[#1F2937] dark:text-slate-200 transition flex flex-col items-center text-center space-y-2 group cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#075E42]"
          >
            <UserCheck className="w-6 h-6 text-[#075E42] dark:text-emerald-400 transition-transform group-hover:scale-110" />
            <span className="text-xs font-semibold">Teachers & Subjects</span>
          </button>

          <button
            onClick={() => onNavigate('exams')}
            className="p-4 rounded-lg border border-[#D9E0E7] dark:border-slate-800 hover:border-[#075E42] dark:hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-slate-800/80 text-[#1F2937] dark:text-slate-200 transition flex flex-col items-center text-center space-y-2 group cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#075E42]"
          >
            <BookMarked className="w-6 h-6 text-[#075E42] dark:text-emerald-400 transition-transform group-hover:scale-110" />
            <span className="text-xs font-semibold">Assessments</span>
          </button>

          <button
            onClick={() => onNavigate('marks-entry')}
            className="p-4 rounded-lg border border-[#D9E0E7] dark:border-slate-800 hover:border-[#075E42] dark:hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-slate-800/80 text-[#1F2937] dark:text-slate-200 transition flex flex-col items-center text-center space-y-2 group cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#075E42]"
          >
            <FileSpreadsheet className="w-6 h-6 text-[#075E42] dark:text-emerald-400 transition-transform group-hover:scale-110" />
            <span className="text-xs font-semibold">Fast Marks Entry</span>
          </button>

          <button
            onClick={() => onNavigate('provisional')}
            className="p-4 rounded-lg border border-[#D9E0E7] dark:border-slate-800 hover:border-[#075E42] dark:hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-slate-800/80 text-[#1F2937] dark:text-slate-200 transition flex flex-col items-center text-center space-y-2 group cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#075E42]"
          >
            <CheckCircle className="w-6 h-6 text-[#075E42] dark:text-emerald-400 transition-transform group-hover:scale-110" />
            <span className="text-xs font-semibold">Provisional Verify</span>
          </button>

          <button
            onClick={() => onNavigate('reports')}
            className="p-4 rounded-lg border border-[#D9E0E7] dark:border-slate-800 hover:border-[#075E42] dark:hover:border-emerald-500 hover:bg-emerald-50/50 dark:hover:bg-slate-800/80 text-[#1F2937] dark:text-slate-200 transition flex flex-col items-center text-center space-y-2 group cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#075E42]"
          >
            <Award className="w-6 h-6 text-[#075E42] dark:text-emerald-400 transition-transform group-hover:scale-110" />
            <span className="text-xs font-semibold">Report Cards</span>
          </button>
        </div>
      </div>
    </div>
  );
};
