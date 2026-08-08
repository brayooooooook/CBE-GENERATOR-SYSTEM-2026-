import React, { useState } from 'react';
import { BookMarked, Plus, Lock, Unlock, FileText, AlertTriangle, CheckCircle, Calendar, Trash2, RefreshCw, CheckCircle2 } from 'lucide-react';
import { Examination, ExamStatus, ExamType, ClassStream, Role, User } from '../types';
import { api } from '../lib/storage';
import { isTermModifiable, canViewTermData, getTermStatusMessage, canPlanExams, canApproveExams } from '../utils/termStatusUtils';
import { useAcademicSession } from '../contexts/AcademicSessionContext';

interface ExaminationManagementProps {
  exams: Examination[];
  classes?: ClassStream[];
  userRole?: Role;
  currentUser?: User | null;
  onAddExamination: (exam: Examination) => void;
  onUpdateStatus: (examId: string, status: ExamStatus) => void;
  onDeleteExamination?: (examId: string) => Promise<{ success: boolean; examName: string; deletedMarksCount: number; affectedStudentsCount: number; message: string }>;
}

export const ExaminationManagement: React.FC<ExaminationManagementProps> = ({
  exams,
  classes = [],
  userRole = 'admin',
  currentUser = null,
  onAddExamination,
  onUpdateStatus,
  onDeleteExamination,
}) => {
  const activeYearObj = api.getActiveAcademicYear();
  const { viewingTerm: activeTermObj } = useAcademicSession();
  const isTermClosed = activeTermObj.status === 'Closed';
  const isAdmin = userRole === 'admin';
  
  const canModify = isTermModifiable(activeTermObj.status);
  const canPlan = canPlanExams(activeTermObj.status);
  const canApprove = canApproveExams(activeTermObj.status);

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

  const [isAdding, setIsAdding] = useState(false);
  const [examName, setExamName] = useState('');
  const [term, setTerm] = useState<'Term 1' | 'Term 2' | 'Term 3'>(
    (activeTermObj.term_name as any) || 'Term 1'
  );
  const [year, setYear] = useState<number>(activeYearObj.year);
  const [examType, setExamType] = useState<ExamType>('CAT');
  const [maxMarks, setMaxMarks] = useState(100);
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [initialStatus, setInitialStatus] = useState<ExamStatus>('Draft');

  // Delete Examination Modal & Status State
  const [examToDelete, setExamToDelete] = useState<Examination | null>(null);
  const [confirmedApproved, setConfirmedApproved] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [successFeedback, setSuccessFeedback] = useState<string | null>(null);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!examName) return;
    if (!canModify) {
      alert(getTermStatusMessage(activeTermObj.status));
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const newExam: Examination = {
      id: `ex_${Date.now()}`,
      exam_name: examName.trim(),
      academic_year_id: activeYearObj.id,
      term,
      year,
      class_id: selectedClassId,
      date_created: today,
      status: initialStatus,
      exam_type: examType,
      max_marks: maxMarks,
      start_date: today,
    };

    onAddExamination(newExam);
    setExamName('');
    setIsAdding(false);
  };

  const handleConfirmDelete = async () => {
    if (!examToDelete || isDeleting) return;
    if (activeTermObj.status === 'Locked') {
      setDeleteError(getTermStatusMessage(activeTermObj.status) || 'Academic Term Locked. Cannot delete examination.');
      return;
    }
    if (examToDelete.status === 'Approved') {
      setDeleteError('Approved examinations are locked and cannot be deleted. Re-open the examination to Draft if corrections are required.');
      return;
    }
    if (examToDelete.status === ('Archived' as any)) {
      setDeleteError('Archived examinations cannot be deleted because they are historical records.');
      return;
    }
    setIsDeleting(true);
    setDeleteError(null);

    try {
      let res;
      if (onDeleteExamination) {
        res = await onDeleteExamination(examToDelete.id);
      } else {
        res = await api.deleteExamination(examToDelete.id, currentUser);
      }
      setSuccessFeedback(res?.message || `Examination "${examToDelete.exam_name}" deleted successfully.`);
      setExamToDelete(null);
      setConfirmedApproved(false);
    } catch (err: any) {
      console.error('Failed to delete examination:', err);
      setDeleteError(err?.message || 'Failed to delete examination. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
            <BookMarked className="w-6 h-6 text-[#176B45] dark:text-emerald-400" />
            <span>Assessment Setup</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Create Continuous Assessment Tests (CATs), Mid-Term Assessment, End-Term Assessment, and manage approval status.
          </p>
        </div>

        {canModify ? (
          <button
            onClick={() => setIsAdding(true)}
            className="bg-[#176B45] hover:bg-[#0F5132] text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow-xs transition flex items-center space-x-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Assessment</span>
          </button>
        ) : (
          <div className="bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 text-xs font-bold px-4 py-2.5 rounded-lg border border-amber-200 dark:border-amber-800/80 flex items-center space-x-1.5">
            <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>Term {activeTermObj.status}: Assessment Creation Locked</span>
          </div>
        )}
      </div>

      {/* SUCCESS NOTIFICATION TOAST */}
      {successFeedback && (
        <div className="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800/80 text-emerald-900 dark:text-emerald-200 rounded-xl p-4 flex items-center justify-between shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center space-x-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <p className="text-xs font-bold">{successFeedback}</p>
          </div>
          <button
            onClick={() => setSuccessFeedback(null)}
            className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-950 dark:hover:text-emerald-200 font-bold text-xs underline ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* CREATE FORM */}
      {isAdding && (
        <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm max-w-xl mx-auto">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">
            New Assessment Details
          </h2>
          <form onSubmit={handleCreate} className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Assessment Title *</label>
              <input
                type="text"
                required
                value={examName}
                onChange={(e) => setExamName(e.target.value)}
                placeholder="e.g. CAT 2 - Term 1 2026"
                className="w-full bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 focus:ring-2 focus:ring-[#176B45] focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Term *</label>
                <select
                  value={term}
                  onChange={(e) => setTerm(e.target.value as any)}
                  className="w-full bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 focus:ring-2 focus:ring-[#176B45] focus:outline-none"
                >
                  <option value="Term 1" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">Term 1</option>
                  <option value="Term 2" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">Term 2</option>
                  <option value="Term 3" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">Term 3</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Academic Year *</label>
                <input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="w-full bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 focus:ring-2 focus:ring-[#176B45] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Assessment Type *</label>
                <select
                  value={examType}
                  onChange={(e) => setExamType(e.target.value as any)}
                  className="w-full bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 focus:ring-2 focus:ring-[#176B45] focus:outline-none"
                >
                  <option value="CAT" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">Continuous Assessment Test (CAT)</option>
                  <option value="Mid-Term" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">Mid-Term Assessment</option>
                  <option value="End-Term" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">End-Term Assessment</option>
                  <option value="Custom" className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">Custom Assessment</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Maximum Marks</label>
                <input
                  type="number"
                  value={maxMarks}
                  onChange={(e) => setMaxMarks(Number(e.target.value))}
                  className="w-full bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg p-2.5 focus:ring-2 focus:ring-[#176B45] focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-3 flex items-center justify-end space-x-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-4 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-300 font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-[#176B45] hover:bg-[#0F5132] text-white font-bold rounded-lg shadow-xs transition"
              >
                Save Assessment
              </button>
            </div>
          </form>
        </div>
      )}

      {/* EXAMINATIONS LIST */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">
          Registered Assessments & Status Pipeline
        </h2>

        <div className="space-y-3">
          {exams.map((ex) => (
            <div
              key={ex.id}
              className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:border-[#176B45]/40 dark:hover:border-emerald-500/40 transition"
            >
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">{ex.exam_name}</h3>
                  <span className="bg-[#E8F3EE] dark:bg-emerald-950/60 text-[#176B45] dark:text-emerald-400 border border-[#2E7D5B]/30 dark:border-emerald-800/60 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {ex.exam_type}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {ex.term} &bull; Year: {ex.year} &bull; Max Score: {ex.max_marks} marks
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {/* Status Badge */}
                <div className="flex items-center space-x-1.5 text-xs font-bold">
                  {ex.status === 'Approved' ? (
                    <span className="bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 px-3 py-1 rounded-full flex items-center space-x-1">
                      <Lock className="w-3.5 h-3.5" />
                      <span>Official (Approved & Locked)</span>
                    </span>
                  ) : ex.status === 'Provisional' ? (
                    <span className="bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 px-3 py-1 rounded-full flex items-center space-x-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>FOR VERIFICATION ONLY</span>
                    </span>
                  ) : (
                    <span className="bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-3 py-1 rounded-full flex items-center space-x-1">
                      <FileText className="w-3.5 h-3.5" />
                      <span>Draft Mode</span>
                    </span>
                  )}
                </div>

                {/* Action Button: Locked indicator for Official/Archived exams, Delete for Draft/Provisional */}
                {ex.status === 'Approved' ? (
                  <span
                    className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold flex items-center space-x-1.5 select-none"
                    title="Approved assessment is locked and cannot be deleted. Re-open to Draft if corrections are required."
                  >
                    <Lock className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                    <span>Locked</span>
                  </span>
                ) : ex.status === ('Archived' as any) ? (
                  <span
                    className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold flex items-center space-x-1.5 select-none"
                    title="Archived assessment cannot be deleted because it is a historical record."
                  >
                    <Lock className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                    <span>Archived</span>
                  </span>
                ) : (
                  isAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteError(null);
                        setConfirmedApproved(false);
                        setExamToDelete(ex);
                      }}
                      className="px-3 py-1.5 bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-800/80 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition shadow-2xs cursor-pointer"
                      title="Delete Assessment"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                      <span>Delete</span>
                    </button>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CONFIRM DELETE DIALOG MODAL */}
      {examToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-start space-x-3.5 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="w-10 h-10 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-slate-900 dark:text-slate-100">Delete Assessment?</h3>
                <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold mt-0.5">
                  Permanent Administrative Action
                </p>
              </div>
            </div>

            {/* Target Examination Summary Details */}
            <div className="space-y-3.5 text-xs text-slate-700 dark:text-slate-300">
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl p-3.5 space-y-2">
                <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                  {examToDelete.exam_name}
                </p>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-400 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                  <div>
                    <span className="font-semibold text-slate-500 dark:text-slate-400">Term:</span> {examToDelete.term}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-500 dark:text-slate-400">Academic Year:</span> {examToDelete.year}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-500 dark:text-slate-400">Assessment Type:</span> {examToDelete.exam_type}
                  </div>
                  <div>
                    <span className="font-semibold text-slate-500 dark:text-slate-400">Maximum Marks:</span> {examToDelete.max_marks} marks
                  </div>
                  <div className="col-span-2 flex items-center space-x-1 mt-1">
                    <span className="font-semibold text-slate-500 dark:text-slate-400">Current Status:</span>{' '}
                    <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${
                      examToDelete.status === 'Approved'
                        ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300'
                        : examToDelete.status === 'Provisional'
                        ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200'
                    }`}>
                      {examToDelete.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Warnings & Notices */}
              {examToDelete.status === 'Approved' ? (
                <div className="bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800/80 rounded-xl p-3 flex items-start space-x-2.5 text-amber-900 dark:text-amber-200">
                  <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <p className="font-bold text-amber-950 dark:text-amber-100">Assessment is Locked</p>
                    <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed font-medium">
                      This assessment is officially approved and locked. It cannot be deleted. Re-open it to Draft if corrections are required.
                    </p>
                  </div>
                </div>
              ) : examToDelete.status === ('Archived' as any) ? (
                <div className="bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800/80 rounded-xl p-3 flex items-start space-x-2.5 text-amber-900 dark:text-amber-200">
                  <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <p className="font-bold text-amber-950 dark:text-amber-100">Assessment is Archived</p>
                    <p className="text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed font-medium">
                      Archived assessments cannot be deleted because they are historical academic records.
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300 leading-relaxed">
                  Deleting this assessment may permanently remove assessment records associated with it. This action cannot be undone.
                </p>
              )}

              {deleteError && (
                <div className="bg-rose-100 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800/80 text-rose-900 dark:text-rose-200 p-2.5 rounded-xl text-xs font-semibold flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-600 dark:text-rose-400" />
                  <span>{deleteError}</span>
                </div>
              )}
            </div>

            {/* Modal Footer Buttons */}
            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => {
                  setExamToDelete(null);
                  setDeleteError(null);
                  setConfirmedApproved(false);
                }}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-lg transition disabled:opacity-50 cursor-pointer border border-transparent dark:border-slate-700"
              >
                {examToDelete.status === 'Approved' || examToDelete.status === ('Archived' as any) ? 'Close' : 'Cancel'}
              </button>

              {examToDelete.status !== 'Approved' && examToDelete.status !== ('Archived' as any) && (
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={handleConfirmDelete}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow-md transition flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isDeleting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-white" />
                      <span>Deleting Assessment...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Delete Assessment</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

