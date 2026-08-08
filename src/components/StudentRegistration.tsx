import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  FileSpreadsheet,
  Search,
  Upload,
  Edit2,
  Trash2,
  CheckCircle,
  X,
  AlertCircle,
  Download,
  ArrowRightLeft,
  GraduationCap,
} from 'lucide-react';
import { Student, ClassStream, ALL_EDUCATION_LEVELS, getEducationLevelForGrade, User, Teacher, EducationLevel, sortGrades, sortClasses, getStudentFullName } from '../types';
import Papa from 'papaparse';
import { getActiveTeacher, getAccessibleClasses, getAccessibleStudents } from '../utils/rbacUtils';

interface StudentRegistrationProps {
  students: Student[];
  classes: ClassStream[];
  teachers?: Teacher[];
  currentUser?: User;
  onAddStudent: (student: Student) => void;
  onBatchAddStudents: (students: Student[]) => void;
  onUpdateStudent: (student: Student) => void;
  onDeleteStudent: (id: string) => void;
  onViewProfile?: (student: Student) => void;
}

export const StudentRegistration: React.FC<StudentRegistrationProps> = ({
  students = [],
  classes = [],
  teachers = [],
  currentUser,
  onAddStudent,
  onBatchAddStudents,
  onUpdateStudent,
  onDeleteStudent,
  onViewProfile,
}) => {
  const activeTeacher = getActiveTeacher(currentUser || null, teachers);
  const accessibleClasses = getAccessibleClasses(currentUser || null, activeTeacher, classes);
  const accessibleStudents = getAccessibleStudents(currentUser || null, activeTeacher, students, classes);

  const [activeTab, setActiveTab] = useState<'list' | 'individual' | 'csv'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all');
  const [selectedLevelFilter, setSelectedLevelFilter] = useState<string>('all');

  // Single Student Form State (First Name, Second Name, Last Name)
  const [firstName, setFirstName] = useState('');
  const [secondName, setSecondName] = useState('');
  const [lastName, setLastName] = useState('');
  const [admNo, setAdmNo] = useState('');
  const [gender, setGender] = useState<'M' | 'F'>('M');
  const [classId, setClassId] = useState<string>(accessibleClasses[0]?.id || '');
  const [dob, setDob] = useState('');

  // Editing student state
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  // Transfer student modal state
  const [transferringStudent, setTransferringStudent] = useState<Student | null>(null);
  const [targetClassId, setTargetClassId] = useState<string>('');
  const [targetStatus, setTargetStatus] = useState<boolean>(true);

  // CSV Import State
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvSuccess, setCsvSuccess] = useState<string | null>(null);
  
  const [importEducationLevel, setImportEducationLevel] = useState<string>('');
  const [importClassName, setImportClassName] = useState<string>('');
  const [importStream, setImportStream] = useState<string>('');

  // Helper to derive curriculum level from student and class relationship
  const getLearnerLevel = (std: Student): EducationLevel => {
    if (!std) return 'Junior School';
    const stdClass = classes.find(
      (c) =>
        (c.id && (c.id === std.class_id || c.id === std.stream_id)) ||
        (c.class_name && std.class_id && c.class_name === std.class_id) ||
        (`${c.class_name || ''} ${c.stream || ''}`.trim().toLowerCase() === String(std.class_id || '').trim().toLowerCase())
    );
    const gradeName = stdClass?.class_name || std.grade;
    if (gradeName) {
      return getEducationLevelForGrade(gradeName);
    }
    if (stdClass?.education_level) {
      return stdClass.education_level;
    }
    if (std.education_level) {
      return std.education_level;
    }
    return 'Junior School';
  };

  const handleStartEdit = (std: Student) => {
    let fName = std.first_name || '';
    let sName = std.second_name || '';
    let lName = std.last_name || '';

    if (!fName && !lName && std.full_name) {
      const parts = std.full_name.trim().split(/\s+/).filter(Boolean);
      if (parts.length === 1) {
        fName = parts[0];
      } else if (parts.length === 2) {
        fName = parts[0];
        lName = parts[1];
      } else if (parts.length >= 3) {
        fName = parts[0];
        sName = parts.slice(1, -1).join(' ');
        lName = parts[parts.length - 1];
      }
    }

    setEditingStudent({
      ...std,
      first_name: fName,
      second_name: sName,
      last_name: lName,
    });
  };

  const handleAddIndividual = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedFirst = firstName.trim();
    const trimmedSecond = secondName.trim();
    const trimmedLast = lastName.trim();
    const trimmedAdm = admNo.trim();

    if (!trimmedFirst) {
      alert('First Name is required.');
      return;
    }
    if (!trimmedLast) {
      alert('Last Name is required.');
      return;
    }
    if (!trimmedAdm) {
      alert('Admission Number is required. Please enter an admission number manually.');
      return;
    }
    if (!classId) {
      alert('Please select a Class & Stream.');
      return;
    }

    if (students.some((s) => (s.admission_number || '').toLowerCase() === trimmedAdm.toLowerCase())) {
      alert(`A learner with admission number '${trimmedAdm}' already exists in the system.`);
      return;
    }

    const selectedCls = classes.find((c) => c.id === classId);
    const derivedGrade = selectedCls?.class_name || '';
    const derivedLevel = selectedCls?.education_level || (derivedGrade ? getEducationLevelForGrade(derivedGrade) : 'Junior School');

    const constructedFullName = [trimmedFirst, trimmedSecond, trimmedLast].filter(Boolean).join(' ');

    const newStudent: Student = {
      id: `std_${Date.now()}`,
      admission_number: trimmedAdm,
      first_name: trimmedFirst,
      second_name: trimmedSecond || undefined,
      last_name: trimmedLast,
      full_name: constructedFullName,
      gender,
      class_id: classId,
      stream_id: classId,
      grade: derivedGrade,
      education_level: derivedLevel,
      dob,
      active: true,
    };

    onAddStudent(newStudent);

    // Reset form
    setFirstName('');
    setSecondName('');
    setLastName('');
    setAdmNo('');
    setActiveTab('list');
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;

    if (!editingStudent.first_name?.trim()) {
      alert('First Name is required.');
      return;
    }
    if (!editingStudent.last_name?.trim()) {
      alert('Last Name is required.');
      return;
    }
    if (!editingStudent.admission_number?.trim()) {
      alert('Admission Number is required.');
      return;
    }

    const selectedCls = classes.find((c) => c.id === editingStudent.class_id);
    const derivedGrade = selectedCls?.class_name || editingStudent.grade;
    const derivedLevel = selectedCls?.education_level || (derivedGrade ? getEducationLevelForGrade(derivedGrade) : editingStudent.education_level);

    const nameParts = [editingStudent.first_name?.trim(), editingStudent.second_name?.trim(), editingStudent.last_name?.trim()].filter(Boolean);
    const constructedFullName = nameParts.length > 0 ? nameParts.join(' ') : editingStudent.full_name;

    onUpdateStudent({
      ...editingStudent,
      first_name: editingStudent.first_name?.trim(),
      second_name: editingStudent.second_name?.trim() || undefined,
      last_name: editingStudent.last_name?.trim(),
      full_name: constructedFullName,
      grade: derivedGrade,
      education_level: derivedLevel,
    });
    setEditingStudent(null);
  };

  const handleExecuteTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferringStudent) return;

    const targetClass = classes.find((c) => c.id === targetClassId);
    const derivedGrade = targetClass?.class_name || transferringStudent.grade;
    const derivedLevel = targetClass?.education_level || (derivedGrade ? getEducationLevelForGrade(derivedGrade) : transferringStudent.education_level);

    onUpdateStudent({
      ...transferringStudent,
      class_id: targetClassId || transferringStudent.class_id,
      stream_id: targetClassId || transferringStudent.stream_id,
      grade: derivedGrade,
      education_level: derivedLevel,
      active: targetStatus,
    });

    setTransferringStudent(null);
  };

  // CSV Parsing
  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCsvError(null);
    setCsvSuccess(null);
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFile(file);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          setCsvError(`CSV Error: ${results.errors[0].message}`);
        } else {
          setParsedRows(results.data);
        }
      },
      error: (err) => {
        setCsvError(`Failed to parse CSV file: ${err.message}`);
      },
    });
  };

  const handleProcessCsvImport = () => {
    if (parsedRows.length === 0) return;
    if (!importEducationLevel || !importClassName) {
      setCsvError('Please select the destination Class (and Stream where applicable) before importing learners.');
      return;
    }

    const expectedLevelForClass = getEducationLevelForGrade(importClassName);
    if (expectedLevelForClass !== importEducationLevel) {
      setCsvError(`Invalid curriculum level combination: '${importClassName}' belongs to '${expectedLevelForClass}', not '${importEducationLevel}'.`);
      return;
    }

    const availableStreams = classes.filter((c) => c.class_name === importClassName).map((c) => c.stream).filter(Boolean);
    if (availableStreams.length > 0 && !importStream) {
      setCsvError('Please select the destination Stream before importing learners.');
      return;
    }

    const targetClassStream = classes.find(
      (c) => c.class_name === importClassName && (c.stream === importStream || (!importStream && !c.stream))
    );

    if (!targetClassStream) {
      setCsvError(`Selected class '${importClassName} ${importStream || ''}' was not found in school class records.`);
      return;
    }

    const existingAdmSet = new Set(students.map((s) => (s.admission_number || '').trim().toLowerCase()));
    const batchAdmSet = new Set<string>();
    const newBatch: Student[] = [];
    let duplicateCount = 0;

    let missingAdmCount = 0;

    parsedRows.forEach((row: any, idx: number) => {
      let fName = (row['First Name'] || row['first_name'] || row['FirstName'] || '').trim();
      let sName = (row['Second Name'] || row['second_name'] || row['SecondName'] || row['Middle Name'] || row['middle_name'] || '').trim();
      let lName = (row['Last Name'] || row['last_name'] || row['LastName'] || row['Surname'] || row['surname'] || '').trim();
      const rawFullName = (row['Full Name'] || row['full_name'] || row['Name'] || row['student_name'] || '').trim();

      if (!fName && rawFullName) {
        const parts = rawFullName.split(/\s+/).filter(Boolean);
        if (parts.length === 1) {
          fName = parts[0];
        } else if (parts.length === 2) {
          fName = parts[0];
          lName = parts[1];
        } else if (parts.length >= 3) {
          fName = parts[0];
          sName = parts.slice(1, -1).join(' ');
          lName = parts[parts.length - 1];
        }
      }

      const nameParts = [fName, sName, lName].filter(Boolean);
      const constructedName = nameParts.length > 0 ? nameParts.join(' ') : rawFullName;

      const admission_number =
        row['Admission Number'] ||
        row['admission_number'] ||
        row['Adm No'] ||
        row['ADM NO'];

      if (!admission_number || !String(admission_number).trim()) {
        missingAdmCount++;
        return;
      }

      const trimmedAdm = String(admission_number).trim();
      const admLower = trimmedAdm.toLowerCase();

      if (existingAdmSet.has(admLower) || batchAdmSet.has(admLower)) {
        duplicateCount++;
        return;
      }

      const genderVal = (row['Gender'] || row['gender'] || 'M').toUpperCase().startsWith('F')
        ? 'F'
        : 'M';

      if (constructedName) {
        batchAdmSet.add(admLower);
        newBatch.push({
          id: `std_csv_${Date.now()}_${idx}`,
          admission_number: trimmedAdm,
          first_name: fName || undefined,
          second_name: sName || undefined,
          last_name: lName || undefined,
          full_name: constructedName,
          gender: genderVal,
          class_id: targetClassStream.id,
          stream_id: targetClassStream.id,
          education_level: importEducationLevel as EducationLevel,
          grade: importClassName,
          active: true,
        });
      }
    });

    if (newBatch.length > 0) {
      onBatchAddStudents(newBatch);
      let msg = `Successfully imported ${newBatch.length} learners!`;
      if (duplicateCount > 0) {
        msg += ` (${duplicateCount} duplicate learner(s) skipped)`;
      }
      if (missingAdmCount > 0) {
        msg += ` (${missingAdmCount} row(s) missing admission number skipped)`;
      }
      setCsvSuccess(msg);
      setParsedRows([]);
      setCsvFile(null);
      setImportEducationLevel('');
      setImportClassName('');
      setImportStream('');
      setTimeout(() => {
        setActiveTab('list');
        setCsvSuccess(null);
      }, 1500);
    } else {
      let errMsg = 'No valid student rows found in CSV.';
      if (duplicateCount > 0) {
        errMsg = `All ${duplicateCount} learner(s) in CSV already exist in the system (duplicate admission numbers).`;
      } else if (missingAdmCount > 0) {
        errMsg = `${missingAdmCount} row(s) in CSV are missing Admission Number. Please enter Admission Numbers manually in your CSV file before importing.`;
      }
      setCsvError(errMsg);
    }
  };

  // Download sample CSV template with separate name fields
  const handleDownloadSampleCsv = () => {
    const csvContent =
      'Admission Number,First Name,Second Name,Last Name,Gender\n' +
      'ADM-2026-050,Mercy,Chebet,Kipkemoi,F\n' +
      'ADM-2026-051,Peter,,Kamau,M\n';
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'CBE_Learners_Import_Template.csv';
    a.click();
  };

  // Level-filtered classes for the dropdown
  const levelFilteredClasses = accessibleClasses.filter((cls) => {
    if (!cls) return false;
    if (selectedLevelFilter === 'all') return true;
    const clsLevel = cls.education_level || (cls.class_name ? getEducationLevelForGrade(cls.class_name) : 'Junior School');
    return clsLevel === selectedLevelFilter;
  });

  // Filtered students list
  const filteredStudents = accessibleStudents.filter((s) => {
    if (!s) return false;
    const query = searchQuery.trim().toLowerCase();
    const fullName = getStudentFullName(s);
    const admNo = s.admission_number || '';
    const matchesSearch =
      !query ||
      fullName.toLowerCase().includes(query) ||
      admNo.toLowerCase().includes(query);

    const matchesClass =
      selectedClassFilter === 'all' ||
      s.class_id === selectedClassFilter ||
      s.stream_id === selectedClassFilter;

    const stdLevel = getLearnerLevel(s);
    const matchesLevel = selectedLevelFilter === 'all' || stdLevel === selectedLevelFilter;

    return matchesSearch && matchesClass && matchesLevel;
  });

  return (
    <div className="space-y-6">
      {/* Top Header & Tab Navigation */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
            <Users className="w-6 h-6 text-[#176B45] dark:text-emerald-400" />
            <span>Learner Registration & Roster</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Register individual learners, import via CSV spreadsheet, search, and manage student transfers.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setActiveTab('list')}
            className={`px-3.5 py-2 text-xs font-bold rounded-lg transition ${
              activeTab === 'list'
                ? 'bg-[#176B45] text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            Learners Roster ({accessibleStudents.length})
          </button>

          {currentUser?.role === 'admin' && (
            <>
              <button
                onClick={() => setActiveTab('individual')}
                className={`px-3.5 py-2 text-xs font-bold rounded-lg transition flex items-center space-x-1.5 ${
                  activeTab === 'individual'
                    ? 'bg-[#176B45] text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <UserPlus className="w-4 h-4" />
                <span>Single Learner</span>
              </button>

              <button
                onClick={() => setActiveTab('csv')}
                className={`px-3.5 py-2 text-xs font-bold rounded-lg transition flex items-center space-x-1.5 ${
                  activeTab === 'csv'
                    ? 'bg-[#176B45] text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Import CSV</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* TAB 1: LEARNERS ROSTER TABLE */}
      {activeTab === 'list' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400 dark:text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by learner name or adm no..."
                className="w-full pl-9 pr-3 py-2 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg text-xs focus:ring-2 focus:ring-[#176B45] focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <div className="flex items-center space-x-2">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">Level:</label>
                <select
                  value={selectedLevelFilter}
                  onChange={(e) => {
                    const newLevel = e.target.value;
                    setSelectedLevelFilter(newLevel);
                    if (newLevel !== 'all') {
                      const validClasses = accessibleClasses.filter((cls) => {
                        const clsLevel = cls.education_level || getEducationLevelForGrade(cls.class_name);
                        return clsLevel === newLevel;
                      });
                      if (selectedClassFilter !== 'all' && !validClasses.some((c) => c.id === selectedClassFilter)) {
                        setSelectedClassFilter('all');
                      }
                    }
                  }}
                  className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-[#176B45] focus:outline-none font-medium text-slate-800 dark:text-slate-100"
                >
                  <option value="all">All Levels</option>
                  {ALL_EDUCATION_LEVELS.map((lvl) => (
                    <option key={lvl} value={lvl}>
                      {lvl}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center space-x-2">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">Class:</label>
                <select
                  value={selectedClassFilter}
                  onChange={(e) => setSelectedClassFilter(e.target.value)}
                  className="border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg px-3 py-1.5 text-xs focus:ring-2 focus:ring-[#176B45] focus:outline-none font-medium text-slate-800 dark:text-slate-100"
                >
                  <option value="all">All Assigned Classes & Streams</option>
                  {levelFilteredClasses.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.class_name} {cls.stream}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider">
                  <th className="p-3">Adm No</th>
                  <th className="p-3">Full Name</th>
                  <th className="p-3">Gender</th>
                  <th className="p-3">Class & Stream</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredStudents.length > 0 ? (
                  filteredStudents.map((std) => {
                    const cls = classes.find((c) => c.id === std.class_id);

                    return (
                      <tr key={std.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                        <td className="p-3 font-mono font-bold text-blue-700 dark:text-blue-400">{std.admission_number}</td>
                        <td className="p-3 font-bold text-slate-900 dark:text-slate-100">{getStudentFullName(std)}</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                              std.gender === 'F' ? 'bg-pink-100 dark:bg-pink-950/80 text-pink-800 dark:text-pink-300' : 'bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300'
                            }`}
                          >
                            {std.gender === 'F' ? 'Female' : 'Male'}
                          </span>
                        </td>
                        <td className="p-3 font-medium text-slate-700 dark:text-slate-300">
                          {cls ? `${cls.class_name} ${cls.stream}` : 'Unassigned'}
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                              std.active
                                ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300'
                                : 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300'
                            }`}
                          >
                            {std.active ? 'Active' : 'Inactive / Transferred'}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center space-x-1">
                             {onViewProfile && (
                              <button
                                onClick={() => onViewProfile(std)}
                                className="p-1.5 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-slate-800 rounded transition flex items-center space-x-1 border border-emerald-200/60 dark:border-emerald-800/60"
                                title="View CBE Profile"
                              >
                                <GraduationCap className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                                <span className="hidden sm:inline text-[10px] font-semibold">Profile</span>
                              </button>
                            )}
                            {currentUser?.role === 'admin' && (
                              <>
                                <button
                                  onClick={() => {
                                    setTransferringStudent(std);
                                    setTargetClassId(std.class_id);
                                    setTargetStatus(std.active);
                                  }}
                                  className="p-1.5 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-slate-800 rounded transition flex items-center space-x-1"
                                  title="Transfer Learner"
                                >
                                  <ArrowRightLeft className="w-3.5 h-3.5" />
                                  <span className="hidden sm:inline text-[10px] font-semibold">Transfer</span>
                                </button>
                                <button
                                  onClick={() => handleStartEdit(std)}
                                  className="p-1.5 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-slate-800 rounded transition"
                                  title="Edit Learner Info"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => {
                                    if (window.confirm(`Are you sure you want to PERMANENTLY delete learner '${std.full_name}' (Admission No: ${std.admission_number})? This action will remove the learner from the database and cannot be undone.`)) {
                                      onDeleteStudent(std.id);
                                    }
                                  }}
                                  className="p-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-slate-800 rounded transition"
                                  title="Permanently Delete Learner"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-400 dark:text-slate-500">
                      No matching learners found. Try adjusting search filters or registering new learners.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: SINGLE INDIVIDUAL REGISTRATION FORM */}
      {activeTab === 'individual' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm max-w-2xl mx-auto">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">
            Register Single Learner
          </h2>

          <form onSubmit={handleAddIndividual} className="space-y-4 text-xs">
            {/* 1. THREE SEPARATE NAME FIELDS */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">First Name *</label>
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="e.g., Stacy"
                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg p-2.5 focus:ring-2 focus:ring-[#176B45] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Second Name <span className="text-slate-400 dark:text-slate-500 font-normal">(Optional)</span></label>
                <input
                  type="text"
                  value={secondName}
                  onChange={(e) => setSecondName(e.target.value)}
                  placeholder="e.g., Njeri"
                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg p-2.5 focus:ring-2 focus:ring-[#176B45] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Last Name *</label>
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="e.g., Mwangi"
                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg p-2.5 focus:ring-2 focus:ring-[#176B45] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Admission Number *</label>
                <input
                  type="text"
                  required
                  value={admNo}
                  onChange={(e) => setAdmNo(e.target.value)}
                  placeholder="Enter admission number manually..."
                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg p-2.5 font-mono font-bold focus:ring-2 focus:ring-[#176B45] focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Gender *</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as 'M' | 'F')}
                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg p-2.5 focus:ring-2 focus:ring-[#176B45] focus:outline-none"
                >
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Class & Stream *</label>
                <select
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg p-2.5 focus:ring-2 focus:ring-[#176B45] focus:outline-none font-medium"
                >
                  {accessibleClasses.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.class_name} {cls.stream}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Curriculum Level (Auto-established)</label>
                {(() => {
                  const selectedCls = classes.find((c) => c.id === classId);
                  const derivedGrade = selectedCls?.class_name || '';
                  const derivedLevel = selectedCls?.education_level || (derivedGrade ? getEducationLevelForGrade(derivedGrade) : 'Junior School');
                  return (
                    <div className="w-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 rounded-lg p-2.5 font-bold text-blue-900 dark:text-blue-300 flex items-center justify-between">
                      <span>{derivedLevel}</span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">Established from class/grade</span>
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="pt-4 flex items-center justify-end space-x-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setActiveTab('list')}
                className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-[#176B45] hover:bg-[#0F5132] text-white font-bold rounded-lg shadow-sm transition"
              >
                Save Learner
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: CSV BATCH IMPORT MODULE */}
      {activeTab === 'csv' && (
        <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm max-w-3xl mx-auto space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <span>Batch CSV Learner Import</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Upload a CSV spreadsheet containing learner names, admission numbers, gender, and contact info.
              </p>
            </div>

            <button
              onClick={handleDownloadSampleCsv}
              className="text-xs font-bold text-emerald-800 dark:text-emerald-300 hover:text-emerald-950 dark:hover:text-emerald-100 border border-emerald-300 dark:border-emerald-700 px-3 py-1.5 rounded-lg flex items-center space-x-1.5 hover:bg-emerald-50 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
              <span>Download Sample CSV</span>
            </button>
          </div>

          {/* Filters for Destination Class */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">1. Education Level</label>
              <select
                value={importEducationLevel}
                onChange={(e) => {
                  setImportEducationLevel(e.target.value);
                  setImportClassName('');
                  setImportStream('');
                }}
                className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg p-2 focus:ring-2 focus:ring-[#176B45] focus:outline-none text-sm"
              >
                <option value="">Select Level...</option>
                {ALL_EDUCATION_LEVELS.map((level) => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </div>
            
            {importEducationLevel && (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">2. Class</label>
                <select
                  value={importClassName}
                  onChange={(e) => {
                    setImportClassName(e.target.value);
                    setImportStream('');
                  }}
                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg p-2 focus:ring-2 focus:ring-[#176B45] focus:outline-none text-sm"
                >
                  <option value="">Select Class...</option>
                  {sortGrades(Array.from(new Set(
                    classes.filter(c => c.education_level === importEducationLevel || getEducationLevelForGrade(c.class_name) === importEducationLevel)
                           .map(c => c.class_name)
                  ))).map(cls => (
                    <option key={cls} value={cls}>{cls}</option>
                  ))}
                </select>
              </div>
            )}
            
            {importClassName && (
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">3. Stream</label>
                <select
                  value={importStream}
                  onChange={(e) => setImportStream(e.target.value)}
                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg p-2 focus:ring-2 focus:ring-[#176B45] focus:outline-none text-sm"
                >
                  <option value="">Select Stream...</option>
                  {classes.filter(c => c.class_name === importClassName && c.stream).map(c => c.stream).filter((v, i, a) => a.indexOf(v) === i).map(stream => (
                    <option key={stream} value={stream}>{stream}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Upload Drop Area */}
          <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-600 dark:hover:border-emerald-500 rounded-xl p-8 text-center bg-slate-50 dark:bg-slate-800/40 hover:bg-emerald-50/40 dark:hover:bg-slate-800/80 transition cursor-pointer relative">
            <input
              type="file"
              accept=".csv"
              onChange={handleCsvFileUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <Upload className="w-10 h-10 text-slate-400 dark:text-slate-500 mx-auto mb-2" />
            <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {csvFile ? csvFile.name : 'Click or Drag & Drop CSV File Here'}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Supported columns: <span className="font-mono">First Name, Second Name, Last Name (or Full Name), Admission Number, Gender</span>
            </p>
          </div>

          {csvError && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-lg text-rose-800 dark:text-rose-300 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{csvError}</span>
            </div>
          )}

          {csvSuccess && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-lg text-emerald-800 dark:text-emerald-300 text-xs flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
              <span>{csvSuccess}</span>
            </div>
          )}

          {/* Parsed CSV Preview Table */}
          {parsedRows.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Preview ({parsedRows.length} rows parsed)
                </span>
                <button
                  onClick={handleProcessCsvImport}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-sm transition"
                >
                  Import All {parsedRows.length} Learners
                </button>
              </div>

              <div className="max-h-60 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold uppercase sticky top-0">
                    <tr>
                      <th className="p-2.5">#</th>
                      <th className="p-2.5">Adm No</th>
                      <th className="p-2.5">Full Name</th>
                      <th className="p-2.5">Gender</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {parsedRows.map((r, i) => (
                      <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="p-2.5 text-slate-400 dark:text-slate-500">{i + 1}</td>
                        <td className="p-2.5 font-mono font-bold text-blue-700 dark:text-blue-400">
                          {r['Admission Number'] || r['admission_number'] || r['Adm No'] || '-'}
                        </td>
                        <td className="p-2.5 font-bold text-slate-800 dark:text-slate-200">
                          {r['Full Name'] || r['full_name'] || r['Name'] || '-'}
                        </td>
                        <td className="p-2.5 text-slate-700 dark:text-slate-300">{r['Gender'] || r['gender'] || 'M'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* EDITING MODAL */}
      {editingStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 p-6 max-w-lg w-full text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Edit Learner Profile</h3>
              <button
                onClick={() => setEditingStudent(null)}
                className="p-1 rounded text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={editingStudent.first_name || ''}
                    onChange={(e) => setEditingStudent({ ...editingStudent, first_name: e.target.value })}
                    className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg p-2.5 focus:ring-2 focus:ring-[#176B45] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Second Name</label>
                  <input
                    type="text"
                    value={editingStudent.second_name || ''}
                    onChange={(e) => setEditingStudent({ ...editingStudent, second_name: e.target.value })}
                    className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg p-2.5 focus:ring-2 focus:ring-[#176B45] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={editingStudent.last_name || ''}
                    onChange={(e) => setEditingStudent({ ...editingStudent, last_name: e.target.value })}
                    className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg p-2.5 focus:ring-2 focus:ring-[#176B45] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Admission Number *</label>
                <input
                  type="text"
                  required
                  value={editingStudent.admission_number}
                  onChange={(e) => setEditingStudent({ ...editingStudent, admission_number: e.target.value })}
                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg p-2.5 font-mono font-bold focus:ring-2 focus:ring-[#176B45] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Gender</label>
                  <select
                    value={editingStudent.gender}
                    onChange={(e) =>
                      setEditingStudent({ ...editingStudent, gender: e.target.value as 'M' | 'F' })
                    }
                    className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg p-2.5 focus:ring-2 focus:ring-[#176B45] focus:outline-none"
                  >
                    <option value="M">Male</option>
                    <option value="F">Female</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Class & Stream</label>
                  <select
                    value={editingStudent.class_id}
                    onChange={(e) => setEditingStudent({ ...editingStudent, class_id: e.target.value })}
                    className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg p-2.5 focus:ring-2 focus:ring-[#176B45] focus:outline-none"
                  >
                    {sortClasses(classes).map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.class_name} {cls.stream}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end space-x-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#176B45] hover:bg-[#0F5132] text-white font-bold rounded-lg shadow-sm"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TRANSFER MODAL */}
      {transferringStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 p-6 max-w-md w-full text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center space-x-2">
                <ArrowRightLeft className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                <span>Transfer Learner</span>
              </h3>
              <button
                onClick={() => setTransferringStudent(null)}
                className="p-1 rounded text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleExecuteTransfer} className="space-y-4">
              <div className="p-3 bg-purple-50 dark:bg-purple-950/60 rounded-lg border border-purple-100 dark:border-purple-800">
                <div className="font-bold text-slate-900 dark:text-slate-100">{transferringStudent.full_name}</div>
                <div className="text-[11px] text-purple-700 dark:text-purple-300 font-mono">
                  {transferringStudent.admission_number}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Target Class & Stream
                </label>
                <select
                  value={targetClassId}
                  onChange={(e) => setTargetClassId(e.target.value)}
                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg p-2.5 focus:ring-2 focus:ring-[#176B45] focus:outline-none"
                >
                  {sortClasses(classes).map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.class_name} {cls.stream}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Learner Status</label>
                <select
                  value={targetStatus ? 'active' : 'inactive'}
                  onChange={(e) => setTargetStatus(e.target.value === 'active')}
                  className="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-lg p-2.5 focus:ring-2 focus:ring-[#176B45] focus:outline-none"
                >
                  <option value="active">Active Learner</option>
                  <option value="inactive">Transferred / Inactive</option>
                </select>
              </div>

              <div className="pt-3 flex items-center justify-end space-x-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setTransferringStudent(null)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg shadow-sm"
                >
                  Execute Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
