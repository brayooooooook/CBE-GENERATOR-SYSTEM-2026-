import { Examination, EducationLevel, ClassStream, getEducationLevelForGrade } from '../types';

/**
 * Checks if a specific education level is approved/locked for an examination.
 * Falls back to global exam.status === 'Approved' | 'Published'
 * for complete backward compatibility with existing examinations.
 */
export function isLevelApproved(
  exam: Examination | null | undefined,
  level: EducationLevel | string | null | undefined
): boolean {
  if (!exam) return false;
  if (
    exam.status === 'Approved' ||
    exam.status === 'Published' ||
    (exam.status as string) === 'Official Results Released'
  ) {
    return true;
  }
  if (!level) return false;
  return (exam.approved_levels || []).includes(level as EducationLevel);
}

/**
 * Checks if a specific class/stream is approved/locked for an examination.
 * Resolves by stream UUID, class UUID, class name, education level, or global exam approval.
 */
export function isClassExamApproved(
  exam: Examination | null | undefined,
  classStream: ClassStream | null | undefined | { id?: string; stream_id?: string; class_name?: string; stream?: string; education_level?: EducationLevel }
): boolean {
  if (!exam) return false;
  if (
    exam.status === 'Approved' ||
    exam.status === 'Published' ||
    (exam.status as string) === 'Official Results Released'
  ) {
    return true;
  }
  if (!classStream) return false;

  // 1. Check if classStream has an explicit education_level approved
  const eduLevel = classStream.education_level || (classStream.class_name ? getEducationLevelForGrade(classStream.class_name) : undefined);
  if (eduLevel && (exam.approved_levels || []).includes(eduLevel)) {
    return true;
  }

  // 2. Check if stream ID or class ID is in approved_classes
  const approvedList = exam.approved_classes || [];
  if ('stream_id' in classStream && classStream.stream_id && approvedList.includes(classStream.stream_id)) {
    return true;
  }
  if (classStream.id && approvedList.includes(classStream.id)) {
    return true;
  }
  if (classStream.class_name && approvedList.includes(classStream.class_name)) {
    return true;
  }

  return false;
}

/**
 * Checks if a specific stream is approved for an exam.
 */
export function isStreamApproved(
  exam: Examination | null | undefined,
  streamIdentifier: string | undefined,
  classes: ClassStream[]
): boolean {
  if (!exam || !streamIdentifier) return false;
  const targetClass = classes.find(
    (c) => c.stream_id === streamIdentifier || c.id === streamIdentifier || c.class_name === streamIdentifier
  );
  if (targetClass) {
    return isClassExamApproved(exam, targetClass);
  }
  return (exam.approved_classes || []).includes(streamIdentifier);
}

/**
 * Checks if all active streams in a grade are approved for an examination.
 */
export function isGradeFullyApproved(
  exam: Examination | null | undefined,
  gradeName: string,
  classes: ClassStream[]
): boolean {
  if (!exam) return false;
  if (exam.status === 'Approved' || exam.status === 'Published') return true;

  const gradeStreams = classes.filter(
    (c) => c.class_name?.toLowerCase() === gradeName.toLowerCase() && c.status !== 'Inactive'
  );

  if (gradeStreams.length === 0) return false;
  return gradeStreams.every((st) => isClassExamApproved(exam, st));
}

/**
 * Checks if all active streams in an education level are approved for an examination.
 */
export function isEducationLevelFullyApproved(
  exam: Examination | null | undefined,
  level: EducationLevel,
  classes: ClassStream[]
): boolean {
  if (!exam) return false;
  if (exam.status === 'Approved' || exam.status === 'Published') return true;
  if ((exam.approved_levels || []).includes(level)) return true;

  const levelStreams = classes.filter((c) => {
    if (c.status === 'Inactive') return false;
    const cLevel = c.education_level || (c.class_name ? getEducationLevelForGrade(c.class_name) : undefined);
    return cLevel === level;
  });

  if (levelStreams.length === 0) return false;
  return levelStreams.every((st) => isClassExamApproved(exam, st));
}

/**
 * Checks if all active streams across the entire school are approved for an examination.
 */
export function isExaminationFullyApproved(
  exam: Examination | null | undefined,
  classes: ClassStream[]
): boolean {
  if (!exam) return false;
  if (exam.status === 'Approved' || exam.status === 'Published') return true;

  const activeStreams = classes.filter((c) => c.status !== 'Inactive');
  if (activeStreams.length === 0) return false;
  return activeStreams.every((st) => isClassExamApproved(exam, st));
}

/**
 * Checks if a student's class/level is approved for an exam.
 */
export function isStudentExamApproved(
  exam: Examination | null | undefined,
  studentClassId: string | undefined,
  classes: ClassStream[]
): boolean {
  if (!exam) return false;
  if (
    exam.status === 'Approved' ||
    exam.status === 'Published' ||
    (exam.status as string) === 'Official Results Released'
  ) {
    return true;
  }
  if (!studentClassId) return false;

  const targetClass = classes.find(
    (c) => c.stream_id === studentClassId || c.id === studentClassId || c.class_name === studentClassId
  );
  return isClassExamApproved(exam, targetClass);
}
