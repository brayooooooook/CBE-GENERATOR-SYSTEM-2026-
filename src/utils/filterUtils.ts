import { Student, ClassStream, Examination } from '../types';
import { getLearnerClassAtExamTime } from '../services/historicalContextResolver';

/**
 * Filter students by selected Class and Stream according to CBE requirements:
 * - If stream filter = 'all' or 'All Streams': filter by class level / class_id only (includes all streams of that class, e.g., Grade 8 RED, Grade 8 BLUE, Grade 8 East, Grade 8 West).
 * - Else: filter by class_id AND stream_id.
 * - If class filter = 'all': returns all students or filters by specific stream if selected.
 * 
 * If an examination is provided, historical context (getLearnerClassAtExamTime) is used to resolve each learner's
 * class_id, stream_id, class_name, and stream_name at the time of that examination.
 */
export function getFilteredStudents(
  students: Student[] = [],
  classes: ClassStream[] = [],
  selectedClassIdOrName: string = 'all',
  selectedStreamIdOrName: string = 'all',
  examination?: Examination | null
): Student[] {
  if (!students || students.length === 0) return [];
  
  const isClassAll = !selectedClassIdOrName || selectedClassIdOrName === 'all';
  const isStreamAll =
    !selectedStreamIdOrName ||
    selectedStreamIdOrName === 'all' ||
    selectedStreamIdOrName === 'All Streams';

  if (isClassAll && isStreamAll) {
    return students;
  }

  // 1. Determine target class name (e.g., "Grade 8") and matching class IDs
  let targetClassName: string | null = null;
  let matchingClassIds: string[] = [];

  if (!isClassAll) {
    // Check if selectedClassIdOrName is a specific ClassStream ID (e.g. "cls_8e")
    const foundById = classes.find((c) => c.id === selectedClassIdOrName);
    if (foundById) {
      targetClassName = foundById.class_name;
      // All ClassStream IDs belonging to this class level (e.g. Grade 8 East + Grade 8 West)
      matchingClassIds = classes
        .filter((c) => (c.class_name || '').toLowerCase() === (targetClassName || '').toLowerCase())
        .map((c) => c.id);
    } else {
      // Check if selectedClassIdOrName is a class level name directly (e.g. "Grade 8")
      const matchingByName = classes.filter(
        (c) => (c.class_name || '').toLowerCase() === (selectedClassIdOrName || '').toLowerCase()
      );
      if (matchingByName.length > 0) {
        targetClassName = matchingByName[0].class_name;
        matchingClassIds = matchingByName.map((c) => c.id);
      } else {
        // Fallback: exact match on class_id string
        matchingClassIds = [selectedClassIdOrName];
      }
    }
  }

  // 2. Filter students
  return students.filter((s) => {
    if (!s) return false;

    let studentClassId: string;
    let studentStreamId: string;
    let studentClassName: string;
    let studentStreamName: string;
    let studentClassObj: ClassStream | undefined;

    if (examination) {
      const historicalContext = getLearnerClassAtExamTime(s, examination, classes);
      studentClassId = historicalContext.class_id;
      studentStreamId = historicalContext.stream_id;
      studentClassName = historicalContext.class_name || historicalContext.grade || '';
      studentStreamName = historicalContext.stream_name || '';
      studentClassObj = classes.find((c) => c.id === studentClassId);
    } else {
      studentClassId = s.class_id;
      studentStreamId = s.stream_id || '';
      studentClassObj = classes.find((c) => c.id === s.class_id);
      studentClassName = studentClassObj ? studentClassObj.class_name : '';
      studentStreamName = studentClassObj ? studentClassObj.stream : '';
    }

    // Class Match Check
    let matchesClass = false;
    if (isClassAll) {
      matchesClass = true;
    } else if (targetClassName) {
      matchesClass =
        (!!studentClassId && matchingClassIds.includes(studentClassId)) ||
        (!!studentClassName &&
          studentClassName.toLowerCase() === targetClassName.toLowerCase());
    } else {
      matchesClass = studentClassId === selectedClassIdOrName;
    }

    if (!matchesClass) return false;

    // Stream Match Check
    if (isStreamAll) {
      // IF stream filter = All Streams: filter by class_id / class level only
      return true;
    }

    // ELSE: filter by class_id AND stream_id
    const matchesStream =
      (!!studentStreamId && studentStreamId === selectedStreamIdOrName) ||
      (!!studentClassId && studentClassId === selectedStreamIdOrName) ||
      (studentClassObj && studentClassObj.id === selectedStreamIdOrName) ||
      (!!studentStreamName &&
        studentStreamName.toLowerCase() === (selectedStreamIdOrName || '').toLowerCase());

    return matchesStream;
  });
}

/**
 * Get display label for selected class and stream
 */
export function getClassStreamLabel(
  classes: ClassStream[],
  selectedClassIdOrName: string = 'all',
  selectedStreamIdOrName: string = 'all'
): string {
  const isClassAll = !selectedClassIdOrName || selectedClassIdOrName === 'all';
  const isStreamAll =
    !selectedStreamIdOrName ||
    selectedStreamIdOrName === 'all' ||
    selectedStreamIdOrName === 'All Streams';

  if (isClassAll && isStreamAll) {
    const uniqueNames = Array.from(new Set((classes || []).map((c) => c.class_name))).filter(Boolean);
    if (uniqueNames.length === 1) {
      return `${uniqueNames[0]} (All Streams)`;
    }
    return 'All Classes (All Streams)';
  }

  let className = selectedClassIdOrName;
  if (!isClassAll) {
    const clsById = classes.find((c) => c.id === selectedClassIdOrName);
    if (clsById) {
      className = clsById.class_name;
    } else {
      const clsByName = classes.find(
        (c) => (c.class_name || '').toLowerCase() === (selectedClassIdOrName || '').toLowerCase()
      );
      if (clsByName) {
        className = clsByName.class_name;
      }
    }
  } else if (classes && classes.length > 0) {
    const uniqueNames = Array.from(new Set(classes.map((c) => c.class_name))).filter(Boolean);
    if (uniqueNames.length === 1) {
      className = uniqueNames[0];
    }
  }

  if (isStreamAll) {
    return `${className} (All Streams)`;
  }

  const streamObj = classes.find((c) => c.id === selectedStreamIdOrName);
  if (streamObj) {
    return `${streamObj.class_name} ${streamObj.stream}`;
  }

  const streamByStream = classes.find(
    (c) => (c.stream || '').toLowerCase() === (selectedStreamIdOrName || '').toLowerCase()
  );
  if (streamByStream) {
    return `${streamByStream.class_name} ${streamByStream.stream}`;
  }

  if (selectedStreamIdOrName && !(className || '').toLowerCase().includes((selectedStreamIdOrName || '').toLowerCase())) {
    return `${className} ${selectedStreamIdOrName}`;
  }

  return className;
}

/**
 * Removes unnecessary surrounding quotation marks from generated or entered remarks/comments.
 * Preserves inner punctuation, capitalization, and formatting.
 */
export function stripSurroundingQuotes(str?: string | null): string {
  if (!str) return '';
  return str.replace(/^["'“‘]+|["'”’]+$/g, '').trim();
}

