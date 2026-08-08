import React, { useState, useEffect } from 'react';
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  BookOpen,
  ArrowUpDown,
  ListFilter,
  Info,
} from 'lucide-react';
import { Subject, SubjectGroup, EducationLevel, LEVEL_TO_GRADES, getEducationLevelForGrade, sortSubjectsByStandardOrder } from '../types';
import { api } from '../lib/storage';

interface SubjectGroupManagementProps {
  educationLevel?: EducationLevel;
  onGroupsUpdated?: () => void;
}

export const SubjectGroupManagement: React.FC<SubjectGroupManagementProps> = ({
  educationLevel = 'Upper Primary',
  onGroupsUpdated,
}) => {
  const [groups, setGroups] = useState<SubjectGroup[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<SubjectGroup | null>(null);

  // Form states
  const [groupName, setGroupName] = useState('');
  const [groupCode, setGroupCode] = useState('');
  const [displayOrder, setDisplayOrder] = useState<number>(1);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>([]);

  // UI status messages
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const targetLevel = educationLevel || 'Upper Primary';
  const gradeListStr = LEVEL_TO_GRADES[targetLevel]?.join(', ') || targetLevel;

  const loadData = () => {
    const allGroups = api.getSubjectGroups();
    const levelGroups = allGroups
      .filter((g) => g.education_level === targetLevel)
      .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
    setGroups(levelGroups);

    const allSubjects = api.getSubjects();
    const levelSubjects = allSubjects.filter(
      (s) =>
        s.status !== 'Archived' &&
        (s.education_level === targetLevel ||
          (s.applicable_grades &&
            s.applicable_grades.length > 0 &&
            getEducationLevelForGrade(s.applicable_grades[0]) === targetLevel))
    );
    setSubjects(levelSubjects);
  };

  useEffect(() => {
    loadData();
  }, [educationLevel]);

  const openCreateModal = () => {
    setEditingGroup(null);
    setGroupName('');
    setGroupCode('');
    setDisplayOrder(groups.length + 1);
    setIsActive(true);
    setSelectedSubjectIds([]);
    setErrorMsg('');
    setSuccessMsg('');
    setIsModalOpen(true);
  };

  const openEditModal = (grp: SubjectGroup) => {
    setEditingGroup(grp);
    setGroupName(grp.group_name);
    setGroupCode(grp.group_code);
    setDisplayOrder(grp.display_order || 1);
    setIsActive(grp.is_active);
    setSelectedSubjectIds([...(grp.subject_ids || [])]);
    setErrorMsg('');
    setSuccessMsg('');
    setIsModalOpen(true);
  };

  const toggleSubjectSelection = (subjectId: string) => {
    if (selectedSubjectIds.includes(subjectId)) {
      setSelectedSubjectIds(selectedSubjectIds.filter((id) => id !== subjectId));
    } else {
      setSelectedSubjectIds([...selectedSubjectIds, subjectId]);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!groupName.trim()) {
      setErrorMsg('Group Name is required.');
      return;
    }
    if (!groupCode.trim()) {
      setErrorMsg('Group Code is required.');
      return;
    }
    if (selectedSubjectIds.length === 0) {
      setErrorMsg('Please select at least one learning area (subject) for this group.');
      return;
    }

    const payload: SubjectGroup = {
      id: editingGroup ? editingGroup.id : `grp_${Date.now()}`,
      group_name: groupName.trim(),
      group_code: groupCode.trim().toUpperCase(),
      education_level: targetLevel as EducationLevel,
      display_order: Number(displayOrder) || 1,
      is_active: isActive,
      subject_ids: selectedSubjectIds,
      updated_at: new Date().toISOString(),
      ...(editingGroup ? { created_at: editingGroup.created_at } : { created_at: new Date().toISOString() }),
    };

    if (editingGroup) {
      api.updateSubjectGroup(payload);
      setSuccessMsg(`Subject group "${payload.group_name}" updated successfully.`);
    } else {
      api.addSubjectGroup(payload);
      setSuccessMsg(`Subject group "${payload.group_name}" created successfully.`);
    }

    loadData();
    setIsModalOpen(false);
    if (onGroupsUpdated) onGroupsUpdated();
  };

  const handleDelete = (grp: SubjectGroup) => {
    if (
      window.confirm(
        `Are you sure you want to delete the subject group "${grp.group_name}" (${grp.group_code})?`
      )
    ) {
      api.deleteSubjectGroup(grp.id);
      setSuccessMsg(`Subject group "${grp.group_name}" deleted.`);
      loadData();
      if (onGroupsUpdated) onGroupsUpdated();
    }
  };

  const handleToggleActive = (grp: SubjectGroup) => {
    const updated = { ...grp, is_active: !grp.is_active, updated_at: new Date().toISOString() };
    api.updateSubjectGroup(updated);
    loadData();
    if (onGroupsUpdated) onGroupsUpdated();
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Info Header */}
      <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
            <Layers className="w-6 h-6 text-[#176B45]" />
            <span>Subject Groups ({targetLevel}: {gradeListStr})</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure CBC subject groups for {gradeListStr}. Grouped learning areas combine marks, calculate weighted averages, performance levels, and dynamically generate Merit Lists, Report Cards, and Analytics.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center space-x-2 bg-[#176B45] hover:bg-[#0F5132] text-white text-xs font-bold px-4 py-2.5 rounded-lg transition shadow-xs whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>Add Subject Group</span>
        </button>
      </div>

      {/* Global Alerts */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Main Groups Table Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800 flex items-center space-x-2">
            <BookOpen className="w-4 h-4 text-slate-600" />
            <span>Configured {targetLevel} Subject Groups ({groups.length})</span>
          </h2>
          <span className="text-xs text-slate-500 font-medium bg-slate-200/60 px-2.5 py-1 rounded-full">
            Scope: {gradeListStr} Only
          </span>
        </div>

        {groups.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <Layers className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-700">No Subject Groups Configured</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Click "Add Subject Group" above to configure combined or individual learning area groups for {targetLevel}.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/70 border-b border-slate-200 text-slate-700 uppercase tracking-wider font-bold">
                  <th className="py-3 px-4 w-16 text-center">Order</th>
                  <th className="py-3 px-4">Group Code</th>
                  <th className="py-3 px-4">Group Name</th>
                  <th className="py-3 px-4">Included Learning Areas (Subjects)</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {groups.map((grp) => {
                  const memberSubjects = subjects.filter((s) => (grp.subject_ids || []).includes(s.id));
                  return (
                    <tr key={grp.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-4 text-center font-bold text-slate-600">
                        {grp.display_order || 1}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-black text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200/80">
                          {grp.group_code}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {grp.group_name}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1.5">
                          {memberSubjects.length === 0 ? (
                            <span className="text-amber-600 italic text-[11px]">No subjects assigned</span>
                          ) : (
                            memberSubjects.map((s) => (
                              <span
                                key={s.id}
                                className="inline-flex items-center space-x-1 bg-slate-100 border border-slate-200 text-slate-800 px-2 py-0.5 rounded-md text-[11px]"
                              >
                                <span className="font-bold text-slate-900">{s.subject_code}:</span>
                                <span>{s.subject_name}</span>
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => handleToggleActive(grp)}
                          className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition cursor-pointer ${
                            grp.is_active
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {grp.is_active ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Active</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3.5 h-3.5 text-slate-400" />
                              <span>Inactive</span>
                            </>
                          )}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-1">
                        <button
                          onClick={() => openEditModal(grp)}
                          className="p-1.5 rounded-md text-emerald-700 hover:bg-emerald-50 transition"
                          title="Edit Group"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(grp)}
                          className="p-1.5 rounded-md text-rose-600 hover:bg-rose-50 transition"
                          title="Delete Group"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                <Layers className="w-5 h-5 text-emerald-700" />
                <span>{editingGroup ? 'Edit Subject Group' : `Create ${targetLevel} Subject Group`}</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs font-semibold flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Group Code *</label>
                  <input
                    type="text"
                    value={groupCode}
                    onChange={(e) => setGroupCode(e.target.value)}
                    placeholder="e.g. SCI/AGN"
                    className="w-full border border-slate-300 rounded-lg p-2.5 font-bold uppercase text-slate-800 focus:ring-2 focus:ring-[#176B45] focus:outline-none"
                    required
                  />
                  <span className="text-[10px] text-slate-400">Column code on reports</span>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Display Order *</label>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={displayOrder}
                    onChange={(e) => setDisplayOrder(parseInt(e.target.value) || 1)}
                    className="w-full border border-slate-300 rounded-lg p-2.5 font-bold text-slate-800 focus:ring-2 focus:ring-[#176B45] focus:outline-none"
                    required
                  />
                  <span className="text-[10px] text-slate-400">Left-to-right report order</span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Group Name *</label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g. Science & Agriculture"
                  className="w-full border border-slate-300 rounded-lg p-2.5 font-semibold text-slate-800 focus:ring-2 focus:ring-[#176B45] focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Included {targetLevel} Learning Areas *
                </label>
                <p className="text-[11px] text-slate-500 mb-2">
                  Select which learning areas are combined into this group. If multiple are selected, their marks will be averaged automatically.
                </p>
                <div className="border border-slate-200 rounded-lg p-3 max-h-48 overflow-y-auto space-y-2 bg-slate-50">
                  {sortSubjectsByStandardOrder<Subject>(subjects).map((sb) => {
                    const isChecked = selectedSubjectIds.includes(sb.id);
                    return (
                      <label
                        key={sb.id}
                        className={`flex items-center space-x-3 p-2 rounded-md transition cursor-pointer border ${
                          isChecked
                            ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950 font-semibold'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSubjectSelection(sb.id)}
                          className="w-4 h-4 text-[#176B45] rounded-md focus:ring-[#176B45] border-slate-300"
                        />
                        <div className="flex-1 text-xs">
                          <span className="font-bold text-[#176B45] mr-2">{sb.subject_code}</span>
                          <span>{sb.subject_name}</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="isActiveToggle"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 text-[#176B45] rounded-md focus:ring-[#176B45] border-slate-300"
                />
                <label htmlFor="isActiveToggle" className="font-bold text-slate-800 cursor-pointer">
                  Activate this Subject Group on Reports
                </label>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#176B45] hover:bg-[#0F5132] text-white font-bold transition shadow-xs"
                >
                  {editingGroup ? 'Save Changes' : 'Create Subject Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
