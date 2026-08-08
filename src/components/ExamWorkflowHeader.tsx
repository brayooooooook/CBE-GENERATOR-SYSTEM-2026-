import React from 'react';
import { Check, ShieldCheck, FileSpreadsheet, CheckSquare, Lock, ArrowRight } from 'lucide-react';
import { TabType } from './Sidebar';

interface ExamWorkflowHeaderProps {
  currentStep: 2 | 3; // Step 2 = Analysis & Validation, Step 3 = Results Verification
  examName?: string;
  validationPassed?: boolean;
  isApproved?: boolean;
  onNavigate?: (tab: TabType) => void;
}

export const ExamWorkflowHeader: React.FC<ExamWorkflowHeaderProps> = ({
  currentStep,
  examName,
  validationPassed = false,
  isApproved = false,
  onNavigate,
}) => {
  const steps = [
    {
      step: 1,
      num: '①',
      label: 'Marks Entry',
      tab: 'marks-entry' as TabType,
      icon: <FileSpreadsheet className="w-3.5 h-3.5" />,
      completed: true, // Step 1 is always completed before validation/verification
    },
    {
      step: 2,
      num: '②',
      label: 'Analysis & Validation',
      tab: 'exam-validation' as TabType,
      icon: <ShieldCheck className="w-3.5 h-3.5" />,
      completed: validationPassed || isApproved,
    },
    {
      step: 3,
      num: '③',
      label: 'Results Verification',
      tab: 'provisional' as TabType,
      icon: <CheckSquare className="w-3.5 h-3.5" />,
      completed: isApproved,
    },
    {
      step: 4,
      num: '④',
      label: 'Approval & Lock',
      tab: 'provisional' as TabType,
      icon: <Lock className="w-3.5 h-3.5" />,
      completed: isApproved,
    },
  ];

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-[#D9E0E7] dark:border-slate-800 p-3.5 sm:p-4 shadow-sm mb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#D9E0E7]/60 dark:border-slate-800 pb-3 mb-3">
        <div className="flex items-center space-x-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[#075E42] dark:bg-emerald-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-[#667085] dark:text-slate-400">
            Assessment Lifecycle Workflow
          </span>
          {examName && (
            <span className="text-xs font-semibold text-[#1F2937] dark:text-slate-200 bg-[#F6F8FA] dark:bg-slate-800 px-2.5 py-0.5 rounded-full border border-[#D9E0E7] dark:border-slate-700">
              {examName}
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2 text-xs">
          {isApproved ? (
            <span className="bg-emerald-50 dark:bg-emerald-950/60 text-[#075E42] dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 px-2.5 py-1 rounded-md font-bold flex items-center space-x-1">
              <Check className="w-3.5 h-3.5 text-[#075E42] dark:text-emerald-400" />
              <span>Official & Locked</span>
            </span>
          ) : validationPassed ? (
            <span className="bg-emerald-50 dark:bg-emerald-950/60 text-[#075E42] dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 px-2.5 py-1 rounded-md font-bold flex items-center space-x-1">
              <Check className="w-3.5 h-3.5 text-[#075E42] dark:text-emerald-400" />
              <span>Validation Passed</span>
            </span>
          ) : (
            <span className="bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 px-2.5 py-1 rounded-md font-semibold">
              Pending Validation
            </span>
          )}
        </div>
      </div>

      {/* Workflow Step Breadcrumbs Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {steps.map((item) => {
          const isActive = item.step === currentStep;
          const isDone = item.completed && !isActive;

          return (
            <button
              key={item.step}
              type="button"
              onClick={() => onNavigate && onNavigate(item.tab)}
              className={`p-2.5 rounded-lg border text-left transition flex items-center justify-between gap-2 text-xs cursor-pointer ${
                isActive
                  ? 'bg-[#075E42] text-white border-[#075E42] shadow-sm font-bold ring-2 ring-[#075E42]/20'
                  : isDone
                  ? 'bg-emerald-50/70 dark:bg-emerald-950/40 text-[#075E42] dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100/80 dark:hover:bg-emerald-900/60 font-semibold'
                  : 'bg-[#F6F8FA] dark:bg-slate-800/60 text-[#667085] dark:text-slate-400 border-[#D9E0E7] dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-700/60 font-medium'
              }`}
            >
              <div className="flex items-center space-x-2 min-w-0">
                <span
                  className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center shrink-0 ${
                    isActive
                      ? 'bg-white dark:bg-slate-900 text-[#075E42] dark:text-emerald-400'
                      : isDone
                      ? 'bg-[#075E42] dark:bg-emerald-500 text-white dark:text-slate-950'
                      : 'bg-[#D9E0E7] dark:bg-slate-700 text-[#1F2937] dark:text-slate-300'
                  }`}
                >
                  {isDone ? <Check className="w-3 h-3 stroke-[3]" /> : item.step}
                </span>
                <span className="truncate">{item.label}</span>
              </div>
              {isActive && <ArrowRight className="w-3.5 h-3.5 shrink-0 text-emerald-200 dark:text-emerald-300 hidden sm:block" />}
            </button>
          );
        })}
      </div>
    </div>
  );
};
