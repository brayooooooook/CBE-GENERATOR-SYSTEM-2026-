import { Student, Examination, ClassStream, LearnerPromotionRecord, GradeName } from '../types';

export interface LearnerExamContext {
  class_id: string;
  stream_id: string;
  grade: GradeName | string;
  class_name: string;
  stream_name: string;
  full_class_name: string;
  is_historical: boolean;
  historical_context_resolved: boolean;
  resolution_source:
    | 'live_current'
    | 'promotion_history_date'
    | 'promotion_history_year'
    | 'promotion_history_academic_year'
    | 'promotion_history_grade_match'
    | 'unresolved_historical'
    | 'fallback_current';
}

/**
 * Looks up live/current class details for an unpromoted or currently assigned student.
 */
function lookupLiveCurrentDetails(student: Student, classes: ClassStream[]): LearnerExamContext {
  const foundClass = classes.find((c) => c.id === student.class_id);
  const className = foundClass?.class_name || student.grade || 'Unknown Grade';
  const streamName = foundClass?.stream || '';
  const fullClassName = streamName ? `${className} ${streamName}`.trim() : className;

  return {
    class_id: foundClass?.id || student.class_id || '',
    stream_id: foundClass?.id || student.stream_id || student.class_id || '',
    grade: className,
    class_name: className,
    stream_name: streamName,
    full_class_name: fullClassName,
    is_historical: false,
    historical_context_resolved: true,
    resolution_source: 'live_current',
  };
}

/**
 * Strictly looks up historical class details given a historical classId or gradeFallback.
 * Never leaks current student.class_id or student.grade into historical results.
 * Never guesses a stream if multiple streams exist for a grade without a valid class_id.
 */
function lookupHistoricalClassDetails(
  classId: string | undefined,
  gradeFallback: string | undefined,
  classes: ClassStream[]
): {
  class_id: string;
  stream_id: string;
  grade: string;
  class_name: string;
  stream_name: string;
  full_class_name: string;
  historical_context_resolved: boolean;
} {
  // 1. Try resolving exact class_id
  if (classId) {
    const foundClass = classes.find((c) => c.id === classId);
    if (foundClass) {
      return {
        class_id: foundClass.id,
        stream_id: foundClass.id,
        grade: foundClass.class_name,
        class_name: foundClass.class_name,
        stream_name: foundClass.stream,
        full_class_name: `${foundClass.class_name} ${foundClass.stream}`.trim(),
        historical_context_resolved: true,
      };
    }
  }

  // 2. Try resolving by gradeFallback
  if (gradeFallback) {
    const matchingClasses = classes.filter(
      (c) => c.class_name.toLowerCase() === gradeFallback.toLowerCase()
    );

    if (matchingClasses.length === 1) {
      const foundClass = matchingClasses[0];
      return {
        class_id: foundClass.id,
        stream_id: foundClass.id,
        grade: foundClass.class_name,
        class_name: foundClass.class_name,
        stream_name: foundClass.stream,
        full_class_name: `${foundClass.class_name} ${foundClass.stream}`.trim(),
        historical_context_resolved: true,
      };
    }

    if (matchingClasses.length > 1) {
      // Multiple streams exist for this grade (e.g. Grade 7 East, Grade 7 West).
      // DO NOT guess a stream! Return grade context without stream details.
      return {
        class_id: classId || '',
        stream_id: '',
        grade: gradeFallback,
        class_name: gradeFallback,
        stream_name: '',
        full_class_name: gradeFallback,
        historical_context_resolved: false, // Stream remains unresolved / ambiguous
      };
    }

    // No matching class in classes array, but grade name exists
    return {
      class_id: classId || '',
      stream_id: '',
      grade: gradeFallback,
      class_name: gradeFallback,
      stream_name: '',
      full_class_name: gradeFallback,
      historical_context_resolved: false,
    };
  }

  // 3. Neither classId nor gradeFallback could be resolved
  return {
    class_id: classId || '',
    stream_id: '',
    grade: 'Unknown Grade',
    class_name: 'Unknown Grade',
    stream_name: '',
    full_class_name: 'Unknown Grade',
    historical_context_resolved: false,
  };
}

/**
 * Resolves the historical grade, class_id, stream_id, and class/stream names
 * for a student at the time a specific examination was taken.
 *
 * Safe & non-destructive:
 * - Does not alter any student, exam, or promotion records.
 * - Handles unpromoted students, single promotion, and multi-promotion histories.
 * - Chronological date comparison takes precedence over coarse academic_year_id matching when dates exist.
 * - Prevents silent leakage of current live class_id into historical contexts.
 * - Never guesses a stream when multiple streams exist for a grade without from_class_id.
 */
export function getLearnerClassAtExamTime(
  student: Student,
  examination: Examination,
  classes: ClassStream[],
  customPromotionHistory?: LearnerPromotionRecord[]
): LearnerExamContext {
  const history = customPromotionHistory || student.promotion_history || [];

  // 1. If no promotion history exists, learner has always been in current class
  if (!history || history.length === 0) {
    return lookupLiveCurrentDetails(student, classes);
  }

  // 2. Sort promotion history chronologically by date_promoted
  const sortedHistory = [...history].sort((a, b) => {
    const timeA = new Date(a.date_promoted).getTime() || 0;
    const timeB = new Date(b.date_promoted).getTime() || 0;
    return timeA - timeB;
  });

  // Determine exam timing reference
  const examDateStr = examination.start_date || examination.date_created;
  const examTime = examDateStr ? new Date(examDateStr).getTime() : null;
  const examYear = examination.year;

  // 3. Chronological date-based resolution (Takes precedence over academic_year_id when exam date exists)
  if (examTime && !isNaN(examTime)) {
    for (let i = 0; i < sortedHistory.length; i++) {
      const promoRecord = sortedHistory[i];
      const promoTime = new Date(promoRecord.date_promoted).getTime();

      if (!isNaN(promoTime) && examTime < promoTime) {
        // Examination was taken BEFORE this promotion event.
        // The student was in `from_class_id` / `from_grade`.
        const details = lookupHistoricalClassDetails(
          promoRecord.from_class_id,
          promoRecord.from_grade,
          classes
        );
        return {
          ...details,
          is_historical: true,
          resolution_source: 'promotion_history_date',
        };
      }
    }

    // Exam occurred after all recorded promotions -> post-promotion state
    const latestPromo = sortedHistory[sortedHistory.length - 1];
    const details = lookupHistoricalClassDetails(
      latestPromo.to_class_id,
      latestPromo.to_grade,
      classes
    );

    // If latest promo details match current student state, or if resolved
    if (details.historical_context_resolved) {
      return {
        ...details,
        is_historical: true,
        resolution_source: 'promotion_history_date',
      };
    }
  }

  // 4. Match by academic_year_id if explicitly available in promotion record (and date check did not conclude)
  if (examination.academic_year_id) {
    const matchByAcadYear = sortedHistory.find(
      (rec) => rec.academic_year_id === examination.academic_year_id
    );
    if (matchByAcadYear) {
      const details = lookupHistoricalClassDetails(
        matchByAcadYear.from_class_id,
        matchByAcadYear.from_grade,
        classes
      );
      return {
        ...details,
        is_historical: true,
        resolution_source: 'promotion_history_academic_year',
      };
    }
  }

  // 5. Year-based fallback resolution (if exam date is missing or invalid)
  if (examYear) {
    for (let i = 0; i < sortedHistory.length; i++) {
      const promoRecord = sortedHistory[i];
      const promoYear = promoRecord.date_promoted
        ? new Date(promoRecord.date_promoted).getFullYear()
        : null;

      if (promoYear && examYear < promoYear) {
        // Exam year is prior to promotion year
        const details = lookupHistoricalClassDetails(
          promoRecord.from_class_id,
          promoRecord.from_grade,
          classes
        );
        return {
          ...details,
          is_historical: true,
          resolution_source: 'promotion_history_year',
        };
      }
    }
  }

  // 6. Grade-match fallback if exam targeted a specific class
  if (examination.class_id && examination.class_id !== 'all') {
    const targetClass = classes.find((c) => c.id === examination.class_id);
    if (targetClass) {
      const matchedPromo = sortedHistory.find(
        (rec) =>
          rec.from_grade?.toLowerCase() === targetClass.class_name.toLowerCase() ||
          rec.from_class_id === targetClass.id
      );
      if (matchedPromo) {
        const details = lookupHistoricalClassDetails(
          matchedPromo.from_class_id || targetClass.id,
          matchedPromo.from_grade || targetClass.class_name,
          classes
        );
        return {
          ...details,
          is_historical: true,
          resolution_source: 'promotion_history_grade_match',
        };
      }
    }
  }

  // 7. Unresolved historical context for promoted learner (NEVER leak live current class)
  return {
    class_id: '',
    stream_id: '',
    grade: 'Unknown Grade',
    class_name: 'Unknown Grade',
    stream_name: '',
    full_class_name: 'Unknown Grade',
    is_historical: true,
    historical_context_resolved: false,
    resolution_source: 'unresolved_historical',
  };
}
