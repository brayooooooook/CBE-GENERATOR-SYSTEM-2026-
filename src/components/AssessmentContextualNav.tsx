import React from 'react';
import {
  BookMarked,
  FileSpreadsheet,
  BarChart3,
  ShieldCheck,
  CheckSquare,
  FileBarChart,
  ChevronRight,
} from 'lucide-react';
import { Role } from '../types';
import { TabType } from './Sidebar';

interface AssessmentContextualNavProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  userRole: Role;
}

interface AssessmentNavItem {
  id: TabType;
  label: string;
  description: string;
  icon: React.ReactNode;
}

export const AssessmentContextualNav: React.FC<AssessmentContextualNavProps> = ({
  activeTab,
  onSelectTab,
  userRole,
}) => {
  const getNavItems = (): AssessmentNavItem[] => {
    if (userRole === 'admin') {
      return [
        {
          id: 'exams',
          label: 'Assessment Setup',
          description: 'Create and configure assessments',
          icon: <BookMarked className="w-4 h-4 shrink-0" />,
        },
        {
          id: 'marks-entry',
          label: 'Marks Entry',
          description: 'Enter and manage learner marks',
          icon: <FileSpreadsheet className="w-4 h-4 shrink-0" />,
        },
        {
          id: 'marks-monitoring',
          label: 'Marks Monitoring',
          description: 'Monitor assessment completion',
          icon: <BarChart3 className="w-4 h-4 shrink-0" />,
        },
        {
          id: 'exam-validation',
          label: 'Analysis & Validation',
          description: 'Analyse and validate assessment results',
          icon: <ShieldCheck className="w-4 h-4 shrink-0" />,
        },
        {
          id: 'provisional',
          label: 'Provisional Results',
          description: 'Review learner results before approval',
          icon: <CheckSquare className="w-4 h-4 shrink-0" />,
        },
        {
          id: 'results-approval',
          label: 'Results Approval',
          description: 'Review, approve and lock results',
          icon: <ShieldCheck className="w-4 h-4 shrink-0" />,
        },
        {
          id: 'reports',
          label: 'Reports & Merit Lists',
          description: 'Generate reports and merit lists',
          icon: <FileBarChart className="w-4 h-4 shrink-0" />,
        },
      ];
    }

    if (userRole === 'class_teacher') {
      return [
        {
          id: 'marks-entry',
          label: 'Enter Marks',
          description: 'Enter and manage learner marks',
          icon: <FileSpreadsheet className="w-4 h-4 shrink-0" />,
        },
        {
          id: 'class-marks-monitoring',
          label: 'Class Marks Monitoring',
          description: 'Monitor class marks completion',
          icon: <BarChart3 className="w-4 h-4 shrink-0" />,
        },
        {
          id: 'provisional',
          label: 'Provisional Results',
          description: 'Review learner results before approval',
          icon: <CheckSquare className="w-4 h-4 shrink-0" />,
        },
        {
          id: 'results-approval',
          label: 'Results Approval',
          description: 'Review, approve and lock results',
          icon: <ShieldCheck className="w-4 h-4 shrink-0" />,
        },
        {
          id: 'reports',
          label: 'Reports & Merit Lists',
          description: 'Generate reports and merit lists',
          icon: <FileBarChart className="w-4 h-4 shrink-0" />,
        },
      ];
    }

    // subject_teacher
    return [
      {
        id: 'marks-entry',
        label: 'Enter Marks',
        description: 'Enter learner marks for assigned subjects',
        icon: <FileSpreadsheet className="w-4 h-4 shrink-0" />,
      },
      {
        id: 'reports',
        label: 'Subject Performance',
        description: 'Generate reports and view performance',
        icon: <FileBarChart className="w-4 h-4 shrink-0" />,
      },
    ];
  };

  const navItems = getNavItems();

  return (
    <nav
      id="assessment-summary-nav"
      aria-label="Assessment Navigation Flow"
      className="bg-white dark:bg-slate-900 rounded-xl p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-xs mb-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-[#176B45] dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/40">
            <BookMarked className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-slate-100 tracking-tight leading-none">
              Assessments
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-none">
              Manage the complete assessment flow
            </p>
          </div>
        </div>
      </div>

      {/* Grid / List of Assessment Navigation Items */}
      <div
        role="tablist"
        aria-label="Assessment Flow Steps"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-2.5"
      >
        {navItems.map((item) => {
          const isActive = activeTab === item.id || (item.id === 'results-approval' && activeTab === 'stream-approval');
          return (
            <button
              key={item.id}
              id={`assessment-nav-${item.id}`}
              role="tab"
              aria-selected={isActive}
              tabIndex={0}
              onClick={() => onSelectTab(item.id)}
              className={`group text-left p-3 rounded-lg border transition-all duration-150 flex items-center justify-between cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#176B45]/30 dark:focus:ring-emerald-500/30 ${
                isActive
                  ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-500/60 dark:border-emerald-600/70 shadow-xs'
                  : 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                <div
                  className={`p-2 rounded-lg shrink-0 transition-colors ${
                    isActive
                      ? 'bg-[#176B45] text-white dark:bg-emerald-600 shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200/70 dark:border-slate-700/60 group-hover:text-slate-900 dark:group-hover:text-slate-200 group-hover:border-slate-300'
                  }`}
                >
                  {item.icon}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center space-x-1.5">
                    <span
                      className={`text-xs font-bold truncate block ${
                        isActive
                          ? 'text-emerald-950 dark:text-emerald-200'
                          : 'text-slate-800 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white'
                      }`}
                    >
                      {item.label}
                    </span>
                    {isActive && (
                      <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider rounded bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700/60">
                        Active
                      </span>
                    )}
                  </div>
                  <p
                    className={`text-[11px] truncate leading-tight mt-0.5 ${
                      isActive
                        ? 'text-emerald-800/80 dark:text-emerald-300/80'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {item.description}
                  </p>
                </div>
              </div>

              <ChevronRight
                className={`w-4 h-4 shrink-0 transition-transform duration-150 ${
                  isActive
                    ? 'text-[#176B45] dark:text-emerald-400 translate-x-0.5'
                    : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 group-hover:translate-x-0.5'
                }`}
              />
            </button>
          );
        })}
      </div>
    </nav>
  );
};
