import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Database,
  RefreshCw,
  X,
  Terminal,
  GraduationCap,
} from 'lucide-react';
import {
  School,
  User,
  Teacher,
  ClassStream,
  Student,
  Subject,
  Examination,
  Mark,
  Grade,
  VerificationLog,
  Role,
} from './types';
import {
  api,
  testSupabaseConnection,
  syncFromSupabase,
} from './lib/storage';
import { getActiveTeacher } from './utils/rbacUtils';
import { authService } from './services/authService';
import { AcademicSessionProvider } from './contexts/AcademicSessionContext';

import { Header } from './components/Header';
import { Sidebar, TabType } from './components/Sidebar';
import { LoginPage } from './components/LoginPage';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { UnauthorizedView } from './components/UnauthorizedView';
import { AdminDashboard } from './components/AdminDashboard';
import { TeacherDashboard } from './components/TeacherDashboard';

import { StudentRegistration } from './components/StudentRegistration';
import { TeacherManagement } from './components/TeacherManagement';
import { ClassSubjectManagement } from './components/ClassSubjectManagement';
import { ExaminationManagement } from './components/ExaminationManagement';
import { MarksEntryTable } from './components/MarksEntryTable';
import { ProvisionalResultsView } from './components/ProvisionalResultsView';
import { ExaminationAnalysisValidation } from './components/ExaminationAnalysisValidation';
import { ReportsView } from './components/ReportsView';
import { GradingSettings } from './components/GradingSettings';
import { SchoolPerformanceAnalytics } from './components/SchoolPerformanceAnalytics';
import { AcademicSessionManagement } from './components/AcademicSessionManagement';
import { StudentPromotionModule } from './components/StudentPromotionModule';
import { SchoolProfileModal } from './components/SchoolProfileModal';
import { SchoolProfileView } from './components/SchoolProfileView';
import { SupabaseModal } from './components/SupabaseModal';
import { LearnerProfileModal } from './components/LearnerProfileModal';
import { GlobalSearchModal } from './components/GlobalSearchModal';
import { SystemSettingsPage } from './components/SystemSettingsPage';
import { DeveloperSettingsPage } from './components/DeveloperSettingsPage';

export const ROLE_ALLOWED_TABS: Record<Role, TabType[]> = {
  admin: [
    'dashboard',
    'academic-session',
    'students',
    'student-promotion',
    'teachers',
    'classes',
    'subjects',
    'subject-groups',
    'exams',
    'marks-entry',
    'provisional',
    'exam-validation',
    'reports',
    'school-analytics',
    'grading',
    'school-profile',
    'system-settings',
    'developer-mode',
  ],
  class_teacher: [
    'dashboard',
    'academic-session',
    'students',
    'marks-entry',
    'provisional',
    'exam-validation',
    'reports',
  ],
  subject_teacher: [
    'dashboard',
    'academic-session',
    'marks-entry',
    'provisional',
    'exam-validation',
    'reports',
  ],
};

const isTabAllowedForRole = (user: User | null, tab: TabType, activeTeacher: Teacher | null): boolean => {
  if (!user) return false;
  if (user.role === 'admin') {
    return ROLE_ALLOWED_TABS.admin.includes(tab as any);
  }
  if (user.role === 'class_teacher') {
    return ROLE_ALLOWED_TABS.class_teacher.includes(tab as any);
  }
  if (user.role === 'subject_teacher') {
    return ROLE_ALLOWED_TABS.subject_teacher.includes(tab as any);
  }
  return false;
};

export default function App() {

  // Authentication & Session State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isAuthChecking, setIsAuthChecking] = useState<boolean>(true);

  // Database State
  const [school, setSchool] = useState<School>(api.getSchool());
  const [teachers, setTeachers] = useState<Teacher[]>(api.getTeachers());
  const [classes, setClasses] = useState<ClassStream[]>(api.getClasses());
  const [students, setStudents] = useState<Student[]>(api.getStudents());
  const [marksStudents, setMarksStudents] = useState<Student[]>(api.getAllStudentsForMarks());
  const [subjects, setSubjects] = useState<Subject[]>(api.getSubjects());
  const [exams, setExams] = useState<Examination[]>(api.getExaminations());
  const [marks, setMarks] = useState<Mark[]>(api.getMarks());
  const [grades, setGrades] = useState<Grade[]>(api.getGrades());
  const [verificationLogs, setVerificationLogs] = useState<VerificationLog[]>(
    api.getVerificationLogs()
  );

  const activeTeacher = getActiveTeacher(currentUser || null, teachers || []);

  // Supabase Connection Status
  const [dbStatus, setDbStatus] = useState<{
    checking: boolean;
    success: boolean;
    message: string;
    url?: string;
    error?: string;
    fixInstructions?: string;
    records?: any[];
  }>({
    checking: true,
    success: false,
    message: 'Testing connection to Supabase project...',
  });
  const [dismissBanner, setDismissBanner] = useState(false);

  // UI State
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [isOpenMobileSidebar, setIsOpenMobileSidebar] = useState(false);
  const [isOpenSchoolProfileModal, setIsOpenSchoolProfileModal] = useState(false);
  const [isOpenSupabaseModal, setIsOpenSupabaseModal] = useState(false);
  const [isOpenSearchModal, setIsOpenSearchModal] = useState(false);
  const [profileStudent, setProfileStudent] = useState<Student | null>(null);

  // Global Ctrl+K / Cmd+K Search Shortcut
  useEffect(() => {
    const handleGlobalSearchKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpenSearchModal((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalSearchKey);
    return () => window.removeEventListener('keydown', handleGlobalSearchKey);
  }, []);

  // Initial authentication check & session listener
  useEffect(() => {
    let isMounted = true;

    const initAuthSession = async () => {
      setIsAuthChecking(true);
      try {
        const user = await authService.getSession();
        if (isMounted) {
          if (user && user.id && user.role) {
            setCurrentUser(user);
            setIsAuthenticated(true);
            api.setCurrentUser(user);

            const hash = window.location.hash.replace('#', '') as TabType;
            const tch = getActiveTeacher(user, api.getTeachers());
            if (hash && isTabAllowedForRole(user, hash, tch)) {
              setActiveTab(hash);
            } else {
              setActiveTab('dashboard');
              window.location.hash = 'dashboard';
            }
          } else {
            setCurrentUser(null);
            setIsAuthenticated(false);
            api.setCurrentUser(null);
          }
        }
      } catch (err) {
        console.error('Error verifying auth session:', err);
        if (isMounted) {
          setCurrentUser(null);
          setIsAuthenticated(false);
          api.setCurrentUser(null);
        }
      } finally {
        if (isMounted) {
          setIsAuthChecking(false);
        }
      }
    };

    initAuthSession();

    const unsubscribe = authService.onAuthStateChange((user) => {
      if (!isMounted) return;
      if (user && user.id && user.role) {
        setCurrentUser(user);
        setIsAuthenticated(true);
        api.setCurrentUser(user);
      } else {
        setCurrentUser(null);
        setIsAuthenticated(false);
        api.setCurrentUser(null);
        window.location.hash = '';
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // Sync activeTab with URL hash changes
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '') as TabType;
      if (hash && isAuthenticated && currentUser) {
        if (!isTabAllowedForRole(currentUser, hash, activeTeacher)) {
          setActiveTab('dashboard');
          window.location.hash = 'dashboard';
          return;
        }
        setActiveTab(hash);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [isAuthenticated, currentUser]);

  // Connection test & data sync
  const verifyAndSyncSupabase = async () => {
    setDbStatus((prev) => ({ ...prev, checking: true }));
    const result = await testSupabaseConnection();
    if (result.success) {
      localStorage.setItem('cbe_system_configured', 'true');
      await syncFromSupabase();
      refreshData();
      setDbStatus({
        checking: false,
        success: true,
        url: result.url,
        message: 'Supabase connection successful',
        records: result.records,
      });
    } else {
      setDbStatus({
        checking: false,
        success: false,
        url: result.url,
        message: result.message,
        error: result.error,
        fixInstructions: result.fixInstructions,
      });

      // If system has never been configured and user is admin, prompt for first-time database setup
      const isConfigured = localStorage.getItem('cbe_system_configured');
      if (!isConfigured && currentUser?.role === 'admin') {
        setIsOpenSupabaseModal(true);
      }
    }
  };

  useEffect(() => {
    verifyAndSyncSupabase();
  }, []);

  // Sync state whenever data updates
  const refreshData = () => {
    setSchool(api.getSchool());
    setTeachers(api.getTeachers());
    setClasses(api.getClasses());
    setStudents(api.getStudents());
    setMarksStudents(api.getAllStudentsForMarks());
    setSubjects(api.getSubjects());
    setExams(api.getExaminations());
    setMarks(api.getMarks());
    setGrades(api.getGrades());
    setVerificationLogs(api.getVerificationLogs());
  };

  // Select tab with URL hash update
  const handleSelectTab = (tab: TabType) => {
    setActiveTab(tab);
    window.location.hash = tab;
  };

  // Secure logout handler
  const handleLogout = async () => {
    await authService.signOut();
    setCurrentUser(null);
    setIsAuthenticated(false);
    api.setCurrentUser(null);
    window.location.hash = '';
  };

  // Successful login callback from LoginPage
  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
    api.setCurrentUser(user);

    const hash = window.location.hash.replace('#', '') as TabType;
    const tch = getActiveTeacher(user, api.getTeachers());
    if (hash && isTabAllowedForRole(user, hash, tch)) {
      setActiveTab(hash);
    } else {
      setActiveTab('dashboard');
      window.location.hash = 'dashboard';
    }
  };

  // CRUD Actions
  const handleUpdateSchool = async (updated: School) => {
    const saved = await api.updateSchool(updated);
    setSchool(saved);
  };

  const handleAddStudent = async (std: Student) => {
    try {
      await api.addStudent(std);
      await refreshData();
    } catch (err: any) {
      alert(err?.message || 'Failed to register learner.');
    }
  };

  const handleBatchAddStudents = async (batch: Student[]) => {
    try {
      await api.batchAddStudents(batch);
      await refreshData();
    } catch (err: any) {
      alert(err?.message || 'Failed to register learner batch.');
    }
  };

  const handleUpdateStudent = async (std: Student) => {
    try {
      await api.updateStudent(std);
      await refreshData();
    } catch (err: any) {
      alert(err?.message || 'Failed to update learner.');
    }
  };

  const handleDeleteStudent = async (id: string) => {
    try {
      await api.deleteStudent(id);
      await refreshData();
    } catch (err: any) {
      alert(err?.message || 'Failed to delete learner.');
    }
  };

  const handleAddTeacher = (tch: Teacher, authUserId?: string) => {
    api.addTeacher(tch, authUserId);
    refreshData();
  };

  const handleUpdateTeacher = async (tch: Teacher) => {
    await api.updateTeacher(tch);
    await refreshData();
  };

  const handleDeleteTeacher = async (id: string) => {
    const targetTeacher = teachers.find((t) => t.id === id);
    const res = await authService.adminDeleteTeacher(id, targetTeacher?.email);
    if (!res.success) {
      throw new Error(res.error || 'Failed to delete teacher account.');
    }
    await refreshData();
  };

  const handleAddClass = (cls: ClassStream) => {
    api.addClass(cls);
    refreshData();
  };

  const handleUpdateClass = (cls: ClassStream) => {
    api.updateClass(cls);
    refreshData();
  };

  const handleDeleteClass = (id: string) => {
    api.deleteClass(id);
    refreshData();
  };

  const handleAddSubject = (sb: Subject) => {
    api.addSubject(sb);
    refreshData();
  };

  const handleDeleteSubject = (id: string) => {
    api.deleteSubject(id);
    refreshData();
  };

  const handleAddExamination = (ex: Examination) => {
    api.addExamination(ex);
    refreshData();
  };

  const handleUpdateExamStatus = (examId: string, status: Examination['status']) => {
    try {
      api.updateExaminationStatus(examId, status, currentUser);
      refreshData();
    } catch (err: any) {
      alert(err.message || 'Failed to update examination status');
    }
  };

  const handleDeleteExamination = async (examId: string) => {
    const res = await api.deleteExamination(examId, currentUser);
    refreshData();
    return res;
  };

  const handleSaveMarks = (newMarks: Mark[]) => {
    try {
      api.saveBulkMarks(newMarks, currentUser);
      refreshData();
    } catch (err: any) {
      alert(err.message || 'Failed to save marks');
      throw err;
    }
  };

  const handleUpdateGrades = (newGrades: Grade[]) => {
    api.updateGrades(newGrades);
    refreshData();
  };

  const handleAddVerificationLog = (log: VerificationLog) => {
    api.addVerificationLog(log);
    refreshData();
  };

  const handleResetDemoData = () => {
    if (window.confirm('Are you sure you want to reset all data to the clean default seed?')) {
      api.resetToDefaultSeed();
      refreshData();
    }
  };

  // Render Loading Screen during session verification & database hydration
  if (isAuthChecking || dbStatus.checking) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-slate-100">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#176B45] to-[#0F5132] text-white shadow-xl shadow-[#0F5132]/40 flex items-center justify-center mb-4 animate-pulse">
          <GraduationCap className="w-9 h-9" />
        </div>
    
        <div className="flex items-center space-x-3 bg-slate-900 border border-slate-800 px-5 py-3 rounded-xl shadow-lg">
          <RefreshCw className="w-5 h-5 text-[#2E7D5B] animate-spin" />
          <span className="text-sm font-semibold text-slate-200">
            {isAuthChecking ? 'Verifying Security & Session Authorization...' : 'Connecting & Hydrating Production Data...'}
          </span>
        </div>
    
      </div>
    
    );
  }

  // Render Login Page if not authenticated or no active user
  if (!isAuthenticated || !currentUser) {
    return (
      <LoginPage
        school={school}
        onLoginSuccess={handleLoginSuccess}
        dbStatusSuccess={dbStatus.success}
      />
    );
  }

  // Mandatory First Login Password Change Guard
  if (currentUser.force_password_change) {
    return (
      <ChangePasswordModal
        user={currentUser}
        onPasswordChanged={(updatedUser) => {
          setCurrentUser(updatedUser);
          api.setCurrentUser(updatedUser);
        }}
        onLogout={handleLogout}
      />
    );
  }

  // Active Teacher / Student context


  const activeStudent =
    currentUser.role === 'student'
      ? students.find((s) => s.id === currentUser.student_id) || students[0]
      : null;

  // Check role authorization for activeTab
  const isTabAllowed = isTabAllowedForRole(currentUser, activeTab, activeTeacher);

  const handleSelectSearchResult = (category: string, item: any, targetTab: TabType) => {
    if (category === 'Learners' && item) {
      setProfileStudent(item);
      if (isTabAllowedForRole(currentUser, 'students', activeTeacher)) {
        handleSelectTab('students');
      }
      return;
    }

    if (targetTab && isTabAllowedForRole(currentUser, targetTab, activeTeacher)) {
      handleSelectTab(targetTab);
    } else if (category === 'Classes & Streams' && isTabAllowedForRole(currentUser, 'students', activeTeacher)) {
      handleSelectTab('students');
    } else if (
      (category === 'Learning Areas' || category === 'Assessments') &&
      isTabAllowedForRole(currentUser, 'marks-entry', activeTeacher)
    ) {
      handleSelectTab('marks-entry');
    }
  };

  return (
    <AcademicSessionProvider currentUser={currentUser}>
      <div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex flex-col font-sans text-slate-800 dark:text-slate-100 antialiased transition-colors duration-200">
      {/* Navbar Header */}
      <Header
        school={school}
        currentUser={currentUser}
        onLogout={handleLogout}
        onOpenSchoolProfile={() => setIsOpenSchoolProfileModal(true)}
        onOpenSupabaseModal={() => setIsOpenSupabaseModal(true)}
        onNavigateToSystem={() => handleSelectTab('system-settings')}
        onToggleSidebar={() => setIsOpenMobileSidebar(!isOpenMobileSidebar)}
        onOpenSearch={() => setIsOpenSearchModal(true)}
      />

      {/* Background Database Connection Warning - Shown ONLY if connection fails */}
      {!dbStatus.checking && !dbStatus.success && !dismissBanner && (
        <div className="bg-rose-950 border-b border-rose-800 text-rose-100 text-xs px-4 py-3 sm:px-6 shadow-md">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
              <div>
                <span className="font-bold text-sm text-rose-100">
                  ⚠️ Database connection unavailable. Please contact the system administrator.
                </span>
                {dbStatus.message && (
                  <p className="text-rose-300 text-xs mt-0.5 font-mono">
                    {dbStatus.message}
                  </p>
                )}
              </div>
    
            </div>
    

            <div className="flex items-center space-x-2 self-end sm:self-center">
              {currentUser.role === 'admin' && (
                <button
                  onClick={() => handleSelectTab('developer-mode')}
                  className="bg-rose-800 hover:bg-rose-700 text-white font-bold px-3 py-1.5 rounded-lg border border-rose-700 text-xs transition flex items-center space-x-1.5 shadow-sm"
                >
                  <Database className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Developer Mode</span>
                </button>
              )}

              <button
                onClick={() => setDismissBanner(true)}
                className="p-1 text-rose-300 hover:text-white rounded"
                title="Dismiss Warning"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
    
          </div>
    
        </div>
    
      )}

      {/* Main Body */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 gap-6">
        {/* Navigation Sidebar */}
        <Sidebar
          currentRole={currentUser.role}
          activeTab={activeTab}
          onSelectTab={handleSelectTab}
          isOpenMobile={isOpenMobileSidebar}
          onCloseMobile={() => setIsOpenMobileSidebar(false)}
          onLogout={handleLogout}
        />

        {/* Dynamic Workspace Container */}
        <main className="flex-1 overflow-x-hidden">
          {/* Handle Role Route Authorization Protection */}
          {!isTabAllowed ? (
            <UnauthorizedView
              currentRole={currentUser.role}
              onReturnToDashboard={() => handleSelectTab('dashboard')}
            />
          ) : (
            <>
              {/* TAB: DASHBOARD */}
              {activeTab === 'dashboard' && (
                <>
                  {currentUser.role === 'admin' && (
                    <AdminDashboard
                      school={school}
                      students={students}
                      teachers={teachers}
                      classes={classes}
                      exams={exams}
                      marks={marks}
                      grades={grades}
                      subjects={subjects}
                      onNavigate={handleSelectTab}
                      onResetData={handleResetDemoData}
                    />
                  )}

                  {(currentUser.role === 'class_teacher' || currentUser.role === 'subject_teacher') && activeTeacher && (
                    <TeacherDashboard
                      teacher={activeTeacher}
                      classes={classes}
                      subjects={subjects}
                      exams={exams}
                      marks={marks}
                      students={marksStudents}
                      onNavigate={handleSelectTab}
                    />
                  )}
                </>
              )}

              {/* TAB: STUDENTS */}
              {activeTab === 'students' && (
                <StudentRegistration
                  students={students}
                  classes={classes}
                  teachers={teachers}
                  currentUser={currentUser}
                  onAddStudent={handleAddStudent}
                  onBatchAddStudents={handleBatchAddStudents}
                  onUpdateStudent={handleUpdateStudent}
                  onDeleteStudent={handleDeleteStudent}
                  onViewProfile={(std) => setProfileStudent(std)}
                />
              )}

              {/* TAB: STUDENT PROMOTION */}
              {activeTab === 'student-promotion' && (
                <StudentPromotionModule
                  students={students}
                  classes={classes}
                  onRefreshData={refreshData}
                />
              )}

              {/* TAB: TEACHERS */}
              {activeTab === 'teachers' && (
                <TeacherManagement
                  teachers={teachers}
                  subjects={subjects}
                  classes={classes}
                  onAddTeacher={handleAddTeacher}
                  onUpdateTeacher={handleUpdateTeacher}
                  onDeleteTeacher={handleDeleteTeacher}
                />
              )}

              {/* TAB: CLASSES & SUBJECTS */}
              {activeTab === 'classes' && (
                <ClassSubjectManagement
                  classes={classes}
                  subjects={subjects}
                  teachers={teachers}
                  initialTab="classes"
                  onAddClass={handleAddClass}
                  onUpdateClass={handleUpdateClass}
                  onDeleteClass={handleDeleteClass}
                  onAddSubject={handleAddSubject}
                  onDeleteSubject={handleDeleteSubject}
                />
              )}

              {/* TAB: LEARNING AREAS */}
              {activeTab === 'subjects' && (
                <ClassSubjectManagement
                  classes={classes}
                  subjects={subjects}
                  teachers={teachers}
                  initialTab="subjects"
                  onAddClass={handleAddClass}
                  onUpdateClass={handleUpdateClass}
                  onDeleteClass={handleDeleteClass}
                  onAddSubject={handleAddSubject}
                  onDeleteSubject={handleDeleteSubject}
                />
              )}

              {/* TAB: SUBJECT GROUPS (UPPER PRIMARY) */}
              {activeTab === 'subject-groups' && (
                <ClassSubjectManagement
                  classes={classes}
                  subjects={subjects}
                  teachers={teachers}
                  initialTab="subject-groups"
                  onAddClass={handleAddClass}
                  onUpdateClass={handleUpdateClass}
                  onDeleteClass={handleDeleteClass}
                  onAddSubject={handleAddSubject}
                  onDeleteSubject={handleDeleteSubject}
                />
              )}

              {/* TAB: ACADEMIC SESSION MANAGEMENT */}
              {activeTab === 'academic-session' && (
                <AcademicSessionManagement
                  userRole={currentUser.role}
                  onSessionUpdated={refreshData}
                />
              )}

              {/* TAB: EXAMINATIONS */}
              {activeTab === 'exams' && (
                <ExaminationManagement
                  exams={exams}
                  classes={classes}
                  userRole={currentUser.role}
                  currentUser={currentUser}
                  onAddExamination={handleAddExamination}
                  onUpdateStatus={handleUpdateExamStatus}
                  onDeleteExamination={handleDeleteExamination}
                />
              )}

              {/* TAB: MARKS ENTRY GRID */}
              {activeTab === 'marks-entry' && (
                <MarksEntryTable
                  exams={exams}
                  classes={classes}
                  subjects={subjects}
                  students={marksStudents}
                  marks={marks}
                  grades={grades}
                  teachers={teachers}
                  currentUser={currentUser}
                  userRole={currentUser.role}
                  onSaveMarks={handleSaveMarks}
                  onUpdateExamStatus={handleUpdateExamStatus}
                />
              )}

              {/* TAB: PROVISIONAL VERIFICATION */}
              {activeTab === 'provisional' && (
                <ProvisionalResultsView
                  school={school}
                  exams={exams}
                  students={marksStudents}
                  subjects={subjects}
                  marks={marks}
                  grades={grades}
                  classes={classes}
                  teachers={teachers}
                  currentUser={currentUser}
                  verificationLogs={verificationLogs}
                  onUpdateStatus={handleUpdateExamStatus}
                  onAddLog={handleAddVerificationLog}
                  onNavigateToTab={handleSelectTab}
                />
              )}

              {/* TAB: EXAMINATION ANALYSIS & VALIDATION */}
              {activeTab === 'exam-validation' && (
                <ExaminationAnalysisValidation
                  exams={exams}
                  students={marksStudents}
                  classes={classes}
                  subjects={subjects}
                  marks={marks}
                  grades={grades}
                  teachers={teachers}
                  currentUser={currentUser}
                  onUpdateExamStatus={handleUpdateExamStatus}
                  onNavigateToTab={handleSelectTab}
                />
              )}

              {/* TAB: REPORTS & MERIT LISTS */}
              {activeTab === 'reports' && (
                <ReportsView
                  school={school}
                  students={marksStudents}
                  subjects={subjects}
                  exams={exams}
                  marks={marks}
                  grades={grades}
                  classes={classes}
                  teachers={teachers}
                  currentUser={currentUser}
                />
              )}

              {/* TAB: SCHOOL PERFORMANCE ANALYTICS & RANKINGS */}
              {activeTab === 'school-analytics' && (
                <SchoolPerformanceAnalytics
                  school={school}
                  exams={exams}
                  students={students}
                  classes={classes}
                  subjects={subjects}
                  marks={marks}
                  grades={grades}
                  teachers={teachers}
                  currentUser={currentUser}
                />
              )}

              {/* TAB: GRADING SETTINGS */}
              {activeTab === 'grading' && (
                <GradingSettings grades={grades} onUpdateGrades={handleUpdateGrades} />
              )}

              {/* TAB: SCHOOL PROFILE */}
              {activeTab === 'school-profile' && (
                <SchoolProfileView
                  school={school}
                  onSaveSchool={handleUpdateSchool}
                  readOnly={currentUser.role !== 'admin'}
                />
              )}

              {/* TAB: SYSTEM SETTINGS (ADMIN ONLY) */}
              {activeTab === 'system-settings' && currentUser.role === 'admin' && (
                <SystemSettingsPage
                  onNavigate={handleSelectTab}
                />
              )}

              {/* TAB: DEVELOPER MODE (HIDDEN) */}
              {activeTab === 'developer-mode' && currentUser.role === 'admin' && (
                <DeveloperSettingsPage
                  dbStatus={dbStatus}
                  onVerifyAndSync={verifyAndSyncSupabase}
                />
              )}
            </>
          )}
        </main>
      </div>
    

      {/* Modals */}
      {currentUser.role === 'admin' && (
        <SchoolProfileModal
          isOpen={isOpenSchoolProfileModal}
          school={school}
          onSave={handleUpdateSchool}
          onClose={() => setIsOpenSchoolProfileModal(false)}
        />
      )}

      <SupabaseModal
        isOpen={isOpenSupabaseModal}
        onClose={() => setIsOpenSupabaseModal(false)}
      />

      <LearnerProfileModal
        student={profileStudent}
        classes={classes}
        subjects={subjects}
        exams={exams}
        marks={marks}
        grades={grades}
        teachers={teachers}
        currentUser={currentUser}
        onClose={() => setProfileStudent(null)}
      />

      <GlobalSearchModal
        isOpen={isOpenSearchModal}
        onClose={() => setIsOpenSearchModal(false)}
        currentUser={currentUser}
        activeTeacher={activeTeacher}
        students={students}
        teachers={teachers}
        classes={classes}
        subjects={subjects}
        exams={exams}
        academicYears={api.getAcademicYears()}
        schoolTerms={api.getSchoolTerms()}
        onSelectResult={handleSelectSearchResult}
      />
    </div>
    </AcademicSessionProvider>
  );
}
