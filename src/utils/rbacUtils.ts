import { User, Teacher, ClassStream, Subject, Student, sortClasses } from '../types';

/**
 * Finds the Teacher object associated with the currently logged-in user.
 */
export function getActiveTeacher(
  currentUser: User | null,
  teachers: Teacher[] = []
): Teacher | null {
  if (!currentUser || (currentUser.role !== 'class_teacher' && currentUser.role !== 'subject_teacher' && (currentUser.role as string) !== 'teacher')) return null;

  if (currentUser.teacher_id) {
    const found = teachers.find((t) => t.id === currentUser.teacher_id);
    if (found) return found;
  }

  if (currentUser.email) {
    const found = teachers.find(
      (t) => (t.email || '').toLowerCase() === (currentUser.email || '').toLowerCase()
    );
    if (found) return found;
  }

  if (currentUser.tsc_number) {
    const found = teachers.find((t) => t.tsc_number === currentUser.tsc_number);
    if (found) return found;
  }

  return null;
}

/**
 * Returns all assigned ClassStream IDs for a teacher.
 */
export function getTeacherAssignedClassIds(
  teacher: Teacher | null,
  classes: ClassStream[] = []
): string[] {
  if (!teacher) return [];
  const assignedSet = new Set<string>();

  if (Array.isArray(teacher.allocations)) {
    teacher.allocations.forEach((alloc) => {
      if (alloc.class_id) assignedSet.add(alloc.class_id);
    });
  }

  if (teacher.is_class_teacher && teacher.class_teacher_of_id) {
    assignedSet.add(teacher.class_teacher_of_id);
  }

  classes.forEach((c) => {
    if (c.class_teacher_id === teacher.id) {
      assignedSet.add(c.id);
    }
  });

  return Array.from(assignedSet);
}

/**
 * Returns ONLY the ClassStream ID where the teacher is the designated Class Teacher.
 */
export function getTeacherPrimaryClassIds(
  teacher: Teacher | null,
  classes: ClassStream[] = []
): string[] {
  if (!teacher) return [];
  const assignedSet = new Set<string>();

  if (teacher.is_class_teacher && teacher.class_teacher_of_id) {
    assignedSet.add(teacher.class_teacher_of_id);
  }

  classes.forEach((c) => {
    if (c.class_teacher_id === teacher.id) {
      assignedSet.add(c.id);
    }
  });

  return Array.from(assignedSet);
}

/**
 * Returns all assigned Subject IDs for a teacher.
 */
export function getTeacherAssignedSubjectIds(teacher: Teacher | null): string[] {
  if (!teacher) return [];
  const assignedSet = new Set<string>();

  if (Array.isArray(teacher.allocations)) {
    teacher.allocations.forEach((alloc) => {
      if (alloc.subject_id) assignedSet.add(alloc.subject_id);
    });
  }

  return Array.from(assignedSet);
}

/**
 * Returns the filtered list of ClassStreams accessible to the current user.
 * Admin: all classes
 * Teacher: only assigned classes
 */
export function getAccessibleClasses(
  currentUser: User | null,
  activeTeacher: Teacher | null,
  classes: ClassStream[] = []
): ClassStream[] {
  if (!currentUser) return sortClasses(classes);
  if (currentUser.role === 'admin') return sortClasses(classes);
  if (currentUser.role === 'class_teacher' || currentUser.role === 'subject_teacher') {
    if (!activeTeacher) return [];
    const assignedIds = getTeacherAssignedClassIds(activeTeacher, classes);
    return sortClasses(classes.filter((c) => assignedIds.includes(c.id)));
  }
  return sortClasses(classes);
}

/**
 * Returns the filtered list of ClassStreams for roster management (Class Teachers only).
 */
export function getAccessiblePrimaryClasses(
  currentUser: User | null,
  activeTeacher: Teacher | null,
  classes: ClassStream[] = []
): ClassStream[] {
  if (!currentUser) return sortClasses(classes);
  if (currentUser.role === 'admin') return sortClasses(classes);
  if (currentUser.role === 'class_teacher') {
    if (!activeTeacher) return [];
    const primaryIds = getTeacherPrimaryClassIds(activeTeacher, classes);
    return sortClasses(classes.filter((c) => primaryIds.includes(c.id)));
  }
  return [];
}

/**
 * Returns the filtered list of Subjects accessible to the current user for subject-based operations.
 * Admin: all subjects
 * Teacher: only assigned subjects
 */
export function getAccessibleSubjects(
  currentUser: User | null,
  activeTeacher: Teacher | null,
  subjects: Subject[] = []
): Subject[] {
  if (!currentUser) return subjects;
  if (currentUser.role === 'admin') return subjects;
  if (currentUser.role === 'class_teacher' || currentUser.role === 'subject_teacher') {
    if (!activeTeacher) return [];
    const assignedIds = getTeacherAssignedSubjectIds(activeTeacher);
    return subjects.filter((s) => assignedIds.includes(s.id));
  }
  return subjects;
}

/**
 * Returns the filtered list of Students accessible to the current user.
 * Admin: all students
 * Teacher: only students in assigned classes
 */
export function getAccessibleStudents(
  currentUser: User | null,
  activeTeacher: Teacher | null,
  students: Student[] = [],
  classes: ClassStream[] = []
): Student[] {
  if (!currentUser) return students;
  if (currentUser.role === 'admin') return students;
  if (currentUser.role === 'class_teacher' || currentUser.role === 'subject_teacher') {
    if (!activeTeacher) return [];
    const assignedIds = getTeacherAssignedClassIds(activeTeacher, classes);
    return students.filter(
      (s) =>
        assignedIds.includes(s.class_id) ||
        (s.stream_id && assignedIds.includes(s.stream_id))
    );
  }
  return students;
}

/**
 * Check if the teacher is a Class Teacher for a given class ID
 */
export function isClassTeacherFor(
  teacher: Teacher | null,
  classId: string,
  classes: ClassStream[] = []
): boolean {
  if (!teacher || !classId) return false;
  if (teacher.is_class_teacher && teacher.class_teacher_of_id === classId) return true;
  const cls = classes.find((c) => c.id === classId);
  if (cls && cls.class_teacher_id === teacher.id) return true;
  return false;
}

/**
 * Check if the user/teacher can edit marks for a specific subject
 * Admin: true
 * Teacher: true ONLY if subjectId is in teacher's assigned subjects
 */
export function canUserEditSubjectMarks(
  currentUser: User | null,
  activeTeacher: Teacher | null,
  subjectId: string
): boolean {
  if (!currentUser) return false;
  if (currentUser.role === 'admin') return true;
  if (currentUser.role === 'class_teacher' || currentUser.role === 'subject_teacher') {
    if (!activeTeacher) return false;
    const assignedSubjectIds = getTeacherAssignedSubjectIds(activeTeacher);
    return assignedSubjectIds.includes(subjectId);
  }
  return false;
}

/**
 * Check if the user/teacher can edit marks for a specific class
 * Admin: true
 * Teacher: true ONLY if classId is in teacher's assigned classes
 */
export function canUserEditClassMarks(
  currentUser: User | null,
  activeTeacher: Teacher | null,
  classId: string,
  classes: ClassStream[] = []
): boolean {
  if (!currentUser) return false;
  if (currentUser.role === 'admin') return true;
  if (currentUser.role === 'class_teacher' || currentUser.role === 'subject_teacher') {
    if (!activeTeacher) return false;
    const assignedClassIds = getTeacherAssignedClassIds(activeTeacher, classes);
    return assignedClassIds.includes(classId);
  }
  return false;
}

/**
 * Check if the user/teacher can edit marks for a specific class AND subject combination
 * Admin: true
 * Teacher: true ONLY if the specific class and subject combination is in their allocations
 */
export function canUserEditClassAndSubjectMarks(
  currentUser: User | null,
  activeTeacher: Teacher | null,
  classId: string,
  subjectId: string,
): boolean {
  if (!currentUser) return false;
  if (currentUser.role === 'admin') return true;
  if (currentUser.role === 'class_teacher' || currentUser.role === 'subject_teacher') {
    if (!activeTeacher) return false;
    return (activeTeacher.allocations || []).some(a => a.class_id === classId && a.subject_id === subjectId);
  }
  return false;
}

/**
 * Check if user/teacher can edit Class Teacher remarks for a specific class
 * Admin: true
 * Teacher: true ONLY if teacher is the designated Class Teacher for that class
 */
export function canUserEditClassTeacherRemarks(
  currentUser: User | null,
  activeTeacher: Teacher | null,
  classId: string,
  classes: ClassStream[] = []
): boolean {
  if (!currentUser) return false;
  if (currentUser.role === 'admin') return true;
  if (currentUser.role === 'class_teacher' || currentUser.role === 'subject_teacher') {
    return isClassTeacherFor(activeTeacher, classId, classes);
  }
  return false;
}
