import React from 'react';
import { School, CalendarDays, Users, BookMarked, FileBarChart, Shield, Info, Database, Lock, ChevronRight, Sun, Moon, Monitor, Award } from 'lucide-react';
import { TabType } from './Sidebar';
import { useTheme } from '../contexts/ThemeContext';

interface SystemSettingsPageProps {
  onNavigate: (tab: TabType) => void;
}

export const SystemSettingsPage: React.FC<SystemSettingsPageProps> = ({ onNavigate }) => {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-6">
      {/* Page Header */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs flex items-center space-x-3.5 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-[#054531] text-emerald-100 flex items-center justify-center shrink-0 shadow-2xs">
          <Shield className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Administrator Settings</h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Manage school preferences, roles, and configurations.</p>
        </div>
      </div>

      {/* SECTION: APPEARANCE */}
      <section className="space-y-2.5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
          Appearance
        </h2>
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-3">
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm sm:text-base leading-snug">
              System Appearance
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Choose how the system looks across your workspace.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <button
              type="button"
              onClick={() => setTheme('light')}
              className={`flex items-center space-x-2.5 sm:space-x-3 p-3 sm:p-3.5 rounded-xl border transition-all cursor-pointer text-left min-w-0 ${
                theme === 'light'
                  ? 'border-emerald-600 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-600/20 font-semibold'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                theme === 'light' ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300 dark:border-slate-600'
              }`}>
                {theme === 'light' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
              <Sun className="w-4 h-4 text-amber-500 shrink-0" />
              <div className="text-xs font-medium min-w-0 truncate">Light</div>
            </button>

            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={`flex items-center space-x-2.5 sm:space-x-3 p-3 sm:p-3.5 rounded-xl border transition-all cursor-pointer text-left min-w-0 ${
                theme === 'dark'
                  ? 'border-emerald-600 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-600/20 font-semibold'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                theme === 'dark' ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300 dark:border-slate-600'
              }`}>
                {theme === 'dark' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
              <Moon className="w-4 h-4 text-indigo-400 shrink-0" />
              <div className="text-xs font-medium min-w-0 truncate">Dark</div>
            </button>

            <button
              type="button"
              onClick={() => setTheme('system')}
              className={`flex items-center space-x-2.5 sm:space-x-3 p-3 sm:p-3.5 rounded-xl border transition-all cursor-pointer text-left min-w-0 ${
                theme === 'system'
                  ? 'border-emerald-600 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-600/20 font-semibold'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                theme === 'system' ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300 dark:border-slate-600'
              }`}>
                {theme === 'system' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
              <Monitor className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
              <div className="text-xs font-medium min-w-0 truncate">System Default</div>
            </button>
          </div>
        </div>
      </section>

      {/* SECTION 1: SCHOOL */}
      <section className="space-y-2.5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
          School
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            onClick={() => onNavigate('school-profile')}
            className="w-full flex items-center justify-between p-3.5 sm:p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50/80 dark:hover:bg-slate-800/80 hover:border-emerald-200 dark:hover:border-emerald-800 transition-all text-left shadow-2xs group cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            <div className="flex items-start space-x-3 sm:space-x-3.5 min-w-0 pr-1.5">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-100/80 dark:border-emerald-800/50 flex items-center justify-center shrink-0 group-hover:bg-emerald-100/80 dark:group-hover:bg-emerald-900/60 transition-colors mt-0.5">
                <School className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm sm:text-base leading-snug group-hover:text-emerald-900 dark:group-hover:text-emerald-300 transition-colors">
                  School Profile & Branding
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal">
                  Update school details, logo, motto, and contact info.
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors shrink-0 ml-1.5 self-center" />
          </button>

          <button
            onClick={() => onNavigate('academic-session')}
            className="w-full flex items-center justify-between p-3.5 sm:p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50/80 dark:hover:bg-slate-800/80 hover:border-emerald-200 dark:hover:border-emerald-800 transition-all text-left shadow-2xs group cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            <div className="flex items-start space-x-3 sm:space-x-3.5 min-w-0 pr-1.5">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-100/80 dark:border-emerald-800/50 flex items-center justify-center shrink-0 group-hover:bg-emerald-100/80 dark:group-hover:bg-emerald-900/60 transition-colors mt-0.5">
                <CalendarDays className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm sm:text-base leading-snug group-hover:text-emerald-900 dark:group-hover:text-emerald-300 transition-colors">
                  Academic Year & Terms
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal">
                  Manage academic years, active terms, and term dates.
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors shrink-0 ml-1.5 self-center" />
          </button>
        </div>
      </section>

      {/* SECTION 2: USERS & ACADEMICS */}
      <section className="space-y-2.5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
          Users & Academics
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            onClick={() => onNavigate('grading')}
            className="w-full flex items-center justify-between p-3.5 sm:p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50/80 dark:hover:bg-slate-800/80 hover:border-emerald-200 dark:hover:border-emerald-800 transition-all text-left shadow-2xs group cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            <div className="flex items-start space-x-3 sm:space-x-3.5 min-w-0 pr-1.5">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-100/80 dark:border-emerald-800/50 flex items-center justify-center shrink-0 group-hover:bg-emerald-100/80 dark:group-hover:bg-emerald-900/60 transition-colors mt-0.5">
                <Award className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm sm:text-base leading-snug group-hover:text-emerald-900 dark:group-hover:text-emerald-300 transition-colors">
                  CBE Grading System
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal">
                  Configure 8-point KNEC grading scales, score boundaries, and descriptors.
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors shrink-0 ml-1.5 self-center" />
          </button>

          <button
            onClick={() => onNavigate('teachers')}
            className="w-full flex items-center justify-between p-3.5 sm:p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50/80 dark:hover:bg-slate-800/80 hover:border-emerald-200 dark:hover:border-emerald-800 transition-all text-left shadow-2xs group cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            <div className="flex items-start space-x-3 sm:space-x-3.5 min-w-0 pr-1.5">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-100/80 dark:border-emerald-800/50 flex items-center justify-center shrink-0 group-hover:bg-emerald-100/80 dark:group-hover:bg-emerald-900/60 transition-colors mt-0.5">
                <Users className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm sm:text-base leading-snug group-hover:text-emerald-900 dark:group-hover:text-emerald-300 transition-colors">
                  User & Role Management
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal">
                  Manage administrator, teacher, and student user accounts.
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors shrink-0 ml-1.5 self-center" />
          </button>

          <button
            onClick={() => onNavigate('exams')}
            className="w-full flex items-center justify-between p-3.5 sm:p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50/80 dark:hover:bg-slate-800/80 hover:border-emerald-200 dark:hover:border-emerald-800 transition-all text-left shadow-2xs group cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            <div className="flex items-start space-x-3 sm:space-x-3.5 min-w-0 pr-1.5">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-100/80 dark:border-emerald-800/50 flex items-center justify-center shrink-0 group-hover:bg-emerald-100/80 dark:group-hover:bg-emerald-900/60 transition-colors mt-0.5">
                <BookMarked className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm sm:text-base leading-snug group-hover:text-emerald-900 dark:group-hover:text-emerald-300 transition-colors">
                  Examination Preferences
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal">
                  Configure examination types, grading scales, and settings.
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors shrink-0 ml-1.5 self-center" />
          </button>
        </div>
      </section>

      {/* SECTION 3: REPORTS & DATA */}
      <section className="space-y-2.5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
          Reports & Data
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            onClick={() => onNavigate('reports')}
            className="w-full flex items-center justify-between p-3.5 sm:p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50/80 dark:hover:bg-slate-800/80 hover:border-emerald-200 dark:hover:border-emerald-800 transition-all text-left shadow-2xs group cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            <div className="flex items-start space-x-3 sm:space-x-3.5 min-w-0 pr-1.5">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-100/80 dark:border-emerald-800/50 flex items-center justify-center shrink-0 group-hover:bg-emerald-100/80 dark:group-hover:bg-emerald-900/60 transition-colors mt-0.5">
                <FileBarChart className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm sm:text-base leading-snug group-hover:text-emerald-900 dark:group-hover:text-emerald-300 transition-colors">
                  Report Generation Settings
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal">
                  Configure report formats, signatures, and printing options.
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors shrink-0 ml-1.5 self-center" />
          </button>

          <div className="w-full flex items-start justify-between p-3.5 sm:p-4 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/50 text-left cursor-not-allowed select-none">
            <div className="flex items-start space-x-3 sm:space-x-3.5 min-w-0 pr-1.5">
              <div className="w-9 h-9 rounded-lg bg-slate-200/80 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 flex items-center justify-center shrink-0 mt-0.5">
                <Shield className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-slate-700 dark:text-slate-300 text-sm sm:text-base leading-snug">
                  Audit Logs
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal">
                  System activity logs are restricted to platform administrators.
                </p>
              </div>
            </div>
            <span className="text-[10px] font-semibold bg-slate-200/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0 ml-1.5 mt-0.5 sm:mt-0">
              <Lock className="w-3 h-3 text-slate-500 dark:text-slate-400" />
              Restricted
            </span>
          </div>

          <div className="w-full flex items-start justify-between p-3.5 sm:p-4 rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/50 text-left cursor-not-allowed select-none md:col-span-2">
            <div className="flex items-start space-x-3 sm:space-x-3.5 min-w-0 pr-1.5">
              <div className="w-9 h-9 rounded-lg bg-slate-200/80 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 flex items-center justify-center shrink-0 mt-0.5">
                <Database className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-slate-700 dark:text-slate-300 text-sm sm:text-base leading-snug">
                  Backup & Restore
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal">
                  Automated cloud backups are managed by the system provider.
                </p>
              </div>
            </div>
            <span className="text-[10px] font-semibold bg-slate-200/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0 ml-1.5 mt-0.5 sm:mt-0">
              <Lock className="w-3 h-3 text-slate-500 dark:text-slate-400" />
              Managed
            </span>
          </div>
        </div>
      </section>

      {/* SECTION 4: SYSTEM */}
      <section className="space-y-2.5 pt-1">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
          System
        </h2>
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start space-x-3 sm:space-x-3.5 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-800/50 flex items-center justify-center shrink-0 mt-0.5">
              <Info className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">CBE School Management Information System</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Version 1.0.0 • School Assessment & Records Core</p>
            </div>
          </div>
          <div className="flex items-center self-start sm:self-auto shrink-0">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800/60 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              System Up to Date
            </span>
          </div>
        </div>
      </section>
    </div>
  );
};

