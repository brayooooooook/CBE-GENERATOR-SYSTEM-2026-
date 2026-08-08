import React, { useState } from 'react';
import {
  UserCheck,
  Plus,
  Trash2,
  Edit2,
  BookOpen,
  Building2,
  Phone,
  Mail,
  X,
  Search,
  User as UserIcon,
  ShieldAlert,
  CheckCircle2,
  Ban,
  Lock,
  KeyRound,
  Eye,
  History,
  Shield,
  Clock,
  Laptop,
  Globe,
  AlertCircle,
  Unlock,
  Sparkles,
  Layers,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Teacher, Subject, ClassStream, AccountStatus, Role, LoginLog, User as AppUser, TeacherAllocation, EducationLevel, ALL_EDUCATION_LEVELS, sortGrades, sortClasses, canonicalizeRole, getEducationLevelForGrade } from '../types';
import { authService, recordLoginLog } from '../services/authService';
import { api, getSupabaseClient, isUUID } from '../lib/storage';

interface TeacherManagementProps {
  teachers: Teacher[];
  subjects: Subject[];
  classes: ClassStream[];
  onAddTeacher: (teacher: Teacher, authUserId?: string) => void;
  onUpdateTeacher: (teacher: Teacher) => void;
  onDeleteTeacher: (id: string) => void | Promise<void>;
}

export const TeacherManagement: React.FC<TeacherManagementProps> = ({
  teachers = [],
  subjects = [],
  classes = [],
  onAddTeacher,
  onUpdateTeacher,
  onDeleteTeacher,
}) => {
  const [isAddingModalOpen, setIsAddingModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [viewingTeacher, setViewingTeacher] = useState<Teacher | null>(null);
  const [resetPasswordTeacher, setResetPasswordTeacher] = useState<Teacher | null>(null);
  const [deletingTeacher, setDeletingTeacher] = useState<Teacher | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [detailTab, setDetailTab] = useState<'profile' | 'allocations' | 'logs'>('profile');
  const [expandedTeacherIds, setExpandedTeacherIds] = useState<Record<string, boolean>>({});

  const toggleTeacherExpand = (id: string) => {
    setExpandedTeacherIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // New Account Creation Form State
  const [createRole, setCreateRole] = useState<Role>('class_teacher');
  const [name, setName] = useState('');
  const [tscNumber, setTscNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [status, setStatus] = useState<AccountStatus>('Active');
  const [tempPassword, setTempPassword] = useState('Teacher@2026');
  const [confirmTempPassword, setConfirmTempPassword] = useState('Teacher@2026');
  const [forcePasswordChange, setForcePasswordChange] = useState(true);
  const [allocations, setAllocations] = useState<TeacherAllocation[]>([]);
  const [allocEduLevel, setAllocEduLevel] = useState<EducationLevel>('Junior School');
  const [allocClassLevel, setAllocClassLevel] = useState<string>('');
  const [allocStreamId, setAllocStreamId] = useState<string>('');
  const [allocSubjectId, setAllocSubjectId] = useState<string>('');

  const [assignedEduLevel, setAssignedEduLevel] = useState<EducationLevel>('Pre-Primary');
  const [assignedClassLevel, setAssignedClassLevel] = useState<string>('');
  const [assignedStreamId, setAssignedStreamId] = useState<string>('');

  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset Password State
  const [newResetPassword, setNewResetPassword] = useState('Teacher@2026');
  const [confirmResetPassword, setConfirmResetPassword] = useState('Teacher@2026');
  const [resetForceChange, setResetForceChange] = useState(true);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Edit Teacher Form State
  const [editTeacherName, setEditTeacherName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editTscNumber, setEditTscNumber] = useState('');
  const [editStatus, setEditStatus] = useState<AccountStatus>('Active');

  // Edit Teacher Class Teacher Assignment State
  const [editClassEduLevel, setEditClassEduLevel] = useState<EducationLevel>('Junior School');
  const [editClassGrade, setEditClassGrade] = useState<string>('');
  const [editClassStreamId, setEditClassStreamId] = useState<string>('');

  // Edit Teacher Allocations State
  const [editAllocations, setEditAllocations] = useState<TeacherAllocation[]>([]);
  const [editAddEduLevel, setEditAddEduLevel] = useState<EducationLevel>('Junior School');
  const [editAddGrade, setEditAddGrade] = useState<string>('');
  const [editAddStreamId, setEditAddStreamId] = useState<string>('');
  const [editAddSubjectId, setEditAddSubjectId] = useState<string>('');

  const [editFormError, setEditFormError] = useState<string | null>(null);
  const [editFormSuccess, setEditFormSuccess] = useState<string | null>(null);
  const [isSavingTeacher, setIsSavingTeacher] = useState(false);
  const [isLoadingTeacherData, setIsLoadingTeacherData] = useState(false);

  const handleAddAllocation = () => {
    if (!allocEduLevel || !allocStreamId || !allocSubjectId) {
      setFormError('Please select Education Level, Class, Stream, and Learning Area.');
      return;
    }
    const selectedClassObj = classes.find(c => c.id === allocStreamId);
    const selectedSubjectObj = subjects.find(s => s.id === allocSubjectId);

    const newAlloc: TeacherAllocation = {
      id: `alloc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      education_level: allocEduLevel,
      class_id: allocStreamId, // stream ID maps to ClassStream.id
      class_name: selectedClassObj?.class_name || allocClassLevel,
      stream: selectedClassObj?.stream,
      subject_id: allocSubjectId,
      subject_name: selectedSubjectObj?.subject_name,
      subject_code: selectedSubjectObj?.subject_code,
    };
    setAllocations([...allocations, newAlloc]);
    setAllocClassLevel('');
    setAllocStreamId('');
    setAllocSubjectId('');
    setFormError(null);
  };

  const removeAllocation = (allocId: string) => {
    setAllocations(allocations.filter((a) => a.id !== allocId));
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!name.trim() || !email.trim()) {
      setFormError('Full Name and Email Address are required.');
      return;
    }

    if (!tempPassword || tempPassword.length < 6) {
      setFormError('Temporary password must be at least 6 characters.');
      return;
    }

    if (tempPassword !== confirmTempPassword) {
      setFormError('Temporary password and confirmation password do not match.');
      return;
    }

    let finalAllocations: TeacherAllocation[] = [];
    let classTeacherOfId: string | undefined = undefined;

    if (createRole === 'class_teacher') {
      if (!assignedStreamId) {
        setFormError('Assigned Class (Education Level, Class, Stream) is required for Class Teachers.');
        return;
      }
      classTeacherOfId = assignedStreamId;

      if (assignedEduLevel === 'Pre-Primary' || assignedEduLevel === 'Lower Primary') {
        const levelSubjects = subjects.filter(
          (s) => s.education_level === assignedEduLevel || !s.education_level
        );
        const assignedClassObj = classes.find(c => c.id === assignedStreamId);
        finalAllocations = levelSubjects.map((s) => ({
          id: `alloc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          education_level: assignedEduLevel,
          class_id: assignedStreamId,
          class_name: assignedClassObj?.class_name || assignedClassLevel,
          stream: assignedClassObj?.stream,
          subject_id: s.id,
          subject_name: s.subject_name,
          subject_code: s.subject_code,
        }));
      } else {
        finalAllocations = [...allocations];
      }
    } else if (createRole === 'subject_teacher') {
      if (allocations.length === 0) {
        setFormError('Subject Teachers must have at least one Teaching Allocation.');
        return;
      }
      finalAllocations = [...allocations];
    } else {
      finalAllocations = [];
    }

    setIsSubmitting(true);
    try {
      const canonicalRole = canonicalizeRole(createRole);
      const res = await authService.adminCreateAccount({
        role: canonicalRole,
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || '+254 700 000 000',
        tsc_number: tscNumber.trim() || undefined,
        username: username.trim() || undefined,
        status,
        temporary_password: tempPassword,
        force_password_change: forcePasswordChange,
        allocations: finalAllocations,
        class_teacher_of_id: classTeacherOfId,
      });

      if (res.error) {
        console.error('Teacher account creation error detail:', res.error);
        if (typeof res.error === 'string' && res.error.includes('users_role_check')) {
          setFormError('Unable to create user profile due to an invalid role specification. Please re-select the User Role and try again.');
        } else if (typeof res.error === 'string' && (res.error.toLowerCase().includes('already registered') || res.error.toLowerCase().includes('already exists') || res.error.toLowerCase().includes('already been registered'))) {
          setFormError('A user account with this email address has already been registered. Please enter a different email address or edit the existing account.');
        } else {
          setFormError(res.error);
        }
      } else {
        const roleLabel = canonicalRole === 'admin' ? 'Administrator' : canonicalRole === 'class_teacher' ? 'Class Teacher' : 'Subject Teacher';
        setFormSuccess(`Successfully created ${roleLabel} account for ${name.trim()} using Supabase Auth!`);
        if (res.teacher) {
          onAddTeacher(res.teacher, res.user?.id);
        }

        setTimeout(() => {
          setIsAddingModalOpen(false);
          resetCreateForm();
        }, 1200);
      }
    } catch (err: any) {
      console.error('Unexpected account creation error:', err);
      setFormError(err.message || 'An unexpected error occurred while creating the user account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetCreateForm = () => {
    setCreateRole('class_teacher');
    setName('');
    setTscNumber('');
    setPhone('');
    setEmail('');
    setUsername('');
    setStatus('Active');
    setTempPassword('Teacher@2026');
    setConfirmTempPassword('Teacher@2026');
    setForcePasswordChange(true);
    setAllocations([]);
    setAllocEduLevel('Junior School');
    setAllocClassLevel('');
    setAllocStreamId('');
    setAllocSubjectId('');
    setAssignedEduLevel('Pre-Primary');
    setAssignedClassLevel('');
    setAssignedStreamId('');
    setFormError(null);
    setFormSuccess(null);
  };

  const openEditTeacherModal = async (tch: Teacher) => {
    setEditFormError(null);
    setEditFormSuccess(null);
    setIsLoadingTeacherData(true);

    // Profile fields
    setEditTeacherName(tch.teacher_name || '');
    setEditEmail(tch.email || '');
    setEditPhone(tch.phone || '');
    setEditTscNumber(tch.tsc_number || '');
    setEditStatus(tch.status || 'Active');
    setEditAllocations(tch.allocations ? [...tch.allocations] : []);

    // Find assigned class teacher stream
    const matchedStream = classes.find(
      (c) => c.class_teacher_id === tch.id || (tch.class_teacher_of_id && (tch.class_teacher_of_id === c.id || tch.class_teacher_of_id === c.class_name))
    );

    if (matchedStream) {
      setEditClassStreamId(matchedStream.id);
      setEditClassGrade(matchedStream.class_name);
      setEditClassEduLevel(matchedStream.education_level || getEducationLevelForGrade(matchedStream.class_name));
    } else {
      setEditClassStreamId('');
      setEditClassGrade('');
      setEditClassEduLevel('Junior School');
    }

    // Reset add allocation form
    setEditAddEduLevel('Junior School');
    setEditAddGrade('');
    setEditAddStreamId('');
    setEditAddSubjectId('');

    setEditingTeacher(tch);

    // Fetch fresh database state from Supabase if connected (Section 7 Data Loading)
    const client = getSupabaseClient();
    if (client) {
      try {
        let dbTch: any = null;
        let effectiveTeacherId: string | null = isUUID(tch.id) ? tch.id : null;

        if (effectiveTeacherId) {
          const res = await client.from('teachers').select('*').eq('id', effectiveTeacherId).maybeSingle();
          dbTch = res.data;
        } else if (tch.email) {
          const res = await client.from('teachers').select('*').eq('email', tch.email.trim().toLowerCase()).maybeSingle();
          dbTch = res.data;
          if (dbTch && isUUID(dbTch.id)) {
            effectiveTeacherId = dbTch.id;
          }
        }

        let dbAllocations: any = null;
        let dbStreams: any = null;

        if (effectiveTeacherId && isUUID(effectiveTeacherId)) {
          const allocRes = await client.from('teacher_subjects').select('*').eq('teacher_id', effectiveTeacherId);
          dbAllocations = allocRes.data;
          const streamRes = await client.from('streams').select('*').eq('class_teacher_id', effectiveTeacherId);
          dbStreams = streamRes.data;
        }

        if (dbTch) {
          setEditTeacherName(dbTch.teacher_name || tch.teacher_name);
          setEditEmail(dbTch.email || tch.email);
          setEditPhone(dbTch.phone || tch.phone);
          setEditTscNumber(dbTch.tsc_number || tch.tsc_number || '');
          setEditStatus(dbTch.status || tch.status || 'Active');
        }

        let freshStreamId = matchedStream?.id || '';
        if (dbStreams && dbStreams.length > 0) {
          freshStreamId = dbStreams[0].id;
        } else if (dbTch?.class_teacher_of_id) {
          freshStreamId = dbTch.class_teacher_of_id;
        }

        if (freshStreamId) {
          const freshCls = classes.find((c) => c.id === freshStreamId);
          if (freshCls) {
            setEditClassStreamId(freshCls.id);
            setEditClassGrade(freshCls.class_name);
            setEditClassEduLevel(freshCls.education_level || getEducationLevelForGrade(freshCls.class_name));
          }
        } else {
          setEditClassStreamId('');
          setEditClassGrade('');
        }

        if (dbAllocations && dbAllocations.length > 0) {
          const freshAllocations: TeacherAllocation[] = dbAllocations.map((ts: any) => {
            const matchedCls = classes.find((c) => c.id === ts.stream_id || c.id === ts.class_id);
            const matchedSub = subjects.find((s) => s.id === ts.subject_id);
            return {
              id: ts.id,
              class_id: ts.stream_id || ts.class_id,
              subject_id: ts.subject_id,
              class_name: matchedCls?.class_name,
              stream: matchedCls?.stream,
              subject_name: matchedSub?.subject_name,
              subject_code: matchedSub?.subject_code,
              education_level: matchedCls?.education_level || (matchedCls ? getEducationLevelForGrade(matchedCls.class_name) : 'Upper Primary'),
            };
          });
          setEditAllocations(freshAllocations);
        }
      } catch (err) {
        console.warn('Could not fetch fresh teacher state from Supabase:', err);
      }
    }

    setIsLoadingTeacherData(false);
  };

  const handleEditAddAllocation = () => {
    setEditFormError(null);
    if (!editAddEduLevel || !editAddStreamId || !editAddSubjectId) {
      setEditFormError('Please select Education Level, Class, Stream, and Learning Area.');
      return;
    }

    // Check duplicate allocation
    const isDuplicate = editAllocations.some(
      (a) => a.class_id === editAddStreamId && a.subject_id === editAddSubjectId
    );
    if (isDuplicate) {
      setEditFormError('This Learning Area allocation (Class, Stream & Subject) is already assigned to this teacher.');
      return;
    }

    const selectedClassObj = classes.find((c) => c.id === editAddStreamId);
    const selectedSubjectObj = subjects.find((s) => s.id === editAddSubjectId);

    const newAlloc: TeacherAllocation = {
      id: `alloc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      education_level: editAddEduLevel,
      class_id: editAddStreamId,
      class_name: selectedClassObj?.class_name || editAddGrade,
      stream: selectedClassObj?.stream,
      subject_id: editAddSubjectId,
      subject_name: selectedSubjectObj?.subject_name,
      subject_code: selectedSubjectObj?.subject_code,
    };

    setEditAllocations([...editAllocations, newAlloc]);
    setEditAddGrade('');
    setEditAddStreamId('');
    setEditAddSubjectId('');
    setEditFormError(null);
  };

  const handleEditRemoveAllocation = (allocId: string) => {
    setEditAllocations(editAllocations.filter((a) => a.id !== allocId));
  };

  const handleSaveEditTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeacher) return;

    setEditFormError(null);
    setEditFormSuccess(null);

    if (!editTeacherName.trim() || !editEmail.trim()) {
      setEditFormError('Full Name and Email address are required.');
      return;
    }

    const isClassTeacher = Boolean(editClassStreamId);

    const updatedTeacher: Teacher = {
      ...editingTeacher,
      teacher_name: editTeacherName.trim(),
      email: editEmail.trim(),
      phone: editPhone.trim(),
      tsc_number: editTscNumber.trim() || undefined,
      status: editStatus,
      is_class_teacher: isClassTeacher,
      class_teacher_of_id: isClassTeacher ? editClassStreamId : undefined,
      allocations: editAllocations,
    };

    setIsSavingTeacher(true);
    try {
      await onUpdateTeacher(updatedTeacher);
      authService.adminUpdateAccountStatus(editEmail.trim(), editStatus);

      setEditFormSuccess('Teacher record updated successfully!');
      setTimeout(() => {
        setEditingTeacher(null);
        setEditFormSuccess(null);
        setEditFormError(null);
      }, 800);
    } catch (err: any) {
      console.error('Failed updating teacher record:', err);
      setEditFormError(err.message || 'Failed to save changes.');
    } finally {
      setIsSavingTeacher(false);
    }
  };

  const handleStatusChange = (tch: Teacher, newStatus: AccountStatus) => {
    const updated = { ...tch, status: newStatus };
    onUpdateTeacher(updated);
    authService.adminUpdateAccountStatus(tch.email, newStatus);
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordTeacher) return;

    setResetError(null);
    setResetSuccess(null);

    if (newResetPassword.length < 6) {
      setResetError('Password must be at least 6 characters long.');
      return;
    }

    if (newResetPassword !== confirmResetPassword) {
      setResetError('Passwords do not match.');
      return;
    }

    try {
      const currentUser = api.getCurrentUser();
      const res = await authService.adminResetPassword(
        resetPasswordTeacher.email,
        newResetPassword,
        resetForceChange,
        currentUser
      );
      if (res.error) {
        setResetError(res.error);
      } else {
        setResetSuccess(`Password successfully reset for ${resetPasswordTeacher.teacher_name}!`);
        onUpdateTeacher({
          ...resetPasswordTeacher,
          force_password_change: resetForceChange,
        });
        setTimeout(() => {
          setResetPasswordTeacher(null);
          setResetError(null);
          setResetSuccess(null);
        }, 1200);
      }
    } catch (err: any) {
      setResetError(err?.message || 'Failed to reset password.');
    }
  };

  const handleDeleteConfirm = async () => {
    if (deletingTeacher) {
      setIsSubmitting(true);
      setDeleteError(null);
      try {
        await onDeleteTeacher(deletingTeacher.id);
        setDeletingTeacher(null);
      } catch (err: any) {
        console.error('Failed to delete teacher:', err);
        setDeleteError(err?.message || 'Failed to delete teacher.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const filteredTeachers = teachers.filter((t) => {
    if (!t) return false;
    const query = searchQuery.toLowerCase();
    const name = (t.teacher_name || '').toLowerCase();
    const email = (t.email || '').toLowerCase();
    const phone = (t.phone || '').toLowerCase();
    const tsc = (t.tsc_number || '').toLowerCase();
    const uname = (t.username || '').toLowerCase();

    const matchesQuery =
      name.includes(query) ||
      email.includes(query) ||
      phone.includes(query) ||
      tsc.includes(query) ||
      uname.includes(query);

    const matchesStatus =
      selectedStatusFilter === 'all'
        ? true
        : (t.status || 'Active') === selectedStatusFilter;

    return matchesQuery && matchesStatus;
  });

  const getStatusBadge = (st?: AccountStatus) => {
    const currentSt = st || 'Active';
    if (currentSt === 'Active') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/60 shadow-2xs">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>Active</span>
        </span>
      );
    }
    if (currentSt === 'Disabled') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200/80 dark:border-rose-800/60 shadow-2xs">
          <Ban className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
          <span>Disabled</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200/80 dark:border-amber-800/60 shadow-2xs">
        <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
        <span>Locked</span>
      </span>
    );
  };

  const currentViewingLogs: LoginLog[] = viewingTeacher
    ? api.getLoginLogs(viewingTeacher.email)
    : [];

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 md:p-6 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start md:items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-100/80 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 flex items-center justify-center border border-emerald-200/60 dark:border-emerald-800/60 shadow-2xs shrink-0">
            <UserCheck className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Teachers & User Account Management
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-normal mt-0.5 max-w-2xl">
              Manage teacher profiles, Supabase authentication accounts, class assignments, learning areas, and account permissions across the school.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            resetCreateForm();
            setIsAddingModalOpen(true);
          }}
          className="inline-flex items-center gap-2 bg-[#075E42] hover:bg-[#054531] text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-xs hover:shadow transition-all cursor-pointer border border-[#054531]/30 self-start md:self-auto shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Create User Account</span>
        </button>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80 md:w-96">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search teachers by name, email, TSC number, or username..."
            className="w-full pl-9 pr-8 py-2 border border-slate-300/80 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-0.5 rounded-md"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-600 dark:text-slate-300 font-semibold whitespace-nowrap">Account Status:</span>
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="border border-slate-300/80 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 outline-none cursor-pointer transition-all shadow-2xs"
            >
              <option value="all">All Statuses</option>
              <option value="Active">Active Only</option>
              <option value="Disabled">Disabled Only</option>
              <option value="Locked">Locked Only</option>
            </select>
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium pl-3 border-l border-slate-200/80 dark:border-slate-800 hidden md:block">
            Showing <strong className="text-slate-800 dark:text-slate-200 font-bold">{filteredTeachers.length}</strong> of <strong className="text-slate-800 dark:text-slate-200 font-bold">{teachers.length}</strong> accounts
          </div>
        </div>
      </div>

      {/* Mobile Teacher Cards View (Visible on < md) */}
      <div className="block md:hidden space-y-3.5">
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium px-1">
          <span>
            Showing <strong className="text-slate-800 dark:text-slate-200 font-bold">{filteredTeachers.length}</strong> of <strong className="text-slate-800 dark:text-slate-200 font-bold">{teachers.length}</strong> accounts
          </span>
        </div>

        {filteredTeachers.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 text-center border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <div className="flex flex-col items-center justify-center space-y-2">
              <UserCheck className="w-8 h-8 text-slate-300 dark:text-slate-600" />
              <p className="font-medium text-slate-600 dark:text-slate-300">No teacher accounts found</p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                Try adjusting your search filters or create a new user account.
              </p>
            </div>
          </div>
        ) : (
          filteredTeachers.map((tch) => {
            const isExpanded = !!expandedTeacherIds[tch.id];
            const assignedClassesList = classes.filter(
              (c) =>
                (c.class_teacher_id && c.class_teacher_id === tch.id) ||
                (tch.class_teacher_of_id &&
                  (tch.class_teacher_of_id === c.id || tch.class_teacher_of_id === c.class_name)) ||
                (tch.allocations && tch.allocations.some((a) => a.class_id === c.id || a.stream_id === c.id))
            );
            const matchedSubjects = subjects.filter(
              (s) =>
                tch.allocations &&
                tch.allocations.some(
                  (a) => a.subject_id === s.id || (a.subject_code && a.subject_code === s.subject_code)
                )
            );
            const assignedSubjectsList =
              matchedSubjects.length > 0
                ? matchedSubjects
                : (tch.allocations || [])
                    .map((a) => {
                      const sb = subjects.find(
                        (s) => s.id === a.subject_id || (a.subject_code && s.subject_code === a.subject_code)
                      );
                      return {
                        id: a.subject_id || a.id,
                        subject_name: sb?.subject_name || a.subject_name || 'Subject',
                        subject_code: sb?.subject_code || a.subject_code || '',
                        category: sb?.category || 'Core',
                        learning_area: sb?.learning_area || '',
                      };
                    })
                    .filter((s) => s.subject_name);

            return (
              <div
                key={tch.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden transition-all"
              >
                {/* Collapsed Card Header */}
                <div className="p-4 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-emerald-100/90 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-bold flex items-center justify-center text-sm border border-emerald-200/60 dark:border-emerald-800/60 shrink-0 shadow-2xs mt-0.5">
                      {tch.teacher_name ? tch.teacher_name.charAt(0).toUpperCase() : 'T'}
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm tracking-tight truncate">
                          {tch.teacher_name}
                        </h3>
                        {getStatusBadge(tch.status)}
                      </div>

                      <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 flex-wrap">
                        <span>{tch.tsc_number ? `TSC: ${tch.tsc_number}` : 'TSC: N/A'}</span>
                        <span className="text-slate-300 dark:text-slate-600">•</span>
                        <span className="font-mono bg-slate-100/80 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[11px] border border-slate-200/60 dark:border-slate-700">
                          @{tch.username || tch.email.split('@')[0]}
                        </span>
                      </p>

                      {/* Primary Class / Subject Summary Badges */}
                      <div className="flex flex-wrap gap-1 pt-1">
                        {assignedClassesList.length > 0 && (
                          <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded text-[11px] font-semibold border border-slate-200/80 dark:border-slate-700">
                            {assignedClassesList[0].class_name} {assignedClassesList[0].stream}
                            {assignedClassesList.length > 1 && ` +${assignedClassesList.length - 1} more`}
                          </span>
                        )}
                        {assignedSubjectsList.length > 0 && (
                          <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 rounded text-[11px] font-medium border border-emerald-100/80 dark:border-emerald-800/60 max-w-[140px] truncate">
                            {assignedSubjectsList[0].subject_name}
                            {assignedSubjectsList.length > 1 && ` +${assignedSubjectsList.length - 1} more`}
                          </span>
                        )}
                        {assignedClassesList.length === 0 && assignedSubjectsList.length === 0 && (
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 italic">Unassigned</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expand / Collapse Control Button */}
                  <button
                    type="button"
                    onClick={() => toggleTeacherExpand(tch.id)}
                    aria-expanded={isExpanded}
                    aria-controls={`teacher-card-details-${tch.id}`}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer shrink-0"
                    title={isExpanded ? 'Collapse details' : 'Expand details'}
                  >
                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </button>
                </div>

                {/* Expanded Details Section */}
                {isExpanded && (
                  <div
                    id={`teacher-card-details-${tch.id}`}
                    className="border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 p-4 space-y-4"
                  >
                    {/* Contact & Identification Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="space-y-1">
                        <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                          Contact
                        </span>
                        <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium break-all">
                          <Mail className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
                          <span>{tch.email}</span>
                        </div>
                        {tch.phone && (
                          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                            <Phone className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
                            <span>{tch.phone}</span>
                          </div>
                        )}
                      </div>

                      <div className="space-y-1">
                        <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                          Identification & Role
                        </span>
                        <div className="text-slate-700 dark:text-slate-300 font-medium">
                          TSC Number: <strong className="font-semibold text-slate-900 dark:text-slate-100">{tch.tsc_number || 'N/A'}</strong>
                        </div>
                        <div className="text-slate-700 dark:text-slate-300 font-medium">
                          Username: <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[11px] border border-slate-200/60 dark:border-slate-700">@{tch.username || tch.email.split('@')[0]}</code>
                        </div>
                      </div>
                    </div>

                    {/* Classes & Streams Assignment */}
                    <div className="space-y-1 text-xs">
                      <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                        Assigned Classes & Streams
                      </span>
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {assignedClassesList.length === 0 ? (
                          <span className="text-slate-400 dark:text-slate-500 italic text-[11px]">No class assignments</span>
                        ) : (
                          assignedClassesList.map((c) => (
                            <span
                              key={c.id}
                              className="px-2.5 py-1 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-semibold border border-slate-200/80 dark:border-slate-700 shadow-2xs"
                            >
                              {c.class_name} {c.stream}
                            </span>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Learning Areas Assignment */}
                    <div className="space-y-1 text-xs">
                      <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                        Assigned Learning Areas
                      </span>
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {assignedSubjectsList.length === 0 ? (
                          <span className="text-slate-400 dark:text-slate-500 italic text-[11px]">No learning area assignments</span>
                        ) : (
                          assignedSubjectsList.map((s) => (
                            <span
                              key={s.id}
                              className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 rounded-lg text-xs font-medium border border-emerald-100/80 dark:border-emerald-800/60 shadow-2xs"
                            >
                              {s.subject_name}
                            </span>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Audit Information */}
                    <div className="space-y-1 text-xs pt-1 border-t border-slate-200/60 dark:border-slate-800">
                      <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                        Audit Information
                      </span>
                      <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                        <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                        <span>
                          {tch.last_login ? (
                            `Last Login: ${new Date(tch.last_login).toLocaleDateString()} ${new Date(tch.last_login).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                          ) : (
                            'Never logged in'
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Mobile Action Controls */}
                    <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 space-y-2">
                      <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                        Account Actions
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        {/* View Profile */}
                        <button
                          type="button"
                          onClick={() => {
                            setViewingTeacher(tch);
                            setDetailTab('profile');
                          }}
                          className="min-h-[44px] px-3 py-2.5 bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 hover:text-[#075E42] dark:hover:text-emerald-400 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                        >
                          <Eye className="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400" />
                          <span>View Profile</span>
                        </button>

                        {/* Edit Teacher */}
                        <button
                          type="button"
                          onClick={() => openEditTeacherModal(tch)}
                          className="min-h-[44px] px-3 py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400" />
                          <span>Edit Teacher</span>
                        </button>

                        {/* Reset Password */}
                        <button
                          type="button"
                          onClick={() => {
                            setResetPasswordTeacher(tch);
                            setNewResetPassword('Teacher@2026');
                            setConfirmResetPassword('Teacher@2026');
                            setResetForceChange(true);
                            setResetError(null);
                            setResetSuccess(null);
                          }}
                          className="min-h-[44px] px-3 py-2.5 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 hover:text-blue-700 dark:hover:text-blue-400 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                        >
                          <KeyRound className="w-4 h-4 shrink-0 text-blue-500 dark:text-blue-400" />
                          <span>Reset Password</span>
                        </button>

                        {/* Status Toggle */}
                        {tch.status === 'Disabled' || tch.status === 'Locked' ? (
                          <button
                            type="button"
                            onClick={() => handleStatusChange(tch, 'Active')}
                            className="min-h-[44px] px-3 py-2.5 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/80 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                          >
                            <Unlock className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                            <span>Enable Account</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleStatusChange(tch, 'Disabled')}
                            className="min-h-[44px] px-3 py-2.5 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/80 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                          >
                            <Ban className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                            <span>Disable Account</span>
                          </button>
                        )}
                      </div>

                      {/* Delete Account */}
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => setDeletingTeacher(tch)}
                          className="w-full min-h-[44px] px-3 py-2.5 bg-rose-50/60 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200/80 dark:border-rose-900/60 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                          <span>Delete Account</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Teachers List Table (Desktop View, Visible on >= md) */}
      <div className="hidden md:block bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-800/80 border-b border-slate-200/80 dark:border-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                <th className="py-3.5 px-4">Teacher / Staff</th>
                <th className="py-3.5 px-4">Contact</th>
                <th className="py-3.5 px-4">TSC / Username</th>
                <th className="py-3.5 px-4">Classes & Streams</th>
                <th className="py-3.5 px-4">Learning Areas</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Last Login</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs text-slate-700 dark:text-slate-300">
              {filteredTeachers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 dark:text-slate-500">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <UserCheck className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                      <p className="font-medium text-slate-600 dark:text-slate-300">No teacher accounts found</p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500">Try adjusting your search filters or create a new user account.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTeachers.map((tch) => {
                  const assignedClassesList = classes.filter((c) =>
                    (c.class_teacher_id && c.class_teacher_id === tch.id) ||
                    (tch.class_teacher_of_id && (tch.class_teacher_of_id === c.id || tch.class_teacher_of_id === c.class_name)) ||
                    (tch.allocations && tch.allocations.some(a => a.class_id === c.id || a.stream_id === c.id))
                  );
                  const matchedSubjects = subjects.filter((s) =>
                    tch.allocations && tch.allocations.some(a => a.subject_id === s.id || (a.subject_code && a.subject_code === s.subject_code))
                  );
                  const assignedSubjectsList = matchedSubjects.length > 0
                    ? matchedSubjects
                    : (tch.allocations || []).map((a) => {
                        const sb = subjects.find((s) => s.id === a.subject_id || (a.subject_code && s.subject_code === a.subject_code));
                        return {
                          id: a.subject_id || a.id,
                          subject_name: sb?.subject_name || a.subject_name || 'Subject',
                          subject_code: sb?.subject_code || a.subject_code || '',
                          category: sb?.category || 'Core',
                          learning_area: sb?.learning_area || '',
                        };
                      }).filter((s) => s.subject_name);

                  return (
                    <tr key={tch.id} className="hover:bg-emerald-50/30 dark:hover:bg-slate-800/50 transition-colors">
                      {/* Teacher Name & Identity */}
                      <td className="py-3.5 px-4 font-medium text-slate-900 dark:text-slate-100">
                        <div className="flex items-center space-x-3">
                          <div className="w-9 h-9 rounded-full bg-emerald-100/90 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-bold flex items-center justify-center text-xs border border-emerald-200/60 dark:border-emerald-800/60 shrink-0 shadow-2xs">
                            {tch.teacher_name ? tch.teacher_name.charAt(0).toUpperCase() : 'T'}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 dark:text-slate-100 text-sm block tracking-tight">{tch.teacher_name}</span>
                          </div>
                        </div>
                      </td>

                      {/* Contact Info */}
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                        <div className="space-y-0.5">
                          <span className="text-xs text-slate-700 dark:text-slate-300 font-medium flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" /> {tch.email}
                          </span>
                          {tch.phone && (
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                              <Phone className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" /> {tch.phone}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* TSC & Username */}
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                        <div className="space-y-1">
                          <span className="block font-semibold text-slate-800 dark:text-slate-200 text-xs">
                            {tch.tsc_number ? `TSC: ${tch.tsc_number}` : 'TSC: N/A'}
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono bg-slate-100/80 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200/60 dark:border-slate-700 inline-block">
                            @{tch.username || tch.email.split('@')[0]}
                          </span>
                        </div>
                      </td>

                      {/* Classes & Streams */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {assignedClassesList.length === 0 ? (
                            <span className="inline-flex items-center text-[11px] font-medium text-slate-400 dark:text-slate-500 italic bg-slate-100/80 dark:bg-slate-800 px-2.5 py-0.5 rounded border border-slate-200/50 dark:border-slate-700">
                              Unassigned
                            </span>
                          ) : (
                            assignedClassesList.map((c) => (
                              <span key={c.id} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded text-[11px] font-semibold border border-slate-200/80 dark:border-slate-700">
                                {c.class_name} {c.stream}
                              </span>
                            ))
                          )}
                        </div>
                      </td>

                      {/* Learning Areas */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {assignedSubjectsList.length === 0 ? (
                            <span className="inline-flex items-center text-[11px] font-medium text-slate-400 dark:text-slate-500 italic bg-slate-100/80 dark:bg-slate-800 px-2.5 py-0.5 rounded border border-slate-200/50 dark:border-slate-700">
                              Unassigned
                            </span>
                          ) : (
                            assignedSubjectsList.map((s) => (
                              <span
                                key={s.id}
                                title={s.subject_name}
                                className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 rounded text-[11px] font-medium border border-emerald-100/80 dark:border-emerald-800/60 max-w-[130px] truncate inline-block"
                              >
                                {s.subject_name}
                              </span>
                            ))
                          )}
                        </div>
                      </td>

                      {/* Account Status */}
                      <td className="py-3.5 px-4">
                        {getStatusBadge(tch.status)}
                      </td>

                      {/* Last Login */}
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 text-xs">
                        {tch.last_login ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 font-medium">
                            <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                            {new Date(tch.last_login).toLocaleDateString()} {new Date(tch.last_login).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-400 dark:text-slate-500 bg-slate-100/80 dark:bg-slate-800 px-2.5 py-0.5 rounded border border-slate-200/50 dark:border-slate-700">
                            <Clock className="w-3 h-3 text-slate-400 dark:text-slate-500 shrink-0" /> Never logged in
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          {/* View Audit Logs & Profile */}
                          <button
                            type="button"
                            title="View Account Profile & Login History"
                            onClick={() => {
                              setViewingTeacher(tch);
                              setDetailTab('profile');
                            }}
                            className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-[#075E42] dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Reset Password */}
                          <button
                            type="button"
                            title="Reset Password"
                            onClick={() => {
                              setResetPasswordTeacher(tch);
                              setNewResetPassword('Teacher@2026');
                              setConfirmResetPassword('Teacher@2026');
                              setResetForceChange(true);
                              setResetError(null);
                              setResetSuccess(null);
                            }}
                            className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-blue-700 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>

                          {/* Account Status Toggle */}
                          {tch.status === 'Disabled' ? (
                            <button
                              type="button"
                              title="Enable Account"
                              onClick={() => handleStatusChange(tch, 'Active')}
                              className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                            >
                              <Unlock className="w-4 h-4" />
                            </button>
                          ) : tch.status === 'Locked' ? (
                            <button
                              type="button"
                              title="Unlock Account"
                              onClick={() => handleStatusChange(tch, 'Active')}
                              className="p-1.5 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                            >
                              <Unlock className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              title="Disable Account"
                              onClick={() => handleStatusChange(tch, 'Disabled')}
                              className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-amber-700 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          )}

                          {/* Edit Teacher */}
                          <button
                            type="button"
                            title="Edit Teacher Record"
                            onClick={() => openEditTeacherModal(tch)}
                            className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* Delete Account */}
                          <button
                            type="button"
                            title="Delete Account"
                            onClick={() => setDeletingTeacher(tch)}
                            className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE ACCOUNT MODAL */}
      {isAddingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white dark:bg-slate-900 z-10">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Create New User Account</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Administrator creation of accounts using Supabase Auth.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAddingModalOpen(false)}
                className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-2 text-xs text-red-700 dark:text-red-300 font-medium">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-2 text-xs text-emerald-800 dark:text-emerald-300 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{formSuccess}</span>
                </div>
              )}

              {/* Role Selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  User Role <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setCreateRole('class_teacher')}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition ${
                      createRole === 'class_teacher'
                        ? 'bg-emerald-50 dark:bg-emerald-950/80 border-emerald-500 dark:border-emerald-600 text-emerald-800 dark:text-emerald-300 ring-2 ring-emerald-500/20'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Class Teacher</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCreateRole('subject_teacher')}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition ${
                      createRole === 'subject_teacher'
                        ? 'bg-amber-50 dark:bg-amber-950/80 border-amber-500 dark:border-amber-600 text-amber-800 dark:text-amber-300 ring-2 ring-amber-500/20'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    <BookOpen className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>Subject Teacher</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCreateRole('admin')}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition ${
                      createRole === 'admin'
                        ? 'bg-blue-50 dark:bg-blue-950/80 border-blue-500 dark:border-blue-600 text-blue-800 dark:text-blue-300 ring-2 ring-blue-500/20'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>Administrator</span>
                  </button>
                </div>
              </div>

              {/* Name & TSC */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Madam Grace Wanjiku"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    TSC Number <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={tscNumber}
                    onChange={(e) => setTscNumber(e.target.value)}
                    placeholder="e.g. TSC-789012"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Email & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="grace.wanjiku@school.ac.ke"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+254 722 000 111"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Username & Account Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Username <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="gwanjiku"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Initial Account Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as AccountStatus)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                  >
                    <option value="Active">Active (Can log in)</option>
                    <option value="Disabled">Disabled (Access denied)</option>
                    <option value="Locked">Locked (Locked by Admin)</option>
                  </select>
                </div>
              </div>

              {/* Temporary Password & Confirmation */}
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <KeyRound className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Temporary Password Credentials</span>
                  </span>
                  <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded font-medium">
                    Supabase Auth
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Temporary Password <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={tempPassword}
                      onChange={(e) => setTempPassword(e.target.value)}
                      placeholder="Teacher@2026"
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Confirm Temporary Password <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={confirmTempPassword}
                      onChange={(e) => setConfirmTempPassword(e.target.value)}
                      placeholder="Teacher@2026"
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2 pt-1">
                  <input
                    type="checkbox"
                    id="forcePasswordChange"
                    checked={forcePasswordChange}
                    onChange={(e) => setForcePasswordChange(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 border-slate-300 dark:border-slate-700"
                  />
                  <label htmlFor="forcePasswordChange" className="text-xs text-slate-700 dark:text-slate-300 font-medium cursor-pointer">
                    Force password change on first login <span className="text-slate-400 font-normal">(Recommended)</span>
                  </label>
                </div>
              </div>

              {/* Assigned Class Selection (Class Teachers Only) */}
              {createRole === 'class_teacher' && (
                <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                      Assigned Class <span className="text-red-500">*</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Education Level</label>
                      <select
                        required
                        value={assignedEduLevel}
                        onChange={(e) => {
                          setAssignedEduLevel(e.target.value as EducationLevel);
                          setAssignedClassLevel('');
                          setAssignedStreamId('');
                        }}
                        className="w-full px-2 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                      >
                        {ALL_EDUCATION_LEVELS.map(level => (
                          <option key={level} value={level}>{level}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Class</label>
                      <select
                        required
                        value={assignedClassLevel}
                        onChange={(e) => {
                          setAssignedClassLevel(e.target.value);
                          setAssignedStreamId('');
                        }}
                        className="w-full px-2 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                      >
                        <option value="">Select...</option>
                        {sortGrades(Array.from(new Set(classes.filter(c => c.education_level === assignedEduLevel).map(c => c.class_name)))).map(cName => (
                          <option key={cName} value={cName}>{cName}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Stream</label>
                      <select
                        required
                        value={assignedStreamId}
                        onChange={(e) => setAssignedStreamId(e.target.value)}
                        className="w-full px-2 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                      >
                        <option value="">Select...</option>
                        {sortClasses(classes.filter(c => c.class_name === assignedClassLevel)).map(c => (
                          <option key={c.id} value={c.id}>{c.stream}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Teaching Allocations Selection */}
              {((createRole === 'class_teacher' && (assignedEduLevel === 'Upper Primary' || assignedEduLevel === 'Junior School')) || createRole === 'subject_teacher') && (
                <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                      {createRole === 'class_teacher' ? 'Additional Teaching Allocations' : 'Teaching Allocations'}
                    </label>
                    <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 rounded-full">
                      {allocations.length} Added
                    </span>
                  </div>

                  {allocations.length > 0 && (
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                      {allocations.map((alloc) => {
                        const cl = classes.find(c => c.id === alloc.class_id);
                        const sb = subjects.find(s => s.id === alloc.subject_id);
                        return (
                          <div key={alloc.id} className="flex flex-row items-center justify-between bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-2.5 rounded-lg shadow-sm">
                            <div>
                              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                {cl ? `${cl.class_name} ${cl.stream}` : alloc.class_id} — {sb ? sb.subject_name : alloc.subject_id}
                              </div>
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                                {alloc.education_level}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeAllocation(alloc.id)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-slate-700 p-1.5 rounded-md transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Level</label>
                      <select
                        value={allocEduLevel}
                        onChange={(e) => {
                          setAllocEduLevel(e.target.value as EducationLevel);
                          setAllocClassLevel('');
                          setAllocStreamId('');
                          setAllocSubjectId('');
                        }}
                        className="w-full px-2 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                      >
                        {ALL_EDUCATION_LEVELS.map(level => (
                          <option key={level} value={level}>{level}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Class</label>
                      <select
                        value={allocClassLevel}
                        onChange={(e) => {
                          setAllocClassLevel(e.target.value);
                          setAllocStreamId('');
                        }}
                        className="w-full px-2 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                      >
                        <option value="">Select...</option>
                        {sortGrades(Array.from(new Set(classes.filter(c => c.education_level === allocEduLevel).map(c => c.class_name)))).map(cName => (
                          <option key={cName} value={cName}>{cName}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Stream</label>
                      <select
                        value={allocStreamId}
                        onChange={(e) => setAllocStreamId(e.target.value)}
                        className="w-full px-2 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                      >
                        <option value="">Select...</option>
                        {sortClasses(classes.filter(c => c.class_name === allocClassLevel)).map(c => (
                          <option key={c.id} value={c.id}>{c.stream}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 dark:text-slate-400 mb-1">Learning Area</label>
                      <select
                        value={allocSubjectId}
                        onChange={(e) => setAllocSubjectId(e.target.value)}
                        className="w-full px-2 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                      >
                        <option value="">Select...</option>
                        {subjects.filter(s => s.education_level === allocEduLevel || !s.education_level).map(s => (
                          <option key={s.id} value={s.id}>{s.subject_name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddAllocation}
                    className="w-full mt-2 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-lg transition flex justify-center items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Allocation
                  </button>
                </div>
              )}

              {/* Modal Buttons */}
              <div className="pt-3 flex items-center justify-end space-x-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddingModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Creating Account...</span>
                    </>
                  ) : (
                    <span>Create Account in Supabase</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT TEACHER MODAL */}
      {editingTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-800/50">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 flex items-center justify-center font-bold text-xs">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Edit Teacher Record</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Manage teacher profile, class assignments, and teaching allocations</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingTeacher(null)}
                className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditTeacher} className="p-6 space-y-6 overflow-y-auto flex-1 text-xs">
              {/* Error & Success Messages */}
              {editFormError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 rounded-xl flex items-start gap-2 text-xs">
                  <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <span>{editFormError}</span>
                </div>
              )}
              {editFormSuccess && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-xl flex items-center gap-2 text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span>{editFormSuccess}</span>
                </div>
              )}

              {isLoadingTeacherData ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 space-y-2">
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-600 dark:text-emerald-400" />
                  <p className="text-xs font-medium">Loading teacher database record...</p>
                </div>
              ) : (
                <>
                  {/* SECTION 1: Personal Information */}
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                      <UserIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <h4 className="font-bold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider">Personal Information</h4>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Full Name <span className="text-rose-500">*</span></label>
                        <input
                          type="text"
                          required
                          value={editTeacherName}
                          onChange={(e) => setEditTeacherName(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                          placeholder="Full Name"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Email Address <span className="text-rose-500">*</span></label>
                        <input
                          type="email"
                          required
                          value={editEmail}
                          onChange={(e) => setEditEmail(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                          placeholder="teacher@school.ac.ke"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Phone Number</label>
                        <input
                          type="text"
                          value={editPhone}
                          onChange={(e) => setEditPhone(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                          placeholder="+254 700 000 000"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">TSC Number</label>
                        <input
                          type="text"
                          value={editTscNumber}
                          onChange={(e) => setEditTscNumber(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                          placeholder="e.g. TSC123456"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Account Status</label>
                        <select
                          value={editStatus}
                          onChange={(e) => setEditStatus(e.target.value as AccountStatus)}
                          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                        >
                          <option value="Active">Active</option>
                          <option value="Disabled">Disabled</option>
                          <option value="Locked">Locked</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* SECTION 2: Class Teacher Assignment */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                      <div className="flex items-center space-x-2">
                        <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <h4 className="font-bold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider">Class Teacher Assignment</h4>
                      </div>
                      {editClassStreamId ? (
                        <button
                          type="button"
                          onClick={() => {
                            setEditClassStreamId('');
                            setEditClassGrade('');
                          }}
                          className="text-[11px] text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 font-medium underline"
                        >
                          Unassign Class Teacher
                        </button>
                      ) : null}
                    </div>

                    {/* Current Assignment Status Badge */}
                    <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 rounded-xl p-3 flex items-center justify-between">
                      <div className="text-xs">
                        <span className="text-slate-500 dark:text-slate-400 font-medium">Class Teacher Status: </span>
                        {editClassStreamId ? (
                          (() => {
                            const strm = classes.find((c) => c.id === editClassStreamId);
                            return (
                              <span className="font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-100/90 dark:bg-emerald-950 px-2.5 py-1 rounded-lg border border-emerald-200/80 dark:border-emerald-800 inline-flex items-center gap-1.5 ml-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                Class Teacher of {strm ? `${strm.class_name} — ${strm.stream}` : editClassGrade || 'Class'}
                              </span>
                            );
                          })()
                        ) : (
                          <span className="font-semibold text-slate-500 dark:text-slate-400 bg-slate-200/70 dark:bg-slate-700 px-2 py-0.5 rounded ml-1 italic">
                            Unassigned
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Class Teacher Assignment Dropdowns */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50/50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Education Level</label>
                        <select
                          value={editClassEduLevel}
                          onChange={(e) => {
                            const lvl = e.target.value as EducationLevel;
                            setEditClassEduLevel(lvl);
                            setEditClassGrade('');
                            setEditClassStreamId('');
                          }}
                          className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                        >
                          {ALL_EDUCATION_LEVELS.map((lvl) => (
                            <option key={lvl} value={lvl}>{lvl}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Class / Grade</label>
                        <select
                          value={editClassGrade}
                          onChange={(e) => {
                            setEditClassGrade(e.target.value);
                            setEditClassStreamId('');
                          }}
                          className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                        >
                          <option value="">Select Class...</option>
                          {sortGrades(
                            Array.from(
                              new Set(
                                classes
                                  .filter((c) => (c.education_level || getEducationLevelForGrade(c.class_name)) === editClassEduLevel)
                                  .map((c) => c.class_name)
                              )
                            )
                          ).map((grade) => (
                            <option key={grade} value={grade}>{grade}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Stream</label>
                        <select
                          value={editClassStreamId}
                          onChange={(e) => setEditClassStreamId(e.target.value)}
                          disabled={!editClassGrade}
                          className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 disabled:bg-slate-100 dark:disabled:bg-slate-900 disabled:text-slate-400 dark:disabled:text-slate-600"
                        >
                          <option value="">Select Stream...</option>
                          {classes
                            .filter((c) => c.class_name === editClassGrade)
                            .map((c) => (
                              <option key={c.id} value={c.id}>{c.stream}</option>
                            ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* SECTION 3: Learning Areas & Teaching Allocations */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                      <div className="flex items-center space-x-2">
                        <BookOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <h4 className="font-bold text-slate-800 dark:text-slate-200 text-xs uppercase tracking-wider">Learning Areas & Teaching Allocations</h4>
                      </div>
                      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                        {editAllocations.length} {editAllocations.length === 1 ? 'allocation' : 'allocations'}
                      </span>
                    </div>

                    {/* Current Allocations List */}
                    <div className="space-y-2">
                      {editAllocations.length === 0 ? (
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-center text-slate-400 dark:text-slate-500 text-xs">
                          <p className="font-medium text-slate-500 dark:text-slate-400">Unassigned</p>
                          <p className="text-[11px] text-slate-400 dark:text-slate-500">No learning area allocations assigned yet. Use the form below to add allocations.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1">
                          {editAllocations.map((alloc) => {
                            const matchedCls = classes.find((c) => c.id === alloc.class_id);
                            const matchedSub = subjects.find((s) => s.id === alloc.subject_id);
                            const classNameStr = matchedCls ? matchedCls.class_name : alloc.class_name || 'Class';
                            const streamStr = matchedCls ? matchedCls.stream : alloc.stream || '';
                            const subjectNameStr = matchedSub ? matchedSub.subject_name : alloc.subject_name || 'Subject';

                            return (
                              <div
                                key={alloc.id}
                                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 flex items-center justify-between shadow-2xs hover:border-emerald-200 dark:hover:border-emerald-700 transition-colors"
                              >
                                <div className="min-w-0 flex-1 pr-2">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                                      {classNameStr} {streamStr ? `— ${streamStr}` : ''}
                                    </span>
                                    {alloc.education_level && (
                                      <span className="text-[10px] font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-950 px-1.5 py-0.2 rounded">
                                        {alloc.education_level}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-600 dark:text-slate-300 font-medium truncate mt-0.5">{subjectNameStr}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleEditRemoveAllocation(alloc.id)}
                                  title="Remove Allocation"
                                  className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-slate-700 rounded-lg transition-colors shrink-0"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Add Allocation Form inside Edit Modal */}
                    <div className="bg-slate-50/80 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 space-y-3">
                      <h5 className="font-bold text-slate-800 dark:text-slate-200 text-[11px] flex items-center gap-1.5 uppercase tracking-wider">
                        <Plus className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> Add Learning Area Allocation
                      </h5>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Education Level</label>
                          <select
                            value={editAddEduLevel}
                            onChange={(e) => {
                              const lvl = e.target.value as EducationLevel;
                              setEditAddEduLevel(lvl);
                              setEditAddGrade('');
                              setEditAddStreamId('');
                              setEditAddSubjectId('');
                            }}
                            className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                          >
                            {ALL_EDUCATION_LEVELS.map((lvl) => (
                              <option key={lvl} value={lvl}>{lvl}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Class / Grade</label>
                          <select
                            value={editAddGrade}
                            onChange={(e) => {
                              setEditAddGrade(e.target.value);
                              setEditAddStreamId('');
                            }}
                            className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                          >
                            <option value="">Select Class...</option>
                            {sortGrades(
                              Array.from(
                                new Set(
                                  classes
                                    .filter((c) => (c.education_level || getEducationLevelForGrade(c.class_name)) === editAddEduLevel)
                                    .map((c) => c.class_name)
                                )
                              )
                            ).map((grade) => (
                              <option key={grade} value={grade}>{grade}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Stream</label>
                          <select
                            value={editAddStreamId}
                            onChange={(e) => setEditAddStreamId(e.target.value)}
                            disabled={!editAddGrade}
                            className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 disabled:bg-slate-100 dark:disabled:bg-slate-900 disabled:text-slate-400 dark:disabled:text-slate-600"
                          >
                            <option value="">Select Stream...</option>
                            {classes
                              .filter((c) => c.class_name === editAddGrade)
                              .map((c) => (
                                <option key={c.id} value={c.id}>{c.stream}</option>
                              ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">Learning Area / Subject</label>
                          <select
                            value={editAddSubjectId}
                            onChange={(e) => setEditAddSubjectId(e.target.value)}
                            disabled={!editAddEduLevel}
                            className="w-full px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 disabled:bg-slate-100 dark:disabled:bg-slate-900 disabled:text-slate-400 dark:disabled:text-slate-600"
                          >
                            <option value="">Select Learning Area...</option>
                            {subjects
                              .filter((s) => (s.education_level === editAddEduLevel || !s.education_level) && (!s.applicable_grades || s.applicable_grades.length === 0 || (editAddGrade && s.applicable_grades.includes(editAddGrade))))
                              .map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.subject_name} ({s.subject_code})
                                </option>
                              ))}
                          </select>
                        </div>
                      </div>

                      <div className="flex justify-end pt-1">
                        <button
                          type="button"
                          onClick={handleEditAddAllocation}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-xs flex items-center gap-1 shadow-2xs cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Allocation
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Modal Footer */}
              <div className="pt-4 flex items-center justify-end space-x-2 border-t border-slate-100 dark:border-slate-800 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingTeacher(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingTeacher || isLoadingTeacherData}
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 rounded-xl shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {isSavingTeacher ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {resetPasswordTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 w-full max-w-md overflow-hidden">
            <div className="bg-gradient-to-r from-blue-700 to-indigo-700 p-5 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <KeyRound className="w-5 h-5 text-blue-200" />
                <h3 className="font-bold text-sm">Reset Teacher Password</h3>
              </div>
              <button
                onClick={() => setResetPasswordTeacher(null)}
                className="text-blue-200 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleResetPasswordSubmit} className="p-6 space-y-4">
              {resetError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300">
                  {resetError}
                </div>
              )}

              {resetSuccess && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 font-medium">
                  {resetSuccess}
                </div>
              )}

              <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                <div className="font-semibold text-slate-800 dark:text-slate-200">{resetPasswordTeacher.teacher_name}</div>
                <div className="text-slate-500 dark:text-slate-400">{resetPasswordTeacher.email}</div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  New Temporary Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newResetPassword}
                  onChange={(e) => setNewResetPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl text-xs font-mono focus:ring-2 focus:ring-[#176B45] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Confirm Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={confirmResetPassword}
                  onChange={(e) => setConfirmResetPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-xl text-xs font-mono focus:ring-2 focus:ring-[#176B45] focus:outline-none"
                />
              </div>

              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="checkbox"
                  id="resetForceChange"
                  checked={resetForceChange}
                  onChange={(e) => setResetForceChange(e.target.checked)}
                  className="w-4 h-4 text-[#176B45] rounded focus:ring-[#176B45] border-slate-300 dark:border-slate-700"
                />
                <label htmlFor="resetForceChange" className="text-xs text-slate-700 dark:text-slate-300 font-medium cursor-pointer">
                  Force password change on next login
                </label>
              </div>

              <div className="pt-3 flex justify-end space-x-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setResetPasswordTeacher(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-[#176B45] hover:bg-[#0F5132] rounded-xl shadow-sm"
                >
                  Reset Password Now
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW TEACHER & LOGIN HISTORY MODAL */}
      {viewingTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-900 text-white">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-sm border border-emerald-500/30">
                  {viewingTeacher.teacher_name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">{viewingTeacher.teacher_name}</h3>
                  <p className="text-[11px] text-slate-400">{viewingTeacher.email}</p>
                </div>
              </div>
              <button
                onClick={() => setViewingTeacher(null)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs Header */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 px-5 gap-4">
              <button
                onClick={() => setDetailTab('profile')}
                className={`py-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
                  detailTab === 'profile'
                    ? 'border-emerald-600 dark:border-emerald-500 text-emerald-700 dark:text-emerald-400'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <UserIcon className="w-4 h-4" />
                <span>Account Profile</span>
              </button>

              <button
                onClick={() => setDetailTab('allocations')}
                className={`py-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
                  detailTab === 'allocations'
                    ? 'border-emerald-600 dark:border-emerald-500 text-emerald-700 dark:text-emerald-400'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>Classes & Learning Areas</span>
              </button>

              <button
                onClick={() => setDetailTab('logs')}
                className={`py-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
                  detailTab === 'logs'
                    ? 'border-emerald-600 dark:border-emerald-500 text-emerald-700 dark:text-emerald-400'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <History className="w-4 h-4" />
                <span>Login History Audit ({currentViewingLogs.length})</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1">
              {detailTab === 'profile' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                      <span className="text-[11px] text-slate-400 uppercase font-semibold block">Full Name</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs">{viewingTeacher.teacher_name}</span>
                    </div>

                    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                      <span className="text-[11px] text-slate-400 uppercase font-semibold block">Email</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs">{viewingTeacher.email}</span>
                    </div>

                    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                      <span className="text-[11px] text-slate-400 uppercase font-semibold block">Phone</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs">{viewingTeacher.phone}</span>
                    </div>

                    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                      <span className="text-[11px] text-slate-400 uppercase font-semibold block">TSC Number</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs">{viewingTeacher.tsc_number || 'N/A'}</span>
                    </div>

                    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                      <span className="text-[11px] text-slate-400 uppercase font-semibold block">Account Status</span>
                      <div>{getStatusBadge(viewingTeacher.status)}</div>
                    </div>

                    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                      <span className="text-[11px] text-slate-400 uppercase font-semibold block">Password Flag</span>
                      <span className="font-semibold text-xs">
                        {viewingTeacher.force_password_change ? (
                          <span className="text-amber-600 dark:text-amber-400 font-bold">Must change password on first login</span>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">Password set</span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {detailTab === 'allocations' && (
                <div className="space-y-4">
                  {/* Class Teacher assignment if applicable */}
                  {(() => {
                    const ctStream = classes.find(c => c.class_teacher_id === viewingTeacher.id || viewingTeacher.class_teacher_of_id === c.id);
                    if (ctStream || viewingTeacher.is_class_teacher) {
                      return (
                        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-1">
                          <span className="text-[10px] uppercase font-bold text-emerald-800 dark:text-emerald-300 tracking-wider">Class Teacher Role</span>
                          <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            {ctStream ? `Class Teacher of ${ctStream.class_name} ${ctStream.stream}` : 'Assigned Class Teacher'}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  <div>
                    <h4 className="font-bold text-slate-800 dark:text-slate-200 text-xs mb-2">Teaching Allocations</h4>
                    <div className="flex flex-col gap-2">
                      {viewingTeacher.allocations && viewingTeacher.allocations.length > 0 ? (
                        viewingTeacher.allocations.map((alloc) => {
                          const cl = classes.find((c) => c.id === alloc.class_id);
                          const sb = subjects.find((s) => s.id === alloc.subject_id);
                          return (
                            <div key={alloc.id} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                              <div>
                                <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
                                  {cl ? `${cl.class_name} ${cl.stream}` : alloc.class_id}
                                </span>
                                <span className="text-slate-400 mx-2">—</span>
                                <span className="font-semibold text-emerald-700 dark:text-emerald-400 text-xs">
                                  {sb ? sb.subject_name : alloc.subject_id}
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                                {alloc.education_level}
                              </span>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-xs text-slate-400 dark:text-slate-500">No additional subject allocations assigned.</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {detailTab === 'logs' && (
                <div className="space-y-3">
                  {currentViewingLogs.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 dark:text-slate-500 text-xs">
                      No login attempts recorded yet for this account.
                    </div>
                  ) : (
                    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                            <th className="py-2.5 px-3">Date & Time</th>
                            <th className="py-2.5 px-3">Status</th>
                            <th className="py-2.5 px-3">Device & Browser</th>
                            <th className="py-2.5 px-3">IP Address</th>
                            <th className="py-2.5 px-3">Remarks / Reason</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                          {currentViewingLogs.map((log) => (
                            <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                              <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200">
                                {log.date} {log.time}
                              </td>
                              <td className="py-2.5 px-3">
                                {log.status === 'Success' ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                                    Success
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300">
                                    Failed
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                                {log.device} &bull; {log.browser}
                              </td>
                              <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                                {log.ip_address}
                              </td>
                              <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">
                                {log.reason || 'Normal Sign In'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end">
              <button
                onClick={() => setViewingTeacher(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 w-full max-w-sm p-6 space-y-4 text-center">
            <div className="w-12 h-12 bg-red-100 dark:bg-red-950/80 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Delete Teacher Account</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Are you sure you want to delete <strong className="text-slate-800 dark:text-slate-200">{deletingTeacher.teacher_name}</strong>? This will permanently remove their user credentials and class assignments.
              </p>
            </div>

            {deleteError && (
              <div className="p-2.5 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-600 dark:text-red-400 text-left">
                {deleteError}
              </div>
            )}

            <div className="flex justify-center space-x-2 pt-2">
              <button
                onClick={() => {
                  setDeletingTeacher(null);
                  setDeleteError(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={isSubmitting}
                className="px-5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-500 rounded-xl shadow-sm disabled:opacity-50"
              >
                {isSubmitting ? 'Deleting...' : 'Yes, Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
