import React, { useState, useMemo } from 'react';
import {
  TrendingUp,
  Award,
  BookOpen,
  Users,
  Building2,
  Layers,
  FileDown,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  CheckCircle2,
  ChevronRight,
  Search,
  SlidersHorizontal,
  BarChart3,
  PieChart as PieIcon,
  Sparkles,
  Trophy,
  Activity,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import { api } from "../lib/storage";
import { ChartWrapper } from './ChartWrapper';
import { canGenerateReports, getTermStatusMessage } from "../utils/termStatusUtils";
import { useAcademicSession } from "../contexts/AcademicSessionContext";

import {
  Student,
  School,
  Examination,
  ClassStream,
  Subject,
  Mark,
  Grade,
  User,
  Teacher,
  EducationLevel,
} from '../types';
import { getActiveTeacher, getAccessibleClasses, getAccessibleSubjects, getAccessibleStudents } from '../utils/rbacUtils';
import {
  calculateSchoolAnalytics,
  compareExaminations,
  LearnerPerformerItem,
} from '../services/schoolAnalyticsEngine';
import {
  exportClassRankingPDF,
  exportStreamRankingPDF,
  exportSubjectAnalysisPDF,
  exportSchoolPerformancePDF,
  exportComprehensiveAnalyticsPDF,
  exportBestLearnersPDF,
  exportExamComparisonPDF,
  exportPerformanceDeviationPDF,
} from '../services/schoolAnalyticsPdfExporter';
import { exportSubjectPerformanceAnalysisPDF } from '../services/subjectPerformancePdfExporter';

interface Props {
  school: School;
  exams: Examination[];
  students: Student[];
  classes: ClassStream[];
  subjects: Subject[];
  marks: Mark[];
  grades: Grade[];
  teachers?: Teacher[];
  currentUser?: User;
  onNavigateToTab?: (tab: any) => void;
}

type SubTab = 'overview' | 'rankings' | 'subjects' | 'top-performers' | 'comparison';

export const SchoolPerformanceAnalytics: React.FC<Props> = ({
  school,
  exams = [],
  students = [],
  classes = [],
  subjects = [],
  marks = [],
  grades = [],
  teachers = [],
  currentUser,
  onNavigateToTab,
}) => {
  const { viewingTerm: activeTermObj } = useAcademicSession();
  if (!canGenerateReports(activeTermObj.status)) {
    return (
      <div className="p-8 text-center space-y-4">
        <div className="bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-200 p-6 rounded-2xl max-w-md mx-auto border border-amber-200 dark:border-amber-800">
          <h2 className="text-lg font-bold mb-2 text-amber-900 dark:text-amber-100">Term {activeTermObj.status}</h2>
          <p className="text-sm text-amber-800 dark:text-amber-300">{getTermStatusMessage(activeTermObj.status)}</p>
          <button onClick={() => window.history.back()} className="mt-4 px-4 py-2 bg-amber-600 hover:bg-amber-700 dark:bg-amber-700 dark:hover:bg-amber-600 text-white font-bold rounded-lg">
            Return
          </button>
        </div>
      </div>
    );
  }
  const activeTeacher = getActiveTeacher(currentUser || null, teachers);
  const accessibleClasses = React.useMemo(() => getAccessibleClasses(currentUser || null, activeTeacher, classes), [currentUser, activeTeacher, classes]);
  const accessibleSubjects = React.useMemo(() => getAccessibleSubjects(currentUser || null, activeTeacher, subjects), [currentUser, activeTeacher, subjects]);
  const accessibleStudents = React.useMemo(() => getAccessibleStudents(currentUser || null, activeTeacher, students, classes), [currentUser, activeTeacher, students, classes]);

  // Educational Level state
  const [selectedLevel, setSelectedLevel] = useState<EducationLevel>('Junior School');

  // Primary exam selection
  const [selectedExamId, setSelectedExamId] = useState<string>(
    exams.length > 0 ? exams[0].id : ''
  );

  // Secondary comparison exam selection
  const [compareExamId, setCompareExamId] = useState<string>(
    exams.length > 1 ? exams[1].id : ''
  );

  const [activeSubTab, setActiveSubTab] = useState<SubTab>('overview');
  const [learnerSearchQuery, setLearnerSearchQuery] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState('all');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState('all');
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccessMsg, setExportSuccessMsg] = useState('');
  const [exportErrorMsg, setExportErrorMsg] = useState('');

  // Calculate Primary Analytics for the selected Educational Level
  const analytics = useMemo(() => {
    if (!selectedExamId) return null;
    return calculateSchoolAnalytics(
      selectedExamId,
      exams,
      accessibleStudents,
      accessibleClasses,
      accessibleSubjects,
      marks,
      grades,
      selectedLevel
    );
  }, [selectedExamId, exams, accessibleStudents, accessibleClasses, accessibleSubjects, marks, grades, selectedLevel]);

  // Calculate Comparison Analytics if 2 exams are selected
  const comparison = useMemo(() => {
    if (!selectedExamId || !compareExamId || selectedExamId === compareExamId) {
      return null;
    }
    return compareExaminations(
      selectedExamId,
      compareExamId,
      exams,
      students,
      classes,
      subjects,
      marks,
      grades,
      selectedLevel
    );
  }, [selectedExamId, compareExamId, exams, students, classes, subjects, marks, grades, selectedLevel]);

  // Helper for level badges
  const getLevelBadge = (level: string) => {
    switch (level) {
      case 'EE':
        return 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 font-semibold';
      case 'ME':
        return 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60 font-semibold';
      case 'AE':
        return 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800 font-semibold';
      case 'BE':
        return 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800 font-semibold';
      default:
        return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700';
    }
  };

  const triggerPDFExport = async (exporter: () => Promise<void>, reportName: string) => {
    try {
      setIsExporting(true);
      setExportSuccessMsg('');
      setExportErrorMsg('');
      await exporter();
      setExportSuccessMsg(`✓ PDF generated successfully.`);
      setTimeout(() => setExportSuccessMsg(''), 4000);
    } catch (err) {
      console.error('PDF export error:', err);
      setExportErrorMsg('Unable to generate the PDF report. Please try again or contact the system administrator.');
      setTimeout(() => setExportErrorMsg(''), 6000);
    } finally {
      setIsExporting(false);
    }
  };

  if (!analytics || exams.length === 0) {
    return (
      <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
        <Activity className="w-12 h-12 text-slate-400 dark:text-slate-500 mx-auto mb-3 animate-pulse" />
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">No Assessment Data Available</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
          Please create assessments and record learner marks to enable the automated School Performance Analytics & Rankings engine.
        </p>
      </div>
    );
  }

  // Charts Data Prep
  const classChartData = analytics.class_rankings.map((c) => ({
    name: c.class_name,
    'Mean Score (%)': c.mean_percentage,
    'Mean Points': c.mean_points,
  }));

  const streamChartData = analytics.stream_rankings.map((s) => ({
    name: s.full_name,
    'Mean Score (%)': s.mean_percentage,
  }));

  const subjectChartData = analytics.subject_rankings.map((sb) => ({
    name: sb.subject_code || sb.subject_name.slice(0, 8),
    fullName: sb.subject_name,
    'Mean Score (%)': sb.mean_percentage,
    'Mean Points': sb.mean_points,
  }));

  // Competency distribution data for Pie Chart
  const levelCountsMap = { EE: 0, ME: 0, AE: 0, BE: 0 };
  analytics.best_learners_school.forEach((l) => {
    if (l.overall_level in levelCountsMap) {
      levelCountsMap[l.overall_level as keyof typeof levelCountsMap]++;
    }
  });

  const pieChartData = [
    { name: 'Exceeding (EE)', value: levelCountsMap.EE, color: '#176B45' },
    { name: 'Meeting (ME)', value: levelCountsMap.ME, color: '#10B981' },
    { name: 'Approaching (AE)', value: levelCountsMap.AE, color: '#F59E0B' },
    { name: 'Below (BE)', value: levelCountsMap.BE, color: '#EF4444' },
  ].filter((item) => item.value > 0);

  // Filtered best learners list
  const filteredBestLearners = analytics.best_learners_school.filter((l) => {
    if (!l) return false;
    const q = (learnerSearchQuery || '').toLowerCase();
    const name = (l.name || '').toLowerCase();
    const adm = (l.admission_number || '').toLowerCase();
    const matchesQuery = !q || name.includes(q) || adm.includes(q);
    const matchesClass =
      selectedClassFilter === 'all' || l.class_name === selectedClassFilter;
    return matchesQuery && matchesClass;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Educational Level Section Selector (Ranks educational levels separately) */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 bg-emerald-50 dark:bg-emerald-950/60 text-[#176B45] dark:text-emerald-400 rounded-xl border border-emerald-100 dark:border-emerald-800/50">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
              Educational Level Section Filter
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Calculates rankings strictly within each curriculum level (No cross-level comparison)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSelectedLevel('Junior School')}
            className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center space-x-2 border ${
              selectedLevel === 'Junior School'
                ? 'bg-[#176B45] text-white border-[#176B45] shadow-md shadow-[#0F5132]/30 dark:bg-emerald-600 dark:border-emerald-600'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/80'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Junior School (Grades 7–9)</span>
          </button>

          <button
            onClick={() => setSelectedLevel('Upper Primary')}
            className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center space-x-2 border ${
              selectedLevel === 'Upper Primary'
                ? 'bg-[#176B45] text-white border-[#176B45] shadow-md shadow-[#0F5132]/30 dark:bg-emerald-600 dark:border-emerald-600'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/80'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Upper Primary (Grades 4–6)</span>
          </button>

          <button
            onClick={() => setSelectedLevel('Lower Primary')}
            className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center space-x-2 border ${
              selectedLevel === 'Lower Primary'
                ? 'bg-[#176B45] text-white border-[#176B45] shadow-md shadow-[#0F5132]/30 dark:bg-emerald-600 dark:border-emerald-600'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/80'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Lower Primary (Grades 1–3)</span>
          </button>

          <button
            onClick={() => setSelectedLevel('Pre-Primary')}
            className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center space-x-2 border ${
              selectedLevel === 'Pre-Primary'
                ? 'bg-[#176B45] text-white border-[#176B45] shadow-md shadow-[#0F5132]/30 dark:bg-emerald-600 dark:border-emerald-600'
                : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/80'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Pre-Primary (PP1–PP2)</span>
          </button>
        </div>
      </div>

      {/* Top Header Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-[#176B45] dark:text-emerald-400 font-bold text-xs tracking-wider uppercase mb-1">
              <Sparkles className="w-4 h-4 text-[#176B45] dark:text-emerald-400" />
              <span>{analytics.education_level_title} Analytics & Merit Standings</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
              {analytics.education_level_title} Performance Rankings
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-sm mt-1 max-w-2xl">
              Independent cohort rankings, stream analytics, subject performance, and merit lists for {analytics.education_level_title} (Max Obtainable Marks: {analytics.max_obtainable_marks}).
            </p>
          </div>

          {/* Exam Selector Dropdowns */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700/80">
              <label className="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider mb-1">
                Target Assessment
              </label>
              <select
                value={selectedExamId}
                onChange={(e) => setSelectedExamId(e.target.value)}
                className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs font-bold rounded-lg px-3 py-1.5 border border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-[#176B45] dark:focus:ring-emerald-500 focus:border-[#176B45] w-full"
              >
                {exams.map((ex) => (
                  <option key={ex.id} value={ex.id} className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100">
                    {ex.exam_name} ({ex.term} {ex.year})
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700/80">
              <label className="block text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider mb-1">
                Compare With (Optional)
              </label>
              <select
                value={compareExamId}
                onChange={(e) => setCompareExamId(e.target.value)}
                className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs font-bold rounded-lg px-3 py-1.5 border border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-[#176B45] dark:focus:ring-emerald-500 focus:border-[#176B45] w-full"
              >
                <option value="" className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100">-- No Comparison --</option>
                {exams
                  .filter((ex) => ex.id !== selectedExamId)
                  .map((ex) => (
                    <option key={ex.id} value={ex.id} className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100">
                      {ex.exam_name} ({ex.term} {ex.year})
                    </option>
                  ))}
              </select>
            </div>
          </div>
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 mt-6 pt-4 border-t border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setActiveSubTab('overview')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center space-x-2 ${
              activeSubTab === 'overview'
                ? 'bg-[#176B45] dark:bg-emerald-600 text-white shadow-sm shadow-[#0F5132]/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Executive Dashboard</span>
          </button>

          <button
            onClick={() => setActiveSubTab('rankings')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center space-x-2 ${
              activeSubTab === 'rankings'
                ? 'bg-[#176B45] dark:bg-emerald-600 text-white shadow-sm shadow-[#0F5132]/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Class & Stream Rankings</span>
          </button>

          <button
            onClick={() => setActiveSubTab('subjects')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center space-x-2 ${
              activeSubTab === 'subjects'
                ? 'bg-[#176B45] dark:bg-emerald-600 text-white shadow-sm shadow-[#0F5132]/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Subject Analysis</span>
          </button>

          <button
            onClick={() => setActiveSubTab('top-performers')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center space-x-2 ${
              activeSubTab === 'top-performers'
                ? 'bg-[#176B45] dark:bg-emerald-600 text-white shadow-sm shadow-[#0F5132]/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <Trophy className="w-4 h-4" />
            <span>Top Performers & Best Learners</span>
          </button>

          <button
            onClick={() => setActiveSubTab('comparison')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center space-x-2 ${
              activeSubTab === 'comparison'
                ? 'bg-[#176B45] dark:bg-emerald-600 text-white shadow-sm shadow-[#0F5132]/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Assessment Comparisons & Trends</span>
          </button>

          {/* Comprehensive PDF Download */}
          <div className="ml-auto relative">
            <button
              disabled={isExporting}
              onClick={() => triggerPDFExport(() => exportComprehensiveAnalyticsPDF(analytics, comparison, school), 'Comprehensive Analytics Report')}
              className={`px-4 py-2 text-xs font-bold rounded-xl shadow-sm transition-all flex items-center space-x-2 ${
                isExporting 
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed' 
                  : 'bg-[#176B45] hover:bg-[#0F5132] dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white'
              }`}
            >
              {isExporting ? (
                <>
                  <Activity className="w-4 h-4 animate-spin" />
                  <span>Generating {analytics.education_level_title} Analytics Report...</span>
                </>
              ) : (
                <>
                  <FileDown className="w-4 h-4" />
                  <span>Download PDF Reports</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {exportSuccessMsg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/80 text-emerald-800 dark:text-emerald-200 rounded-xl text-xs font-semibold flex items-center space-x-2 animate-fade-in mb-4">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>{exportSuccessMsg}</span>
        </div>
      )}
      
      {exportErrorMsg && (
        <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/80 text-red-800 dark:text-red-200 rounded-xl text-xs font-semibold flex items-center space-x-2 animate-fade-in mb-4">
          <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
          <span>{exportErrorMsg}</span>
        </div>
      )}

      {/* ==================== SUB-TAB 1: EXECUTIVE DASHBOARD ==================== */}
      {activeSubTab === 'overview' && (
        <div className="space-y-6">
          {/* Summary Metric Cards (Item 11 in Prompt) */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">Level Mean Marks</span>
              <div className="text-xl font-black text-slate-900 dark:text-slate-100 mt-1">
                {analytics.overall_school_mean.toFixed(2)} <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">/ {analytics.max_obtainable_marks}</span>
              </div>
              <div className="text-xs font-semibold text-[#176B45] dark:text-emerald-400 mt-0.5">
                {(analytics.overall_school_mean_percentage ?? 0).toFixed(2)}% • {analytics.overall_school_level}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">Mean Points</span>
              <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
                {analytics.overall_school_mean_points.toFixed(2)}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Out of 8.0 Points</div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">Assessed Learners</span>
              <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
                {analytics.total_students_assessed}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Sat Assessment</div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">Classes / Streams</span>
              <div className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-1">
                {analytics.total_classes_count} / {analytics.total_streams_count}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Active Cohorts</div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm col-span-2 sm:col-span-1">
              <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">Top Class</span>
              <div className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1 truncate">
                {analytics.highest_performing_class}
              </div>
              <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">Rank #1</div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm col-span-2 sm:col-span-1">
              <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">Top Stream</span>
              <div className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-1 truncate">
                {analytics.highest_performing_stream}
              </div>
              <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">Rank #1</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">Highest Subject</span>
              <div className="text-base font-bold text-emerald-700 dark:text-emerald-400 mt-1">
                {analytics.highest_performing_subject}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Top School Learning Area</div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">Lowest Subject</span>
              <div className="text-base font-bold text-rose-700 dark:text-rose-400 mt-1">
                {analytics.lowest_performing_subject}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Needs Intervention</div>
            </div>

            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">Overall Best Learner</span>
              <div className="text-base font-bold text-[#176B45] dark:text-emerald-400 mt-1 truncate">
                {analytics.best_learner ? `${analytics.best_learner.name} (${analytics.best_learner.average_marks.toFixed(1)}%)` : '-'}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {analytics.best_learner ? `${analytics.best_learner.class_name} ${analytics.best_learner.stream}` : '-'}
              </div>
            </div>
          </div>

          {/* Visual Analytics Charts (Item 12 in Prompt) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Class Mean Bar Chart */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center space-x-2">
                <Building2 className="w-4 h-4 text-[#176B45] dark:text-emerald-400" />
                <span>Class Mean Performance Comparison (%)</span>
              </h3>
              <ChartWrapper className="h-64 w-full" hasData={classChartData.some(d => d['Mean Score (%)'] > 0)}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={classChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-slate-200 dark:stroke-slate-800" />
                    <XAxis dataKey="name" stroke="#64748B" fontSize={12} />
                    <YAxis domain={[0, 100]} stroke="#64748B" fontSize={12} />
                    <Tooltip wrapperClassName="dark:[&_.recharts-default-tooltip]:!bg-slate-900 dark:[&_.recharts-default-tooltip]:!border-slate-800 dark:[&_.recharts-default-tooltip]:!text-slate-100" />
                    <Bar dataKey="Mean Score (%)" fill="#176B45" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartWrapper>
            </div>

            {/* Competency Distribution Pie Chart */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center space-x-2">
                <PieIcon className="w-4 h-4 text-[#176B45] dark:text-emerald-400" />
                <span>Competency Level Distribution</span>
              </h3>
              <ChartWrapper className="h-64 w-full" hasData={pieChartData.some(d => d.value > 0)}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieChartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                    >
                      {pieChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip wrapperClassName="dark:[&_.recharts-default-tooltip]:!bg-slate-900 dark:[&_.recharts-default-tooltip]:!border-slate-800 dark:[&_.recharts-default-tooltip]:!text-slate-100" />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </ChartWrapper>
            </div>
          </div>

          {/* Subject Performance Bar Chart */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center space-x-2">
              <BookOpen className="w-4 h-4 text-[#176B45] dark:text-emerald-400" />
              <span>Subject Performance Standings across School (%)</span>
            </h3>
            <ChartWrapper className="h-72 w-full" hasData={subjectChartData.some(d => d['Mean Score (%)'] > 0)}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={subjectChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-slate-200 dark:stroke-slate-800" />
                  <XAxis dataKey="name" stroke="#64748B" fontSize={11} />
                  <YAxis domain={[0, 100]} stroke="#64748B" fontSize={12} />
                  <Tooltip wrapperClassName="dark:[&_.recharts-default-tooltip]:!bg-slate-900 dark:[&_.recharts-default-tooltip]:!border-slate-800 dark:[&_.recharts-default-tooltip]:!text-slate-100" />
                  <Bar dataKey="Mean Score (%)" fill="#176B45" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartWrapper>
          </div>
        </div>
      )}

      {/* ==================== SUB-TAB 2: CLASS & STREAM RANKINGS ==================== */}
      {activeSubTab === 'rankings' && (
        <div className="space-y-8">
          {/* Section 1: Class Ranking Table (Item 1 in Prompt) */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">1. Overall Class Ranking</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Ranked by overall mean performance across all subjects sitted.</p>
              </div>
              <button
                onClick={() => triggerPDFExport(() => exportClassRankingPDF(analytics, school), 'Class Ranking Report')}
                className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/60 text-[#176B45] dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors border border-emerald-200 dark:border-emerald-800/80"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>Export Class PDF</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3 text-center w-12">Rank</th>
                    <th className="p-3">Class Name</th>
                    <th className="p-3 text-center">Learners</th>
                    <th className="p-3 text-right">Total Marks</th>
                    <th className="p-3 text-right">Mean Marks (Max)</th>
                    <th className="p-3 text-right">Mean %</th>
                    <th className="p-3 text-right">Mean Points</th>
                    <th className="p-3 text-center">Overall Level</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                  {analytics.class_rankings.map((c) => (
                    <tr key={c.class_name} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="p-3 text-center font-black text-slate-900 dark:text-slate-100 bg-slate-50/50 dark:bg-slate-800/30">
                        #{c.rank}
                      </td>
                      <td className="p-3 font-bold text-slate-900 dark:text-slate-100">{c.class_name}</td>
                      <td className="p-3 text-center">{c.learners_count}</td>
                      <td className="p-3 text-right">{c.total_marks.toLocaleString()}</td>
                      <td className="p-3 text-right font-bold text-slate-900 dark:text-slate-100">
                        {c.mean_marks.toFixed(2)} <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">/ {c.max_obtainable_marks}</span>
                      </td>
                      <td className="p-3 text-right font-bold text-[#176B45] dark:text-emerald-400">{c.mean_percentage.toFixed(2)}%</td>
                      <td className="p-3 text-right font-bold text-slate-900 dark:text-slate-100">{c.mean_points.toFixed(2)}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] border ${getLevelBadge(c.overall_level)}`}>
                          {c.overall_level} ({c.grade_code})
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 2: Stream Ranking Table (Item 2 in Prompt) */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">2. Stream Performance Ranking</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Rankings for all individual streams within each class cohort.</p>
              </div>
              <button
                onClick={() => triggerPDFExport(() => exportStreamRankingPDF(analytics, school), 'Stream Ranking Report')}
                className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/60 text-[#176B45] dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors border border-emerald-200 dark:border-emerald-800/80"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>Export Stream PDF</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3 text-center w-12">Rank</th>
                    <th className="p-3">Stream Name</th>
                    <th className="p-3">Grade Class</th>
                    <th className="p-3 text-center">Learners</th>
                    <th className="p-3 text-right">Total Marks</th>
                    <th className="p-3 text-right">Mean Marks (Max)</th>
                    <th className="p-3 text-right">Mean %</th>
                    <th className="p-3 text-right">Mean Points</th>
                    <th className="p-3 text-center">Overall Level</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                  {analytics.stream_rankings.map((st) => (
                    <tr key={st.full_name} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="p-3 text-center font-black text-slate-900 dark:text-slate-100 bg-slate-50/50 dark:bg-slate-800/30">
                        #{st.rank}
                      </td>
                      <td className="p-3 font-bold text-slate-900 dark:text-slate-100">{st.full_name}</td>
                      <td className="p-3 text-slate-600 dark:text-slate-400">{st.class_name}</td>
                      <td className="p-3 text-center">{st.learners_count}</td>
                      <td className="p-3 text-right">{st.total_marks.toLocaleString()}</td>
                      <td className="p-3 text-right font-bold text-slate-900 dark:text-slate-100">
                        {st.mean_marks.toFixed(2)} <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">/ {st.max_obtainable_marks}</span>
                      </td>
                      <td className="p-3 text-right font-bold text-[#176B45] dark:text-emerald-400">{st.mean_percentage.toFixed(2)}%</td>
                      <td className="p-3 text-right font-bold text-slate-900 dark:text-slate-100">{st.mean_points.toFixed(2)}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] border ${getLevelBadge(st.overall_level)}`}>
                          {st.overall_level} ({st.grade_code})
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================== SUB-TAB 3: SUBJECT ANALYSIS ==================== */}
      {activeSubTab === 'subjects' && (
        <div className="space-y-8">
          {/* Section 3: Subject Performance Ranking (Item 3 in Prompt) */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="p-5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">3. School-Wide Subject Performance Ranking</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Learning areas ranked from highest performing to lowest performing.</p>
              </div>
              <button
                onClick={() => triggerPDFExport(() => exportSubjectAnalysisPDF(analytics, school), 'Subject Analysis Report')}
                className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/60 text-[#176B45] dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors border border-emerald-200 dark:border-emerald-800/80"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>Export Subject PDF</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3 text-center w-12">Rank</th>
                    <th className="p-3">Subject Name</th>
                    <th className="p-3 text-center">Code</th>
                    <th className="p-3 text-center">Category</th>
                    <th className="p-3 text-center">Total Candidates</th>
                    <th className="p-3 text-right">Mean Marks</th>
                    <th className="p-3 text-right">Mean %</th>
                    <th className="p-3 text-right">Mean Points</th>
                    <th className="p-3 text-center">Overall Level</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                  {analytics.subject_rankings.map((sb) => (
                    <tr key={sb.subject_id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="p-3 text-center font-black text-slate-900 dark:text-slate-100 bg-slate-50/50 dark:bg-slate-800/30">
                        #{sb.rank}
                      </td>
                      <td className="p-3 font-bold text-slate-900 dark:text-slate-100">{sb.subject_name}</td>
                      <td className="p-3 text-center font-mono text-slate-500 dark:text-slate-400">{sb.subject_code}</td>
                      <td className="p-3 text-center">{sb.category}</td>
                      <td className="p-3 text-center">{sb.total_candidates}</td>
                      <td className="p-3 text-right font-bold text-slate-900 dark:text-slate-100">{sb.mean_marks.toFixed(2)}</td>
                      <td className="p-3 text-right font-bold text-[#176B45] dark:text-emerald-400">{sb.mean_percentage.toFixed(2)}%</td>
                      <td className="p-3 text-right font-bold text-slate-900 dark:text-slate-100">{sb.mean_points.toFixed(2)}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] border ${getLevelBadge(sb.overall_level)}`}>
                          {sb.overall_level} ({sb.grade_code})
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 4: Class Subject Analysis (Item 4 in Prompt) */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">4. Class Subject Breakdown Analysis</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Subject performance means, points, and levels categorized by class cohort.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {analytics.class_subject_analysis.map((cAnal) => (
                <div key={cAnal.class_name} className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700/80">
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">{cAnal.class_name}</h3>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{cAnal.subjects.length} Subjects</span>
                  </div>

                  <div className="space-y-2">
                    {cAnal.subjects.map((sb) => (
                      <div key={sb.subject_id} className="flex items-center justify-between text-xs bg-white dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-2xs">
                        <div>
                          <div className="font-bold text-slate-800 dark:text-slate-200">{sb.subject_name}</div>
                          <div className="text-[10px] text-slate-400 dark:text-slate-500">{sb.candidates_count} candidates</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-slate-900 dark:text-slate-100">{sb.mean_marks.toFixed(1)} marks</div>
                          <div className="text-[10px] font-semibold text-[#176B45] dark:text-emerald-400">
                            {sb.overall_level} ({sb.mean_points.toFixed(1)} pts)
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ==================== SUB-TAB 4: TOP PERFORMERS & BEST LEARNERS ==================== */}
      {activeSubTab === 'top-performers' && (
        <div className="space-y-8">
          {/* Section 5 & 6: Best 3 Learners per Stream & Class (Items 5 & 6 in Prompt) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Best 3 Per Stream */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                <span>5. Best 3 Learners Per Stream</span>
              </h3>

              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                {Object.entries(analytics.best_three_per_stream).map(([stName, learners]) => (
                  <div key={stName} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3.5 border border-slate-200 dark:border-slate-800">
                    <div className="font-bold text-slate-900 dark:text-slate-100 text-xs mb-2 border-b border-slate-200 dark:border-slate-700/80 pb-1 flex justify-between">
                      <span>{stName}</span>
                      <span className="text-slate-400 dark:text-slate-500 font-normal">Top 3 Standings</span>
                    </div>

                    <div className="space-y-1.5">
                      {(learners as LearnerPerformerItem[]).map((l) => (
                        <div key={l.student_id} className="flex items-center justify-between text-xs bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                          <div className="flex items-center space-x-2">
                            <span className="w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 font-bold text-[10px] flex items-center justify-center border border-amber-200 dark:border-amber-800">
                              #{l.rank}
                            </span>
                            <div>
                              <div className="font-bold text-slate-900 dark:text-slate-100">{l.name}</div>
                              <div className="text-[10px] text-slate-400 dark:text-slate-500">Adm: {l.admission_number}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-slate-900 dark:text-slate-100">{l.total_marks} marks</div>
                            <div className="text-[10px] font-semibold text-[#176B45] dark:text-emerald-400">
                              {l.average_marks.toFixed(1)}% • {l.overall_level}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Best 3 Per Class */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                <Award className="w-5 h-5 text-[#176B45] dark:text-emerald-400" />
                <span>6. Best 3 Learners Per Class</span>
              </h3>

              <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                {Object.entries(analytics.best_three_per_class).map(([cName, learners]) => (
                  <div key={cName} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3.5 border border-slate-200 dark:border-slate-800">
                    <div className="font-bold text-slate-900 dark:text-slate-100 text-xs mb-2 border-b border-slate-200 dark:border-slate-700/80 pb-1 flex justify-between">
                      <span>{cName} (All Streams)</span>
                      <span className="text-slate-400 dark:text-slate-500 font-normal">Top 3 Standings</span>
                    </div>

                    <div className="space-y-1.5">
                      {(learners as LearnerPerformerItem[]).map((l) => (
                        <div key={l.student_id} className="flex items-center justify-between text-xs bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                          <div className="flex items-center space-x-2">
                            <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-[#176B45] dark:text-emerald-300 font-bold text-[10px] flex items-center justify-center border border-emerald-200 dark:border-emerald-800">
                              #{l.rank}
                            </span>
                            <div>
                              <div className="font-bold text-slate-900 dark:text-slate-100">{l.name}</div>
                              <div className="text-[10px] text-slate-400 dark:text-slate-500">Stream: {l.stream} • Adm: {l.admission_number}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-slate-900 dark:text-slate-100">{l.total_marks} marks</div>
                            <div className="text-[10px] font-semibold text-[#176B45] dark:text-emerald-400">
                              {l.average_marks.toFixed(1)}% • {l.overall_level}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Section 7: Best Learners in Entire School Table (Item 7 in Prompt) */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden space-y-4">
            <div className="p-5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">7. School-Wide Overall Learner Standings</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Ranked across all assessed learners in the entire school for {analytics.exam.exam_name}.</p>
              </div>

              {/* Filters & Controls */}
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search name or adm..."
                    value={learnerSearchQuery}
                    onChange={(e) => setLearnerSearchQuery(e.target.value)}
                    className="pl-9 pr-3 py-1.5 text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#176B45] dark:focus:ring-emerald-500 w-48"
                  />
                </div>

                <select
                  value={selectedClassFilter}
                  onChange={(e) => setSelectedClassFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#176B45] dark:focus:ring-emerald-500"
                >
                  <option value="all" className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100">All Classes</option>
                  {analytics.class_rankings.map((c) => (
                    <option key={c.class_name} value={c.class_name} className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100">
                      {c.class_name}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => triggerPDFExport(() => exportBestLearnersPDF(analytics, school), 'Best Learners Report')}
                  className="px-3 py-1.5 bg-[#176B45] hover:bg-[#0F5132] dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 shadow-sm"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span>Export PDF</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px] sticky top-0 z-10">
                  <tr>
                    <th className="p-3 text-center w-12">Overall Pos</th>
                    <th className="p-3">Learner Name</th>
                    <th className="p-3 text-center">Adm No</th>
                    <th className="p-3">Class</th>
                    <th className="p-3">Stream</th>
                    <th className="p-3 text-right">Total Marks</th>
                    <th className="p-3 text-right">Mean %</th>
                    <th className="p-3 text-right">Mean Points</th>
                    <th className="p-3 text-center">Overall Level</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                  {filteredBestLearners.map((l) => (
                    <tr key={l.student_id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="p-3 text-center font-black text-slate-900 dark:text-slate-100 bg-slate-50/50 dark:bg-slate-800/30">
                        #{l.rank}
                      </td>
                      <td className="p-3 font-bold text-slate-900 dark:text-slate-100">{l.name}</td>
                      <td className="p-3 text-center font-mono text-slate-500 dark:text-slate-400">{l.admission_number}</td>
                      <td className="p-3">{l.class_name}</td>
                      <td className="p-3 text-slate-600 dark:text-slate-400">{l.stream || '-'}</td>
                      <td className="p-3 text-right font-bold text-slate-900 dark:text-slate-100">{l.total_marks}</td>
                      <td className="p-3 text-right font-bold text-[#176B45] dark:text-emerald-400">{l.average_marks.toFixed(2)}%</td>
                      <td className="p-3 text-right font-bold text-slate-900 dark:text-slate-100">{l.average_points.toFixed(2)}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] border ${getLevelBadge(l.overall_level)}`}>
                          {l.overall_level} ({l.grade_code})
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 8: Best Subject Performers (Top 10 per Subject - Item 8 in Prompt) */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">8. Best Subject Performers (Top 10 per Learning Area)</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Top 10 highest-scoring learners in each subject across the entire school cohort.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {analytics.best_subject_performers.map((sbTop) => (
                <div key={sbTop.subject_id} className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700/80 pb-2">
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 text-xs">{sbTop.subject_name}</h3>
                    <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">{sbTop.subject_code}</span>
                  </div>

                  <div className="space-y-1.5">
                    {sbTop.top_learners.map((l) => (
                      <div key={l.student_id} className="flex items-center justify-between text-xs bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                        <div className="flex items-center space-x-2 truncate">
                          <span className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-[9px] flex items-center justify-center">
                            {l.rank}
                          </span>
                          <div className="truncate">
                            <div className="font-bold text-slate-800 dark:text-slate-200 truncate">{l.name}</div>
                            <div className="text-[9px] text-slate-400 dark:text-slate-500">{l.class_name} {l.stream}</div>
                          </div>
                        </div>
                        <div className="text-right font-bold text-slate-900 dark:text-slate-100">
                          {l.marks} <span className="text-[10px] text-[#176B45] dark:text-emerald-400 font-normal">({l.grade_code})</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ==================== SUB-TAB 5: EXAM COMPARISONS & DEVIATIONS ==================== */}
      {activeSubTab === 'comparison' && (
        <div className="space-y-8">
          {!comparison ? (
            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <SlidersHorizontal className="w-10 h-10 text-slate-400 dark:text-slate-500 mx-auto mb-2" />
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">Select Two Examinations To Compare</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
                Please pick a primary examination and a secondary comparison examination in the top banner header above to calculate mean differences, % changes, and performance trend deviations.
              </p>
            </div>
          ) : (
            <>
              {/* Section 9 & 10: Comparison Summary Cards & Deviations (Items 9 & 10 in Prompt) */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">School Mean Difference</span>
                  <div className={`text-2xl font-black mt-1 ${comparison.school_deviation.diff_mean >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {comparison.school_deviation.diff_mean > 0 ? '+' : ''}{comparison.school_deviation.diff_mean.toFixed(2)}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {comparison.school_deviation.percentage_change.toFixed(2)}% change
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">Most Improved Class</span>
                  <div className="text-base font-bold text-slate-900 dark:text-slate-100 mt-1 truncate">
                    {comparison.most_improved_class}
                  </div>
                  <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">Highest Positive Gain</div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">Most Improved Stream</span>
                  <div className="text-base font-bold text-slate-900 dark:text-slate-100 mt-1 truncate">
                    {comparison.most_improved_stream}
                  </div>
                  <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">Highest Positive Gain</div>
                </div>

                <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 tracking-wider">Most Improved Learner</span>
                  <div className="text-base font-bold text-slate-900 dark:text-slate-100 mt-1 truncate">
                    {comparison.most_improved_learner}
                  </div>
                  <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">Highest Mark Gain</div>
                </div>
              </div>

              {/* Class Deviations Table */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="p-5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Class Performance Comparison & Deviations</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Comparing {comparison.examA.exam_name} (Current) vs {comparison.examB.exam_name} (Previous).
                    </p>
                  </div>
                  <button
                    onClick={() => triggerPDFExport(() => exportExamComparisonPDF(comparison, school), 'Exam Comparison Report')}
                    className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg text-xs font-semibold flex items-center space-x-1.5 border border-blue-200 dark:border-blue-800/80"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    <span>Export PDF</span>
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="p-3">Class Name</th>
                        <th className="p-3 text-right">Current Mean</th>
                        <th className="p-3 text-right">Previous Mean</th>
                        <th className="p-3 text-right">Mean Difference</th>
                        <th className="p-3 text-right">% Change</th>
                        <th className="p-3 text-right">Points Diff</th>
                        <th className="p-3 text-center">Level Change</th>
                        <th className="p-3 text-center">Trend</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                      {comparison.class_deviations.map((d) => (
                        <tr key={d.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="p-3 font-bold text-slate-900 dark:text-slate-100">{d.name}</td>
                          <td className="p-3 text-right font-bold text-slate-900 dark:text-slate-100">{d.current_mean.toFixed(2)}</td>
                          <td className="p-3 text-right text-slate-600 dark:text-slate-400">{d.previous_mean.toFixed(2)}</td>
                          <td className={`p-3 text-right font-bold ${d.diff_mean > 0 ? 'text-emerald-600 dark:text-emerald-400' : d.diff_mean < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-slate-400'}`}>
                            {d.diff_mean > 0 ? '+' : ''}{d.diff_mean.toFixed(2)}
                          </td>
                          <td className={`p-3 text-right font-bold ${d.percentage_change > 0 ? 'text-emerald-600 dark:text-emerald-400' : d.percentage_change < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-slate-400'}`}>
                            {d.percentage_change > 0 ? '+' : ''}{d.percentage_change.toFixed(2)}%
                          </td>
                          <td className="p-3 text-right font-bold text-slate-900 dark:text-slate-100">
                            {d.diff_points > 0 ? '+' : ''}{d.diff_points.toFixed(2)}
                          </td>
                          <td className="p-3 text-center font-bold text-slate-800 dark:text-slate-200">
                            {d.previous_level} → {d.current_level}
                          </td>
                          <td className="p-3 text-center font-bold">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] ${d.trend.includes('Improved') ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' : d.trend.includes('Declined') ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'}`}>
                              {d.trend}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Subject Deviations Table */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="p-5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Subject Performance Deviations & Trends</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Tracking gains and declines across learning areas.</p>
                  </div>
                  <button
                    onClick={() => triggerPDFExport(() => exportPerformanceDeviationPDF(comparison, school), 'Performance Deviation Report')}
                    className="px-3 py-1.5 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg text-xs font-semibold flex items-center space-x-1.5 border border-blue-200 dark:border-blue-800/80"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    <span>Export PDF</span>
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="p-3">Subject</th>
                        <th className="p-3 text-right">Current Mean %</th>
                        <th className="p-3 text-right">Previous Mean %</th>
                        <th className="p-3 text-right">Difference %</th>
                        <th className="p-3 text-right">% Change</th>
                        <th className="p-3 text-center">Level Change</th>
                        <th className="p-3 text-center">Trend</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                      {comparison.subject_deviations.map((d) => (
                        <tr key={d.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="p-3 font-bold text-slate-900 dark:text-slate-100">{d.name}</td>
                          <td className="p-3 text-right font-bold text-slate-900 dark:text-slate-100">{d.current_mean.toFixed(2)}%</td>
                          <td className="p-3 text-right text-slate-600 dark:text-slate-400">{d.previous_mean.toFixed(2)}%</td>
                          <td className={`p-3 text-right font-bold ${d.diff_mean > 0 ? 'text-emerald-600 dark:text-emerald-400' : d.diff_mean < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-slate-400'}`}>
                            {d.diff_mean > 0 ? '+' : ''}{d.diff_mean.toFixed(2)}%
                          </td>
                          <td className={`p-3 text-right font-bold ${d.percentage_change > 0 ? 'text-emerald-600 dark:text-emerald-400' : d.percentage_change < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-slate-400'}`}>
                            {d.percentage_change > 0 ? '+' : ''}{d.percentage_change.toFixed(2)}%
                          </td>
                          <td className="p-3 text-center font-bold text-slate-800 dark:text-slate-200">
                            {d.previous_level} → {d.current_level}
                          </td>
                          <td className="p-3 text-center font-bold">
                            <span className={`px-2 py-0.5 rounded-md text-[10px] ${d.trend.includes('Improved') ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' : d.trend.includes('Declined') ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'}`}>
                              {d.trend}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
