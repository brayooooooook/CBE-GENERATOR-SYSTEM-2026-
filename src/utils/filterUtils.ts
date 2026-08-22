import { Student, ClassStream, Examination } from '../types';
import { getLearnerClassAtExamTime } from '../services/historicalContextResolver';

/**
 * Standard authoritative helper to find the exact ClassStream from a list of classes,
 * prioritizing exact stream_id match, then stream name + class_id/grade match, then class_id.
 */
export function findClassStream(
  classes: ClassStream[] = [],
  criteria: {
    streamId?: string | null;
    classId?: string | null;
    className?: string | null;
    streamName?: string | null;
    grade?: string | null;
  }
): ClassStream | undefined {
  if (!classes || classes.length === 0) return undefined;

  const { streamId, classId, className, streamName, grade } = criteria;

  // 1. Exact match by stream_id if provided
  if (streamId) {
    const byStreamId = classes.find((c) => c.stream_id === streamId || c.id === streamId);
    if (byStreamId) return byStreamId;
  }

  // 2. Match by classId AND streamName if both available
  if (classId && streamName) {
    const byClassAndStream = classes.find(
      (c) =>
        (c.id === classId || c.stream_id === classId) &&
        c.stream &&
        c.stream.toLowerCase() === streamName.toLowerCase()
    );
    if (byClassAndStream) return byClassAndStream;
  }

  // 3. Match by className/grade AND streamName if both available
  const effectiveGrade = className || grade;
  if (effectiveGrade && streamName) {
    const byGradeAndStream = classes.find(
      (c) =>
        (c.class_name || '').toLowerCase() === effectiveGrade.toLowerCase() &&
        c.stream &&
        c.stream.toLowerCase() === streamName.toLowerCase()
    );
    if (byGradeAndStream) return byGradeAndStream;
  }

  // 4. Match by classId alone (if classId equals a stream_id or class id)
  if (classId) {
    const byClassId = classes.find((c) => c.stream_id === classId) || classes.find((c) => c.id === classId);
    if (byClassId) return byClassId;
  }

  // 5. Match by className/grade alone
  if (effectiveGrade) {
    const byGrade = classes.find((c) => (c.class_name || '').toLowerCase() === effectiveGrade.toLowerCase());
    if (byGrade) return byGrade;
  }

  // 6. Match by streamName alone
  if (streamName) {
    const byStream = classes.find((c) => (c.stream || '').toLowerCase() === streamName.toLowerCase());
    if (byStream) return byStream;
  }

  return undefined;
}

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
    // Check if selectedClassIdOrName is a specific ClassStream ID or Stream ID (e.g. "cls_8e")
    const foundById = classes.find((c) => c.id === selectedClassIdOrName || c.stream_id === selectedClassIdOrName);
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
      studentClassObj =
        (s.stream_id ? classes.find((c) => c.stream_id === s.stream_id) : undefined) ||
        (studentStreamId ? classes.find((c) => c.stream_id === studentStreamId) : undefined) ||
        classes.find((c) => c.id === studentClassId);
    } else {
      studentClassId = s.class_id;
      studentStreamId = s.stream_id || '';
      studentClassObj =
        (s.stream_id ? classes.find((c) => c.stream_id === s.stream_id) : undefined) ||
        classes.find((c) => c.id === s.class_id);
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
      matchesClass = studentClassId === selectedClassIdOrName || (studentClassObj && (studentClassObj.id === selectedClassIdOrName || studentClassObj.stream_id === selectedClassIdOrName));
    }

    if (!matchesClass) return false;

    // Stream Match Check
    if (isStreamAll) {
      // IF stream filter = All Streams: filter by class_id / class level only
      return true;
    }

    // Find matching stream objects from classes list
    const matchingStreamObjs = classes.filter((c) => {
      const matchesId = c.stream_id === selectedStreamIdOrName || c.id === selectedStreamIdOrName;
      const matchesName = (c.stream || '').toLowerCase() === (selectedStreamIdOrName || '').toLowerCase();
      if (!isClassAll && targetClassName) {
        return (matchesId || matchesName) && (c.class_name || '').toLowerCase() === targetClassName.toLowerCase();
      }
      return matchesId || matchesName;
    });

    let matchesStream = false;

    if (matchingStreamObjs.length > 0) {
      matchesStream = matchingStreamObjs.some((targetStreamObj) => {
        // 1. Student's stream_id equals target's stream_id or target's id
        if (studentStreamId && (studentStreamId === targetStreamObj.stream_id || studentStreamId === targetStreamObj.id)) {
          return true;
        }
        // 2. Student's class_id equals target's stream_id
        if (studentClassId && targetStreamObj.stream_id && studentClassId === targetStreamObj.stream_id) {
          return true;
        }
        // 3. Student's classObj stream_id/id equals target's stream_id/id
        if (studentClassObj) {
          if (studentClassObj.stream_id && (studentClassObj.stream_id === targetStreamObj.stream_id || studentClassObj.stream_id === targetStreamObj.id)) {
            return true;
          }
          if (targetStreamObj.stream_id && studentClassObj.id === targetStreamObj.stream_id) {
            return true;
          }
        }
        // 4. Student's stream name matches target's stream name AND class names match
        if (studentStreamName && targetStreamObj.stream && studentStreamName.toLowerCase() === targetStreamObj.stream.toLowerCase()) {
          if (isClassAll || (studentClassName && targetStreamObj.class_name && studentClassName.toLowerCase() === targetStreamObj.class_name.toLowerCase())) {
            return true;
          }
        }
        return false;
      });
    } else {
      // Fallback if selectedStreamIdOrName was not found as a known ClassStream object
      matchesStream =
        (!!studentStreamId && studentStreamId === selectedStreamIdOrName) ||
        (!!studentStreamName && studentStreamName.toLowerCase() === selectedStreamIdOrName.toLowerCase());
    }

    return !!matchesStream;
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

  const isUUID = (str: any) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

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
      } else if (isUUID(selectedClassIdOrName)) {
        className = 'All Classes';
      }
    }
  } else if (classes && classes.length > 0) {
    const uniqueNames = Array.from(new Set(classes.map((c) => c.class_name))).filter(Boolean);
    if (uniqueNames.length === 1) {
      className = uniqueNames[0];
    }
  }

  if (isStreamAll || isUUID(selectedStreamIdOrName)) {
    const streamObj = classes.find((c) => c.stream_id === selectedStreamIdOrName || c.id === selectedStreamIdOrName);
    if (streamObj && streamObj.stream && !isUUID(streamObj.stream)) {
      return `${streamObj.class_name} ${streamObj.stream}`;
    }
    return `${className} (All Streams)`;
  }

  const streamObj = classes.find((c) => c.stream_id === selectedStreamIdOrName || c.id === selectedStreamIdOrName);
  if (streamObj && streamObj.stream && !isUUID(streamObj.stream)) {
    return `${streamObj.class_name} ${streamObj.stream}`;
  }

  const streamByStream = classes.find(
    (c) => (c.stream || '').toLowerCase() === (selectedStreamIdOrName || '').toLowerCase()
  );
  if (streamByStream && streamByStream.stream && !isUUID(streamByStream.stream)) {
    return `${streamByStream.class_name} ${streamByStream.stream}`;
  }

  if (selectedStreamIdOrName && !isUUID(selectedStreamIdOrName) && !(className || '').toLowerCase().includes((selectedStreamIdOrName || '').toLowerCase())) {
    return `${className} ${selectedStreamIdOrName}`;
  }

  return `${className} (All Streams)`;
}

/**
 * Formats standard CBE Examination Code in the administrative format:
 * [CLASS]-[TERM]-[YEAR]-[EXAM SHORT CODE]
 * Examples: "PP1-T2-2026-MT2", "PP2-T2-2026-MT2", "G1-T2-2026-MT2", "G7-T2-2026-ET2"
 */
export function formatStandardExamCode(
  gradeOrClass: string,
  exam?: Partial<Examination> | null
): string {
  // 1. Authoritative check: if exam has an explicit pre-configured exam_code
  // that follows the clean hyphenated format and has no legacy concatenation defects (e.g. ALLSTREAMS, TTERM)
  const rawCode = ((exam as any)?.exam_code || (exam as any)?.code || '').trim();
  if (
    rawCode &&
    !rawCode.toUpperCase().includes('ALLSTREAMS') &&
    !rawCode.toUpperCase().includes('TTERM') &&
    !rawCode.includes(' ') &&
    rawCode.includes('-') &&
    /^[A-Z0-9]+-[A-Z0-9]+-[0-9]{4}-[A-Z0-9]+$/i.test(rawCode)
  ) {
    return rawCode.toUpperCase();
  }

  // 2. Class Part: PP1, PP2, G1, G2, ..., G9
  let classPart = 'G1';
  const cleanGrade = (gradeOrClass || '').trim();
  if (/^pp\s*1/i.test(cleanGrade) || /pre.*primary.*1/i.test(cleanGrade)) {
    classPart = 'PP1';
  } else if (/^pp\s*2/i.test(cleanGrade) || /pre.*primary.*2/i.test(cleanGrade)) {
    classPart = 'PP2';
  } else {
    const numMatch = cleanGrade.match(/\d+/);
    if (numMatch) {
      classPart = `G${numMatch[0]}`;
    } else if (cleanGrade) {
      classPart = cleanGrade.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 4) || 'G1';
    }
  }

  // 3. Term Part: T1, T2, T3
  let termNum = '2';
  const termStr = String(exam?.term || '2').trim();
  const termNumMatch = termStr.match(/\d+/);
  if (termNumMatch) {
    termNum = termNumMatch[0];
  }
  const termPart = `T${termNum}`;

  // 4. Year Part: 2026
  const yearStr = String(exam?.year || new Date().getFullYear()).trim();
  const yearMatch = yearStr.match(/\d{4}/);
  const yearPart = yearMatch ? yearMatch[0] : (yearStr || '2026');

  // 5. Exam Short Code Part: MT2, ET2, CAT1, OPN, etc.
  let examShortCode = '';
  if (rawCode && /^[A-Z0-9]{2,6}$/i.test(rawCode) && !rawCode.toUpperCase().includes('TTERM')) {
    examShortCode = rawCode.toUpperCase();
  } else {
    const examName = (exam?.exam_name || '').trim().toUpperCase();
    const examType = (exam?.exam_type || '').trim().toUpperCase();
    const combined = `${examName} ${examType}`;

    if (combined.includes('MID')) {
      const numMatch = examName.match(/(\d+)/);
      const num = numMatch ? numMatch[1] : termNum;
      examShortCode = `MT${num}`;
    } else if (combined.includes('END') || combined.includes('FINAL')) {
      const numMatch = examName.match(/(\d+)/);
      const num = numMatch ? numMatch[1] : termNum;
      examShortCode = `ET${num}`;
    } else if (combined.includes('CAT') || combined.includes('CONTINUOUS')) {
      const numMatch = examName.match(/(\d+)/);
      const num = numMatch ? numMatch[1] : '1';
      examShortCode = `CAT${num}`;
    } else if (combined.includes('OPEN')) {
      examShortCode = 'OPN';
    } else if (combined.includes('MOCK')) {
      examShortCode = 'MCK';
    } else {
      const words = examName.split(/[\s-_]+/).filter(Boolean);
      if (words.length > 1) {
        const acronym = words.map((w) => w[0]).join('').slice(0, 4);
        examShortCode = acronym || `MT${termNum}`;
      } else if (examName) {
        examShortCode = examName.slice(0, 4);
      } else {
        examShortCode = `MT${termNum}`;
      }
    }
  }

  return `${classPart}-${termPart}-${yearPart}-${examShortCode}`;
}

/**
 * Removes unnecessary surrounding quotation marks from generated or entered remarks/comments.
 * Preserves inner punctuation, capitalization, and formatting.
 */
export function stripSurroundingQuotes(str?: string | null): string {
  if (!str) return '';
  return str.replace(/^["'“‘]+|["'”’]+$/g, '').trim();
}

