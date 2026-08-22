var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");
var import_supabase_js2 = require("@supabase/supabase-js");
var import_config = require("dotenv/config");

// src/types.ts
var ALL_GRADES = [
  "PP1",
  "PP2",
  "Grade 1",
  "Grade 2",
  "Grade 3",
  "Grade 4",
  "Grade 5",
  "Grade 6",
  "Grade 7",
  "Grade 8",
  "Grade 9"
];
var LEVEL_TO_GRADES = {
  "Pre-Primary": ["PP1", "PP2"],
  "Lower Primary": ["Grade 1", "Grade 2", "Grade 3"],
  "Upper Primary": ["Grade 4", "Grade 5", "Grade 6"],
  "Junior School": ["Grade 7", "Grade 8", "Grade 9"]
};
function normalizeGradeName(input) {
  if (!input) return "Grade 7";
  const str = String(input).trim();
  if (ALL_GRADES.includes(str)) {
    return str;
  }
  if (/^pp\s*1|^pre-?primary\s*1/i.test(str)) return "PP1";
  if (/^pp\s*2|^pre-?primary\s*2/i.test(str)) return "PP2";
  const match = str.match(/(?:cls_|grade\s*|g\s*)?([1-9])/i);
  if (match) {
    const num = parseInt(match[1], 10);
    if (num >= 1 && num <= 9) {
      return `Grade ${num}`;
    }
  }
  return "Grade 7";
}
function getEducationLevelForGrade(grade) {
  const norm = normalizeGradeName(grade);
  if (norm === "PP1" || norm === "PP2") return "Pre-Primary";
  if (norm === "Grade 1" || norm === "Grade 2" || norm === "Grade 3") return "Lower Primary";
  if (norm === "Grade 4" || norm === "Grade 5" || norm === "Grade 6") return "Upper Primary";
  return "Junior School";
}
var GRADE_ORDER_MAP = {
  "PP1": 0,
  "Pre-Primary 1": 0,
  "PP 1": 0,
  "PP2": 1,
  "Pre-Primary 2": 1,
  "PP 2": 1,
  "Grade 1": 2,
  "G1": 2,
  "Grade 2": 3,
  "G2": 3,
  "Grade 3": 4,
  "G3": 4,
  "Grade 4": 5,
  "G4": 5,
  "Grade 5": 6,
  "G5": 6,
  "Grade 6": 7,
  "G6": 7,
  "Grade 7": 8,
  "G7": 8,
  "Grade 8": 9,
  "G8": 9,
  "Grade 9": 10,
  "G9": 10,
  "Grade 10": 11,
  "G10": 11
};
function getGradeOrderIndex(gradeName) {
  if (!gradeName) return 999;
  const trimmed = String(gradeName).trim();
  if (GRADE_ORDER_MAP[trimmed] !== void 0) {
    return GRADE_ORDER_MAP[trimmed];
  }
  const lower = trimmed.toLowerCase();
  for (const key in GRADE_ORDER_MAP) {
    if (key.toLowerCase() === lower) {
      return GRADE_ORDER_MAP[key];
    }
  }
  const numMatch = trimmed.match(/\d+/);
  if (numMatch) {
    const num = parseInt(numMatch[0], 10);
    if (lower.includes("pp") || lower.includes("pre")) {
      return num - 1;
    }
    return num + 1;
  }
  return 999;
}
var PREFERRED_STREAMS = [
  "Blue",
  "Green",
  "Red",
  "Yellow",
  "White",
  "Gold",
  "Silver",
  "East",
  "West",
  "North",
  "South",
  "Alpha",
  "Beta",
  "Gamma",
  "Delta",
  "A",
  "B",
  "C",
  "D",
  "E",
  "F"
];
function getStreamOrderIndex(streamName) {
  if (!streamName) return 0;
  const trimmed = String(streamName).trim();
  const idx = PREFERRED_STREAMS.findIndex((s) => s.toLowerCase() === trimmed.toLowerCase());
  return idx !== -1 ? idx : 500;
}
function compareGradeAndStream(aGrade = "", aStream = "", bGrade = "", bStream = "") {
  const gradeDiff = getGradeOrderIndex(aGrade) - getGradeOrderIndex(bGrade);
  if (gradeDiff !== 0) return gradeDiff;
  const streamDiff = getStreamOrderIndex(aStream) - getStreamOrderIndex(bStream);
  if (streamDiff !== 0) return streamDiff;
  return aStream.localeCompare(bStream);
}
function isDemoOrTestClass(c) {
  if (!c) return false;
  const name = String(c.class_name || c.name || "").toLowerCase().trim();
  const stream = String(c.stream || c.stream_name || "").toLowerCase().trim();
  const id = String(c.id || "").toLowerCase().trim();
  return name === "demo" || name === "demo class" || name === "sample class" || name.startsWith("demo ") || stream === "demo" || stream === "demo stream" || stream === "sample" || id === "cls_demo" || id.startsWith("cls_demo_");
}
function sortClasses(classList) {
  if (!classList || classList.length === 0) return [];
  const filtered = classList.filter((c) => !isDemoOrTestClass(c));
  if (filtered.length <= 1) return filtered;
  return [...filtered].sort(
    (a, b) => compareGradeAndStream(a.class_name, a.stream, b.class_name, b.stream)
  );
}
function isIntakePeriodFuture(intakeYear, intakeTerm, activeYear, activeTerm) {
  if (!intakeYear) return false;
  const currentYear = activeYear || 2026;
  if (intakeYear > currentYear) return true;
  if (intakeYear < currentYear) return false;
  if (!intakeTerm || !activeTerm) return false;
  const termOrder = {
    "Term 1": 1,
    "Term 2": 2,
    "Term 3": 3
  };
  const intakeVal = termOrder[intakeTerm] || 0;
  const activeVal = termOrder[activeTerm] || 0;
  return intakeVal > activeVal;
}
function getStudentFullName(student) {
  if (!student) return "";
  if (student.first_name || student.last_name) {
    const parts = [student.first_name, student.second_name, student.last_name].filter((n) => Boolean(n && n.trim())).map((n) => n.trim());
    if (parts.length > 0) {
      return parts.join(" ");
    }
  }
  return student.full_name || "";
}
function extractGradeName(gradeStr) {
  if (!gradeStr) return "";
  const s = gradeStr.trim();
  const match = s.match(/(PP1|PP2|Grade\s*\d+)/i);
  if (match) {
    const raw = match[0];
    if (raw.toLowerCase().startsWith("grade")) {
      const num = raw.replace(/\D/g, "");
      return `Grade ${num}`;
    }
    return raw.toUpperCase();
  }
  return s;
}
function getShortCbeCode(code, name) {
  const upperCode = (code || "").toUpperCase().trim();
  const upperName = (name || "").toUpperCase().trim();
  if (upperCode === "PRE TECH" || upperCode === "PRE-TECH" || upperCode === "PTS" || upperCode.includes("PRE TECH") || upperCode.includes("PRE-TECH") || upperName.includes("PRE-TECH") || upperName.includes("PRE TECH") || upperName.includes("PRE TECHNICAL")) {
    return "PRE TECH";
  }
  if (upperCode === "ENG" || upperName.includes("ENGLISH")) return "ENG";
  if (upperCode === "KIS" || upperName.includes("KISWAHILI")) return "KIS";
  if (upperCode === "MATH" || upperCode === "MAT" || upperName.includes("MATH")) return "MATH";
  if (upperCode === "INT-SCI" || upperCode === "INT SCI" || upperCode === "SCI" || upperCode === "INT/SC" || upperCode.includes("INT") || upperName.includes("INTEGRATED") || upperName.includes("SCIENCE")) {
    return "INT-SCI";
  }
  if (upperCode === "CAS" || upperCode === "CA" || upperCode === "CREAT UP" || upperName.includes("CREATIVE") || upperName.includes("SPORTS")) {
    return "CAS";
  }
  if (upperCode === "SST" || upperName.includes("SOCIAL")) return "SST";
  if (upperCode === "CRE" || upperCode === "C.R.E" || upperCode === "RE" || upperCode === "RE ACT" || upperCode === "RE LP" || upperCode === "RE UP" || upperName.includes("CHRISTIAN") || upperName.includes("RELIGIOUS")) {
    return "CRE";
  }
  if (upperCode === "AGN" || upperCode === "AGR" || upperCode === "AGRIC" || upperCode === "AGRI" || upperName.includes("AGRICULT") || upperName.includes("NUTRITION")) {
    return "AGN";
  }
  if (upperCode === "IRE" || upperCode === "I.R.E" || upperName.includes("ISLAMIC")) return "IRE";
  if (upperCode === "HRE" || upperCode === "H.R.E" || upperName.includes("HINDU")) return "HRE";
  return upperCode || "SUBJ";
}
function sortSubjectsByStandardOrder(subjects) {
  if (!subjects || subjects.length <= 1) return subjects || [];
  const orderMap = {
    // Official Standard Order:
    "ENG": 1,
    "ENGLISH": 1,
    "KIS": 2,
    "KISW": 2,
    "KISWAHILI": 2,
    "MATH": 3,
    "MAT": 3,
    "MATHEMATICS": 3,
    "MATHS": 3,
    "SCT": 4,
    "INT-SCI": 4,
    "INT SCI": 4,
    "SCI": 4,
    "INT/SC": 4,
    "INTEGRATED SCIENCE": 4,
    "CAS": 5,
    "CA": 5,
    "CREATIVE ARTS AND SPORTS": 5,
    "CREATIVE ARTS & SPORTS": 5,
    "CREATIVE ARTS": 5,
    "CREAT UP": 5,
    "SS": 6,
    "SST": 6,
    "SOCIAL STUDIES": 6,
    "CRE": 7,
    "C.R.E": 7,
    "CHRISTIAN RELIGIOUS EDUCATION": 7,
    "AGN": 8,
    "AGR": 8,
    "AGRI": 8,
    "AGRIC": 8,
    "AGRICULTURE AND NUTRITION": 8,
    "AGRICULTURE & NUTRITION": 8,
    "AGRICULTURE": 8,
    "PRE TECH": 9,
    "PRE-TECH": 9,
    "PTS": 9,
    "PRE-TECHNICAL STUDIES": 9
  };
  return [...subjects].sort((a, b) => {
    const codeA = getShortCbeCode(a.subject_code || "", a.subject_name || "");
    const codeB = getShortCbeCode(b.subject_code || "", b.subject_name || "");
    const posA = orderMap[codeA] ?? (orderMap[(a.subject_code || "").toUpperCase()] ?? 99);
    const posB = orderMap[codeB] ?? (orderMap[(b.subject_code || "").toUpperCase()] ?? 99);
    if (posA !== posB) return posA - posB;
    return (a.subject_code || a.subject_name || "").localeCompare(b.subject_code || b.subject_name || "");
  });
}
function getApplicableSubjectsForGrade(gradeInput, subjects = []) {
  if (!subjects || subjects.length === 0) return [];
  const normalizedGrade = extractGradeName(gradeInput) || gradeInput;
  const eduLevel = getEducationLevelForGrade(normalizedGrade || gradeInput);
  const filtered = (subjects || []).filter((s) => {
    if (s.status === "Archived") return false;
    if (s.applicable_grades && s.applicable_grades.length > 0) {
      return s.applicable_grades.includes(normalizedGrade);
    }
    if (s.education_level) {
      return s.education_level === eduLevel;
    }
    return false;
  });
  return sortSubjectsByStandardOrder(filtered);
}
function getAllocatedSubjectsForClass(classStream, subjects = []) {
  if (!classStream || !subjects || subjects.length === 0) return [];
  if (classStream.allocated_subject_ids && classStream.allocated_subject_ids.length > 0) {
    const allocated = subjects.filter((s) => classStream.allocated_subject_ids.includes(s.id));
    if (allocated.length > 0) {
      return sortSubjectsByStandardOrder(allocated);
    }
  }
  return getApplicableSubjectsForGrade(classStream.class_name, subjects);
}

// src/lib/storage.ts
var import_supabase_js = require("@supabase/supabase-js");

// src/utils/rbacUtils.ts
function getActiveTeacher(currentUser, teachers = []) {
  if (!currentUser || currentUser.role !== "class_teacher" && currentUser.role !== "subject_teacher" && currentUser.role !== "teacher") return null;
  if (currentUser.teacher_id) {
    const found = teachers.find((t) => t.id === currentUser.teacher_id);
    if (found) return found;
  }
  if (currentUser.email) {
    const found = teachers.find(
      (t) => (t.email || "").toLowerCase() === (currentUser.email || "").toLowerCase()
    );
    if (found) return found;
  }
  if (currentUser.tsc_number) {
    const found = teachers.find((t) => t.tsc_number === currentUser.tsc_number);
    if (found) return found;
  }
  return null;
}
function getTeacherAssignedClassIds(teacher, classes = []) {
  if (!teacher) return [];
  const assignedSet = /* @__PURE__ */ new Set();
  if (Array.isArray(teacher.allocations)) {
    teacher.allocations.forEach((alloc) => {
      if (alloc.stream_id) {
        assignedSet.add(alloc.stream_id);
      } else if (alloc.stream) {
        const matched = classes.find(
          (c) => (c.class_name === alloc.class_name || c.id === alloc.class_id) && c.stream.toLowerCase() === alloc.stream.toLowerCase()
        );
        if (matched?.stream_id) assignedSet.add(matched.stream_id);
        else if (matched?.id) assignedSet.add(matched.id);
      } else if (alloc.class_id) {
        assignedSet.add(alloc.class_id);
      }
    });
  }
  if (teacher.is_class_teacher && teacher.class_teacher_of_id) {
    assignedSet.add(teacher.class_teacher_of_id);
  }
  classes.forEach((c) => {
    if (c.class_teacher_id === teacher.id || teacher.user_id && c.class_teacher_id === teacher.user_id || teacher.tsc_number && c.class_teacher_id === teacher.tsc_number) {
      if (c.stream_id) assignedSet.add(c.stream_id);
      else if (c.id) assignedSet.add(c.id);
    }
  });
  return Array.from(assignedSet);
}
function getTeacherAssignedSubjectIds(teacher) {
  if (!teacher) return [];
  const assignedSet = /* @__PURE__ */ new Set();
  if (Array.isArray(teacher.allocations)) {
    teacher.allocations.forEach((alloc) => {
      if (alloc.subject_id) assignedSet.add(alloc.subject_id);
      if (alloc.subject_code) assignedSet.add(alloc.subject_code);
    });
  }
  return Array.from(assignedSet);
}
function getAccessibleSubjects(currentUser, activeTeacher, subjects = [], selectedClassId, classes = []) {
  if (!currentUser) return subjects;
  if (currentUser.role === "admin") return subjects;
  if (currentUser.role === "class_teacher" || currentUser.role === "subject_teacher" || currentUser.role === "teacher") {
    if (!activeTeacher) return [];
    if (selectedClassId) {
      const cls = classes.find((c) => c.stream_id === selectedClassId || c.id === selectedClassId);
      if (isClassTeacherFor(activeTeacher, selectedClassId, classes)) {
        if (cls) {
          return getAllocatedSubjectsForClass(cls, subjects);
        }
        return subjects;
      }
      const teacherAllocs2 = activeTeacher.allocations || [];
      const classAllocs = teacherAllocs2.filter((a) => {
        if (a.stream_id && (selectedClassId === a.stream_id || cls?.stream_id === a.stream_id || cls?.id === a.stream_id)) return true;
        if (a.class_id && (selectedClassId === a.class_id || cls?.id === a.class_id || cls?.stream_id === a.class_id)) return true;
        if (cls && a.class_name && cls.class_name && a.class_name.toLowerCase() === cls.class_name.toLowerCase()) {
          if (a.stream && cls.stream) {
            return a.stream.trim().toLowerCase() === cls.stream.trim().toLowerCase();
          }
          return true;
        }
        return false;
      });
      return subjects.filter(
        (s) => classAllocs.some(
          (a) => a.subject_id === s.id || a.subject_id === s.subject_code || a.subject_code && a.subject_code === s.subject_code || a.subject_name && a.subject_name.toLowerCase() === s.subject_name.toLowerCase()
        )
      );
    }
    const teacherAllocs = activeTeacher.allocations || [];
    const assignedIds = getTeacherAssignedSubjectIds(activeTeacher);
    const ctClasses = classes.filter((c) => isClassTeacherFor(activeTeacher, c.stream_id || c.id, classes));
    const ctSubjects = ctClasses.flatMap((c) => getAllocatedSubjectsForClass(c, subjects));
    return subjects.filter(
      (s) => assignedIds.includes(s.id) || ctSubjects.some((cts) => cts.id === s.id) || teacherAllocs.some(
        (a) => a.subject_id === s.id || a.subject_id === s.subject_code || a.subject_code && a.subject_code === s.subject_code || a.subject_name && a.subject_name.toLowerCase() === s.subject_name.toLowerCase()
      )
    );
  }
  return subjects;
}
function getAccessibleStudents(currentUser, activeTeacher, students = [], classes = []) {
  if (!currentUser) return students;
  if (currentUser.role === "admin") return students;
  if (currentUser.role === "class_teacher" || currentUser.role === "subject_teacher" || currentUser.role === "teacher") {
    if (!activeTeacher) return [];
    const assignedIds = getTeacherAssignedClassIds(activeTeacher, classes);
    return students.filter(
      (s) => assignedIds.includes(s.class_id) || s.stream_id && assignedIds.includes(s.stream_id)
    );
  }
  return students;
}
function isClassTeacherFor(teacher, classId, classes = []) {
  if (!teacher || !classId) return false;
  const cls = classes.find((c) => c.stream_id === classId || c.id === classId);
  if (teacher.is_class_teacher && teacher.class_teacher_of_id) {
    if (cls?.stream_id && teacher.class_teacher_of_id === cls.stream_id) return true;
    if (cls?.id && teacher.class_teacher_of_id === cls.id) return true;
    if (teacher.class_teacher_of_id === classId) return true;
  }
  if (cls && (cls.class_teacher_id === teacher.id || teacher.user_id && cls.class_teacher_id === teacher.user_id || teacher.tsc_number && cls.class_teacher_id === teacher.tsc_number)) {
    return true;
  }
  return false;
}

// src/services/historicalContextResolver.ts
function lookupLiveCurrentDetails(student, classes) {
  const foundClass = (student.stream_id ? classes.find((c) => c.stream_id === student.stream_id || c.id === student.stream_id) : void 0) || classes.find((c) => c.id === student.class_id);
  const className = foundClass?.class_name || student.grade || "Unknown Grade";
  const streamName = foundClass?.stream || "";
  const fullClassName = streamName ? `${className} ${streamName}`.trim() : className;
  return {
    class_id: foundClass?.id || student.class_id || "",
    stream_id: foundClass?.stream_id || student.stream_id || foundClass?.id || student.class_id || "",
    grade: className,
    class_name: className,
    stream_name: streamName,
    full_class_name: fullClassName,
    is_historical: false,
    historical_context_resolved: true,
    resolution_source: "live_current"
  };
}
function lookupHistoricalClassDetails(classId, gradeFallback, classes) {
  if (classId) {
    const foundClass = classes.find((c) => c.stream_id === classId) || classes.find((c) => c.id === classId);
    if (foundClass) {
      return {
        class_id: foundClass.id,
        stream_id: foundClass.stream_id || foundClass.id,
        grade: foundClass.class_name,
        class_name: foundClass.class_name,
        stream_name: foundClass.stream,
        full_class_name: `${foundClass.class_name} ${foundClass.stream}`.trim(),
        historical_context_resolved: true
      };
    }
  }
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
        historical_context_resolved: true
      };
    }
    if (matchingClasses.length > 1) {
      return {
        class_id: classId || "",
        stream_id: "",
        grade: gradeFallback,
        class_name: gradeFallback,
        stream_name: "",
        full_class_name: gradeFallback,
        historical_context_resolved: false
        // Stream remains unresolved / ambiguous
      };
    }
    return {
      class_id: classId || "",
      stream_id: "",
      grade: gradeFallback,
      class_name: gradeFallback,
      stream_name: "",
      full_class_name: gradeFallback,
      historical_context_resolved: false
    };
  }
  return {
    class_id: classId || "",
    stream_id: "",
    grade: "Unknown Grade",
    class_name: "Unknown Grade",
    stream_name: "",
    full_class_name: "Unknown Grade",
    historical_context_resolved: false
  };
}
function getLearnerClassAtExamTime(student, examination, classes, customPromotionHistory) {
  const history = customPromotionHistory || student.promotion_history || [];
  if (!history || history.length === 0) {
    return lookupLiveCurrentDetails(student, classes);
  }
  const sortedHistory = [...history].sort((a, b) => {
    const timeA = new Date(a.date_promoted).getTime() || 0;
    const timeB = new Date(b.date_promoted).getTime() || 0;
    return timeA - timeB;
  });
  const examDateStr = examination.start_date || examination.date_created;
  const examTime = examDateStr ? new Date(examDateStr).getTime() : null;
  const examYear = examination.year;
  if (examTime && !isNaN(examTime)) {
    for (let i = 0; i < sortedHistory.length; i++) {
      const promoRecord = sortedHistory[i];
      const promoTime = new Date(promoRecord.date_promoted).getTime();
      if (!isNaN(promoTime) && examTime < promoTime) {
        const details2 = lookupHistoricalClassDetails(
          promoRecord.from_class_id,
          promoRecord.from_grade,
          classes
        );
        return {
          ...details2,
          is_historical: true,
          resolution_source: "promotion_history_date"
        };
      }
    }
    const latestPromo = sortedHistory[sortedHistory.length - 1];
    const details = lookupHistoricalClassDetails(
      latestPromo.to_class_id,
      latestPromo.to_grade,
      classes
    );
    if (details.historical_context_resolved) {
      return {
        ...details,
        is_historical: true,
        resolution_source: "promotion_history_date"
      };
    }
  }
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
        resolution_source: "promotion_history_academic_year"
      };
    }
  }
  if (examYear) {
    for (let i = 0; i < sortedHistory.length; i++) {
      const promoRecord = sortedHistory[i];
      const promoYear = promoRecord.date_promoted ? new Date(promoRecord.date_promoted).getFullYear() : null;
      if (promoYear && examYear < promoYear) {
        const details = lookupHistoricalClassDetails(
          promoRecord.from_class_id,
          promoRecord.from_grade,
          classes
        );
        return {
          ...details,
          is_historical: true,
          resolution_source: "promotion_history_year"
        };
      }
    }
  }
  if (examination.class_id && examination.class_id !== "all") {
    const targetClass = classes.find((c) => c.id === examination.class_id);
    if (targetClass) {
      const matchedPromo = sortedHistory.find(
        (rec) => rec.from_grade?.toLowerCase() === targetClass.class_name.toLowerCase() || rec.from_class_id === targetClass.id
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
          resolution_source: "promotion_history_grade_match"
        };
      }
    }
  }
  return {
    class_id: "",
    stream_id: "",
    grade: "Unknown Grade",
    class_name: "Unknown Grade",
    stream_name: "",
    full_class_name: "Unknown Grade",
    is_historical: true,
    historical_context_resolved: false,
    resolution_source: "unresolved_historical"
  };
}
function getStreamCohortStudentIds(targetStudent, allStudents, exam, classes) {
  if (!targetStudent || !allStudents || allStudents.length === 0) {
    return new Set(targetStudent?.id ? [targetStudent.id] : []);
  }
  const targetContext = exam ? getLearnerClassAtExamTime(targetStudent, exam, classes) : lookupLiveCurrentDetails(targetStudent, classes);
  const targetGrade = (targetContext.grade || targetStudent.grade || "").toLowerCase().trim();
  const targetStreamName = (targetContext.stream_name || "").toLowerCase().trim();
  const targetStreamId = (targetContext.stream_id || targetStudent.stream_id || "").trim();
  const targetClassId = (targetContext.class_id || targetStudent.class_id || "").trim();
  const matchedIds = /* @__PURE__ */ new Set();
  for (const candidate of allStudents) {
    if (!candidate) continue;
    const candContext = exam ? getLearnerClassAtExamTime(candidate, exam, classes) : lookupLiveCurrentDetails(candidate, classes);
    const candGrade = (candContext.grade || candidate.grade || "").toLowerCase().trim();
    const candStreamName = (candContext.stream_name || "").toLowerCase().trim();
    const candStreamId = (candContext.stream_id || candidate.stream_id || "").trim();
    const candClassId = (candContext.class_id || candidate.class_id || "").trim();
    if (targetGrade && candGrade && targetGrade !== candGrade) {
      continue;
    }
    if (targetStreamId && candStreamId && targetStreamId === candStreamId) {
      matchedIds.add(candidate.id);
      continue;
    }
    if (targetStreamName && candStreamName && targetStreamName === candStreamName) {
      matchedIds.add(candidate.id);
      continue;
    }
    if (!targetStreamName && !candStreamName && !targetStreamId && !candStreamId) {
      if (targetClassId && candClassId && targetClassId === candClassId) {
        matchedIds.add(candidate.id);
        continue;
      }
    }
  }
  if (allStudents.some((s) => s.id === targetStudent.id)) {
    matchedIds.add(targetStudent.id);
  }
  return matchedIds;
}
function getGradeCohortStudentIds(targetStudent, allStudents, exam, classes) {
  if (!targetStudent || !allStudents || allStudents.length === 0) {
    return new Set(targetStudent?.id ? [targetStudent.id] : []);
  }
  const targetContext = exam ? getLearnerClassAtExamTime(targetStudent, exam, classes) : lookupLiveCurrentDetails(targetStudent, classes);
  const targetGrade = (targetContext.grade || targetStudent.grade || "").toLowerCase().trim();
  const matchedIds = /* @__PURE__ */ new Set();
  if (!targetGrade || targetGrade === "unknown grade") {
    if (allStudents.some((s) => s.id === targetStudent.id)) {
      matchedIds.add(targetStudent.id);
    }
    return matchedIds;
  }
  for (const candidate of allStudents) {
    if (!candidate) continue;
    const candContext = exam ? getLearnerClassAtExamTime(candidate, exam, classes) : lookupLiveCurrentDetails(candidate, classes);
    const candGrade = (candContext.grade || candidate.grade || "").toLowerCase().trim();
    if (candGrade && candGrade !== "unknown grade" && targetGrade === candGrade) {
      matchedIds.add(candidate.id);
    }
  }
  if (allStudents.some((s) => s.id === targetStudent.id)) {
    matchedIds.add(targetStudent.id);
  }
  return matchedIds;
}

// src/utils/filterUtils.ts
function getFilteredStudents(students = [], classes = [], selectedClassIdOrName = "all", selectedStreamIdOrName = "all", examination) {
  if (!students || students.length === 0) return [];
  const isClassAll = !selectedClassIdOrName || selectedClassIdOrName === "all";
  const isStreamAll = !selectedStreamIdOrName || selectedStreamIdOrName === "all" || selectedStreamIdOrName === "All Streams";
  if (isClassAll && isStreamAll) {
    return students;
  }
  let targetClassName = null;
  let matchingClassIds = [];
  if (!isClassAll) {
    const foundById = classes.find((c) => c.id === selectedClassIdOrName || c.stream_id === selectedClassIdOrName);
    if (foundById) {
      targetClassName = foundById.class_name;
      matchingClassIds = classes.filter((c) => (c.class_name || "").toLowerCase() === (targetClassName || "").toLowerCase()).map((c) => c.id);
    } else {
      const matchingByName = classes.filter(
        (c) => (c.class_name || "").toLowerCase() === (selectedClassIdOrName || "").toLowerCase()
      );
      if (matchingByName.length > 0) {
        targetClassName = matchingByName[0].class_name;
        matchingClassIds = matchingByName.map((c) => c.id);
      } else {
        matchingClassIds = [selectedClassIdOrName];
      }
    }
  }
  return students.filter((s) => {
    if (!s) return false;
    let studentClassId;
    let studentStreamId;
    let studentClassName;
    let studentStreamName;
    let studentClassObj;
    if (examination) {
      const historicalContext = getLearnerClassAtExamTime(s, examination, classes);
      studentClassId = historicalContext.class_id;
      studentStreamId = historicalContext.stream_id;
      studentClassName = historicalContext.class_name || historicalContext.grade || "";
      studentStreamName = historicalContext.stream_name || "";
      studentClassObj = (s.stream_id ? classes.find((c) => c.stream_id === s.stream_id) : void 0) || (studentStreamId ? classes.find((c) => c.stream_id === studentStreamId) : void 0) || classes.find((c) => c.id === studentClassId);
    } else {
      studentClassId = s.class_id;
      studentStreamId = s.stream_id || "";
      studentClassObj = (s.stream_id ? classes.find((c) => c.stream_id === s.stream_id) : void 0) || classes.find((c) => c.id === s.class_id);
      studentClassName = studentClassObj ? studentClassObj.class_name : "";
      studentStreamName = studentClassObj ? studentClassObj.stream : "";
    }
    let matchesClass = false;
    if (isClassAll) {
      matchesClass = true;
    } else if (targetClassName) {
      matchesClass = !!studentClassId && matchingClassIds.includes(studentClassId) || !!studentClassName && studentClassName.toLowerCase() === targetClassName.toLowerCase();
    } else {
      matchesClass = studentClassId === selectedClassIdOrName || studentClassObj && (studentClassObj.id === selectedClassIdOrName || studentClassObj.stream_id === selectedClassIdOrName);
    }
    if (!matchesClass) return false;
    if (isStreamAll) {
      return true;
    }
    const matchingStreamObjs = classes.filter((c) => {
      const matchesId = c.stream_id === selectedStreamIdOrName || c.id === selectedStreamIdOrName;
      const matchesName = (c.stream || "").toLowerCase() === (selectedStreamIdOrName || "").toLowerCase();
      if (!isClassAll && targetClassName) {
        return (matchesId || matchesName) && (c.class_name || "").toLowerCase() === targetClassName.toLowerCase();
      }
      return matchesId || matchesName;
    });
    let matchesStream = false;
    if (matchingStreamObjs.length > 0) {
      matchesStream = matchingStreamObjs.some((targetStreamObj) => {
        if (studentStreamId && (studentStreamId === targetStreamObj.stream_id || studentStreamId === targetStreamObj.id)) {
          return true;
        }
        if (studentClassId && targetStreamObj.stream_id && studentClassId === targetStreamObj.stream_id) {
          return true;
        }
        if (studentClassObj) {
          if (studentClassObj.stream_id && (studentClassObj.stream_id === targetStreamObj.stream_id || studentClassObj.stream_id === targetStreamObj.id)) {
            return true;
          }
          if (targetStreamObj.stream_id && studentClassObj.id === targetStreamObj.stream_id) {
            return true;
          }
        }
        if (studentStreamName && targetStreamObj.stream && studentStreamName.toLowerCase() === targetStreamObj.stream.toLowerCase()) {
          if (isClassAll || studentClassName && targetStreamObj.class_name && studentClassName.toLowerCase() === targetStreamObj.class_name.toLowerCase()) {
            return true;
          }
        }
        return false;
      });
    } else {
      matchesStream = !!studentStreamId && studentStreamId === selectedStreamIdOrName || !!studentStreamName && studentStreamName.toLowerCase() === selectedStreamIdOrName.toLowerCase();
    }
    return !!matchesStream;
  });
}

// src/utils/apiConfig.ts
var import_core = require("@capacitor/core");
var import_meta = {};
function getApiBaseUrl() {
  let envUrl = "";
  try {
    if (typeof import_meta !== "undefined" && import_meta.env?.VITE_API_BASE_URL) {
      envUrl = import_meta.env.VITE_API_BASE_URL;
    }
  } catch {
  }
  if (!envUrl && typeof process !== "undefined" && process.env?.VITE_API_BASE_URL) {
    envUrl = process.env.VITE_API_BASE_URL;
  }
  if (typeof envUrl === "string" && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/+$/, "");
  }
  if (typeof import_core.Capacitor !== "undefined" && import_core.Capacitor.isNativePlatform()) {
    console.warn("[apiConfig] Running in Capacitor native mode without VITE_API_BASE_URL set. Administrative Express API calls may fail.");
  }
  return "";
}
function buildApiUrl(path2) {
  const base = getApiBaseUrl();
  const normalizedPath = path2.startsWith("/") ? path2 : `/${path2}`;
  if (!base) {
    return normalizedPath;
  }
  return `${base}${normalizedPath}`;
}

// src/data/seedData.ts
var initialAcademicYears = [
  { id: "ay_2025", year: 2025, status: "Archived", created_at: "2025-01-01T00:00:00Z", updated_at: "2025-12-31T00:00:00Z" },
  { id: "ay_2026", year: 2026, status: "Active", created_at: "2026-01-01T00:00:00Z", updated_at: "2026-05-06T00:00:00Z" },
  { id: "ay_2027", year: 2027, status: "Upcoming", created_at: "2026-05-01T00:00:00Z", updated_at: "2026-05-01T00:00:00Z" }
];
var initialTerms = [
  { id: "t_2025_1", academic_year_id: "ay_2025", year: 2025, term_name: "Term 1", opening_date: "2025-01-08", closing_date: "2025-04-11", status: "Archived" },
  { id: "t_2025_2", academic_year_id: "ay_2025", year: 2025, term_name: "Term 2", opening_date: "2025-05-05", closing_date: "2025-08-08", status: "Archived" },
  { id: "t_2025_3", academic_year_id: "ay_2025", year: 2025, term_name: "Term 3", opening_date: "2025-09-01", closing_date: "2025-11-21", status: "Archived" },
  { id: "t_2026_1", academic_year_id: "ay_2026", year: 2026, term_name: "Term 1", opening_date: "2026-01-06", closing_date: "2026-04-02", mid_term_opening_date: "2026-02-25", mid_term_closing_date: "2026-03-01", status: "Closed" },
  { id: "t_2026_2", academic_year_id: "ay_2026", year: 2026, term_name: "Term 2", opening_date: "2026-04-27", closing_date: "2026-07-31", mid_term_opening_date: "2026-06-24", mid_term_closing_date: "2026-06-28", status: "Active" },
  { id: "t_2026_3", academic_year_id: "ay_2026", year: 2026, term_name: "Term 3", opening_date: "2026-08-24", closing_date: "2026-10-23", status: "Upcoming" }
];
var initialSchool = {
  id: "00000000-0000-0000-0000-000000000001",
  school_name: "CBE Management System",
  motto: "Strive for Excellence",
  county: "Kenya",
  postal_code: "P.O. Box 100-00100",
  address: "Kenya",
  email: "info@school.ac.ke"
};
var initialGrades = [
  {
    id: "gr_ee1",
    grade_code: "EE1",
    performance_level: "EE",
    minimum_score: 90,
    maximum_score: 100,
    points: 8,
    remarks: "Outstanding Performance",
    descriptor: "Exceeding Expectations",
    grade: "EE1",
    minimum_marks: 90,
    maximum_marks: 100
  },
  {
    id: "gr_ee2",
    grade_code: "EE2",
    performance_level: "EE",
    minimum_score: 75,
    maximum_score: 89,
    points: 7,
    remarks: "Excellent Performance",
    descriptor: "Exceeding Expectations",
    grade: "EE2",
    minimum_marks: 75,
    maximum_marks: 89
  },
  {
    id: "gr_me1",
    grade_code: "ME1",
    performance_level: "ME",
    minimum_score: 58,
    maximum_score: 74,
    points: 6,
    remarks: "Good Performance",
    descriptor: "Meeting Expectations",
    grade: "ME1",
    minimum_marks: 58,
    maximum_marks: 74
  },
  {
    id: "gr_me2",
    grade_code: "ME2",
    performance_level: "ME",
    minimum_score: 41,
    maximum_score: 57,
    points: 5,
    remarks: "Satisfactory Performance",
    descriptor: "Meeting Expectations",
    grade: "ME2",
    minimum_marks: 41,
    maximum_marks: 57
  },
  {
    id: "gr_ae1",
    grade_code: "AE1",
    performance_level: "AE",
    minimum_score: 31,
    maximum_score: 40,
    points: 4,
    remarks: "Developing Competency",
    descriptor: "Approaching Expectations",
    grade: "AE1",
    minimum_marks: 31,
    maximum_marks: 40
  },
  {
    id: "gr_ae2",
    grade_code: "AE2",
    performance_level: "AE",
    minimum_score: 21,
    maximum_score: 30,
    points: 3,
    remarks: "Needs More Practice",
    descriptor: "Approaching Expectations",
    grade: "AE2",
    minimum_marks: 21,
    maximum_marks: 30
  },
  {
    id: "gr_be1",
    grade_code: "BE1",
    performance_level: "BE",
    minimum_score: 11,
    maximum_score: 20,
    points: 2,
    remarks: "Requires Intervention",
    descriptor: "Below Expectations",
    grade: "BE1",
    minimum_marks: 11,
    maximum_marks: 20
  },
  {
    id: "gr_be2",
    grade_code: "BE2",
    performance_level: "BE",
    minimum_score: 0,
    maximum_score: 10,
    points: 1,
    remarks: "Immediate Support Required",
    descriptor: "Below Expectations",
    grade: "BE2",
    minimum_marks: 0,
    maximum_marks: 10
  }
];
var initialSubjects = [
  // --- PRE-PRIMARY (PP1 & PP2) ---
  { id: "sb_pp_lang", subject_name: "Language Activities", subject_code: "PP-LANG", category: "Activity", department: "Pre-Primary", education_level: "Pre-Primary", applicable_grades: ["PP1", "PP2"], status: "Active" },
  { id: "sb_pp_math", subject_name: "Mathematical Activities", subject_code: "PP-MATH", category: "Activity", department: "Pre-Primary", education_level: "Pre-Primary", applicable_grades: ["PP1", "PP2"], status: "Active" },
  { id: "sb_pp_env", subject_name: "Environmental Activities", subject_code: "PP-ENV", category: "Activity", department: "Pre-Primary", education_level: "Pre-Primary", applicable_grades: ["PP1", "PP2"], status: "Active" },
  { id: "sb_pp_psy", subject_name: "Psychomotor & Creative Activities", subject_code: "PP-PCA", category: "Activity", department: "Pre-Primary", education_level: "Pre-Primary", applicable_grades: ["PP1", "PP2"], status: "Active" },
  { id: "sb_pp_re", subject_name: "Christian Religious Education Activities", subject_code: "PP-CRE", category: "Activity", department: "Pre-Primary", education_level: "Pre-Primary", applicable_grades: ["PP1", "PP2"], status: "Active" },
  // --- LOWER PRIMARY (Grade 1 - 3) ---
  { id: "sb_lp_lit", subject_name: "Literacy Activities", subject_code: "LP-LIT", category: "Activity", department: "Languages", education_level: "Lower Primary", applicable_grades: ["Grade 1", "Grade 2", "Grade 3"], status: "Active" },
  { id: "sb_lp_eng", subject_name: "English Language Activities", subject_code: "LP-ENG", category: "Activity", department: "Languages", education_level: "Lower Primary", applicable_grades: ["Grade 1", "Grade 2", "Grade 3"], status: "Active" },
  { id: "sb_lp_kis", subject_name: "Kiswahili Language Activities / Kenya Sign Language", subject_code: "LP-KSL", category: "Activity", department: "Languages", education_level: "Lower Primary", applicable_grades: ["Grade 1", "Grade 2", "Grade 3"], status: "Active" },
  { id: "sb_lp_mat", subject_name: "Mathematical Activities", subject_code: "LP-MATH", category: "Activity", department: "STEM", education_level: "Lower Primary", applicable_grades: ["Grade 1", "Grade 2", "Grade 3"], status: "Active" },
  { id: "sb_lp_env", subject_name: "Environmental Activities", subject_code: "LP-ENV", category: "Activity", department: "Humanities", education_level: "Lower Primary", applicable_grades: ["Grade 1", "Grade 2", "Grade 3"], status: "Active" },
  { id: "sb_lp_hng", subject_name: "Hygiene & Nutrition Activities", subject_code: "LP-HN", category: "Activity", department: "Applied Sciences", education_level: "Lower Primary", applicable_grades: ["Grade 1", "Grade 2", "Grade 3"], status: "Active" },
  { id: "sb_lp_re", subject_name: "Christian Religious Education Activities", subject_code: "LP-CRE", category: "Activity", department: "Humanities", education_level: "Lower Primary", applicable_grades: ["Grade 1", "Grade 2", "Grade 3"], status: "Active" },
  { id: "sb_lp_crt", subject_name: "Movement & Creative Activities", subject_code: "LP-MCA", category: "Activity", department: "Technical & Arts", education_level: "Lower Primary", applicable_grades: ["Grade 1", "Grade 2", "Grade 3"], status: "Active" },
  // --- UPPER PRIMARY (Grade 4 - 6) ---
  { id: "sb_up_eng", subject_name: "English", subject_code: "ENG", category: "Core", department: "Languages", education_level: "Upper Primary", applicable_grades: ["Grade 4", "Grade 5", "Grade 6"], status: "Active" },
  { id: "sb_up_kis", subject_name: "Kiswahili", subject_code: "KISW", category: "Core", department: "Languages", education_level: "Upper Primary", applicable_grades: ["Grade 4", "Grade 5", "Grade 6"], status: "Active" },
  { id: "sb_up_mat", subject_name: "Mathematics", subject_code: "MATHS", category: "Core", department: "STEM", education_level: "Upper Primary", applicable_grades: ["Grade 4", "Grade 5", "Grade 6"], status: "Active" },
  { id: "sb_up_sci", subject_name: "Science & Technology", subject_code: "SCT", category: "Core", department: "STEM", education_level: "Upper Primary", applicable_grades: ["Grade 4", "Grade 5", "Grade 6"], status: "Active" },
  { id: "sb_up_agr", subject_name: "Agriculture", subject_code: "AGR", category: "Core", department: "Applied Sciences", education_level: "Upper Primary", applicable_grades: ["Grade 4", "Grade 5", "Grade 6"], status: "Active" },
  { id: "sb_up_sst", subject_name: "Social Studies", subject_code: "SS", category: "Core", department: "Humanities", education_level: "Upper Primary", applicable_grades: ["Grade 4", "Grade 5", "Grade 6"], status: "Active" },
  { id: "sb_up_crt", subject_name: "Creative Arts", subject_code: "CA", category: "Core", department: "Technical & Arts", education_level: "Upper Primary", applicable_grades: ["Grade 4", "Grade 5", "Grade 6"], status: "Active" },
  { id: "sb_up_re", subject_name: "Christian Religious Education", subject_code: "CRE", category: "Core", department: "Humanities", education_level: "Upper Primary", applicable_grades: ["Grade 4", "Grade 5", "Grade 6"], status: "Active" },
  // --- JUNIOR SCHOOL (Grade 7 - 9) ---
  { id: "sb_eng", subject_name: "English", subject_code: "ENG", category: "Core", department: "Languages", education_level: "Junior School", applicable_grades: ["Grade 7", "Grade 8", "Grade 9"], status: "Active" },
  { id: "sb_kis", subject_name: "Kiswahili", subject_code: "KIS", category: "Core", department: "Languages", education_level: "Junior School", applicable_grades: ["Grade 7", "Grade 8", "Grade 9"], status: "Active" },
  { id: "sb_mat", subject_name: "Mathematics", subject_code: "MATH", category: "Core", department: "STEM", education_level: "Junior School", applicable_grades: ["Grade 7", "Grade 8", "Grade 9"], status: "Active" },
  { id: "sb_sci", subject_name: "Integrated Science", subject_code: "INT-SCI", category: "Core", department: "STEM", education_level: "Junior School", applicable_grades: ["Grade 7", "Grade 8", "Grade 9"], status: "Active" },
  { id: "sb_cas", subject_name: "Creative Arts and Sports", subject_code: "CAS", category: "Core", department: "Technical & Arts", education_level: "Junior School", applicable_grades: ["Grade 7", "Grade 8", "Grade 9"], status: "Active" },
  { id: "sb_sst", subject_name: "Social Studies", subject_code: "SST", category: "Core", department: "Humanities", education_level: "Junior School", applicable_grades: ["Grade 7", "Grade 8", "Grade 9"], status: "Active" },
  { id: "sb_cre", subject_name: "Christian Religious Education", subject_code: "CRE", category: "Core", department: "Humanities", education_level: "Junior School", applicable_grades: ["Grade 7", "Grade 8", "Grade 9"], status: "Active" },
  { id: "sb_agn", subject_name: "Agriculture", subject_code: "AGN", category: "Core", department: "Applied Sciences", education_level: "Junior School", applicable_grades: ["Grade 7", "Grade 8", "Grade 9"], status: "Active" },
  { id: "sb_pts", subject_name: "Pre-Technical Studies", subject_code: "PRE-TECH", category: "Core", department: "Technical & Arts", education_level: "Junior School", applicable_grades: ["Grade 7", "Grade 8", "Grade 9"], status: "Active" }
];
function isStandardSubject(sb) {
  if (!sb) return false;
  const idStr = typeof sb === "string" ? sb : sb.id;
  const codeStr = (typeof sb === "string" ? "" : sb.subject_code || "").toUpperCase().trim();
  const nameStr = (typeof sb === "string" ? "" : sb.subject_name || "").toLowerCase().trim();
  if (typeof sb !== "string") {
    if (sb.is_system === true || sb.is_custom === false) {
      return true;
    }
  }
  return initialSubjects.some((isb) => {
    if (isb.id === idStr) return true;
    if (codeStr && isb.subject_code.toUpperCase().trim() === codeStr) return true;
    if (nameStr && isb.subject_name.toLowerCase().trim() === nameStr) return true;
    return false;
  });
}
var initialUsers = [
  {
    id: "usr_admin",
    name: "Administrator",
    email: "admin@cbe.ac.ke",
    role: "admin"
  },
  {
    id: "usr_tch_01",
    name: "Madam Grace Wanjiku (Class Teacher)",
    email: "grace@cbe.ac.ke",
    role: "class_teacher",
    teacher_id: "tch_01"
  },
  {
    id: "usr_tch_02",
    name: "Mr. David Otieno (Subject Teacher)",
    email: "david@cbe.ac.ke",
    role: "subject_teacher",
    teacher_id: "tch_02"
  }
];

// src/lib/storage.ts
var import_meta2 = {};
var adminUsersOnly = initialUsers.filter((u) => u.role === "admin");
var supabase = null;
var supabaseInstance = null;
var currentUrl = "";
var currentKey = "";
function getSupabaseCredentials() {
  const env = import_meta2.env || {};
  const procEnv = typeof process !== "undefined" ? process.env : {};
  const url = env.VITE_SUPABASE_URL || procEnv.VITE_SUPABASE_URL || procEnv.SUPABASE_URL || (typeof localStorage !== "undefined" ? localStorage.getItem("cbe_supabase_url") : "") || "";
  const anonKey = env.VITE_SUPABASE_ANON_KEY || procEnv.VITE_SUPABASE_ANON_KEY || (typeof localStorage !== "undefined" ? localStorage.getItem("cbe_supabase_anon_key") : "") || "";
  return { url: url.trim(), anonKey: anonKey.trim() };
}
function getSupabaseClient(url, anonKey) {
  const creds = getSupabaseCredentials();
  const finalUrl = (url !== void 0 ? url : creds.url).trim();
  const finalKey = (anonKey !== void 0 ? anonKey : creds.anonKey).trim();
  if (!finalUrl || !finalKey) {
    return null;
  }
  if (supabaseInstance && currentUrl === finalUrl && currentKey === finalKey) {
    return supabaseInstance;
  }
  try {
    supabaseInstance = (0, import_supabase_js.createClient)(finalUrl, finalKey);
    currentUrl = finalUrl;
    currentKey = finalKey;
    supabase = supabaseInstance;
    return supabaseInstance;
  } catch (err) {
    console.error("Failed to create Supabase client", err);
    return null;
  }
}
function createSupabaseClient(url, anonKey) {
  return getSupabaseClient(url, anonKey);
}
getSupabaseClient();
var marksRealtimeChannel = null;
var isInitializingMarksRealtimeChannel = false;
var marksRealtimeCallbacks = /* @__PURE__ */ new Set();
var lastAppliedRealtimeToken = null;
function syncRealtimeAuth(token) {
  lastAppliedRealtimeToken = token || "";
}
var pendingRealtimeMarkEvents = [];
var realtimeBatchTimeout = null;
var hasBeenDisconnected = false;
var isInitialSubscription = true;
var isRecoveryInProgress = false;
var currentConnectionStatus = typeof navigator !== "undefined" && typeof navigator.onLine === "boolean" && !navigator.onLine ? "offline" : "online";
var connectionStatusListeners = /* @__PURE__ */ new Set();
function getConnectionStatus() {
  if (typeof navigator !== "undefined" && typeof navigator.onLine === "boolean" && !navigator.onLine) {
    return "offline";
  }
  return currentConnectionStatus;
}
function setConnectionStatus(status) {
  if (currentConnectionStatus === status) return;
  currentConnectionStatus = status;
  connectionStatusListeners.forEach((listener) => {
    try {
      listener(status);
    } catch (err) {
      console.error("[ConnectionStatus] Listener error:", err);
    }
  });
}
function subscribeToConnectionStatus(listener) {
  connectionStatusListeners.add(listener);
  try {
    listener(getConnectionStatus());
  } catch (err) {
    console.error("[ConnectionStatus] Initial listener error:", err);
  }
  return () => {
    connectionStatusListeners.delete(listener);
  };
}
if (typeof window !== "undefined" && !window.__cbe_global_network_listeners_set) {
  window.__cbe_global_network_listeners_set = true;
  window.addEventListener("offline", () => {
    console.warn("[Network] Browser offline detected");
    hasBeenDisconnected = true;
    setConnectionStatus("offline");
  });
  window.addEventListener("online", async () => {
    console.log("[Network] Browser online restored. Initiating reconnection...");
    if (hasBeenDisconnected && !isInitialSubscription) {
      setConnectionStatus("reconnecting");
      try {
        setConnectionStatus("syncing");
        await reconcileMarksOnReconnect();
      } catch (err) {
        console.error("[Network] Reconnection sync error:", err);
      }
      hasBeenDisconnected = false;
    }
    setConnectionStatus("online");
  });
}
async function reconcileMarksOnReconnect() {
  if (isRecoveryInProgress) {
    console.log("[Realtime] Reconnection recovery already in progress. Skipping duplicate attempt.");
    return;
  }
  const client = getSupabaseClient();
  if (!client) {
    console.warn("[Realtime] Supabase client unavailable for reconnection recovery");
    hasBeenDisconnected = true;
    return;
  }
  isRecoveryInProgress = true;
  try {
    const currentMarks = getStorage(KEYS.MARKS, []);
    const exams = getStorage(KEYS.EXAMS, []);
    const cachedExamIds = Array.from(
      new Set(
        currentMarks.map((m) => m.exam_id).filter((id) => Boolean(id && isUUID(id)))
      )
    );
    const activeExamIds = exams.filter((e) => e.status !== "Approved" && isUUID(e.id)).map((e) => e.id);
    const targetExamIds = Array.from(/* @__PURE__ */ new Set([...cachedExamIds, ...activeExamIds]));
    if (targetExamIds.length === 0) {
      console.log("[Realtime] No active or cached exam scope for reconnection recovery.");
      return;
    }
    const { data: dbMarks, error } = await client.from("marks").select("*").in("exam_id", targetExamIds);
    if (error) {
      console.warn("[Realtime] Reconnection recovery marks query error:", error);
      hasBeenDisconnected = true;
      return;
    }
    if (!dbMarks) return;
    const fetchedMarks = api.mapDatabaseMarks(dbMarks);
    const fetchedMap = /* @__PURE__ */ new Map();
    fetchedMarks.forEach((m) => {
      if (m.student_id && m.subject_id && m.exam_id) {
        fetchedMap.set(`${m.student_id}_${m.subject_id}_${m.exam_id}`, m);
      }
    });
    let updatedMarks = [...currentMarks];
    let cacheChanged = false;
    const syntheticEvents = [];
    for (let i = 0; i < updatedMarks.length; i++) {
      const existing = updatedMarks[i];
      if (!targetExamIds.includes(existing.exam_id)) {
        continue;
      }
      const key = `${existing.student_id}_${existing.subject_id}_${existing.exam_id}`;
      const incoming = fetchedMap.get(key);
      if (incoming) {
        if (incoming.updated_at && existing.updated_at) {
          const incomingTime = new Date(incoming.updated_at).getTime();
          const existingTime = new Date(existing.updated_at).getTime();
          if (!isNaN(incomingTime) && !isNaN(existingTime) && incomingTime <= existingTime) {
            fetchedMap.delete(key);
            continue;
          }
        }
        const markChanged = incoming.marks !== existing.marks || incoming.raw_score !== existing.raw_score || incoming.special_status !== existing.special_status || incoming.irregularity_reason !== existing.irregularity_reason;
        if (markChanged) {
          updatedMarks[i] = { ...existing, ...incoming };
          cacheChanged = true;
          syntheticEvents.push({
            eventType: "UPDATE",
            newRecord: incoming,
            oldRecord: existing,
            rawPayload: null
          });
        }
        fetchedMap.delete(key);
      } else {
        updatedMarks.splice(i, 1);
        i--;
        cacheChanged = true;
        syntheticEvents.push({
          eventType: "DELETE",
          newRecord: null,
          oldRecord: existing,
          rawPayload: null
        });
      }
    }
    for (const [_, incoming] of fetchedMap) {
      updatedMarks.push(incoming);
      cacheChanged = true;
      syntheticEvents.push({
        eventType: "INSERT",
        newRecord: incoming,
        oldRecord: null,
        rawPayload: null
      });
    }
    if (cacheChanged) {
      setStorage(KEYS.MARKS, updatedMarks);
    }
    if (syntheticEvents.length > 0) {
      syntheticEvents.forEach((evt) => {
        marksRealtimeCallbacks.forEach((cb) => {
          try {
            cb(evt);
          } catch (err) {
            console.error("[Realtime] Error in callback during recovery sync:", err);
          }
        });
      });
    }
    console.log(`[Realtime] Reconnection recovery completed. Synced ${syntheticEvents.length} changes.`);
  } catch (err) {
    console.error("[Realtime] Exception during reconnection recovery:", err);
    hasBeenDisconnected = true;
  } finally {
    isRecoveryInProgress = false;
  }
}
function processRealtimeMarkBatch() {
  if (pendingRealtimeMarkEvents.length === 0) return;
  const eventsToProcess = [...pendingRealtimeMarkEvents];
  pendingRealtimeMarkEvents = [];
  realtimeBatchTimeout = null;
  const currentMarks = getStorage(KEYS.MARKS, []);
  let updatedMarks = [...currentMarks];
  let cacheChanged = false;
  for (const event of eventsToProcess) {
    const { eventType, newRecord, oldRecord } = event;
    if (eventType === "INSERT" || eventType === "UPDATE") {
      const rawData = newRecord;
      if (!rawData) continue;
      const mappedList = api.mapDatabaseMarks([rawData]);
      if (!mappedList || mappedList.length === 0) continue;
      const incomingMark = mappedList[0];
      if (!incomingMark.student_id || !incomingMark.subject_id || !incomingMark.exam_id) {
        continue;
      }
      const existingIndex = updatedMarks.findIndex(
        (m) => incomingMark.id && m.id === incomingMark.id || m.student_id === incomingMark.student_id && m.subject_id === incomingMark.subject_id && m.exam_id === incomingMark.exam_id
      );
      if (existingIndex >= 0) {
        const existingMark = updatedMarks[existingIndex];
        if (incomingMark.updated_at && existingMark.updated_at) {
          const incomingTime = new Date(incomingMark.updated_at).getTime();
          const existingTime = new Date(existingMark.updated_at).getTime();
          if (!isNaN(incomingTime) && !isNaN(existingTime) && incomingTime <= existingTime) {
            continue;
          }
        }
        updatedMarks[existingIndex] = {
          ...existingMark,
          ...incomingMark,
          id: incomingMark.id || existingMark.id,
          student_id: incomingMark.student_id || existingMark.student_id,
          subject_id: incomingMark.subject_id || existingMark.subject_id,
          exam_id: incomingMark.exam_id || existingMark.exam_id
        };
        cacheChanged = true;
      } else {
        updatedMarks.push(incomingMark);
        cacheChanged = true;
      }
    } else if (eventType === "DELETE") {
      const rawData = oldRecord || newRecord;
      if (!rawData) continue;
      const targetId = rawData.id;
      const targetStudentId = rawData.student_id;
      const targetSubjectId = rawData.subject_id;
      const targetExamId = rawData.exam_id;
      const prevLength = updatedMarks.length;
      updatedMarks = updatedMarks.filter((m) => {
        if (targetId && m.id === targetId) return false;
        if (targetStudentId && targetSubjectId && targetExamId && m.student_id === targetStudentId && m.subject_id === targetSubjectId && m.exam_id === targetExamId) {
          return false;
        }
        return true;
      });
      if (updatedMarks.length !== prevLength) {
        cacheChanged = true;
      }
    }
  }
  if (cacheChanged) {
    setStorage(KEYS.MARKS, updatedMarks);
  }
  eventsToProcess.forEach((evt) => {
    marksRealtimeCallbacks.forEach((cb) => {
      try {
        cb(evt);
      } catch (err) {
        console.error("[Realtime] Error in marks realtime callback handler:", err);
      }
    });
  });
}
function subscribeToMarksRealtime(callback) {
  if (callback) {
    marksRealtimeCallbacks.add(callback);
  }
  if (marksRealtimeChannel) {
    return callback || null;
  }
  if (isInitializingMarksRealtimeChannel) {
    return callback || null;
  }
  const client = getSupabaseClient();
  if (!client) {
    console.warn("[Realtime] Supabase client unavailable for marks subscription");
    return null;
  }
  isInitializingMarksRealtimeChannel = true;
  const initChannelWithAuth = async () => {
    try {
      const { data, error } = await client.auth.getSession();
      if (error) {
        console.warn("[Realtime] Error retrieving session for marks subscription:", error);
      }
      const token = data?.session?.access_token;
      if (!token) {
        console.warn("[Realtime] No active authenticated session found. Skipping Realtime channel creation.");
        return;
      }
      syncRealtimeAuth(token);
      if (marksRealtimeCallbacks.size === 0 || marksRealtimeChannel) {
        return;
      }
      marksRealtimeChannel = client.channel("realtime-cbe-marks").on(
        "postgres_changes",
        {
          event: "*",
          // Listen to INSERT, UPDATE, DELETE
          schema: "public",
          table: "marks"
        },
        (payload) => {
          const eventType = payload.eventType || payload.type || "UPDATE";
          const newRecord = payload.new && Object.keys(payload.new).length > 0 ? payload.new : null;
          const oldRecord = payload.old && Object.keys(payload.old).length > 0 ? payload.old : null;
          const event = {
            eventType,
            newRecord,
            oldRecord,
            rawPayload: payload
          };
          pendingRealtimeMarkEvents.push(event);
          if (!realtimeBatchTimeout) {
            realtimeBatchTimeout = setTimeout(processRealtimeMarkBatch, 150);
          }
        }
      ).subscribe(async (status, err) => {
        if (status === "SUBSCRIBED") {
          console.log("[Realtime] Successfully subscribed to public.marks change stream");
          if (hasBeenDisconnected && !isInitialSubscription) {
            console.log("[Realtime] Reconnection detected. Triggering scoped marks reconciliation...");
            setConnectionStatus("syncing");
            await reconcileMarksOnReconnect();
          }
          hasBeenDisconnected = false;
          isInitialSubscription = false;
          setConnectionStatus("online");
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          console.warn(`[Realtime] Marks subscription status changed: ${status}`, err || "");
          hasBeenDisconnected = true;
          if (typeof navigator !== "undefined" && !navigator.onLine) {
            setConnectionStatus("offline");
          } else {
            setConnectionStatus("realtime_unavailable");
          }
        }
      });
      if (typeof window !== "undefined" && !window.__cbe_realtime_network_listeners_set) {
        window.__cbe_realtime_network_listeners_set = true;
        window.addEventListener("offline", () => {
          console.warn("[Realtime] Network offline detected");
          hasBeenDisconnected = true;
        });
        window.addEventListener("online", () => {
          console.log("[Realtime] Network online restored. Checking for missed events...");
          if (hasBeenDisconnected && !isInitialSubscription) {
            reconcileMarksOnReconnect();
            hasBeenDisconnected = false;
          }
        });
      }
    } catch (err) {
      console.error("[Realtime] Failed to initialize marks realtime channel:", err);
      marksRealtimeChannel = null;
    } finally {
      isInitializingMarksRealtimeChannel = false;
    }
  };
  initChannelWithAuth();
  return callback || null;
}
function unsubscribeFromMarksRealtime(callback) {
  if (callback) {
    marksRealtimeCallbacks.delete(callback);
  } else {
    marksRealtimeCallbacks.clear();
  }
  if (marksRealtimeCallbacks.size === 0 && marksRealtimeChannel) {
    if (realtimeBatchTimeout) {
      clearTimeout(realtimeBatchTimeout);
      realtimeBatchTimeout = null;
    }
    pendingRealtimeMarkEvents = [];
    const client = getSupabaseClient();
    if (client) {
      try {
        client.removeChannel(marksRealtimeChannel);
      } catch (err) {
        console.warn("[Realtime] Error removing marks channel:", err);
      }
    }
    marksRealtimeChannel = null;
    console.log("[Realtime] Unsubscribed from public.marks realtime channel");
  }
}
function sanitizeSubject(sb) {
  if (!sb) return sb;
  const code = (sb.subject_code || "").trim().toUpperCase();
  const name = (sb.subject_name || "").trim();
  const id = sb.id || "";
  let rawArea = sb.education_level || sb.learning_area || "";
  let eduLevel = sb.education_level;
  if (!eduLevel) {
    if (rawArea === "Upper Primary" || rawArea === "Grade 4\u20136" || rawArea === "Grade 4-6") {
      eduLevel = "Upper Primary";
    } else if (rawArea === "Junior School" || rawArea === "Grade 7\u20139" || rawArea === "Grade 7-9") {
      eduLevel = "Junior School";
    } else if (rawArea === "Lower Primary" || rawArea === "Grade 1\u20133" || rawArea === "Grade 1-3") {
      eduLevel = "Lower Primary";
    } else if (rawArea === "Pre-Primary" || rawArea === "PP1\u2013PP2") {
      eduLevel = "Pre-Primary";
    } else if (rawArea === "Grade 4\u20139") {
      if (code === "AGR") eduLevel = "Upper Primary";
      else eduLevel = "Junior School";
    }
  }
  sb = { ...sb, education_level: eduLevel };
  let applicableGrades = sb.applicable_grades ? [...sb.applicable_grades] : [];
  if (code === "PP-LANG" || code === "LANG" || code === "LANG ACT" || name === "Language" || name === "Language Activities" || id === "sb_pp_lang") {
    eduLevel = "Pre-Primary";
    applicableGrades = ["PP1", "PP2"];
    return {
      ...sb,
      subject_name: "Language Activities",
      subject_code: "PP-LANG",
      category: "Activity",
      education_level: eduLevel,
      applicable_grades: applicableGrades
    };
  } else if (code === "PP-PCA" || code === "PSY-CRE" || code === "PSYCH ACT" || name.includes("Psychomotor") || id === "sb_pp_psy" || id === "c38b548b-270c-4bc1-a5db-946801a1c8ae") {
    eduLevel = "Pre-Primary";
    applicableGrades = ["PP1", "PP2"];
    return {
      ...sb,
      subject_name: "Psychomotor & Creative Activities",
      subject_code: "PP-PCA",
      category: "Activity",
      education_level: eduLevel,
      applicable_grades: applicableGrades
    };
  } else if (code === "PP-ENV" || code === "ENV ACT" || id === "sb_pp_env") {
    eduLevel = "Pre-Primary";
    applicableGrades = ["PP1", "PP2"];
    return {
      ...sb,
      subject_name: "Environmental Activities",
      subject_code: "PP-ENV",
      category: "Activity",
      education_level: eduLevel,
      applicable_grades: applicableGrades
    };
  } else if (code === "LP-LIT" || code === "LIT LP" || name === "Literacy Activities" || id === "sb_lp_lit") {
    eduLevel = "Lower Primary";
    applicableGrades = ["Grade 1", "Grade 2", "Grade 3"];
    return {
      ...sb,
      subject_name: "Literacy Activities",
      subject_code: "LP-LIT",
      category: "Activity",
      education_level: eduLevel,
      applicable_grades: applicableGrades
    };
  } else if (code === "LP-ENG" || code === "ENG LP" && id === "sb_lp_eng" || id === "sb_lp_eng") {
    eduLevel = "Lower Primary";
    applicableGrades = ["Grade 1", "Grade 2", "Grade 3"];
    return {
      ...sb,
      subject_name: "English Language Activities",
      subject_code: "LP-ENG",
      category: "Activity",
      education_level: eduLevel,
      applicable_grades: applicableGrades
    };
  } else if (code === "LP-KSL" || code === "KIS LP" && id === "sb_lp_kis" || id === "sb_lp_kis") {
    eduLevel = "Lower Primary";
    applicableGrades = ["Grade 1", "Grade 2", "Grade 3"];
    return {
      ...sb,
      subject_name: "Kiswahili Language Activities / Kenya Sign Language",
      subject_code: "LP-KSL",
      category: "Activity",
      education_level: eduLevel,
      applicable_grades: applicableGrades
    };
  } else if (code === "LP-MATH" || code === "MAT LP" && id === "sb_lp_mat" || id === "sb_lp_mat") {
    eduLevel = "Lower Primary";
    applicableGrades = ["Grade 1", "Grade 2", "Grade 3"];
    return {
      ...sb,
      subject_name: "Mathematical Activities",
      subject_code: "LP-MATH",
      category: "Activity",
      education_level: eduLevel,
      applicable_grades: applicableGrades
    };
  } else if (code === "LP-ENV" || code === "ENV LP" && id === "sb_lp_env" || id === "sb_lp_env") {
    eduLevel = "Lower Primary";
    applicableGrades = ["Grade 1", "Grade 2", "Grade 3"];
    return {
      ...sb,
      subject_name: "Environmental Activities",
      subject_code: "LP-ENV",
      category: "Activity",
      education_level: eduLevel,
      applicable_grades: applicableGrades
    };
  } else if (code === "LP-HN" || code === "HNG LP" || name.includes("Hygiene") || id === "sb_lp_hng") {
    eduLevel = "Lower Primary";
    applicableGrades = ["Grade 1", "Grade 2", "Grade 3"];
    return {
      ...sb,
      subject_name: "Hygiene & Nutrition Activities",
      subject_code: "LP-HN",
      category: "Activity",
      education_level: eduLevel,
      applicable_grades: applicableGrades
    };
  } else if (code === "LP-MCA" || code === "CREAT LP" || id === "sb_lp_crt") {
    eduLevel = "Lower Primary";
    applicableGrades = ["Grade 1", "Grade 2", "Grade 3"];
    return {
      ...sb,
      subject_name: "Movement & Creative Activities",
      subject_code: "LP-MCA",
      category: "Activity",
      education_level: eduLevel,
      applicable_grades: applicableGrades
    };
  } else if (id === "823eba35-ac51-4ac8-be57-fcbeee88151c" || code === "ENG" || id === "sb_eng" || id === "sb_up_eng" || code === "ENG UP") {
    return {
      ...sb,
      subject_name: "English",
      subject_code: "ENG",
      education_level: sb.education_level || sb.learning_area || "Junior School",
      applicable_grades: ["Grade 4", "Grade 5", "Grade 6", "Grade 7", "Grade 8", "Grade 9"]
    };
  } else if (id === "f00b5334-fa16-4640-b19c-733ec4530318" || code === "KIS" || code === "KISW" || id === "sb_kis" || id === "sb_up_kis" || code === "KIS UP") {
    return {
      ...sb,
      subject_name: "Kiswahili",
      subject_code: "KIS",
      education_level: sb.education_level || sb.learning_area || "Junior School",
      applicable_grades: ["Grade 4", "Grade 5", "Grade 6", "Grade 7", "Grade 8", "Grade 9"]
    };
  } else if (id === "4441b054-2d20-4d5c-852d-f31d16fbc145" || code === "MATH" || code === "MATHS" || code === "MAT" || id === "sb_mat" || id === "sb_up_mat" || code === "MAT UP") {
    return {
      ...sb,
      subject_name: "Mathematics",
      subject_code: "MATH",
      education_level: sb.education_level || sb.learning_area || "Junior School",
      applicable_grades: ["Grade 4", "Grade 5", "Grade 6", "Grade 7", "Grade 8", "Grade 9"]
    };
  } else if (id === "sb_up_sci" || code === "SCI UP" || code === "SCT" || code === "SCI-TECH" || name.includes("Science") && sb.education_level === "Upper Primary") {
    eduLevel = "Upper Primary";
    applicableGrades = ["Grade 4", "Grade 5", "Grade 6"];
    return {
      ...sb,
      subject_name: "Science & Technology",
      subject_code: "SCT",
      education_level: eduLevel,
      applicable_grades: applicableGrades
    };
  } else if (id === "dff8e7fc-bb0d-41c5-b451-e6b6f3361409" || code === "SST" || code === "SS" || id === "sb_sst" || id === "sb_up_sst" || code === "SST UP") {
    return {
      ...sb,
      subject_name: "Social Studies",
      subject_code: "SST",
      education_level: sb.education_level || sb.learning_area || "Junior School",
      applicable_grades: ["Grade 4", "Grade 5", "Grade 6", "Grade 7", "Grade 8", "Grade 9"]
    };
  } else if (id === "fe17661a-9c3b-439e-9cb9-fd2f88279f56" || code === "AGN" || code === "AGR" || id === "sb_agn" || id === "sb_up_agr" || code === "AGR UP") {
    return {
      ...sb,
      subject_name: "Agriculture",
      subject_code: "AGN",
      education_level: sb.education_level || sb.learning_area || "Junior School",
      applicable_grades: ["Grade 4", "Grade 5", "Grade 6", "Grade 7", "Grade 8", "Grade 9"]
    };
  } else if (id === "sb_up_crt" || code === "CREAT UP" || code === "CA" && (sb.education_level === "Upper Primary" || sb.applicable_grades && sb.applicable_grades.some((g) => ["Grade 4", "Grade 5", "Grade 6"].includes(g)))) {
    eduLevel = "Upper Primary";
    applicableGrades = ["Grade 4", "Grade 5", "Grade 6"];
    return {
      ...sb,
      subject_name: "Creative Arts",
      subject_code: "CA",
      education_level: eduLevel,
      applicable_grades: applicableGrades
    };
  } else if (code === "CREAT" || code === "CREAT LP" || name === "Creative" || name === "Creative Activities" || id === "sb_lp_crt") {
    eduLevel = "Lower Primary";
    applicableGrades = ["Grade 1", "Grade 2", "Grade 3"];
  } else if (code === "INT-SCI" || code === "SCI" && (sb.education_level === "Junior School" || name.includes("Integrated")) || id === "sb_sci") {
    eduLevel = "Junior School";
    applicableGrades = ["Grade 7", "Grade 8", "Grade 9"];
    return {
      ...sb,
      subject_name: "Integrated Science",
      subject_code: "INT-SCI",
      education_level: eduLevel,
      applicable_grades: applicableGrades
    };
  } else if (code === "PRE TECH" || code === "PRE-TECH" || code === "PTS" || name.includes("Pre-Technical") || id === "sb_pts") {
    eduLevel = "Junior School";
    applicableGrades = ["Grade 7", "Grade 8", "Grade 9"];
    return {
      ...sb,
      subject_name: "Pre-Technical Studies",
      subject_code: "PRE-TECH",
      education_level: eduLevel,
      applicable_grades: applicableGrades
    };
  } else if (code === "CREAT UP" || id === "sb_up_crt") {
    eduLevel = "Upper Primary";
    applicableGrades = ["Grade 4", "Grade 5", "Grade 6"];
  } else if (code === "CAS" || code === "CA" || name.includes("Creative Arts") || name.includes("Sports") || id === "sb_cas") {
    eduLevel = "Junior School";
    applicableGrades = ["Grade 7", "Grade 8", "Grade 9"];
    return {
      ...sb,
      subject_name: "Creative Arts and Sports",
      subject_code: "CAS",
      education_level: eduLevel,
      applicable_grades: applicableGrades
    };
  } else if (code === "SST UP" || id === "sb_up_sst") {
    eduLevel = "Upper Primary";
    applicableGrades = ["Grade 4", "Grade 5", "Grade 6"];
  } else if (code === "SST" || name === "Social Studies" || id === "sb_sst") {
    applicableGrades = ["Grade 7", "Grade 8", "Grade 9"];
    eduLevel = "Junior School";
    return {
      ...sb,
      subject_name: "Social Studies",
      subject_code: "SST",
      education_level: eduLevel,
      applicable_grades: applicableGrades
    };
  } else if (code === "PP-MATH" || code === "MATH ACT" || id === "sb_pp_math") {
    eduLevel = "Pre-Primary";
    applicableGrades = ["PP1", "PP2"];
    return {
      ...sb,
      subject_name: "Mathematical Activities",
      subject_code: "PP-MATH",
      education_level: eduLevel,
      applicable_grades: applicableGrades
    };
  } else if (code === "MAT LP" || id === "sb_lp_mat") {
    eduLevel = "Lower Primary";
    applicableGrades = ["Grade 1", "Grade 2", "Grade 3"];
  } else if (code === "ENG LP" || id === "sb_lp_eng") {
    eduLevel = "Lower Primary";
    applicableGrades = ["Grade 1", "Grade 2", "Grade 3"];
  } else if (code === "KIS LP" || id === "sb_lp_kis") {
    eduLevel = "Lower Primary";
    applicableGrades = ["Grade 1", "Grade 2", "Grade 3"];
  } else if (code === "AGR UP" || id === "sb_up_agr") {
    eduLevel = "Upper Primary";
    applicableGrades = ["Grade 4", "Grade 5", "Grade 6"];
  } else if (code === "AGR" || code === "AGN" || name.includes("Agriculture") || name.includes("Nutrition") || id === "sb_agn") {
    eduLevel = "Junior School";
    applicableGrades = ["Grade 7", "Grade 8", "Grade 9"];
    return {
      ...sb,
      subject_name: "Agriculture",
      subject_code: "AGN",
      education_level: eduLevel,
      applicable_grades: applicableGrades
    };
  } else if (code === "PP-CRE" || code === "PP-RE" || code === "CRE" || code === "RE" || code === "RE ACT" || code === "RE LP" || code === "RE UP" || code === "C.R.E" || name.includes("Religious") || name.toUpperCase() === "CRE" || id === "sb_cre" || id === "sb_pp_re" || id === "sb_lp_re" || id === "sb_up_re") {
    if (id === "sb_lp_re" || code === "LP-CRE" || code === "RE LP" || sb.education_level === "Lower Primary" && (code === "CRE" || name.includes("Religious"))) {
      eduLevel = "Lower Primary";
      applicableGrades = ["Grade 1", "Grade 2", "Grade 3"];
      return {
        ...sb,
        subject_name: "Christian Religious Education Activities",
        subject_code: "LP-CRE",
        category: "Activity",
        education_level: eduLevel,
        applicable_grades: applicableGrades
      };
    } else if (id === "sb_pp_re" || code === "PP-CRE" || code === "PP-RE" || code === "RE ACT" || sb.education_level === "Pre-Primary" && (code === "CRE" || name.includes("Religious"))) {
      eduLevel = "Pre-Primary";
      applicableGrades = ["PP1", "PP2"];
      return {
        ...sb,
        subject_name: "Christian Religious Education Activities",
        subject_code: "PP-CRE",
        category: "Activity",
        education_level: eduLevel,
        applicable_grades: applicableGrades
      };
    } else if (id === "sb_up_re" || code === "RE UP" || sb.education_level === "Upper Primary" && (code === "CRE" || name.includes("Religious"))) {
      eduLevel = "Upper Primary";
      applicableGrades = ["Grade 4", "Grade 5", "Grade 6"];
    } else {
      eduLevel = sb.education_level || "Junior School";
      applicableGrades = sb.applicable_grades && sb.applicable_grades.length > 0 ? sb.applicable_grades : LEVEL_TO_GRADES[eduLevel] || ["Grade 7", "Grade 8", "Grade 9"];
    }
    return {
      ...sb,
      subject_name: "Christian Religious Education",
      subject_code: "CRE",
      education_level: eduLevel,
      applicable_grades: applicableGrades
    };
  }
  if (!eduLevel) {
    if (applicableGrades.length > 0) {
      eduLevel = getEducationLevelForGrade(applicableGrades[0]);
    } else {
      eduLevel = "Junior School";
    }
  }
  if (!applicableGrades || applicableGrades.length === 0) {
    applicableGrades = LEVEL_TO_GRADES[eduLevel] || [];
  }
  return {
    ...sb,
    subject_code: code,
    subject_name: name,
    education_level: eduLevel,
    applicable_grades: applicableGrades
  };
}
function sanitizeClass(c) {
  if (!c) {
    return {
      id: `cls_${Date.now()}`,
      class_name: "Grade 7",
      stream: "Blue",
      capacity: 40,
      education_level: "Junior School",
      status: "Active",
      allocated_subject_ids: []
    };
  }
  let classNameStr = (c.class_name || c.grade || "Grade 7").trim();
  let rawStream = (c.stream !== void 0 && c.stream !== null ? String(c.stream) : c.stream_name || c.name || "").trim();
  if ((!rawStream || rawStream.toLowerCase() === classNameStr.toLowerCase() || /^cls_/i.test(rawStream)) && classNameStr) {
    const match = classNameStr.match(/cls_\d+([a-zA-Z]+)|^(PP1|PP2|Grade\s*\d+)\s*[\-\|•\(\s]\s*([A-Za-z0-9\s]+)\)?$/i);
    if (match) {
      if (match[1]) {
        const s = match[1].toUpperCase();
        rawStream = s === "E" ? "East" : s === "W" ? "West" : s === "A" ? "A" : s === "B" ? "Blue" : s;
      } else if (match[2]) {
        classNameStr = match[2] ? classNameStr : match[1].replace(/\s+/g, " ").trim();
        rawStream = match[2].trim();
      }
    }
  }
  const className = normalizeGradeName(classNameStr);
  const eduLevel = c.education_level || getEducationLevelForGrade(className);
  return {
    id: String(c.id || `cls_${Date.now()}`),
    stream_id: c.stream_id ? String(c.stream_id) : void 0,
    class_name: className,
    stream: rawStream,
    capacity: typeof c.capacity === "number" && c.capacity > 0 ? c.capacity : c.capacity ? Number(c.capacity) : 40,
    class_teacher_id: c.class_teacher_id || void 0,
    education_level: eduLevel,
    status: c.status === "Inactive" ? "Inactive" : "Active",
    allocated_subject_ids: Array.isArray(c.allocated_subject_ids) ? c.allocated_subject_ids : []
  };
}
async function syncClassToSupabase(cls, isDelete = false) {
  const client = createSupabaseClient();
  if (!client) return;
  if (isDelete) {
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cls.id)) {
      if (cls.stream_id) {
        const { error: sErr } = await client.from("streams").delete().eq("id", cls.stream_id);
        if (sErr) {
          console.error("Failed to delete stream from Supabase:", sErr);
          throw sErr;
        }
      } else {
        const { error: sErr } = await client.from("streams").delete().eq("class_id", cls.id);
        if (sErr) {
          console.error("Failed to delete streams from Supabase:", sErr);
          throw sErr;
        }
      }
      const { error: cErr } = await client.from("classes").delete().eq("id", cls.id);
      if (cErr) {
        console.error("Failed to delete class from Supabase:", cErr);
        throw cErr;
      }
    }
  } else {
    const { data: existingClasses } = await client.from("classes").select("*").ilike("class_name", cls.class_name);
    let classObj = existingClasses?.[0];
    if (!classObj) {
      const gradeLevelNum = getGradeOrderIndex(cls.class_name);
      const classPayload = {
        class_name: cls.class_name,
        grade_level: gradeLevelNum >= 0 && gradeLevelNum <= 12 ? gradeLevelNum : 0,
        capacity: cls.capacity || 40
      };
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cls.id)) {
        classPayload.id = cls.id;
      }
      const { data: createdClass, error: cInsErr } = await client.from("classes").insert([classPayload]).select("*");
      if (cInsErr) throw cInsErr;
      classObj = createdClass?.[0];
    }
    if (classObj) {
      const streamName = cls.stream || "A";
      const { data: existingStreams } = await client.from("streams").select("*").eq("class_id", classObj.id).ilike("stream_name", streamName);
      if (!existingStreams || existingStreams.length === 0) {
        const streamPayload = {
          class_id: classObj.id,
          stream_name: streamName,
          capacity: cls.capacity || 40,
          class_teacher_id: cls.class_teacher_id || null
        };
        if (cls.stream_id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cls.stream_id)) {
          streamPayload.id = cls.stream_id;
        }
        const { error: sInsErr } = await client.from("streams").insert([streamPayload]);
        if (sInsErr) throw sInsErr;
      } else {
        const { error: sUpdErr } = await client.from("streams").update({ class_teacher_id: cls.class_teacher_id || null }).eq("id", existingStreams[0].id);
        if (sUpdErr) throw sUpdErr;
      }
    }
  }
}
async function resolveStudentClassAndStreamUuids(classOrStreamId, client) {
  if (!client) {
    return { class_id: null, stream_id: null };
  }
  const rawId = (classOrStreamId || "").trim();
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (rawId && uuidRegex.test(rawId)) {
    const { data: streamMatch } = await client.from("streams").select("id, class_id").eq("id", rawId).maybeSingle();
    if (streamMatch) {
      return { class_id: streamMatch.class_id, stream_id: streamMatch.id };
    }
    const { data: classMatch } = await client.from("classes").select("id").eq("id", rawId).maybeSingle();
    if (classMatch) {
      const { data: defaultStream } = await client.from("streams").select("id").eq("class_id", classMatch.id).limit(1);
      return { class_id: classMatch.id, stream_id: defaultStream?.[0]?.id || null };
    }
  }
  const localClasses = getStorage(KEYS.CLASSES, []);
  const matchedLocalClass = localClasses.find(
    (c) => c.id === rawId || `${c.class_name} ${c.stream}`.trim().toLowerCase() === rawId.toLowerCase() || c.class_name.toLowerCase() === rawId.toLowerCase()
  );
  let className = matchedLocalClass ? matchedLocalClass.class_name : normalizeGradeName(rawId);
  let streamName = matchedLocalClass ? matchedLocalClass.stream || "A" : "A";
  if (!matchedLocalClass && rawId) {
    const match = rawId.match(/cls_\d+([a-zA-Z]+)|^(PP1|PP2|Grade\s*\d+)\s*[\-\|•\(\s]\s*([A-Za-z0-9\s]+)\)?$/i);
    if (match) {
      if (match[1]) {
        const s = match[1].toUpperCase();
        streamName = s === "E" ? "East" : s === "W" ? "West" : s === "A" ? "A" : s === "B" ? "Blue" : s;
      } else if (match[2]) {
        className = match[2] ? className : match[1].replace(/\s+/g, " ").trim();
        streamName = match[2].trim();
      }
    }
  }
  className = normalizeGradeName(className);
  let { data: dbClasses } = await client.from("classes").select("id").ilike("class_name", className);
  let classId = dbClasses?.[0]?.id;
  if (!classId) {
    const gradeLevelNum = getGradeOrderIndex(className);
    const { data: newClass } = await client.from("classes").insert([{
      class_name: className,
      grade_level: gradeLevelNum >= 0 && gradeLevelNum <= 12 ? gradeLevelNum : 7,
      capacity: matchedLocalClass?.capacity || 40
    }]).select("id");
    classId = newClass?.[0]?.id;
  }
  if (classId) {
    let { data: dbStreams } = await client.from("streams").select("id, class_id").eq("class_id", classId).ilike("stream_name", streamName);
    let streamId = dbStreams?.[0]?.id;
    if (!streamId) {
      let { data: anyStreams } = await client.from("streams").select("id, class_id").eq("class_id", classId).limit(1);
      if (anyStreams && anyStreams[0]) {
        streamId = anyStreams[0].id;
      } else {
        const { data: newStream } = await client.from("streams").insert([{
          class_id: classId,
          stream_name: streamName,
          capacity: matchedLocalClass?.capacity || 40
        }]).select("id");
        streamId = newStream?.[0]?.id;
      }
    }
    return { class_id: classId, stream_id: streamId || null };
  }
  const { data: anyClass } = await client.from("classes").select("id").limit(1);
  if (anyClass && anyClass[0]) {
    const { data: anyStream } = await client.from("streams").select("id").eq("class_id", anyClass[0].id).limit(1);
    return { class_id: anyClass[0].id, stream_id: anyStream?.[0]?.id || null };
  }
  return { class_id: null, stream_id: null };
}
var KEYS = {
  SCHOOL: "cbe_school",
  GRADES: "cbe_grades",
  SUBJECTS: "cbe_subjects",
  CLASSES: "cbe_classes",
  TEACHERS: "cbe_teachers",
  USERS: "cbe_users",
  STUDENTS: "cbe_students",
  ALLOCATED_STUDENTS: "cbe_allocated_students",
  EXAMS: "cbe_exams",
  MARKS: "cbe_marks",
  VERIFICATIONS: "cbe_verifications",
  CURRENT_USER: "cbe_current_user",
  ACADEMIC_YEARS: "cbe_academic_years",
  SCHOOL_TERMS: "cbe_school_terms",
  LOGIN_LOGS: "cbe_login_logs",
  DELETED_TEACHERS: "cbe_deleted_teachers"
};
var memoryStorage = {};
function getStorage(key, defaultValue) {
  try {
    const item = memoryStorage[key];
    return item !== void 0 && item !== null ? JSON.parse(item) : defaultValue;
  } catch (err) {
    console.error(`Error reading ${key} from memory storage`, err);
    return defaultValue;
  }
}
function setStorage(key, value) {
  try {
    if (value === null || value === void 0) {
      delete memoryStorage[key];
      return;
    }
    memoryStorage[key] = JSON.stringify(value);
  } catch (err) {
    console.error(`Error writing ${key} to memory storage`, err);
  }
}
function getDeletedTeacherIdentifiers() {
  const list = getStorage(KEYS.DELETED_TEACHERS, []);
  const ids = /* @__PURE__ */ new Set();
  const emails = /* @__PURE__ */ new Set();
  for (const item of list) {
    if (item && typeof item === "string") {
      const trimmed = item.trim();
      if (!trimmed) continue;
      if (trimmed.includes("@")) {
        emails.add(trimmed.toLowerCase());
      } else {
        ids.add(trimmed);
        ids.add(trimmed.toLowerCase());
      }
    }
  }
  return { ids, emails };
}
function recordDeletedTeacherIdentifier(...identifiers) {
  const current = getStorage(KEYS.DELETED_TEACHERS, []);
  const set = new Set(current);
  for (const id of identifiers) {
    if (id && typeof id === "string" && id.trim()) {
      const trimmed = id.trim();
      set.add(trimmed);
      if (trimmed.includes("@")) {
        set.add(trimmed.toLowerCase());
      }
    }
  }
  setStorage(KEYS.DELETED_TEACHERS, Array.from(set));
}
function removeDeletedTeacherIdentifier(...identifiers) {
  const current = getStorage(KEYS.DELETED_TEACHERS, []);
  const toRemove = new Set(
    identifiers.filter((i) => Boolean(i && typeof i === "string")).map((i) => i.trim().toLowerCase())
  );
  if (toRemove.size === 0) return;
  const updated = current.filter((item) => !toRemove.has(item.trim().toLowerCase()));
  setStorage(KEYS.DELETED_TEACHERS, updated);
}
function sanitizeUser(u) {
  if (!u) return u;
  if (u.name && (u.name.toLowerCase().includes("omwenga") || u.name.includes("Dr. Joseph"))) {
    return {
      ...u,
      name: u.role === "admin" ? "Administrator" : u.name.replace(/Dr\.\s*Joseph\s*Omwenga/gi, "Administrator")
    };
  }
  return u;
}
var TARGET_TEST_TEACHER_EMAILS = [
  "test_teacher_1785574605292@example.com",
  "test_teacher_e2e_1785574890386@example.com"
];
function isBlacklistedTestEmail(email) {
  if (!email) return false;
  const lower = email.trim().toLowerCase();
  return TARGET_TEST_TEACHER_EMAILS.includes(lower) || lower.includes("test_teacher_1785574605292") || lower.includes("test_teacher_e2e_1785574890386");
}
function getCleanUsername(username) {
  if (!username) return "";
  return username.replace(/^@+/, "").trim().toLowerCase();
}
function areTeachersSamePerson(t1, t2) {
  if (!t1 || !t2) return false;
  if (t1.id && t2.id && t1.id === t2.id) return true;
  const email1 = t1.email ? t1.email.trim().toLowerCase() : "";
  const email2 = t2.email ? t2.email.trim().toLowerCase() : "";
  if (email1 && email2 && email1 === email2) return true;
  const uname1 = getCleanUsername(t1.username);
  const uname2 = getCleanUsername(t2.username);
  if (uname1 && uname2 && uname1 === uname2) return true;
  const tsc1 = t1.tsc_number && t1.tsc_number !== "TSC-PENDING" ? t1.tsc_number.trim().toLowerCase() : "";
  const tsc2 = t2.tsc_number && t2.tsc_number !== "TSC-PENDING" ? t2.tsc_number.trim().toLowerCase() : "";
  if (tsc1 && tsc2 && tsc1 === tsc2) return true;
  const name1 = t1.teacher_name ? t1.teacher_name.trim().toLowerCase() : "";
  const name2 = t2.teacher_name ? t2.teacher_name.trim().toLowerCase() : "";
  if (name1 && name2 && name1 === name2) {
    const phone1 = t1.phone ? t1.phone.trim() : "";
    const phone2 = t2.phone ? t2.phone.trim() : "";
    if (phone1 && phone2 && phone1 === phone2) return true;
    if (!email1 || !email2) return true;
  }
  return false;
}
function mergeTeacherObjects(t1, t2) {
  const keptId = isUUID(t1.id) ? t1.id : isUUID(t2.id) ? t2.id : t1.id;
  const mergedAllocations = [...t1.allocations || []];
  if (t2.allocations) {
    for (const alloc of t2.allocations) {
      if (!mergedAllocations.some((a) => a.class_id === alloc.class_id && a.subject_id === alloc.subject_id && (a.stream || "") === (alloc.stream || ""))) {
        mergedAllocations.push(alloc);
      }
    }
  }
  return {
    ...t2,
    ...t1,
    id: keptId,
    teacher_name: t1.teacher_name || t2.teacher_name,
    email: t1.email ? t1.email.trim().toLowerCase() : t2.email ? t2.email.trim().toLowerCase() : "",
    phone: t1.phone || t2.phone || "",
    username: t1.username || t2.username || "",
    tsc_number: t1.tsc_number && t1.tsc_number !== "TSC-PENDING" ? t1.tsc_number : t2.tsc_number || "TSC-PENDING",
    user_id: isUUID(t1.user_id) ? t1.user_id : isUUID(t2.user_id) ? t2.user_id : t1.user_id || t2.user_id,
    is_class_teacher: t1.is_class_teacher || t2.is_class_teacher,
    class_teacher_of_id: t1.class_teacher_of_id || t2.class_teacher_of_id,
    status: t1.status === "Active" || t2.status === "Active" ? "Active" : t1.status || t2.status || "Active",
    last_login: t1.last_login || t2.last_login || null,
    allocations: mergedAllocations
  };
}
function initDatabase() {
  if (getStorage(KEYS.SCHOOL, null) === null) setStorage(KEYS.SCHOOL, initialSchool);
  if (getStorage(KEYS.GRADES, null) === null) setStorage(KEYS.GRADES, initialGrades);
  if (getStorage(KEYS.SUBJECTS, null) === null) {
    setStorage(KEYS.SUBJECTS, initialSubjects.map(sanitizeSubject));
  } else {
    const storedSubjects = getStorage(KEYS.SUBJECTS, []);
    setStorage(KEYS.SUBJECTS, storedSubjects.map(sanitizeSubject));
  }
  if (getStorage(KEYS.CLASSES, null) === null) setStorage(KEYS.CLASSES, []);
  if (getStorage(KEYS.TEACHERS, null) === null) setStorage(KEYS.TEACHERS, []);
  if (getStorage(KEYS.USERS, null) === null) setStorage(KEYS.USERS, adminUsersOnly);
  if (getStorage(KEYS.STUDENTS, null) === null) setStorage(KEYS.STUDENTS, []);
  if (getStorage(KEYS.EXAMS, null) === null) setStorage(KEYS.EXAMS, []);
  if (getStorage(KEYS.MARKS, null) === null) setStorage(KEYS.MARKS, []);
  if (getStorage(KEYS.VERIFICATIONS, null) === null) setStorage(KEYS.VERIFICATIONS, []);
  if (getStorage(KEYS.ACADEMIC_YEARS, null) === null) setStorage(KEYS.ACADEMIC_YEARS, initialAcademicYears);
  if (getStorage(KEYS.SCHOOL_TERMS, null) === null) setStorage(KEYS.SCHOOL_TERMS, initialTerms);
  if (getStorage(KEYS.LOGIN_LOGS, null) === null) setStorage(KEYS.LOGIN_LOGS, []);
}
initDatabase();
function isUUID(str) {
  if (!str || typeof str !== "string") return false;
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(str.trim());
}
function generateUUID() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === "x" ? r : r & 3 | 8;
    return v.toString(16);
  });
}
async function resolveSubjectUUID(client, alloc) {
  if (isUUID(alloc.subject_id)) {
    const { data: sb } = await client.from("subjects").select("id").eq("id", alloc.subject_id).maybeSingle();
    if (sb) return sb.id;
  }
  let code = alloc.subject_code;
  let name = alloc.subject_name;
  const localSubjects = getStorage(KEYS.SUBJECTS, []);
  const matchedLocal = localSubjects.find((s) => s.id === alloc.subject_id || s.subject_code === alloc.subject_id || s.subject_name === alloc.subject_id);
  if (matchedLocal) {
    if (isUUID(matchedLocal.id)) {
      const { data: sb } = await client.from("subjects").select("id").eq("id", matchedLocal.id).maybeSingle();
      if (sb) return sb.id;
    }
    code = code || matchedLocal.subject_code;
    name = name || matchedLocal.subject_name;
  }
  if (alloc.subject_id && typeof alloc.subject_id === "string" && !code && !name) {
    const cleanId = alloc.subject_id.replace(/^sb_/, "").replace(/_/g, " ");
    name = cleanId;
  }
  if (code || name) {
    let query = client.from("subjects").select("id, subject_code, subject_name");
    if (code && name) {
      query = query.or(`subject_code.eq.${code},subject_name.ilike.${name}`);
    } else if (code) {
      query = query.eq("subject_code", code);
    } else if (name) {
      query = query.ilike("subject_name", name);
    }
    const { data: matches } = await query;
    if (matches && matches.length > 0) {
      return matches[0].id;
    }
  }
  const { data: allSubjects } = await client.from("subjects").select("id, subject_code, subject_name");
  if (allSubjects && allSubjects.length > 0) {
    const targetStr = (alloc.subject_id || name || code || "").toLowerCase();
    const found = allSubjects.find(
      (s) => s.id === alloc.subject_id || s.subject_code && s.subject_code.toLowerCase() === targetStr || s.subject_name && s.subject_name.toLowerCase() === targetStr || name && s.subject_name && s.subject_name.toLowerCase().includes(name.toLowerCase()) || code && s.subject_code && s.subject_code.toLowerCase().includes(code.toLowerCase())
    );
    if (found) return found.id;
  }
  throw new Error(`Unable to resolve database subject UUID for learning area "${alloc.subject_name || alloc.subject_code || alloc.subject_id}".`);
}
function formatTeacherSaveError(err, fallbackMessage = "Teacher details could not be saved. Please try again.") {
  if (!err) return fallbackMessage;
  const rawMsg = typeof err === "string" ? err : err.message || String(err);
  const code = err.code || "";
  if (code === "42501" || rawMsg.includes("violates row-level security policy") || rawMsg.includes("Access denied") || rawMsg.includes("Only administrators") || rawMsg.includes("permission denied")) {
    return "Learning area allocations could not be saved. Please ensure you are signed in as an administrator and try again.";
  }
  if (code === "23505" || rawMsg.includes("duplicate key") || rawMsg.includes("unique constraint")) {
    if (rawMsg.includes("email")) return "A teacher or user with this email address already exists.";
    if (rawMsg.includes("tsc_number")) return "A teacher with this TSC Number already exists.";
    if (rawMsg.includes("subject_code")) return "A learning area with this code already exists.";
    return "A record with these unique details already exists.";
  }
  if (code === "23503" || rawMsg.includes("foreign key constraint")) {
    return "The specified learning area, class, or stream could not be found.";
  }
  if (code === "PGRST116") {
    return "The requested record was not found.";
  }
  if (rawMsg.includes("Unable to resolve database subject UUID")) {
    return rawMsg;
  }
  if (rawMsg.length > 0 && !rawMsg.includes("violates") && !rawMsg.includes('relation "') && !rawMsg.includes("syntax error") && !rawMsg.includes('column "')) {
    return rawMsg;
  }
  return fallbackMessage;
}
async function resolveClassAndStreamUUIDs(client, alloc) {
  const isUUID4 = (str) => typeof str === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
  let resolvedClassId = null;
  let resolvedStreamId = null;
  const rawClassId = alloc.class_id || alloc.stream_id;
  const rawStreamId = alloc.stream_id;
  if (isUUID4(rawStreamId)) {
    const { data: strmData } = await client.from("streams").select("id, class_id").eq("id", rawStreamId).maybeSingle();
    if (strmData) {
      resolvedStreamId = strmData.id;
      resolvedClassId = strmData.class_id;
    }
  }
  if (!resolvedClassId && isUUID4(rawClassId)) {
    const { data: clsData } = await client.from("classes").select("id").eq("id", rawClassId).maybeSingle();
    if (clsData) {
      resolvedClassId = clsData.id;
      if (!resolvedStreamId && alloc.stream) {
        const { data: strmData } = await client.from("streams").select("id").eq("class_id", resolvedClassId).ilike("stream_name", alloc.stream).maybeSingle();
        if (strmData) {
          resolvedStreamId = strmData.id;
        }
      }
    } else {
      const { data: strmData } = await client.from("streams").select("id, class_id").eq("id", rawClassId).maybeSingle();
      if (strmData) {
        resolvedStreamId = strmData.id;
        resolvedClassId = strmData.class_id;
      }
    }
  }
  if (!resolvedClassId) {
    const localClasses = getStorage(KEYS.CLASSES, []);
    const matchedClassObj = localClasses.find((c) => c.id === rawClassId || c.id === rawStreamId || c.class_name === alloc.class_name && c.stream === alloc.stream);
    if (matchedClassObj) {
      if (isUUID4(matchedClassObj.id)) {
        const { data: strm } = await client.from("streams").select("id, class_id").eq("id", matchedClassObj.id).maybeSingle();
        if (strm) {
          resolvedStreamId = strm.id;
          resolvedClassId = strm.class_id;
        } else {
          const { data: cls } = await client.from("classes").select("id").eq("id", matchedClassObj.id).maybeSingle();
          if (cls) resolvedClassId = cls.id;
        }
      }
      if (!resolvedClassId && matchedClassObj.class_name) {
        const { data: clsData } = await client.from("classes").select("id").ilike("class_name", matchedClassObj.class_name).maybeSingle();
        if (clsData) {
          resolvedClassId = clsData.id;
          if (matchedClassObj.stream) {
            const { data: strmData } = await client.from("streams").select("id").eq("class_id", resolvedClassId).ilike("stream_name", matchedClassObj.stream).maybeSingle();
            if (strmData) resolvedStreamId = strmData.id;
          }
        }
      }
    }
  }
  if (!resolvedClassId && alloc.class_name) {
    const { data: clsData } = await client.from("classes").select("id").ilike("class_name", alloc.class_name).maybeSingle();
    if (clsData) {
      resolvedClassId = clsData.id;
      if (alloc.stream) {
        const { data: strmData } = await client.from("streams").select("id").eq("class_id", resolvedClassId).ilike("stream_name", alloc.stream).maybeSingle();
        if (strmData) resolvedStreamId = strmData.id;
      }
    }
  }
  return { class_id: resolvedClassId, stream_id: resolvedStreamId };
}
function isDuplicateSubjectCodeError(error) {
  if (!error) return false;
  const codeStr = String(error.code || "");
  const msgStr = String(error.message || error.msg || "");
  const detailsStr = String(error.details || "");
  const hintStr = String(error.hint || "");
  const fullText = `${codeStr} ${msgStr} ${detailsStr} ${hintStr} ${String(error)}`.toLowerCase();
  const matchesCodeOrDuplicate = codeStr === "23505" || fullText.includes("23505") || fullText.includes("duplicate key") || fullText.includes("unique constraint");
  const matchesSubjectCodeKey = fullText.includes("subjects_subject_code_key") || fullText.includes("subject_code");
  return matchesCodeOrDuplicate && matchesSubjectCodeKey;
}
var CANONICAL_SUBJECT_UUIDS = {
  ENG: "823eba35-ac51-4ac8-be57-fcbeee88151c",
  KIS: "f00b5334-fa16-4640-b19c-733ec4530318",
  MATH: "4441b054-2d20-4d5c-852d-f31d16fbc145",
  SST: "dff8e7fc-bb0d-41c5-b451-e6b6f3361409",
  AGN: "fe17661a-9c3b-439e-9cb9-fd2f88279f56",
  CRE: "e784b5fc-dab9-4105-bb49-fce1d1a84cf7"
};
function deduplicateSubjectList(subjects) {
  const result = [];
  for (const rawSb of subjects) {
    const sb = sanitizeSubject(rawSb);
    if (!sb) continue;
    const existingIndex = result.findIndex((existing) => {
      if (existing.id === sb.id) return true;
      if (existing.subject_code && sb.subject_code && existing.subject_code === sb.subject_code) {
        if (existing.education_level === sb.education_level) return true;
        const existingGrades = existing.applicable_grades || [];
        const sbGrades = sb.applicable_grades || [];
        if (existingGrades.some((g) => sbGrades.includes(g))) return true;
        if (["Grade 4\u20139", "PP1\u2013Grade 9", "Junior School", "Upper Primary"].includes(existing.education_level || "") && ["Grade 4\u20139", "PP1\u2013Grade 9", "Junior School", "Upper Primary"].includes(sb.education_level || "")) {
          return true;
        }
      }
      return false;
    });
    if (existingIndex === -1) {
      result.push({ ...sb });
    } else {
      const existing = result[existingIndex];
      const mergedGrades = Array.from(/* @__PURE__ */ new Set([...existing.applicable_grades || [], ...sb.applicable_grades || []]));
      const canonicalUuid = CANONICAL_SUBJECT_UUIDS[sb.subject_code];
      let keepNew = false;
      if (canonicalUuid) {
        if (sb.id === canonicalUuid && existing.id !== canonicalUuid) {
          keepNew = true;
        }
      } else {
        const existingIsUuid = isUUID(existing.id);
        const sbIsUuid = isUUID(sb.id);
        if (!existingIsUuid && sbIsUuid) {
          keepNew = true;
        }
      }
      if (keepNew) {
        result[existingIndex] = {
          ...sb,
          applicable_grades: mergedGrades
        };
      } else {
        result[existingIndex] = {
          ...existing,
          applicable_grades: mergedGrades
        };
      }
    }
  }
  return result;
}
var api = {
  // --- SCHOOL ---
  getSchool: () => getStorage(KEYS.SCHOOL, initialSchool),
  updateSchool: async (school) => {
    setStorage(KEYS.SCHOOL, school);
    const client = createSupabaseClient();
    if (client) {
      try {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const isValidUUID = uuidRegex.test(school.id);
        const postalVal = school.postal_code || school.address || "";
        const payload = {
          school_name: school.school_name || "",
          motto: school.motto || "",
          county: school.county || "",
          address: postalVal,
          email: school.email || "",
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        };
        const { data: existing } = await client.from("school_profile").select("id").limit(1);
        if (existing && existing.length > 0) {
          const targetId = existing[0].id;
          const { data, error } = await client.from("school_profile").update(payload).eq("id", targetId).select("*");
          if (error) {
            console.warn("Could not update school profile in Supabase:", error.message);
          } else if (data && data.length > 0) {
            const updatedSchool = { ...school, id: data[0].id };
            setStorage(KEYS.SCHOOL, updatedSchool);
            return updatedSchool;
          }
        } else {
          if (isValidUUID) {
            payload.id = school.id;
          }
          const { data, error } = await client.from("school_profile").insert([payload]).select("*");
          if (error) {
            console.warn("Could not insert school profile into Supabase:", error.message);
          } else if (data && data.length > 0) {
            const insertedSchool = { ...school, id: data[0].id };
            setStorage(KEYS.SCHOOL, insertedSchool);
            return insertedSchool;
          }
        }
      } catch (err) {
        console.warn("Unexpected error updating school profile in Supabase:", err?.message || err);
      }
    }
    return school;
  },
  // --- USERS & AUTH ---
  getCurrentUser: () => {
    const raw = getStorage(KEYS.CURRENT_USER, null);
    if (!raw) return null;
    const clean = sanitizeUser(raw);
    if (clean.name !== raw.name) {
      setStorage(KEYS.CURRENT_USER, clean);
    }
    return clean;
  },
  setCurrentUser: (user) => {
    const clean = user ? sanitizeUser(user) : null;
    if (clean) {
      setStorage(KEYS.CURRENT_USER, clean);
    } else {
      setStorage(KEYS.CURRENT_USER, null);
    }
    return clean;
  },
  getUsers: () => {
    const users = getStorage(KEYS.USERS, adminUsersOnly);
    let changed = false;
    const filtered = users.filter((u) => u && !isBlacklistedTestEmail(u.email));
    if (filtered.length !== users.length) changed = true;
    const cleanUsers = filtered.map((u) => {
      const clean = sanitizeUser(u);
      if (clean.name !== u.name) changed = true;
      return clean;
    });
    if (changed) {
      setStorage(KEYS.USERS, cleanUsers);
    }
    return cleanUsers;
  },
  syncUsersFromDatabase: (userData) => {
    if (!userData || !Array.isArray(userData) || userData.length === 0) return;
    const existing = getStorage(KEYS.USERS, adminUsersOnly);
    const { ids: delIds, emails: delEmails } = getDeletedTeacherIdentifiers();
    const mappedDBUsers = userData.filter((u) => {
      if (!u) return false;
      if (isBlacklistedTestEmail(u?.email)) return false;
      if (u.teacher_id && (delIds.has(u.teacher_id) || delIds.has(u.teacher_id.toLowerCase()))) return false;
      if (u.id && (delIds.has(u.id) || delIds.has(u.id.toLowerCase()))) return false;
      if (u.email && delEmails.has(u.email.trim().toLowerCase())) return false;
      return true;
    }).map((u) => {
      const rawRole = (u.role || "").toLowerCase();
      let normalizedRole = "class_teacher";
      if (rawRole === "admin") {
        normalizedRole = "admin";
      } else if (rawRole === "learner" || rawRole === "student") {
        normalizedRole = "learner";
      } else if (rawRole === "subject_teacher") {
        normalizedRole = "subject_teacher";
      } else if (rawRole === "class_teacher") {
        normalizedRole = "class_teacher";
      } else if (rawRole === "teacher") {
        const teachersList = getStorage(KEYS.TEACHERS, []);
        const email = (u.email || "").toLowerCase();
        const matchedT = teachersList.find((t) => t.email.toLowerCase() === email || t.id === u.teacher_id);
        normalizedRole = matchedT?.is_class_teacher || Boolean(matchedT?.class_teacher_of_id) ? "class_teacher" : "subject_teacher";
      } else {
        normalizedRole = u.role;
      }
      const existingUser = existing.find((ex) => ex.id === u.id || u.email && ex.email.toLowerCase() === (u.email || "").toLowerCase());
      return {
        id: u.id,
        name: u.name || u.email?.split("@")[0] || "User",
        email: (u.email || "").toLowerCase(),
        role: normalizedRole,
        teacher_id: normalizedRole === "admin" || normalizedRole === "learner" ? void 0 : u.teacher_id || void 0,
        student_id: u.student_id || void 0,
        status: u.status || "Active",
        force_password_change: u.force_password_change ?? false,
        last_login: u.last_login || existingUser?.last_login || null
      };
    });
    setStorage(KEYS.USERS, mappedDBUsers);
  },
  addUser: (user) => {
    const users = getStorage(KEYS.USERS, adminUsersOnly);
    const updated = [...users, user];
    setStorage(KEYS.USERS, updated);
    return user;
  },
  updateUser: (user) => {
    const users = getStorage(KEYS.USERS, adminUsersOnly);
    const exists = users.some((u) => u.id === user.id || user.email && u.email.toLowerCase() === user.email.toLowerCase());
    const updated = exists ? users.map(
      (u) => u.id === user.id || user.email && u.email.toLowerCase() === user.email.toLowerCase() ? { ...u, ...user } : u
    ) : [...users, user];
    setStorage(KEYS.USERS, updated);
    return user;
  },
  deleteUser: (idOrEmail) => {
    const users = getStorage(KEYS.USERS, adminUsersOnly);
    const updated = users.filter(
      (u) => u.id !== idOrEmail && u.email.toLowerCase() !== idOrEmail.toLowerCase() && u.teacher_id !== idOrEmail && u.student_id !== idOrEmail
    );
    setStorage(KEYS.USERS, updated);
  },
  // --- LOGIN LOGS ---
  getLoginLogs: (filterQuery) => {
    const logs = getStorage(KEYS.LOGIN_LOGS, []);
    if (!filterQuery) return logs;
    const q = filterQuery.toLowerCase();
    return logs.filter(
      (l) => l.user_id && l.user_id.toLowerCase() === q || l.email && l.email.toLowerCase() === q || l.user_name && l.user_name.toLowerCase().includes(q)
    );
  },
  addLoginLog: (log) => {
    const logs = getStorage(KEYS.LOGIN_LOGS, []);
    const updated = [log, ...logs];
    setStorage(KEYS.LOGIN_LOGS, updated);
    return log;
  },
  // --- CLASSES ---
  getClasses: () => {
    const raw = getStorage(KEYS.CLASSES, []);
    return sortClasses(raw.map(sanitizeClass));
  },
  addClass: async (cls) => {
    const clean = sanitizeClass(cls);
    if (clean.class_teacher_id) {
      await api.updateClass(clean);
    } else {
      await syncClassToSupabase(clean);
    }
    const list = getStorage(KEYS.CLASSES, []).map(sanitizeClass);
    const existingIndex = list.findIndex(
      (c) => c.id === clean.id || c.class_name === clean.class_name && c.stream.toLowerCase() === clean.stream.toLowerCase()
    );
    let updated;
    if (existingIndex >= 0) {
      updated = list.map((c, idx) => idx === existingIndex ? clean : c);
    } else {
      updated = [...list, clean];
    }
    setStorage(KEYS.CLASSES, updated);
    return clean;
  },
  updateClass: async (cls) => {
    const clean = sanitizeClass(cls);
    const list = getStorage(KEYS.CLASSES, []).map(sanitizeClass);
    const updated = list.map((c) => c.id === clean.id ? clean : c);
    setStorage(KEYS.CLASSES, updated);
    const teachers = getStorage(KEYS.TEACHERS, []);
    let teachersChanged = false;
    const updatedTeachers = teachers.map((t) => {
      if (clean.class_teacher_id && t.id === clean.class_teacher_id) {
        teachersChanged = true;
        return {
          ...t,
          is_class_teacher: true,
          class_teacher_of_id: clean.id
        };
      } else if (t.class_teacher_of_id === clean.id && t.id !== clean.class_teacher_id) {
        teachersChanged = true;
        return {
          ...t,
          is_class_teacher: false,
          class_teacher_of_id: void 0
        };
      }
      return t;
    });
    if (teachersChanged) {
      setStorage(KEYS.TEACHERS, updatedTeachers);
    }
    await syncClassToSupabase(clean);
    return clean;
  },
  deleteStream: async (streamId) => {
    if (!streamId || typeof streamId !== "string" || !streamId.trim()) {
      throw new Error("deleteStream requires a valid, non-empty streamId.");
    }
    const list = getStorage(KEYS.CLASSES, []);
    const client = createSupabaseClient();
    if (client) {
      const { error: sErr } = await client.from("streams").delete().eq("id", streamId);
      if (sErr) {
        console.error("Failed to delete stream from Supabase:", sErr);
        throw new Error(`Failed to delete stream: ${sErr.message}`);
      }
    }
    const updated = list.filter((c) => c.stream_id !== streamId);
    setStorage(KEYS.CLASSES, updated);
    const teachers = getStorage(KEYS.TEACHERS, []);
    let teachersChanged = false;
    const updatedTeachers = teachers.map((t) => {
      let changed = false;
      const newAllocations = (t.allocations || []).filter((a) => a.stream_id !== streamId);
      if (newAllocations.length !== (t.allocations || []).length) {
        changed = true;
      }
      if (t.class_teacher_of_id === streamId) {
        changed = true;
        teachersChanged = true;
        return {
          ...t,
          is_class_teacher: false,
          class_teacher_of_id: void 0,
          allocations: newAllocations
        };
      }
      if (changed) {
        teachersChanged = true;
        return { ...t, allocations: newAllocations };
      }
      return t;
    });
    if (teachersChanged) {
      setStorage(KEYS.TEACHERS, updatedTeachers);
    }
  },
  deleteClass: async (classId) => {
    if (!classId || typeof classId !== "string" || !classId.trim()) {
      throw new Error("deleteClass requires a valid, non-empty classId.");
    }
    const list = getStorage(KEYS.CLASSES, []);
    const targetClasses = list.filter((c) => c.id === classId);
    const streamIds = targetClasses.map((c) => c.stream_id).filter(Boolean);
    const client = createSupabaseClient();
    if (client) {
      const { error: sErr } = await client.from("streams").delete().eq("class_id", classId);
      if (sErr) {
        console.error("Failed to delete class streams from Supabase:", sErr);
        throw new Error(`Failed to delete class streams: ${sErr.message}`);
      }
      const { error: cErr } = await client.from("classes").delete().eq("id", classId);
      if (cErr) {
        console.error("Failed to delete parent class from Supabase:", cErr);
        throw new Error(`Failed to delete parent class: ${cErr.message}`);
      }
    }
    const updated = list.filter((c) => c.id !== classId);
    setStorage(KEYS.CLASSES, updated);
    const teachers = getStorage(KEYS.TEACHERS, []);
    let teachersChanged = false;
    const updatedTeachers = teachers.map((t) => {
      let changed = false;
      const newAllocations = (t.allocations || []).filter(
        (a) => a.class_id !== classId && !streamIds.includes(a.stream_id || "")
      );
      if (newAllocations.length !== (t.allocations || []).length) {
        changed = true;
      }
      if (t.class_teacher_of_id === classId || streamIds.includes(t.class_teacher_of_id || "")) {
        changed = true;
        teachersChanged = true;
        return {
          ...t,
          is_class_teacher: false,
          class_teacher_of_id: void 0,
          allocations: newAllocations
        };
      }
      if (changed) {
        teachersChanged = true;
        return { ...t, allocations: newAllocations };
      }
      return t;
    });
    if (teachersChanged) {
      setStorage(KEYS.TEACHERS, updatedTeachers);
    }
  },
  // --- SUBJECTS ---
  getSubjects: () => {
    const raw = getStorage(KEYS.SUBJECTS, []);
    let hasChanges = false;
    const sanitized = raw.map((s) => {
      const clean = sanitizeSubject(s);
      if (clean.subject_code !== s.subject_code || clean.subject_name !== s.subject_name) {
        hasChanges = true;
      }
      return clean;
    });
    const uniqueSubjects = deduplicateSubjectList(sanitized);
    if (uniqueSubjects.length !== raw.length || hasChanges) {
      setStorage(KEYS.SUBJECTS, uniqueSubjects);
    }
    return uniqueSubjects;
  },
  getSubjectsForGrade: (grade) => {
    const all = api.getSubjects();
    return getApplicableSubjectsForGrade(grade, all);
  },
  getSubjectsForClass: (classStream) => {
    const all = api.getSubjects();
    return getAllocatedSubjectsForClass(classStream, all);
  },
  getSubjectsForLevel: (level) => {
    const all = api.getSubjects();
    const levelGrades = LEVEL_TO_GRADES[level] || [];
    return all.filter((s) => {
      if (s.status === "Archived") return false;
      if (s.applicable_grades && s.applicable_grades.length > 0) {
        return s.applicable_grades.some((g) => levelGrades.includes(g) || getEducationLevelForGrade(g) === level);
      }
      return s.education_level === level;
    });
  },
  addSubject: async (sb) => {
    const cleanSb = sanitizeSubject(sb);
    const targetId = isUUID(cleanSb.id) ? cleanSb.id : generateUUID();
    const finalSubject = { ...cleanSb, id: targetId };
    const client = createSupabaseClient();
    if (client) {
      const payload = {
        id: targetId,
        subject_name: finalSubject.subject_name,
        subject_code: finalSubject.subject_code,
        category: finalSubject.category || "Core",
        department: finalSubject.department || null,
        learning_area: finalSubject.education_level || null,
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      try {
        const { data, error } = await client.from("subjects").insert([payload]).select("*");
        if (error) {
          console.error("Failed to insert subject into Supabase:", error);
          if (isDuplicateSubjectCodeError(error)) {
            throw new Error(
              `Learning Area Code Already Exists

The code "${finalSubject.subject_code}" is already assigned to another Learning Area. Please use a different code.`
            );
          }
          throw new Error(`Failed to save Learning Area: ${error.message || String(error)}`);
        }
        if (data && data.length > 0) {
          const row = data[0];
          const insertedSubject = {
            ...finalSubject,
            id: row.id || targetId,
            subject_name: row.subject_name || finalSubject.subject_name,
            subject_code: row.subject_code || finalSubject.subject_code
          };
          const list2 = getStorage(KEYS.SUBJECTS, []);
          const updated2 = [...list2, insertedSubject];
          setStorage(KEYS.SUBJECTS, updated2);
          return insertedSubject;
        }
      } catch (err) {
        if (isDuplicateSubjectCodeError(err)) {
          throw new Error(
            `Learning Area Code Already Exists

The code "${finalSubject.subject_code}" is already assigned to another Learning Area. Please use a different code.`
          );
        }
        if (err?.message?.includes("Learning Area Code Already Exists")) {
          throw err;
        }
        console.error("Failed to insert subject into Supabase:", err);
        throw new Error(
          err?.message?.includes("Failed to fetch") ? `Network Error: Unable to connect to database. Please check your internet connection.` : `Failed to save Learning Area: ${err?.message || String(err)}`
        );
      }
    }
    const list = getStorage(KEYS.SUBJECTS, []);
    const updated = [...list, finalSubject];
    setStorage(KEYS.SUBJECTS, updated);
    return finalSubject;
  },
  updateSubject: async (sb) => {
    const cleanSb = sanitizeSubject(sb);
    if (!cleanSb.id || !isUUID(cleanSb.id)) {
      throw new Error(`Cannot update Learning Area: Invalid UUID '${cleanSb?.id}'`);
    }
    const client = createSupabaseClient();
    if (client) {
      const payload = {
        subject_name: cleanSb.subject_name,
        subject_code: cleanSb.subject_code,
        category: cleanSb.category || "Core",
        department: cleanSb.department || null,
        learning_area: cleanSb.education_level || null,
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      try {
        const { data, error } = await client.from("subjects").update(payload).eq("id", cleanSb.id).select("*");
        if (error) {
          console.error("Failed to update subject in Supabase:", error);
          if (isDuplicateSubjectCodeError(error)) {
            throw new Error(
              `Learning Area Code Already Exists

The code "${cleanSb.subject_code}" is already assigned to another Learning Area. Please use a different code.`
            );
          }
          throw new Error(`Failed to update Learning Area: ${error.message || String(error)}`);
        }
        if (data && data.length > 0) {
          const row = data[0];
          const updatedSubject = {
            ...cleanSb,
            id: row.id || cleanSb.id,
            subject_name: row.subject_name || cleanSb.subject_name,
            subject_code: row.subject_code || cleanSb.subject_code
          };
          const list2 = getStorage(KEYS.SUBJECTS, []);
          const updated2 = list2.map((s) => s.id === updatedSubject.id ? updatedSubject : s);
          setStorage(KEYS.SUBJECTS, updated2);
          return updatedSubject;
        }
      } catch (err) {
        if (isDuplicateSubjectCodeError(err)) {
          throw new Error(
            `Learning Area Code Already Exists

The code "${cleanSb.subject_code}" is already assigned to another Learning Area. Please use a different code.`
          );
        }
        if (err?.message?.includes("Learning Area Code Already Exists")) {
          throw err;
        }
        console.error("Failed to update subject in Supabase:", err);
        throw new Error(
          err?.message?.includes("Failed to fetch") ? `Network Error: Unable to connect to database. Please check your internet connection.` : `Failed to update Learning Area: ${err?.message || String(err)}`
        );
      }
    }
    const list = getStorage(KEYS.SUBJECTS, []);
    const updated = list.map((s) => s.id === cleanSb.id ? cleanSb : s);
    setStorage(KEYS.SUBJECTS, updated);
    return cleanSb;
  },
  isSubjectInUse: (id) => {
    const list = getStorage(KEYS.SUBJECTS, []);
    const target = list.find((s) => s.id === id);
    if (target && isStandardSubject(target)) return true;
    const marks = getStorage(KEYS.MARKS, []);
    if (marks.some((m) => m && (m.subject_id === id || target && (m.subject_id === target.subject_code || m.subject_id === target.subject_name)))) return true;
    const classes = getStorage(KEYS.CLASSES, []);
    if (classes.some((c) => {
      if (!c) return false;
      if (c.allocated_subject_ids && (c.allocated_subject_ids.includes(id) || target && (c.allocated_subject_ids.includes(target.subject_code) || c.allocated_subject_ids.includes(target.subject_name)))) return true;
      return false;
    })) {
      return true;
    }
    const teachers = getStorage(KEYS.TEACHERS, []);
    if (teachers.some(
      (t) => t && t.allocations && t.allocations.some((a) => a && (a.subject_id === id || target && (a.subject_id === target.subject_code || a.subject_id === target.subject_name)))
    )) {
      return true;
    }
    return false;
  },
  deactivateSubject: async (id) => {
    const list = getStorage(KEYS.SUBJECTS, []);
    const target = list.find((s) => s.id === id);
    if (!target) {
      throw new Error(`Subject with ID '${id}' not found.`);
    }
    const client = createSupabaseClient();
    if (client) {
      const { error } = await client.from("subjects").delete().eq("id", id);
      if (error) {
        console.error("Failed to deactivate subject in Supabase:", error);
        throw new Error(`Failed to deactivate subject: ${error.message}`);
      }
    }
    const updated = list.map((s) => s.id === id ? { ...s, status: "Archived" } : s);
    setStorage(KEYS.SUBJECTS, updated);
  },
  restoreSubject: async (id) => {
    const list = getStorage(KEYS.SUBJECTS, []);
    const target = list.find((s) => s.id === id);
    if (!target) {
      throw new Error(`Subject with ID '${id}' not found.`);
    }
    const activeSubject = { ...target, status: "Active" };
    const client = createSupabaseClient();
    if (client) {
      const payload = {
        id: activeSubject.id,
        subject_name: activeSubject.subject_name,
        subject_code: activeSubject.subject_code,
        category: activeSubject.category || "Core",
        learning_area: activeSubject.education_level || "Grade 1\u20139",
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      const { error } = await client.from("subjects").upsert([payload]);
      if (error) {
        console.error("Failed to restore subject in Supabase:", error);
        throw new Error(`Failed to restore subject: ${error.message}`);
      }
    }
    const updated = list.map((s) => s.id === id ? activeSubject : s);
    setStorage(KEYS.SUBJECTS, updated);
  },
  deleteSubject: async (id) => {
    const list = getStorage(KEYS.SUBJECTS, []);
    const target = list.find((s) => s.id === id);
    if (!target) {
      throw new Error(`Subject with ID '${id}' not found.`);
    }
    if (isStandardSubject(target) || api.isSubjectInUse(id)) {
      await api.deactivateSubject(id);
      return { success: true, deactivated: true };
    }
    const client = createSupabaseClient();
    if (client) {
      const { error } = await client.from("subjects").delete().eq("id", id);
      if (error) {
        console.error("Failed to delete subject from Supabase:", error);
        throw new Error(`Failed to delete subject: ${error.message}`);
      }
    }
    const updated = list.filter((s) => s.id !== id);
    setStorage(KEYS.SUBJECTS, updated);
    return { success: true, deactivated: false };
  },
  // --- TEACHERS ---
  getTeachers: () => {
    const teachers = getStorage(KEYS.TEACHERS, []);
    const users = getStorage(KEYS.USERS, adminUsersOnly);
    const { ids: delIds, emails: delEmails } = getDeletedTeacherIdentifiers();
    const clean = teachers.filter(
      (t) => t && !isBlacklistedTestEmail(t.email) && !delIds.has(t.id) && (!t.id || !delIds.has(t.id.toLowerCase())) && (!t.email || !delEmails.has(t.email.trim().toLowerCase()))
    );
    const uniqueTeachers = [];
    for (const t of clean) {
      const existingIdx = uniqueTeachers.findIndex((ex) => areTeachersSamePerson(ex, t));
      const matchedUser = users.find(
        (u) => u.teacher_id && u.teacher_id === t.id || t.user_id && u.id === t.user_id || t.email && u.email && u.email.toLowerCase() === t.email.toLowerCase()
      );
      const tchWithLogin = {
        ...t,
        last_login: t.last_login || matchedUser?.last_login || null
      };
      if (existingIdx >= 0) {
        uniqueTeachers[existingIdx] = mergeTeacherObjects(uniqueTeachers[existingIdx], tchWithLogin);
      } else {
        uniqueTeachers.push(tchWithLogin);
      }
    }
    if (uniqueTeachers.length !== teachers.length) {
      setStorage(KEYS.TEACHERS, uniqueTeachers);
    }
    return uniqueTeachers;
  },
  deduplicateTeachersAndUsers: () => {
    const teachers = getStorage(KEYS.TEACHERS, []).filter((t) => t && !isBlacklistedTestEmail(t.email));
    const users = getStorage(KEYS.USERS, adminUsersOnly).filter((u) => u && !isBlacklistedTestEmail(u.email));
    const uniqueTeachers = [];
    let teachersChanged = false;
    for (const tch of teachers) {
      const existingIdx = uniqueTeachers.findIndex((ex) => areTeachersSamePerson(ex, tch));
      if (existingIdx >= 0) {
        teachersChanged = true;
        const existing = uniqueTeachers[existingIdx];
        const merged = mergeTeacherObjects(existing, tch);
        const redundantId = tch.id === merged.id ? existing.id : tch.id;
        uniqueTeachers[existingIdx] = merged;
        if (redundantId && redundantId !== merged.id) {
          const currentUsersList = getStorage(KEYS.USERS, adminUsersOnly);
          let usersChangedForTeacher = false;
          const updatedUsers = currentUsersList.map((u) => {
            if (u.teacher_id === redundantId) {
              usersChangedForTeacher = true;
              return { ...u, teacher_id: merged.id };
            }
            return u;
          });
          if (usersChangedForTeacher) {
            setStorage(KEYS.USERS, updatedUsers);
          }
        }
      } else {
        uniqueTeachers.push(tch);
      }
    }
    if (teachersChanged || teachers.length !== uniqueTeachers.length) {
      setStorage(KEYS.TEACHERS, uniqueTeachers);
    }
    const uniqueUsersMap = /* @__PURE__ */ new Map();
    let usersChanged = false;
    const currentUsers = getStorage(KEYS.USERS, adminUsersOnly);
    for (const u of currentUsers) {
      const key = (u.email || "").trim().toLowerCase();
      if (uniqueUsersMap.has(key)) {
        usersChanged = true;
        const existing = uniqueUsersMap.get(key);
        uniqueUsersMap.set(key, existing);
      } else {
        uniqueUsersMap.set(key, u);
      }
    }
    if (usersChanged || currentUsers.length !== uniqueUsersMap.size) {
      setStorage(KEYS.USERS, Array.from(uniqueUsersMap.values()));
    }
  },
  addTeacher: (tch, authUserId) => {
    removeDeletedTeacherIdentifier(tch.id, tch.email, tch.user_id, authUserId);
    const list = getStorage(KEYS.TEACHERS, []);
    const emailLower = tch.email ? tch.email.trim().toLowerCase() : "";
    const existingIndex = list.findIndex((t) => areTeachersSamePerson(t, tch));
    let updated;
    if (existingIndex >= 0) {
      const existing = list[existingIndex];
      list[existingIndex] = mergeTeacherObjects(existing, tch);
      updated = list;
    } else {
      updated = [...list, tch];
    }
    setStorage(KEYS.TEACHERS, updated);
    const users = getStorage(KEYS.USERS, adminUsersOnly);
    const existingUserIndex = users.findIndex((u) => u.teacher_id === tch.id || emailLower && u.email.toLowerCase() === emailLower);
    const userPayload = {
      id: authUserId || (existingUserIndex >= 0 ? users[existingUserIndex].id : isUUID(tch.id) ? tch.id : generateUUID()),
      name: tch.teacher_name,
      email: tch.email,
      role: tch.is_class_teacher ? "class_teacher" : "subject_teacher",
      teacher_id: tch.id,
      phone: tch.phone,
      username: tch.username,
      tsc_number: tch.tsc_number,
      status: tch.status || "Active",
      force_password_change: tch.force_password_change ?? true,
      last_login: tch.last_login
    };
    if (existingUserIndex >= 0) {
      users[existingUserIndex] = { ...users[existingUserIndex], ...userPayload };
      setStorage(KEYS.USERS, users);
    } else {
      setStorage(KEYS.USERS, [...users, userPayload]);
    }
    api.deduplicateTeachersAndUsers();
    return tch;
  },
  updateTeacher: async (tch) => {
    const targetEmailLower = tch.email ? tch.email.trim().toLowerCase() : "";
    const client = getSupabaseClient();
    if (client) {
      let serverUpdated = false;
      const currentUser = api.getCurrentUser();
      const isCallerAdmin = !currentUser || currentUser.role === "admin";
      if (isCallerAdmin) {
        try {
          let token;
          try {
            const { data: sessionData } = await client.auth.getSession();
            token = sessionData?.session?.access_token;
          } catch (e) {
          }
          const headers = { "Content-Type": "application/json" };
          if (token) {
            headers["Authorization"] = `Bearer ${token}`;
          }
          const response = await fetch(buildApiUrl("/api/admin/update-teacher"), {
            method: "POST",
            headers,
            body: JSON.stringify({
              teacher: tch,
              token
            })
          });
          if (response.ok) {
            const respData = await response.json().catch(() => null);
            if (respData && respData.success) {
              if (respData.teacher && respData.teacher.id && isUUID(respData.teacher.id)) {
                tch.id = respData.teacher.id;
              }
              serverUpdated = true;
            }
          } else {
            const errData = await response.json().catch(() => null);
            if (errData && errData.error && response.status !== 404 && response.status !== 502 && response.status !== 503) {
              throw new Error(`Teacher details could not be saved: ${errData.error}`);
            }
          }
        } catch (srvErr) {
          if (srvErr.message && srvErr.message.includes("Teacher details could not be saved")) {
            throw srvErr;
          }
          console.warn("Backend endpoint /api/admin/update-teacher call failed or unavailable, falling back to client SDK:", srvErr);
        }
      }
      if (!serverUpdated) {
        let teacherUuid = isUUID(tch.id) ? tch.id : null;
        if (!teacherUuid && targetEmailLower) {
          try {
            const { data: dbMatch } = await client.from("teachers").select("id").eq("email", targetEmailLower).maybeSingle();
            if (dbMatch && isUUID(dbMatch.id)) {
              teacherUuid = dbMatch.id;
              tch.id = teacherUuid;
            }
          } catch (err) {
            console.warn("Could not lookup teacher UUID by email:", err);
          }
        }
        if (!teacherUuid && targetEmailLower) {
          try {
            const { data: insertedDb, error: insErr } = await client.from("teachers").insert([{
              teacher_name: tch.teacher_name,
              email: tch.email,
              phone: tch.phone,
              tsc_number: tch.tsc_number || null,
              is_class_teacher: tch.is_class_teacher || false
            }]).select().single();
            if (insertedDb && isUUID(insertedDb.id)) {
              teacherUuid = insertedDb.id;
              tch.id = teacherUuid;
            } else if (insErr) {
              console.warn("Could not insert teacher into Supabase to acquire UUID:", insErr);
            }
          } catch (err) {
            console.warn("Error inserting teacher into Supabase:", err);
          }
        }
        if (teacherUuid && isUUID(teacherUuid)) {
          const rawInserts = [];
          if (tch.allocations && tch.allocations.length > 0) {
            for (const alloc of tch.allocations) {
              const subjectUuid = await resolveSubjectUUID(client, alloc);
              const { class_id: classUuid, stream_id: streamUuid } = await resolveClassAndStreamUUIDs(client, alloc);
              if (subjectUuid) {
                rawInserts.push({
                  subject_id: subjectUuid,
                  class_id: classUuid,
                  stream_id: streamUuid
                });
              }
            }
          }
          const seenAllocationKeys = /* @__PURE__ */ new Set();
          const inserts = [];
          for (const item of rawInserts) {
            const key = `${item.subject_id}_${item.class_id || "null"}_${item.stream_id || "null"}`;
            if (!seenAllocationKeys.has(key)) {
              seenAllocationKeys.add(key);
              inserts.push(item);
            }
          }
          const { error: teacherErr } = await client.from("teachers").update({
            teacher_name: tch.teacher_name,
            email: tch.email,
            phone: tch.phone,
            tsc_number: tch.tsc_number || null,
            is_class_teacher: tch.is_class_teacher || false
          }).eq("id", teacherUuid);
          if (teacherErr) {
            console.error("Supabase update teacher record error:", teacherErr);
            throw new Error(formatTeacherSaveError(teacherErr, "Teacher details could not be saved."));
          }
          if (targetEmailLower) {
            await client.from("users").update({
              name: tch.teacher_name,
              email: tch.email,
              role: tch.is_class_teacher ? "class_teacher" : "subject_teacher"
            }).or(`teacher_id.eq.${teacherUuid},email.eq.${targetEmailLower}`);
          }
          if (isCallerAdmin) {
            await client.from("streams").update({ class_teacher_id: null }).eq("class_teacher_id", teacherUuid);
            if (tch.is_class_teacher && tch.class_teacher_of_id) {
              if (isUUID(tch.class_teacher_of_id)) {
                await client.from("streams").update({ class_teacher_id: teacherUuid }).eq("id", tch.class_teacher_of_id);
              }
            }
            if (tch.allocations !== void 0) {
              const { error: rpcAllocErr } = await client.rpc("update_teacher_allocations_atomic", {
                p_teacher_id: teacherUuid,
                p_allocations: inserts
              });
              if (rpcAllocErr) {
                if (rpcAllocErr.code === "PGRST202") {
                  const { data: existingAllocs } = await client.from("teacher_subjects").select("subject_id, class_id, stream_id").eq("teacher_id", teacherUuid);
                  const { error: delAllocErr } = await client.from("teacher_subjects").delete().eq("teacher_id", teacherUuid);
                  if (delAllocErr) {
                    console.error("Supabase delete allocations error:", delAllocErr);
                    throw new Error(formatTeacherSaveError(delAllocErr, "Learning area allocations could not be saved."));
                  }
                  if (inserts.length > 0) {
                    const fullInserts = inserts.map((i) => ({ teacher_id: teacherUuid, ...i }));
                    const { error: insAllocErr } = await client.from("teacher_subjects").insert(fullInserts);
                    if (insAllocErr) {
                      console.error("Supabase insert allocations error, restoring original allocations:", insAllocErr);
                      if (existingAllocs && existingAllocs.length > 0) {
                        try {
                          await client.from("teacher_subjects").insert(existingAllocs.map((a) => ({ teacher_id: teacherUuid, ...a })));
                        } catch (restoreErr) {
                          console.warn("Could not restore original allocations after insert failure:", restoreErr);
                        }
                      }
                      throw new Error(formatTeacherSaveError(insAllocErr, "Learning area allocations could not be saved."));
                    }
                  }
                } else {
                  console.error("Supabase RPC update_teacher_allocations_atomic error:", rpcAllocErr);
                  throw new Error(formatTeacherSaveError(rpcAllocErr, "Learning area allocations could not be saved."));
                }
              }
            }
          }
        }
      }
    }
    const list = getStorage(KEYS.TEACHERS, []);
    const updated = list.map(
      (t) => t.id === tch.id || targetEmailLower && t.email && t.email.trim().toLowerCase() === targetEmailLower ? { ...t, ...tch } : t
    );
    setStorage(KEYS.TEACHERS, updated);
    const users = getStorage(KEYS.USERS, adminUsersOnly);
    const userIndex = users.findIndex((u) => u.teacher_id === tch.id || targetEmailLower && u.email.toLowerCase() === targetEmailLower);
    if (userIndex >= 0) {
      users[userIndex] = {
        ...users[userIndex],
        name: tch.teacher_name,
        email: tch.email,
        phone: tch.phone,
        username: tch.username,
        tsc_number: tch.tsc_number,
        status: tch.status,
        role: tch.is_class_teacher && Boolean(tch.class_teacher_of_id) ? "class_teacher" : "subject_teacher",
        force_password_change: tch.force_password_change,
        last_login: tch.last_login || users[userIndex].last_login
      };
      setStorage(KEYS.USERS, users);
    } else {
      const newUser = {
        id: isUUID(tch.id) ? tch.id : generateUUID(),
        name: tch.teacher_name,
        email: tch.email,
        role: tch.is_class_teacher && Boolean(tch.class_teacher_of_id) ? "class_teacher" : "subject_teacher",
        teacher_id: tch.id,
        phone: tch.phone,
        username: tch.username,
        tsc_number: tch.tsc_number,
        status: tch.status || "Active",
        force_password_change: tch.force_password_change ?? true,
        last_login: tch.last_login
      };
      setStorage(KEYS.USERS, [...users, newUser]);
    }
    const classesList = getStorage(KEYS.CLASSES, []);
    let classesChanged = false;
    const updatedClasses = classesList.map((c) => {
      if (tch.is_class_teacher && tch.class_teacher_of_id === c.id) {
        if (c.class_teacher_id !== tch.id) {
          classesChanged = true;
          return { ...c, class_teacher_id: tch.id };
        }
      } else if (c.class_teacher_id === tch.id && (!tch.is_class_teacher || tch.class_teacher_of_id !== c.id)) {
        classesChanged = true;
        return { ...c, class_teacher_id: void 0 };
      }
      return c;
    });
    if (classesChanged) {
      setStorage(KEYS.CLASSES, updatedClasses);
    }
    api.deduplicateTeachersAndUsers();
    return tch;
  },
  deleteTeacher: async (id, options) => {
    const list = getStorage(KEYS.TEACHERS, []);
    const target = list.find((t) => t.id === id || t.email && t.email.toLowerCase() === id.toLowerCase());
    const targetEmailLower = target?.email ? target.email.trim().toLowerCase() : "";
    const deleteId = target?.id || id;
    const client = getSupabaseClient();
    if (client && !options?.alreadyDeletedOnServer) {
      let accessToken;
      try {
        const { data: sessionData } = await client.auth.getSession();
        accessToken = sessionData?.session?.access_token;
      } catch {
      }
      if (typeof fetch === "function" && typeof window !== "undefined") {
        const headers = { "Content-Type": "application/json" };
        if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
        const response = await fetch(buildApiUrl("/api/admin/delete-teacher"), {
          method: "POST",
          headers,
          body: JSON.stringify({
            teacherId: deleteId,
            email: targetEmailLower || void 0,
            token: accessToken
          })
        });
        let resData = null;
        try {
          resData = await response.json();
        } catch {
        }
        if (!response.ok || !resData?.success) {
          throw new Error(resData?.error || `Failed to delete teacher (${response.status})`);
        }
      } else {
        let deleteUuid = isUUID(deleteId) ? deleteId : null;
        if (!deleteUuid && targetEmailLower) {
          const { data: dbMatch } = await client.from("teachers").select("id").eq("email", targetEmailLower).maybeSingle();
          if (dbMatch && isUUID(dbMatch.id)) {
            deleteUuid = dbMatch.id;
          }
        }
        if (deleteUuid && isUUID(deleteUuid)) {
          const { error: tsErr } = await client.from("teacher_subjects").delete().eq("teacher_id", deleteUuid);
          if (tsErr) {
            console.warn("Could not clear teacher_subjects in direct test:", tsErr.message);
          }
          await client.from("streams").update({ class_teacher_id: null }).eq("class_teacher_id", deleteUuid);
          const { error: tErr } = await client.from("teachers").delete().eq("id", deleteUuid);
          if (tErr) {
            console.error("Supabase deleteTeacher error:", tErr);
            throw new Error(`Failed to delete teacher from database: ${tErr.message}`);
          }
          await client.from("users").delete().eq("teacher_id", deleteUuid);
        } else if (targetEmailLower) {
          const { error: tErr } = await client.from("teachers").delete().eq("email", targetEmailLower);
          if (tErr) {
            console.error("Supabase deleteTeacher error:", tErr);
            throw new Error(`Failed to delete teacher from database: ${tErr.message}`);
          }
          await client.from("users").delete().eq("email", targetEmailLower);
        }
        if (target?.user_id && isUUID(target.user_id)) {
          await client.from("users").delete().eq("id", target.user_id);
        }
      }
    }
    recordDeletedTeacherIdentifier(id, target?.id, target?.email, target?.user_id);
    const updated = list.filter(
      (t) => t.id !== id && t.id !== target?.id && (!targetEmailLower || t.email.trim().toLowerCase() !== targetEmailLower)
    );
    setStorage(KEYS.TEACHERS, updated);
    if (target) {
      if (target.email) api.deleteUser(target.email);
      if (target.user_id) api.deleteUser(target.user_id);
    }
    api.deleteUser(id);
    const classesList = getStorage(KEYS.CLASSES, []);
    let classesChanged = false;
    const updatedClasses = classesList.map((c) => {
      if (c.class_teacher_id === id || target && c.class_teacher_id === target.id) {
        classesChanged = true;
        return { ...c, class_teacher_id: void 0 };
      }
      return c;
    });
    if (classesChanged) {
      setStorage(KEYS.CLASSES, updatedClasses);
    }
    api.deduplicateTeachersAndUsers();
  },
  // --- STUDENTS ---
  getStudents: () => {
    const list = getStorage(KEYS.STUDENTS, []);
    return list.filter((s) => {
      const id = String(s.id || "");
      const adm = String(s.admission_number || "");
      const name = String(s.full_name || "");
      return !id.startsWith("std_test_") && !id.startsWith("test_") && adm !== "ADM-9001" && adm !== "ADM-9002" && !adm.startsWith("TEST_") && !adm.startsWith("ADM-900") && name !== "Alice Wambui" && name !== "Brian Kipchoge";
    });
  },
  getAllStudentsForMarks: () => {
    const isDemoOrTest = (s) => {
      const id = String(s.id || "");
      const adm = String(s.admission_number || "");
      const name = String(s.full_name || "");
      return id.startsWith("std_test_") || id.startsWith("test_") || adm === "ADM-9001" || adm === "ADM-9002" || adm.startsWith("TEST_") || adm.startsWith("ADM-900") || name === "Alice Wambui" || name === "Brian Kipchoge";
    };
    const primaryList = api.getStudents();
    const allocatedList = getStorage(KEYS.ALLOCATED_STUDENTS, []).filter((s) => !isDemoOrTest(s));
    const allStudentsMap = /* @__PURE__ */ new Map();
    primaryList.forEach((s) => allStudentsMap.set(s.id, s));
    allocatedList.forEach((s) => allStudentsMap.set(s.id, s));
    return Array.from(allStudentsMap.values());
  },
  addStudent: async (std) => {
    const client = getSupabaseClient();
    const activeAY = api.getActiveAcademicYear();
    const activeTerm = api.getActiveTerm();
    const isFutureIntake = isIntakePeriodFuture(
      std.intake_year,
      std.intake_term,
      activeAY?.year,
      activeTerm?.term_name
    );
    const rawEnrolmentStatus = std.enrolment_status;
    let enrolmentStatus;
    if (rawEnrolmentStatus === "future" || rawEnrolmentStatus === "inactive" || rawEnrolmentStatus === "active") {
      enrolmentStatus = rawEnrolmentStatus;
    } else if (isFutureIntake) {
      enrolmentStatus = "future";
    } else {
      enrolmentStatus = std.active === false ? "inactive" : "active";
    }
    const computedActive = enrolmentStatus === "active";
    const admissionDate = std.admission_date || (computedActive ? (/* @__PURE__ */ new Date()).toISOString().split("T")[0] : void 0);
    if (client) {
      const { class_id: targetClassUuid, stream_id: targetStreamUuid } = await resolveStudentClassAndStreamUuids(std.stream_id || std.class_id || "", client);
      const fullName = getStudentFullName(std) || std.full_name || `${std.first_name || ""} ${std.last_name || ""}`.trim();
      const payload = {
        admission_number: std.admission_number,
        full_name: fullName,
        gender: std.gender === "M" || std.gender === "Boy" || std.gender === "Male" ? "M" : "F",
        class_id: targetClassUuid,
        stream_id: targetStreamUuid,
        dob: std.dob || null,
        active: computedActive
      };
      if (std.id && isUUID(std.id)) {
        payload.id = std.id;
      }
      let { data, error } = await client.from("students").insert([payload]).select("*");
      if (error && error.code === "23505") {
        const { data: updateData, error: updateErr } = await client.from("students").update({
          full_name: payload.full_name,
          gender: payload.gender,
          class_id: payload.class_id,
          stream_id: payload.stream_id,
          dob: payload.dob,
          active: payload.active,
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        }).eq("admission_number", std.admission_number).select("*");
        if (!updateErr && updateData && updateData[0]) {
          data = updateData;
          error = null;
        }
      }
      if (error) {
        console.error("Supabase addStudent error:", error);
        throw new Error(`Failed to register learner in database: ${error.message}`);
      }
      if (data && data[0]) {
        const created = data[0];
        const currentClasses = getStorage(KEYS.CLASSES, []);
        const matchedClass = currentClasses.find((c) => c.id === created.stream_id || c.id === created.class_id);
        const grade = matchedClass ? matchedClass.class_name : std.grade;
        const level = matchedClass ? matchedClass.education_level : std.education_level;
        const nameParts = (created.full_name || "").trim().split(/\s+/);
        const firstName = std.first_name || nameParts[0] || "";
        const lastName = std.last_name || (nameParts.length > 1 ? nameParts[nameParts.length - 1] : "");
        const secondName = std.second_name || (nameParts.length > 2 ? nameParts.slice(1, -1).join(" ") : void 0);
        const newStudentObj = {
          ...std,
          id: created.id,
          admission_number: created.admission_number,
          full_name: created.full_name,
          first_name: firstName,
          second_name: secondName,
          last_name: lastName,
          gender: created.gender === "M" || created.gender === "Boy" || created.gender === "Male" ? "M" : "F",
          class_id: created.class_id || std.class_id || created.stream_id || "",
          stream_id: created.stream_id || std.stream_id || created.class_id || "",
          active: computedActive,
          enrolment_status: enrolmentStatus,
          intake_year: std.intake_year,
          intake_term: std.intake_term,
          admission_date: admissionDate,
          grade,
          education_level: level
        };
        const list2 = getStorage(KEYS.STUDENTS, []);
        const updated2 = [...list2.filter((s) => s.id !== newStudentObj.id), newStudentObj];
        setStorage(KEYS.STUDENTS, updated2);
        return newStudentObj;
      }
    }
    const normalizedStd = {
      ...std,
      active: computedActive,
      enrolment_status: enrolmentStatus,
      admission_date: admissionDate
    };
    const list = getStorage(KEYS.STUDENTS, []);
    const updated = [...list, normalizedStd];
    setStorage(KEYS.STUDENTS, updated);
    return normalizedStd;
  },
  batchAddStudents: async (newStudents) => {
    const client = getSupabaseClient();
    const activeAY = api.getActiveAcademicYear();
    const activeTerm = api.getActiveTerm();
    if (client && newStudents.length > 0) {
      const classUuidCache = /* @__PURE__ */ new Map();
      const getResolvedClassAndStream = async (classOrStreamId) => {
        const key = (classOrStreamId || "").trim();
        if (!classUuidCache.has(key)) {
          const resolved = await resolveStudentClassAndStreamUuids(key, client);
          classUuidCache.set(key, resolved);
        }
        return classUuidCache.get(key);
      };
      const payloads = [];
      for (const std of newStudents) {
        const { class_id: targetClassUuid, stream_id: targetStreamUuid } = await getResolvedClassAndStream(std.stream_id || std.class_id || "");
        const fullName = getStudentFullName(std) || std.full_name || `${std.first_name || ""} ${std.last_name || ""}`.trim();
        const isFutureIntake = isIntakePeriodFuture(
          std.intake_year,
          std.intake_term,
          activeAY?.year,
          activeTerm?.term_name
        );
        const rawEnrolmentStatus = std.enrolment_status;
        let enrolmentStatus;
        if (rawEnrolmentStatus === "future" || rawEnrolmentStatus === "inactive" || rawEnrolmentStatus === "active") {
          enrolmentStatus = rawEnrolmentStatus;
        } else if (isFutureIntake) {
          enrolmentStatus = "future";
        } else {
          enrolmentStatus = std.active === false ? "inactive" : "active";
        }
        const computedActive = enrolmentStatus === "active";
        const p = {
          admission_number: std.admission_number,
          full_name: fullName,
          gender: std.gender === "M" || std.gender === "Boy" || std.gender === "Male" ? "M" : "F",
          class_id: targetClassUuid,
          stream_id: targetStreamUuid,
          dob: std.dob || null,
          active: computedActive
        };
        if (std.id && isUUID(std.id)) {
          p.id = std.id;
        }
        payloads.push(p);
      }
      const { data, error } = await client.from("students").insert(payloads).select("*");
      if (error) {
        if (error.code === "42P01" || error.code === "23502" || error.code === "23503" || error.code === "PGRST204" || error.code === "23505") {
          console.warn("Supabase batchAddStudents DB insert warning:", error.message);
        } else {
          console.error("Supabase batchAddStudents error:", error);
          throw new Error(`Failed to batch register learners in database: ${error.message}`);
        }
      }
      if (data && data.length > 0) {
        const currentClasses = getStorage(KEYS.CLASSES, []);
        const createdStudents = data.map((created) => {
          const matchedInput = newStudents.find((s) => s.admission_number === created.admission_number);
          const isFutureIntake = isIntakePeriodFuture(
            matchedInput?.intake_year,
            matchedInput?.intake_term,
            activeAY?.year,
            activeTerm?.term_name
          );
          const rawEnrolmentStatus = matchedInput?.enrolment_status;
          let enrolmentStatus;
          if (rawEnrolmentStatus === "future" || rawEnrolmentStatus === "inactive" || rawEnrolmentStatus === "active") {
            enrolmentStatus = rawEnrolmentStatus;
          } else if (isFutureIntake) {
            enrolmentStatus = "future";
          } else {
            enrolmentStatus = created.active === false ? "inactive" : "active";
          }
          const computedActive = created.active !== false && enrolmentStatus === "active";
          const matchedClass = currentClasses.find((c) => c.id === created.stream_id || c.id === created.class_id);
          const grade = matchedClass ? matchedClass.class_name : void 0;
          const level = matchedClass ? matchedClass.education_level : grade ? getEducationLevelForGrade(grade) : void 0;
          const nameParts = (created.full_name || "").trim().split(/\s+/);
          const firstName = nameParts[0] || "";
          const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : "";
          const secondName = nameParts.length > 2 ? nameParts.slice(1, -1).join(" ") : void 0;
          const admissionDate = matchedInput?.admission_date || (computedActive ? (/* @__PURE__ */ new Date()).toISOString().split("T")[0] : void 0);
          return {
            id: created.id,
            admission_number: created.admission_number,
            full_name: created.full_name,
            first_name: firstName,
            second_name: secondName,
            last_name: lastName,
            gender: created.gender === "M" || created.gender === "Boy" || created.gender === "Male" ? "M" : "F",
            class_id: created.class_id || created.stream_id || "",
            stream_id: created.stream_id || created.class_id || "",
            dob: created.dob || void 0,
            active: computedActive,
            enrolment_status: enrolmentStatus,
            intake_year: matchedInput?.intake_year,
            intake_term: matchedInput?.intake_term,
            admission_date: admissionDate,
            grade,
            education_level: level
          };
        });
        const list2 = getStorage(KEYS.STUDENTS, []);
        const createdIds = new Set(createdStudents.map((s) => s.id));
        const updated2 = [...list2.filter((s) => !createdIds.has(s.id)), ...createdStudents];
        setStorage(KEYS.STUDENTS, updated2);
        return createdStudents;
      }
    }
    const list = getStorage(KEYS.STUDENTS, []);
    const normalizedNew = newStudents.map((std) => ({
      ...std,
      admission_date: std.admission_date || (std.active !== false ? (/* @__PURE__ */ new Date()).toISOString().split("T")[0] : void 0)
    }));
    const updated = [...list, ...normalizedNew];
    setStorage(KEYS.STUDENTS, updated);
    return normalizedNew;
  },
  updateStudent: async (std) => {
    const rawEnrolmentStatus = std.enrolment_status;
    const enrolmentStatus = rawEnrolmentStatus === "future" || rawEnrolmentStatus === "inactive" || rawEnrolmentStatus === "active" ? rawEnrolmentStatus : std.active === false ? "inactive" : "active";
    const targetActive = enrolmentStatus === "active";
    const targetStatus = targetActive ? "Active" : "Disabled";
    const normalizedStd = {
      ...std,
      active: targetActive,
      enrolment_status: enrolmentStatus,
      admission_date: std.admission_date || (targetActive ? (/* @__PURE__ */ new Date()).toISOString().split("T")[0] : void 0),
      intake_year: std.intake_year,
      intake_term: std.intake_term
    };
    const client = getSupabaseClient();
    if (client && isUUID(std.id)) {
      const { class_id: targetClassUuid, stream_id: targetStreamUuid } = await resolveStudentClassAndStreamUuids(std.stream_id || std.class_id || "", client);
      const payload = {
        admission_number: std.admission_number,
        full_name: getStudentFullName(std) || std.full_name,
        gender: std.gender === "M" || std.gender === "Boy" || std.gender === "Male" ? "M" : "F",
        class_id: targetClassUuid,
        stream_id: targetStreamUuid,
        dob: std.dob || null,
        active: targetActive,
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      const { error } = await client.from("students").update(payload).eq("id", std.id);
      if (error) {
        console.error("Supabase updateStudent error:", error);
        throw new Error(`Failed to update learner in database: ${error.message}`);
      }
      try {
        await client.from("users").update({
          status: targetStatus,
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        }).eq("student_id", std.id);
      } catch (userSyncErr) {
        console.warn("Could not synchronize public.users status in updateStudent:", userSyncErr);
      }
      try {
        const { data: sessionData } = await client.auth.getSession();
        const accessToken = sessionData?.session?.access_token;
        if (accessToken && typeof fetch === "function" && typeof window !== "undefined") {
          await fetch(buildApiUrl("/api/admin/set-learner-status"), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${accessToken}`
            },
            body: JSON.stringify({
              student_id: std.id,
              active: targetActive,
              enrolment_status: enrolmentStatus,
              token: accessToken
            })
          });
        }
      } catch {
      }
    }
    const list = getStorage(KEYS.STUDENTS, []);
    const updated = list.map((s) => s.id === std.id ? normalizedStd : s);
    setStorage(KEYS.STUDENTS, updated);
    const userList = getStorage(KEYS.USERS, []);
    const updatedUsers = userList.map((u) => {
      if (u.student_id === std.id && u.role === "learner") {
        return { ...u, status: targetStatus };
      }
      return u;
    });
    setStorage(KEYS.USERS, updatedUsers);
    return normalizedStd;
  },
  deleteStudent: async (id) => {
    const client = getSupabaseClient();
    if (client && isUUID(id)) {
      let accessToken;
      try {
        const { data: sessionData } = await client.auth.getSession();
        accessToken = sessionData?.session?.access_token;
      } catch {
      }
      if (typeof fetch === "function" && typeof window !== "undefined") {
        const headers = { "Content-Type": "application/json" };
        if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
        const response = await fetch(buildApiUrl("/api/admin/delete-learner"), {
          method: "POST",
          headers,
          body: JSON.stringify({ student_id: id, token: accessToken })
        });
        let resData = null;
        try {
          resData = await response.json();
        } catch {
        }
        if (!response.ok || !resData?.success) {
          throw new Error(resData?.error || `Failed to delete learner (${response.status})`);
        }
      } else {
        const { count: marksCount } = await client.from("marks").select("id", { count: "exact", head: true }).eq("student_id", id);
        if ((marksCount || 0) > 0) {
          throw new Error(`Permanent Deletion Blocked: Learner has ${marksCount} assessment mark(s).`);
        }
        const { error } = await client.from("students").delete().eq("id", id);
        if (error) {
          console.error("Supabase deleteStudent error:", error);
          throw new Error(`Failed to delete learner from database: ${error.message}`);
        }
      }
    } else if (client && !isUUID(id)) {
      const { error } = await client.from("students").delete().or(`id.eq.${id},admission_number.eq.${id}`);
      if (error) {
        console.error("Supabase deleteStudent error:", error);
        throw new Error(`Failed to delete learner from database: ${error.message}`);
      }
    }
    const list = getStorage(KEYS.STUDENTS, []);
    const updated = list.filter((s) => s.id !== id && s.admission_number !== id);
    setStorage(KEYS.STUDENTS, updated);
  },
  setLearnerStatus: async (studentId, action, reason) => {
    const list = getStorage(KEYS.STUDENTS, []);
    const student = list.find((s) => s.id === studentId);
    if (!student) {
      throw new Error(`Learner with ID '${studentId}' not found.`);
    }
    const isAdmit = action === "admit";
    const isReactivate = action === "reactivate";
    const newActive = isAdmit || isReactivate;
    const newEnrolmentStatus = newActive ? "active" : "inactive";
    const newAccountStatus = newActive ? "Active" : "Disabled";
    const activeAY = api.getActiveAcademicYear();
    const activeTerm = api.getActiveTerm();
    const admissionDate = isAdmit ? student.admission_date || (/* @__PURE__ */ new Date()).toISOString().split("T")[0] : student.admission_date;
    const client = getSupabaseClient();
    if (client && isUUID(studentId)) {
      let accessToken;
      try {
        const { data: sessionData } = await client.auth.getSession();
        accessToken = sessionData?.session?.access_token;
      } catch {
      }
      if (typeof fetch === "function" && typeof window !== "undefined") {
        const headers = { "Content-Type": "application/json" };
        if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
        const response = await fetch(buildApiUrl("/api/admin/set-learner-status"), {
          method: "POST",
          headers,
          body: JSON.stringify({
            student_id: studentId,
            action,
            active: newActive,
            enrolment_status: newEnrolmentStatus,
            admission_date: admissionDate,
            reason,
            token: accessToken
          })
        });
        let resData = null;
        try {
          resData = await response.json();
        } catch {
        }
        if (!response.ok || !resData?.success) {
          throw new Error(resData?.error || `Failed to update learner status (${response.status})`);
        }
      } else {
        await client.from("students").update({
          active: newActive,
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        }).eq("id", studentId);
        await client.from("users").update({
          status: newAccountStatus,
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        }).eq("student_id", studentId);
        try {
          const actionLogName = isAdmit ? "LEARNER_ADMITTED" : isReactivate ? "LEARNER_REACTIVATED" : "LEARNER_DEACTIVATED";
          await client.from("audit_logs").insert([{
            action: actionLogName,
            details: {
              student_id: studentId,
              admission_number: student.admission_number,
              full_name: student.full_name,
              admission_date: admissionDate,
              reason: reason || (isAdmit ? "Manual admission by administrator" : isReactivate ? "Reactivation by administrator" : "Deactivation by administrator"),
              timestamp: (/* @__PURE__ */ new Date()).toISOString()
            }
          }]);
        } catch {
        }
      }
    }
    const updatedStudent = {
      ...student,
      active: newActive,
      enrolment_status: newEnrolmentStatus,
      admission_date: admissionDate,
      intake_year: isAdmit && isIntakePeriodFuture(student.intake_year, student.intake_term, activeAY?.year, activeTerm?.term_name) ? activeAY?.year || student.intake_year : student.intake_year,
      intake_term: isAdmit && isIntakePeriodFuture(student.intake_year, student.intake_term, activeAY?.year, activeTerm?.term_name) ? activeTerm?.term_name || student.intake_term : student.intake_term
    };
    const updatedList = list.map((s) => s.id === studentId ? updatedStudent : s);
    setStorage(KEYS.STUDENTS, updatedList);
    const userList = getStorage(KEYS.USERS, []);
    const updatedUsers = userList.map((u) => {
      if (u.student_id === studentId && u.role === "learner") {
        return { ...u, status: newAccountStatus };
      }
      return u;
    });
    setStorage(KEYS.USERS, updatedUsers);
    return updatedStudent;
  },
  admitLearner: async (studentId, reason) => {
    return api.setLearnerStatus(studentId, "admit", reason || "Learner admitted from Future Intake");
  },
  promoteStudents: (studentIds, targetGrade, targetClassId, promotedBy, fromYear, fromTerm, toYear, toTerm) => {
    const students = getStorage(KEYS.STUDENTS, []);
    const classes = getStorage(KEYS.CLASSES, []);
    const activeAY = api.getActiveAcademicYear();
    const activeTerm = api.getActiveTerm();
    const dateStr = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const targetLevel = getEducationLevelForGrade(targetGrade);
    const fYear = fromYear ?? (activeAY ? activeAY.year : 2026);
    const fTerm = fromTerm ?? (activeTerm ? activeTerm.term_name : "Term 3");
    const tYear = toYear ?? fYear + 1;
    const tTerm = toTerm ?? "Term 1";
    const updatedStudents = students.map((std) => {
      if (!studentIds.includes(std.id)) return std;
      const currentClass = classes.find((c) => c.id === std.class_id);
      const fromGrade = std.grade || currentClass?.class_name || "Grade 7";
      const promoRecord = {
        id: `prm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        student_id: std.id,
        from_grade: fromGrade,
        to_grade: targetGrade,
        from_class_id: std.class_id,
        to_class_id: targetClassId || std.class_id,
        academic_year_id: activeAY ? activeAY.id : void 0,
        date_promoted: dateStr,
        promoted_by: promotedBy || "Admin",
        from_year: fYear,
        from_term: fTerm,
        to_year: tYear,
        to_term: tTerm
      };
      const history = std.promotion_history || [];
      return {
        ...std,
        grade: targetGrade,
        education_level: targetLevel,
        class_id: targetClassId || std.class_id,
        stream_id: targetClassId || std.stream_id || std.class_id,
        promotion_history: [...history, promoRecord]
      };
    });
    setStorage(KEYS.STUDENTS, updatedStudents);
    return updatedStudents.filter((s) => studentIds.includes(s.id));
  },
  // --- EXAMINATIONS ---
  getExaminations: () => getStorage(KEYS.EXAMS, []),
  addExamination: async (ex) => {
    const client = createSupabaseClient();
    const examUuid = ex.id && (isUUID(ex.id) || !client) ? ex.id : generateUUID();
    let ayId = isUUID(ex.academic_year_id) ? ex.academic_year_id : null;
    if (!ayId) {
      const years = api.getAcademicYears();
      const matchedYear = years.find((y) => y.year === ex.year || y.id === ex.academic_year_id);
      if (matchedYear && isUUID(matchedYear.id)) {
        ayId = matchedYear.id;
      }
    }
    if (!ayId && client) {
      try {
        const { data: dbYear } = await client.from("academic_years").select("id").eq("year", ex.year).maybeSingle();
        if (dbYear && isUUID(dbYear.id)) {
          ayId = dbYear.id;
        }
      } catch (e) {
      }
    }
    let termId = isUUID(ex.term_id) ? ex.term_id : null;
    if (!termId) {
      const terms = api.getSchoolTerms();
      const matchedTerm = terms.find(
        (t) => (ayId && t.academic_year_id === ayId || t.academic_year_id === ex.academic_year_id || t.year === ex.year) && (t.term_name === ex.term || t.id === ex.term_id)
      );
      if (matchedTerm && isUUID(matchedTerm.id)) {
        termId = matchedTerm.id;
      }
    }
    if (!termId && client) {
      try {
        let query = client.from("school_terms").select("id");
        if (ayId) {
          query = query.eq("academic_year_id", ayId);
        } else {
          query = query.eq("year", ex.year);
        }
        query = query.eq("term_name", ex.term);
        const { data: dbTerm } = await query.maybeSingle();
        if (dbTerm && isUUID(dbTerm.id)) {
          termId = dbTerm.id;
        }
      } catch (e) {
      }
    }
    if (client) {
      if (!ayId || !isUUID(ayId)) {
        throw new Error(`Failed to create examination in database: Unable to resolve authoritative relational UUID for Academic Year ${ex.year}`);
      }
      if (!termId || !isUUID(termId)) {
        throw new Error(`Failed to create examination in database: Unable to resolve authoritative relational UUID for School Term "${ex.term}" in Academic Year ${ex.year}`);
      }
    }
    const finalExam = {
      ...ex,
      id: examUuid,
      academic_year_id: ayId || ex.academic_year_id,
      term_id: termId || ex.term_id,
      created_at: ex.created_at || (/* @__PURE__ */ new Date()).toISOString()
    };
    const list = getStorage(KEYS.EXAMS, []);
    const updated = [finalExam, ...list.filter((e) => e.id !== finalExam.id)];
    setStorage(KEYS.EXAMS, updated);
    if (client) {
      const payload = {
        id: finalExam.id,
        exam_name: finalExam.exam_name,
        term: finalExam.term,
        year: finalExam.year,
        academic_year_id: ayId,
        term_id: termId,
        status: finalExam.status,
        exam_type: finalExam.exam_type,
        max_marks: finalExam.max_marks,
        weightage: finalExam.weightage || 100,
        approved_levels: finalExam.approved_levels || [],
        approved_classes: finalExam.approved_classes || [],
        education_level: finalExam.education_level || null,
        start_date: finalExam.start_date || null,
        end_date: finalExam.end_date || null
      };
      let { data: insertedData, error } = await client.from("examinations").insert([payload]).select().maybeSingle();
      if (error && (error.code === "PGRST204" || error.message?.includes("approved_levels") || error.message?.includes("approved_classes"))) {
        delete payload.approved_levels;
        delete payload.approved_classes;
        delete payload.education_level;
        const retryResult = await client.from("examinations").insert([payload]).select().maybeSingle();
        error = retryResult.error;
        insertedData = retryResult.data;
      }
      if (error) {
        console.error("Supabase error creating examination:", error);
        throw new Error(`Failed to create examination in database: ${error.message}`);
      }
      if (insertedData?.created_at) {
        finalExam.created_at = insertedData.created_at;
        finalExam.updated_at = insertedData.updated_at;
        const currentList = getStorage(KEYS.EXAMS, []);
        const syncedList = currentList.map(
          (e) => e.id === finalExam.id ? { ...e, created_at: insertedData.created_at, updated_at: insertedData.updated_at } : e
        );
        setStorage(KEYS.EXAMS, syncedList);
      }
    }
    return finalExam;
  },
  updateExaminationLevelApproval: async (examId, level, approved, currentUser) => {
    const list = getStorage(KEYS.EXAMS, []);
    const targetExam = list.find((ex) => ex.id === examId);
    if (!targetExam) {
      throw new Error("Examination record not found.");
    }
    if (currentUser?.role !== "admin") {
      throw new Error("UNAUTHORIZED: Only an Administrator can approve or reopen an assessment level.");
    }
    const currentApprovedLevels = [...targetExam.approved_levels || []];
    let newApprovedLevels;
    if (approved) {
      if (!currentApprovedLevels.includes(level)) {
        newApprovedLevels = [...currentApprovedLevels, level];
      } else {
        newApprovedLevels = currentApprovedLevels;
      }
    } else {
      newApprovedLevels = currentApprovedLevels.filter((l) => l !== level);
    }
    const allClasses = getStorage(KEYS.CLASSES, []).filter(
      (c) => c && c.status !== "Inactive" && !String(c.id).startsWith("cls_test_") && !String(c.stream_id).startsWith("st_test_")
    );
    const levelStreams = allClasses.filter((c) => {
      const cLevel = c.education_level || (c.class_name ? getEducationLevelForGrade(c.class_name) : void 0);
      return cLevel === level;
    });
    const levelStreamIds = levelStreams.map((st) => st.stream_id || st.id).filter(Boolean);
    const currentApprovedClasses = targetExam.approved_classes || [];
    let newApprovedClasses = [];
    if (approved) {
      const set = /* @__PURE__ */ new Set([...currentApprovedClasses, ...levelStreamIds]);
      newApprovedClasses = Array.from(set);
    } else {
      const removeSet = new Set(levelStreamIds);
      newApprovedClasses = currentApprovedClasses.filter((id) => !removeSet.has(id));
    }
    const allCbeLevels = ["Pre-Primary", "Lower Primary", "Upper Primary", "Junior School"];
    const isAllLevelsApproved = allCbeLevels.every((lvl) => newApprovedLevels.includes(lvl));
    const isAllSchoolStreamsApproved = allClasses.length > 0 && allClasses.every((st) => {
      const sId = st.stream_id || st.id;
      return newApprovedClasses.includes(sId);
    });
    let newStatus = targetExam.status;
    if (isAllLevelsApproved || isAllSchoolStreamsApproved) {
      newStatus = "Approved";
    } else if (!approved && targetExam.status === "Approved") {
      newStatus = newApprovedClasses.length > 0 ? "Provisional" : "Draft";
    } else if (newApprovedLevels.length > 0 && targetExam.status === "Draft") {
      newStatus = "Provisional";
    } else if (newApprovedLevels.length === 0 && newApprovedClasses.length === 0 && targetExam.status === "Provisional") {
      newStatus = "Draft";
    }
    const client = createSupabaseClient();
    if (client && isUUID(examId)) {
      const { error } = await client.from("examinations").update({
        status: newStatus,
        approved_levels: newApprovedLevels,
        approved_classes: newApprovedClasses,
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      }).eq("id", examId);
      if (error) {
        if (error.code === "PGRST204" || error.message?.includes("approved_levels") || error.message?.includes("approved_classes")) {
          console.info('Info: Column "approved_levels" or "approved_classes" updating via fallback.');
        } else {
          console.warn("Supabase update approved_levels/approved_classes warning, falling back to status update:", error);
        }
        await client.from("examinations").update({
          status: newStatus,
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        }).eq("id", examId);
      }
    }
    let updatedExam = null;
    const updated = list.map((ex) => {
      if (ex.id === examId) {
        updatedExam = {
          ...ex,
          status: newStatus,
          approved_levels: newApprovedLevels,
          approved_classes: newApprovedClasses
        };
        return updatedExam;
      }
      return ex;
    });
    setStorage(KEYS.EXAMS, updated);
    try {
      const now = /* @__PURE__ */ new Date();
      const adminName = currentUser?.name || currentUser?.full_name || currentUser?.username || "Administrator";
      const actionType = approved ? `APPROVED & LOCKED LEVEL [${level}]` : `REOPENED LEVEL [${level}] FOR MARKS ENTRY`;
      const auditLog = {
        id: `log_exam_level_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        user_id: currentUser?.id || "admin",
        email: currentUser?.email || "admin@school.ac.ke",
        user_name: adminName,
        role: currentUser?.role || "admin",
        timestamp: now.toISOString(),
        date: now.toISOString().slice(0, 10),
        time: now.toTimeString().slice(0, 8),
        ip_address: "127.0.0.1 (Internal System)",
        device: "Web Client",
        browser: "Secure Management Console",
        status: "Success",
        reason: `${actionType}: "${targetExam.exam_name}" | Approved Levels: ${newApprovedLevels.join(", ") || "None"} | Performed By: ${adminName}`
      };
      const currentLogs = getStorage(KEYS.LOGIN_LOGS, []);
      setStorage(KEYS.LOGIN_LOGS, [auditLog, ...currentLogs]);
    } catch (e) {
    }
    return updatedExam || targetExam;
  },
  updateExaminationClassApproval: async (examId, classStreamId, approved, currentUser) => {
    const list = getStorage(KEYS.EXAMS, []);
    const targetExam = list.find((ex) => ex.id === examId);
    if (!targetExam) {
      throw new Error("Examination record not found.");
    }
    const allClasses = getStorage(KEYS.CLASSES, []).filter(
      (c) => c && c.status !== "Inactive" && !String(c.id).startsWith("cls_test_") && !String(c.stream_id).startsWith("st_test_")
    );
    const targetClass = allClasses.find(
      (c) => c.stream_id === classStreamId || c.id === classStreamId || c.class_name === classStreamId
    );
    const streamIdentifier = targetClass?.stream_id || targetClass?.id || classStreamId;
    const streamName = targetClass ? `${targetClass.class_name} ${targetClass.stream}` : streamIdentifier;
    if (currentUser) {
      const isUserAdmin = currentUser.role === "admin";
      const isUserClassTeacher = currentUser.role === "class_teacher";
      if (!isUserAdmin) {
        if (!isUserClassTeacher) {
          throw new Error("UNAUTHORIZED: Only Administrators and designated Class Teachers can approve examination results.");
        }
        const teachers = getStorage(KEYS.TEACHERS, []);
        const activeTeacher = teachers.find(
          (t) => currentUser.teacher_id && t.id === currentUser.teacher_id || currentUser.email && t.email && t.email.toLowerCase() === currentUser.email.toLowerCase() || t.user_id && t.user_id === currentUser.id
        );
        const ownsStream = targetClass && (targetClass.class_teacher_id === activeTeacher?.id || activeTeacher?.class_teacher_of_id === targetClass.stream_id || activeTeacher?.class_teacher_of_id === targetClass.id || activeTeacher && isClassTeacherFor(activeTeacher, streamIdentifier, allClasses));
        if (!ownsStream) {
          throw new Error(`UNAUTHORIZED: You are only permitted to approve results for your assigned class stream (${streamName}).`);
        }
        if (!approved) {
          if (targetExam.status === "Approved") {
            throw new Error("UNAUTHORIZED: Reopening a globally locked examination requires Administrator authorization.");
          }
        }
      }
    }
    const currentApprovedClasses = targetExam.approved_classes || [];
    let newApprovedClasses = [];
    if (approved) {
      const set = /* @__PURE__ */ new Set([...currentApprovedClasses, streamIdentifier]);
      newApprovedClasses = Array.from(set);
    } else {
      newApprovedClasses = currentApprovedClasses.filter(
        (id) => id !== streamIdentifier && id !== targetClass?.stream_id && id !== targetClass?.id
      );
    }
    const currentApprovedLevels = targetExam.approved_levels || [];
    let newApprovedLevels = [...currentApprovedLevels];
    const allCbeLevels = ["Pre-Primary", "Lower Primary", "Upper Primary", "Junior School"];
    allCbeLevels.forEach((lvl) => {
      const levelStreams = allClasses.filter((c) => {
        const cLevel = c.education_level || (c.class_name ? getEducationLevelForGrade(c.class_name) : void 0);
        return cLevel === lvl;
      });
      if (levelStreams.length > 0) {
        const allLevelStreamsApproved = levelStreams.every((st) => {
          const sId = st.stream_id || st.id;
          return newApprovedClasses.includes(sId);
        });
        if (allLevelStreamsApproved) {
          if (!newApprovedLevels.includes(lvl)) {
            newApprovedLevels.push(lvl);
          }
        } else {
          newApprovedLevels = newApprovedLevels.filter((l) => l !== lvl);
        }
      }
    });
    const isAllSchoolStreamsApproved = allClasses.length > 0 && allClasses.every((st) => {
      const sId = st.stream_id || st.id;
      return newApprovedClasses.includes(sId);
    });
    let newStatus = targetExam.status;
    if (isAllSchoolStreamsApproved) {
      newStatus = "Approved";
    } else if (!approved && targetExam.status === "Approved") {
      newStatus = "Provisional";
    } else if (newApprovedClasses.length > 0 && targetExam.status === "Draft") {
      newStatus = "Provisional";
    } else if (newApprovedClasses.length === 0 && newApprovedLevels.length === 0 && targetExam.status === "Provisional") {
      newStatus = "Draft";
    }
    const client = createSupabaseClient();
    if (client && isUUID(examId)) {
      const { error } = await client.from("examinations").update({
        status: newStatus,
        approved_levels: newApprovedLevels,
        approved_classes: newApprovedClasses,
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      }).eq("id", examId);
      if (error) {
        if (error.code === "PGRST204" || error.message?.includes("approved_classes") || error.message?.includes("approved_levels")) {
          console.info('Info: Column "approved_classes" updating via fallback.');
        } else {
          console.warn("Supabase update approved_classes warning:", error);
        }
        await client.from("examinations").update({
          status: newStatus,
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        }).eq("id", examId);
      }
    }
    let updatedExam = null;
    const updated = list.map((ex) => {
      if (ex.id === examId) {
        updatedExam = {
          ...ex,
          status: newStatus,
          approved_levels: newApprovedLevels,
          approved_classes: newApprovedClasses
        };
        return updatedExam;
      }
      return ex;
    });
    setStorage(KEYS.EXAMS, updated);
    try {
      const now = /* @__PURE__ */ new Date();
      const userName = currentUser?.name || currentUser?.full_name || currentUser?.username || "Class Teacher";
      const roleLabel = currentUser?.role === "admin" ? "Administrator" : "Class Teacher";
      const actionType = approved ? `APPROVED & LOCKED CLASS STREAM [${streamName}]` : `REOPENED CLASS STREAM [${streamName}] FOR MARKS ENTRY`;
      const auditLog = {
        id: `log_exam_class_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        user_id: currentUser?.id || "teacher",
        email: currentUser?.email || "teacher@school.ac.ke",
        user_name: userName,
        role: currentUser?.role || "class_teacher",
        timestamp: now.toISOString(),
        date: now.toISOString().slice(0, 10),
        time: now.toTimeString().slice(0, 8),
        ip_address: "127.0.0.1 (Internal System)",
        device: "Web Client",
        browser: "Secure Management Console",
        status: "Success",
        reason: `${actionType}: "${targetExam.exam_name}" | Approved Streams: ${newApprovedClasses.length} | Performed By: ${userName} (${roleLabel})`
      };
      const currentLogs = getStorage(KEYS.LOGIN_LOGS, []);
      setStorage(KEYS.LOGIN_LOGS, [auditLog, ...currentLogs]);
    } catch (e) {
    }
    return updatedExam || targetExam;
  },
  updateExaminationStatus: async (examId, status, currentUser) => {
    const list = getStorage(KEYS.EXAMS, []);
    let targetExam = list.find((ex) => ex.id === examId);
    const client = createSupabaseClient();
    if (!targetExam && client && isUUID(examId)) {
      const { data } = await client.from("examinations").select("*").eq("id", examId).maybeSingle();
      if (data) {
        targetExam = {
          id: data.id,
          exam_name: data.exam_name,
          term: data.term,
          year: data.year,
          status: data.status,
          exam_type: data.exam_type,
          max_marks: data.max_marks,
          start_date: data.start_date,
          end_date: data.end_date,
          approved_levels: data.approved_levels || [],
          approved_classes: data.approved_classes || []
        };
      }
    }
    if (!targetExam) {
      throw new Error("Examination record not found.");
    }
    if (targetExam.status === "Approved" && status !== "Approved") {
      const actualRole = currentUser?.role;
      if (actualRole !== "admin") {
        throw new Error("UNAUTHORIZED: Only an Administrator can reopen an approved examination.");
      }
    }
    if (client && isUUID(examId)) {
      const updatePayload = {
        status,
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      if (status === "Draft") {
        updatePayload.approved_classes = [];
        updatePayload.approved_levels = [];
      }
      const { error } = await client.from("examinations").update(updatePayload).eq("id", examId);
      if (error) {
        console.error("Supabase updateExaminationStatus error:", error);
        throw new Error(`Failed to update examination status in database: ${error.message}`);
      }
    }
    let updatedExam = null;
    const updated = list.map((ex) => {
      if (ex.id === examId) {
        updatedExam = {
          ...ex,
          status,
          ...status === "Draft" ? { approved_classes: [], approved_levels: [] } : {}
        };
        return updatedExam;
      }
      return ex;
    });
    if (!updatedExam) {
      updatedExam = {
        ...targetExam,
        status,
        ...status === "Draft" ? { approved_classes: [], approved_levels: [] } : {}
      };
      setStorage(KEYS.EXAMS, [...list, updatedExam]);
    } else {
      setStorage(KEYS.EXAMS, updated);
    }
    try {
      if (targetExam.status !== status && (status === "Approved" || targetExam.status === "Approved")) {
        const now = /* @__PURE__ */ new Date();
        const dateStr = now.toISOString().slice(0, 10);
        const timeStr = now.toTimeString().slice(0, 8);
        const adminName = currentUser?.name || currentUser?.full_name || currentUser?.username || "Administrator";
        const actionType = status === "Approved" ? "APPROVED & LOCKED EXAMINATION" : "REOPENED EXAMINATION FOR MARKS ENTRY";
        const auditLog = {
          id: `log_exam_${status.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          user_id: currentUser?.id || "admin",
          email: currentUser?.email || "admin@school.ac.ke",
          user_name: adminName,
          role: currentUser?.role || "admin",
          timestamp: now.toISOString(),
          date: dateStr,
          time: timeStr,
          ip_address: "127.0.0.1 (Internal System)",
          device: "Web Client",
          browser: "Secure Management Console",
          status: "Success",
          reason: `${actionType}: "${targetExam.exam_name}" (ID: ${examId}) | Status transitioned from ${targetExam.status} to ${status} | Performed By: ${adminName} (${currentUser?.role || "admin"})`
        };
        const currentLogs = getStorage(KEYS.LOGIN_LOGS, []);
        setStorage(KEYS.LOGIN_LOGS, [auditLog, ...currentLogs]);
      }
    } catch (e) {
    }
    return updatedExam || targetExam;
  },
  deleteExamination: async (examId, currentUser) => {
    const exams = getStorage(KEYS.EXAMS, []);
    const targetExam = exams.find((e) => e.id === examId);
    if (!targetExam) {
      throw new Error("Examination record not found.");
    }
    if (targetExam.status === "Approved") {
      throw new Error(
        "Approved examinations are locked and cannot be deleted. Re-open the examination to Draft if corrections are required."
      );
    }
    if (targetExam.status === "Archived") {
      throw new Error(
        "Archived examinations cannot be deleted because they are historical records."
      );
    }
    const client = createSupabaseClient();
    const localMarks = getStorage(KEYS.MARKS, []);
    const dependentLocalMarks = localMarks.filter((m) => m.exam_id === examId);
    let dbMarksCount = 0;
    if (client && isUUID(examId)) {
      const { count, error: mCountErr } = await client.from("marks").select("id", { count: "exact", head: true }).eq("exam_id", examId);
      if (!mCountErr && typeof count === "number") {
        dbMarksCount = count;
      }
    }
    if (dependentLocalMarks.length > 0 || dbMarksCount > 0) {
      const markCount = Math.max(dependentLocalMarks.length, dbMarksCount);
      throw new Error(
        `Cannot delete examination "${targetExam.exam_name}": This assessment has ${markCount} associated mark record(s). Deletion blocked to preserve student marks and results.`
      );
    }
    if (client && isUUID(examId)) {
      const { error: eErr } = await client.from("examinations").delete().eq("id", examId);
      if (eErr && eErr.code !== "42P01") {
        console.error("Database error deleting examination:", eErr);
        throw new Error(`Database error deleting examination: ${eErr.message}`);
      }
    }
    const remainingExams = exams.filter((e) => e.id !== examId);
    setStorage(KEYS.EXAMS, remainingExams);
    const verifications = getStorage(KEYS.VERIFICATIONS, []);
    const remainingVerifications = verifications.filter((v) => v.exam_id !== examId);
    setStorage(KEYS.VERIFICATIONS, remainingVerifications);
    try {
      const commentsKey = "cbe_report_comments";
      const comments = getStorage(commentsKey, []);
      if (comments && comments.length > 0) {
        const remainingComments = comments.filter((c) => c.exam_id !== examId);
        setStorage(commentsKey, remainingComments);
      }
    } catch (e) {
    }
    try {
      const now = /* @__PURE__ */ new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const timeStr = now.toTimeString().slice(0, 8);
      const adminName = currentUser?.name || currentUser?.full_name || currentUser?.username || "Administrator";
      const auditLog = {
        id: `log_exam_del_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        user_id: currentUser?.id || "admin",
        email: currentUser?.email || "admin@school.ac.ke",
        user_name: adminName,
        role: currentUser?.role || "admin",
        timestamp: now.toISOString(),
        date: dateStr,
        time: timeStr,
        ip_address: "127.0.0.1 (Internal System)",
        device: "Web Client",
        browser: "Secure Management Console",
        status: "Success",
        reason: `DELETED ASSESSMENT: "${targetExam.exam_name}" (ID: ${examId}) | Performed By: ${adminName}`
      };
      const currentLogs = getStorage(KEYS.LOGIN_LOGS, []);
      setStorage(KEYS.LOGIN_LOGS, [auditLog, ...currentLogs]);
    } catch (e) {
    }
    return {
      success: true,
      examName: targetExam.exam_name,
      deletedMarksCount: 0,
      affectedStudentsCount: 0,
      message: `Examination "${targetExam.exam_name}" was successfully deleted.`
    };
  },
  // --- MARKS ---
  mapDatabaseMarks: (markData) => {
    if (!Array.isArray(markData)) return [];
    return markData.map((m) => {
      let rawScore = m.raw_score;
      let outOf = m.out_of;
      let specialStatus = m.special_status;
      let irregularityReason = m.irregularity_reason;
      if (m.remarks && typeof m.remarks === "string" && m.remarks.trim().startsWith("{")) {
        try {
          const parsed = JSON.parse(m.remarks);
          if (rawScore === void 0) rawScore = parsed.raw_score;
          if (outOf === void 0) outOf = parsed.out_of;
          if (specialStatus === void 0) specialStatus = parsed.special_status;
          if (irregularityReason === void 0) irregularityReason = parsed.irregularity_reason;
        } catch (e) {
        }
      }
      return {
        id: m.id,
        student_id: m.student_id,
        subject_id: m.subject_id,
        exam_id: m.exam_id,
        marks: typeof m.marks === "number" ? m.marks : typeof rawScore === "number" ? rawScore : 0,
        raw_score: rawScore !== void 0 ? rawScore : typeof m.marks === "number" ? m.marks : null,
        out_of: typeof outOf === "number" ? outOf : 100,
        special_status: specialStatus || "Normal",
        irregularity_reason: irregularityReason || void 0,
        entered_by_teacher_id: m.entered_by_teacher_id || void 0,
        updated_at: m.updated_at || void 0
      };
    });
  },
  fetchMarksForExam: async (examId, options) => {
    if (!examId) return getStorage(KEYS.MARKS, []);
    const client = createSupabaseClient();
    if (!client) return getStorage(KEYS.MARKS, []);
    const exams = getStorage(KEYS.EXAMS, []);
    const targetExam = exams.find((e) => e.id === examId || e.exam_code === examId || e.exam_name === examId);
    const examUuid = targetExam && isUUID(targetExam.id) ? targetExam.id : isUUID(examId) ? examId : null;
    const validExamUuids = examUuid ? [examUuid] : Array.from(new Set([examId, targetExam?.id].filter(Boolean))).filter(isUUID);
    if (validExamUuids.length === 0) {
      console.warn("fetchMarksForExam: No valid exam UUID found for:", examId);
      return getStorage(KEYS.MARKS, []);
    }
    let query = client.from("marks").select("*");
    if (validExamUuids.length === 1) {
      query = query.eq("exam_id", validExamUuids[0]);
    } else {
      query = query.in("exam_id", validExamUuids);
    }
    const currentUser = api.getCurrentUser();
    const students = getStorage(KEYS.STUDENTS, []);
    const classes = getStorage(KEYS.CLASSES, []);
    const teachers = getStorage(KEYS.TEACHERS, []);
    const activeTeacher = getActiveTeacher(currentUser, teachers);
    let targetStudentIds = null;
    if (options?.studentIds && options.studentIds.length > 0) {
      targetStudentIds = options.studentIds.filter(isUUID);
    } else if (options?.studentId) {
      const match = students.find((s) => isUUID(options.studentId) ? s.id === options.studentId : s.id === options.studentId || s.admission_number === options.studentId);
      const sUuid = match && isUUID(match.id) ? match.id : isUUID(options.studentId) ? options.studentId : null;
      targetStudentIds = sUuid ? [sUuid] : isUUID(options.studentId) ? [options.studentId] : null;
    } else if (currentUser && currentUser.role === "learner") {
      const stdId = currentUser.student_id;
      const match = students.find((s) => isUUID(stdId) ? s.id === stdId : s.id === stdId || s.admission_number === stdId);
      const sUuid = match && isUUID(match.id) ? match.id : isUUID(stdId) ? stdId : null;
      targetStudentIds = sUuid ? [sUuid] : isUUID(stdId) ? [stdId] : null;
    } else if (options?.classId || options?.streamId) {
      const clsId = options.classId || "all";
      const strmId = options.streamId || "all";
      const filtered = getFilteredStudents(students, classes, clsId, strmId, targetExam);
      targetStudentIds = filtered.map((s) => s.id).filter(isUUID);
    } else if (currentUser && (currentUser.role === "class_teacher" || currentUser.role === "subject_teacher" || currentUser.role === "teacher")) {
      const accStudents = getAccessibleStudents(currentUser, activeTeacher, students, classes);
      targetStudentIds = accStudents.map((s) => s.id).filter(isUUID);
    }
    if (targetStudentIds !== null) {
      if (targetStudentIds.length === 1) {
        query = query.eq("student_id", targetStudentIds[0]);
      } else if (targetStudentIds.length > 1) {
        query = query.in("student_id", targetStudentIds);
      } else {
        query = query.in("student_id", ["00000000-0000-0000-0000-000000000000"]);
      }
    }
    let targetSubjectIds = null;
    if (options?.subjectId) {
      const subjects = getStorage(KEYS.SUBJECTS, []);
      const matchSub = subjects.find((s) => s.id === options.subjectId || s.subject_code === options.subjectId);
      const subUuid = matchSub && isUUID(matchSub.id) ? matchSub.id : isUUID(options.subjectId) ? options.subjectId : null;
      if (subUuid) {
        targetSubjectIds = [subUuid];
        query = query.eq("subject_id", subUuid);
      } else {
        console.warn("fetchMarksForExam: Subject identifier is not a valid UUID:", options.subjectId);
      }
    } else if (currentUser && currentUser.role === "subject_teacher") {
      const subjects = getStorage(KEYS.SUBJECTS, []);
      const accSubjects = getAccessibleSubjects(currentUser, activeTeacher, subjects, options?.classId, classes);
      const accSubjIds = accSubjects.map((s) => s.id).filter(isUUID);
      if (accSubjIds.length > 0) {
        targetSubjectIds = accSubjIds;
        if (accSubjIds.length === 1) {
          query = query.eq("subject_id", accSubjIds[0]);
        } else {
          query = query.in("subject_id", accSubjIds);
        }
      } else {
        targetSubjectIds = ["00000000-0000-0000-0000-000000000000"];
        query = query.eq("subject_id", "00000000-0000-0000-0000-000000000000");
      }
    }
    try {
      const { data: markData, error: markError } = await query;
      if (markError) {
        console.error("Supabase query error in fetchMarksForExam:", markError);
        throw markError;
      }
      if (markData) {
        const mappedMarks = api.mapDatabaseMarks(markData);
        const currentMarks = getStorage(KEYS.MARKS, []);
        const preservedMarks = currentMarks.filter((m) => {
          const matchExam = validExamUuids.includes(m.exam_id);
          if (!matchExam) return true;
          if (targetStudentIds !== null) {
            const matchStudent = targetStudentIds.includes(m.student_id);
            if (!matchStudent) return true;
          }
          if (targetSubjectIds !== null) {
            const matchSubject = targetSubjectIds.includes(m.subject_id);
            if (!matchSubject) return true;
          }
          return false;
        });
        const markMap = /* @__PURE__ */ new Map();
        preservedMarks.forEach((m) => markMap.set(`${m.student_id}_${m.subject_id}_${m.exam_id}`, m));
        mappedMarks.forEach((m) => markMap.set(`${m.student_id}_${m.subject_id}_${m.exam_id}`, m));
        const combinedMarks = Array.from(markMap.values());
        setStorage(KEYS.MARKS, combinedMarks);
        return combinedMarks;
      }
    } catch (err) {
      console.error("Error fetching marks for exam from Supabase:", err);
    }
    return getStorage(KEYS.MARKS, []);
  },
  fetchMarksForLearner: async (studentId, options) => {
    if (!studentId) return getStorage(KEYS.MARKS, []);
    const client = createSupabaseClient();
    if (!client) return getStorage(KEYS.MARKS, []);
    const students = getStorage(KEYS.STUDENTS, []);
    const matchStd = students.find((s) => isUUID(studentId) ? s.id === studentId : s.id === studentId || s.admission_number === studentId);
    const studentUuid = matchStd && isUUID(matchStd.id) ? matchStd.id : isUUID(studentId) ? studentId : null;
    const validStudentUuids = Array.from(
      new Set(
        [
          studentUuid,
          matchStd?.id,
          matchStd?.admission_number,
          studentId
        ].filter(Boolean)
      )
    );
    const matchesLearner = (mStdId) => {
      if (!mStdId) return false;
      const str = String(mStdId).trim().toLowerCase();
      return validStudentUuids.some((vid) => String(vid).trim().toLowerCase() === str);
    };
    if (validStudentUuids.length === 0) {
      console.warn("fetchMarksForLearner: No valid student identifier found for:", studentId);
      return getStorage(KEYS.MARKS, []).filter((m) => m.student_id === studentId);
    }
    const queryStudentUuids = validStudentUuids.filter(isUUID);
    let query = client.from("marks").select("*");
    if (queryStudentUuids.length === 1) {
      query = query.eq("student_id", queryStudentUuids[0]);
    } else if (queryStudentUuids.length > 1) {
      query = query.in("student_id", queryStudentUuids);
    } else {
      query = query.in("student_id", ["00000000-0000-0000-0000-000000000000"]);
    }
    let targetExamUuid = null;
    let validExamUuids = null;
    if (options?.examId) {
      const exams = getStorage(KEYS.EXAMS, []);
      const matchEx = exams.find((e) => e.id === options.examId || e.exam_code === options.examId || e.exam_name === options.examId);
      const exUuid = matchEx && isUUID(matchEx.id) ? matchEx.id : isUUID(options.examId) ? options.examId : null;
      if (exUuid) {
        targetExamUuid = exUuid;
        validExamUuids = [exUuid];
        query = query.eq("exam_id", exUuid);
      } else {
        console.warn("fetchMarksForLearner: Exam identifier is not a valid UUID:", options.examId);
      }
    }
    let targetSubjectUuid = null;
    let validSubjectUuids = null;
    if (options?.subjectId) {
      const subjects = getStorage(KEYS.SUBJECTS, []);
      const matchSub = subjects.find((s) => s.id === options.subjectId || s.subject_code === options.subjectId);
      const subUuid = matchSub && isUUID(matchSub.id) ? matchSub.id : isUUID(options.subjectId) ? options.subjectId : null;
      if (subUuid) {
        targetSubjectUuid = subUuid;
        validSubjectUuids = [subUuid];
        query = query.eq("subject_id", subUuid);
      } else {
        console.warn("fetchMarksForLearner: Subject identifier is not a valid UUID:", options.subjectId);
      }
    } else {
      const currentUser = api.getCurrentUser();
      if (currentUser && currentUser.role === "subject_teacher") {
        const teachers = getStorage(KEYS.TEACHERS, []);
        const activeTeacher = getActiveTeacher(currentUser, teachers);
        const subjects = getStorage(KEYS.SUBJECTS, []);
        const accSubjects = getAccessibleSubjects(currentUser, activeTeacher, subjects);
        const accSubjUuids = accSubjects.map((s) => s.id).filter((id) => Boolean(id && isUUID(id)));
        if (accSubjUuids.length > 0) {
          validSubjectUuids = accSubjUuids;
          if (accSubjUuids.length === 1) {
            query = query.eq("subject_id", accSubjUuids[0]);
          } else {
            query = query.in("subject_id", accSubjUuids);
          }
        } else {
          validSubjectUuids = ["00000000-0000-0000-0000-000000000000"];
          query = query.eq("subject_id", "00000000-0000-0000-0000-000000000000");
        }
      }
    }
    try {
      const { data: markData, error: markError } = await query;
      if (markError) {
        console.error("Supabase query error in fetchMarksForLearner:", markError);
        throw markError;
      }
      if (markData) {
        const mappedMarks = api.mapDatabaseMarks(markData);
        const currentMarks = getStorage(KEYS.MARKS, []);
        const preservedMarks = currentMarks.filter((m) => {
          const matchStudent = matchesLearner(m.student_id);
          if (!matchStudent) return true;
          if (validExamUuids !== null) {
            const matchExam = validExamUuids.includes(m.exam_id);
            if (!matchExam) return true;
          }
          if (validSubjectUuids !== null) {
            const matchSubject = validSubjectUuids.includes(m.subject_id);
            if (!matchSubject) return true;
          }
          return false;
        });
        const markMap = /* @__PURE__ */ new Map();
        preservedMarks.forEach((m) => markMap.set(`${m.student_id}_${m.subject_id}_${m.exam_id}`, m));
        mappedMarks.forEach((m) => markMap.set(`${m.student_id}_${m.subject_id}_${m.exam_id}`, m));
        const combinedMarks = Array.from(markMap.values());
        setStorage(KEYS.MARKS, combinedMarks);
        return mappedMarks;
      }
    } catch (err) {
      console.error("Error fetching marks for learner from Supabase:", err);
    }
    const currentCached = getStorage(KEYS.MARKS, []);
    return currentCached.filter((m) => {
      const isMatchLearner = matchesLearner(m.student_id);
      const isMatchExam = validExamUuids ? validExamUuids.includes(m.exam_id) : true;
      const isMatchSubject = validSubjectUuids ? validSubjectUuids.includes(m.subject_id) : true;
      return isMatchLearner && isMatchExam && isMatchSubject;
    });
  },
  fetchMarksForWorkflow: async (options) => {
    const client = createSupabaseClient();
    if (!client) return getStorage(KEYS.MARKS, []);
    let query = client.from("marks").select("*");
    let hasFilter = false;
    const currentUser = api.getCurrentUser();
    const students = getStorage(KEYS.STUDENTS, []);
    const classes = getStorage(KEYS.CLASSES, []);
    const teachers = getStorage(KEYS.TEACHERS, []);
    const activeTeacher = getActiveTeacher(currentUser, teachers);
    let targetExamUuid = null;
    if (options.examId) {
      const exams = getStorage(KEYS.EXAMS, []);
      const match = exams.find((e) => e.id === options.examId);
      const examUuid = match && isUUID(match.id) ? match.id : isUUID(options.examId) ? options.examId : null;
      if (examUuid) {
        targetExamUuid = examUuid;
        query = query.eq("exam_id", examUuid);
        hasFilter = true;
      } else {
        targetExamUuid = options.examId;
        query = query.eq("exam_id", options.examId);
        hasFilter = true;
      }
    }
    let targetStudentUuids = null;
    if (options.studentId) {
      const match = students.find((s) => s.id === options.studentId);
      const sUuid = match && isUUID(match.id) ? match.id : isUUID(options.studentId) ? options.studentId : null;
      if (sUuid) targetStudentUuids = [sUuid];
    } else if (options.studentIds && options.studentIds.length > 0) {
      targetStudentUuids = options.studentIds.filter((id) => isUUID(id));
    } else if (options.classId || options.streamId) {
      const clsId = options.classId;
      const strmId = options.streamId;
      const clsObj = classes.find((c) => c.id === clsId || c.stream_id === clsId || c.id === strmId || c.stream_id === strmId);
      const filtered = students.filter((s) => {
        if (strmId) return s.stream_id === strmId || s.id === strmId;
        if (clsObj && clsObj.stream_id) return s.stream_id === clsObj.stream_id || s.stream_id === clsObj.id;
        if (clsId) return s.class_id === clsId || s.stream_id === clsId;
        if (clsObj) return s.class_id === clsObj.id;
        return false;
      });
      targetStudentUuids = filtered.map((s) => s.id).filter((id) => isUUID(id));
    } else if (currentUser && currentUser.role !== "admin") {
      const accStudents = getAccessibleStudents(currentUser, activeTeacher, students, classes);
      targetStudentUuids = accStudents.map((s) => s.id).filter((id) => isUUID(id));
    }
    if (targetStudentUuids !== null) {
      if (targetStudentUuids.length > 0) {
        query = query.in("student_id", targetStudentUuids);
        hasFilter = true;
      } else {
        query = query.in("student_id", ["00000000-0000-0000-0000-000000000000"]);
        hasFilter = true;
      }
    }
    let targetSubjectUuid = null;
    let targetSubjectUuids = null;
    if (options.subjectId) {
      const subjects = getStorage(KEYS.SUBJECTS, []);
      const match = subjects.find((s) => s.id === options.subjectId);
      const subjectUuid = match && isUUID(match.id) ? match.id : isUUID(options.subjectId) ? options.subjectId : null;
      if (subjectUuid) {
        targetSubjectUuid = subjectUuid;
        query = query.eq("subject_id", subjectUuid);
        hasFilter = true;
      } else {
        targetSubjectUuid = options.subjectId;
        query = query.eq("subject_id", options.subjectId);
        hasFilter = true;
      }
    } else if (currentUser && currentUser.role === "subject_teacher") {
      const subjects = getStorage(KEYS.SUBJECTS, []);
      const accSubjects = getAccessibleSubjects(currentUser, activeTeacher, subjects, options.classId, classes);
      const accSubjUuids = accSubjects.map((s) => s.id).filter((id) => isUUID(id));
      if (accSubjUuids.length > 0) {
        targetSubjectUuids = accSubjUuids;
        query = query.in("subject_id", accSubjUuids);
        hasFilter = true;
      } else {
        targetSubjectUuids = ["00000000-0000-0000-0000-000000000000"];
        query = query.in("subject_id", ["00000000-0000-0000-0000-000000000000"]);
        hasFilter = true;
      }
    }
    if (!hasFilter) {
      return getStorage(KEYS.MARKS, []);
    }
    try {
      const { data: markData, error: markError } = await query;
      if (!markError && markData) {
        const mappedMarks = api.mapDatabaseMarks(markData);
        const currentMarks = getStorage(KEYS.MARKS, []);
        const preservedMarks = currentMarks.filter((m) => {
          if (targetExamUuid !== null) {
            const matchExam = m.exam_id === targetExamUuid || options.examId && m.exam_id === options.examId;
            if (!matchExam) return true;
          }
          if (targetStudentUuids !== null) {
            const matchStudent = targetStudentUuids.includes(m.student_id) || options.studentId && m.student_id === options.studentId;
            if (!matchStudent) return true;
          }
          if (targetSubjectUuid !== null) {
            const matchSubject = m.subject_id === targetSubjectUuid || options.subjectId && m.subject_id === options.subjectId;
            if (!matchSubject) return true;
          } else if (targetSubjectUuids !== null) {
            const matchSubject = targetSubjectUuids.includes(m.subject_id);
            if (!matchSubject) return true;
          }
          return false;
        });
        const markMap = /* @__PURE__ */ new Map();
        preservedMarks.forEach((m) => markMap.set(`${m.student_id}_${m.subject_id}_${m.exam_id}`, m));
        mappedMarks.forEach((m) => markMap.set(`${m.student_id}_${m.subject_id}_${m.exam_id}`, m));
        const combinedMarks = Array.from(markMap.values());
        setStorage(KEYS.MARKS, combinedMarks);
        return combinedMarks;
      }
    } catch (err) {
      console.warn("Error fetching workflow marks:", err);
    }
    return getStorage(KEYS.MARKS, []);
  },
  getMarks: () => getStorage(KEYS.MARKS, []),
  saveBulkMarks: async (newMarks, currentUser) => {
    const list = getStorage(KEYS.MARKS, []);
    const exams = getStorage(KEYS.EXAMS, []);
    const dbStudentsForLock = getStorage(KEYS.STUDENTS, []);
    const dbClassesForLock = getStorage(KEYS.CLASSES, []);
    for (const m of newMarks) {
      const targetExam = exams.find((e) => e.id === m.exam_id);
      if (targetExam) {
        if (targetExam.status === "Approved") {
          throw new Error(
            `Cannot modify marks for approved examination "${targetExam.exam_name}". Examination is locked.`
          );
        }
        if (targetExam.approved_levels && targetExam.approved_levels.length > 0) {
          const studentObj = dbStudentsForLock.find((s) => s.id === m.student_id);
          const studentClassObj = studentObj ? dbClassesForLock.find((c) => c.id === studentObj.class_id || c.stream_id === studentObj.class_id || c.class_name === studentObj.class_id) : null;
          const eduLevel = studentClassObj?.education_level;
          if (eduLevel && targetExam.approved_levels.includes(eduLevel)) {
            throw new Error(
              `Cannot modify marks for education level "${eduLevel}". This level is officially approved and locked for "${targetExam.exam_name}".`
            );
          }
        }
      }
    }
    const client = getSupabaseClient();
    if (client && newMarks.length > 0) {
      const dbStudents = getStorage(KEYS.STUDENTS, []);
      const dbSubjects = getStorage(KEYS.SUBJECTS, []);
      const dbExams = getStorage(KEYS.EXAMS, []);
      const dbTeachers = getStorage(KEYS.TEACHERS, []);
      const payloads = [];
      for (const m of newMarks) {
        let studentUuid = m.student_id;
        if (!isUUID(studentUuid)) {
          const matchStd = dbStudents.find((s) => s.id === m.student_id || s.admission_number === m.student_id);
          if (matchStd && isUUID(matchStd.id)) {
            studentUuid = matchStd.id;
          }
        }
        let subjectUuid = m.subject_id;
        if (!isUUID(subjectUuid)) {
          try {
            subjectUuid = await resolveSubjectUUID(client, { subject_id: m.subject_id });
          } catch (err) {
            const matchSub = dbSubjects.find((s) => (s.id === m.subject_id || s.subject_code === m.subject_id || s.subject_name === m.subject_id) && isUUID(s.id));
            if (matchSub) {
              subjectUuid = matchSub.id;
            }
          }
        }
        if (isUUID(subjectUuid)) {
          m.subject_id = subjectUuid;
        }
        let examUuid = m.exam_id;
        if (!isUUID(examUuid)) {
          const matchExam = dbExams.find((e) => e.id === m.exam_id || e.exam_name === m.exam_id);
          if (matchExam && isUUID(matchExam.id)) {
            examUuid = matchExam.id;
          }
        }
        let teacherUuid = null;
        const candidateTeacherId = m.entered_by_teacher_id || currentUser?.teacher_id || currentUser?.id;
        if (candidateTeacherId) {
          const matchTch = dbTeachers.find(
            (t) => t.id === candidateTeacherId || t.user_id === candidateTeacherId || t.tsc_number === candidateTeacherId || t.email && currentUser?.email && t.email.toLowerCase() === currentUser.email.toLowerCase()
          );
          if (matchTch && isUUID(matchTch.id)) {
            teacherUuid = matchTch.id;
          } else if (isUUID(candidateTeacherId) && dbTeachers.some((t) => t.id === candidateTeacherId)) {
            teacherUuid = candidateTeacherId;
          }
          if (!teacherUuid && client) {
            try {
              let query = client.from("teachers").select("id");
              if (isUUID(candidateTeacherId)) {
                query = query.or(`id.eq.${candidateTeacherId},user_id.eq.${candidateTeacherId}`);
              } else {
                query = query.or(`tsc_number.eq.${candidateTeacherId},id.eq.${candidateTeacherId}`);
              }
              const { data: dbTchData } = await query.limit(1);
              if (dbTchData && dbTchData.length > 0 && isUUID(dbTchData[0].id)) {
                teacherUuid = dbTchData[0].id;
              }
            } catch (err) {
            }
          }
        }
        if (isUUID(studentUuid) && isUUID(subjectUuid) && isUUID(examUuid)) {
          const remarksObj = {
            raw_score: typeof m.raw_score === "number" && !isNaN(m.raw_score) ? m.raw_score : typeof m.marks === "number" ? m.marks : null,
            out_of: typeof m.out_of === "number" ? m.out_of : 100,
            special_status: m.special_status || "Normal",
            irregularity_reason: m.irregularity_reason || null,
            entered_by_teacher_id: candidateTeacherId || null
          };
          const payload = {
            student_id: studentUuid,
            subject_id: subjectUuid,
            exam_id: examUuid,
            marks: typeof m.marks === "number" && !isNaN(m.marks) ? m.marks : 0,
            entered_by_teacher_id: teacherUuid,
            remarks: JSON.stringify(remarksObj),
            updated_at: m.updated_at || (/* @__PURE__ */ new Date()).toISOString()
          };
          if (isUUID(m.id)) {
            payload.id = m.id;
          }
          payloads.push(payload);
        } else {
          const unresolvable = !isUUID(studentUuid) ? `student "${m.student_id}"` : !isUUID(subjectUuid) ? `learning area "${m.subject_id}"` : `examination "${m.exam_id}"`;
          throw new Error(`Failed to save mark: Unresolvable database UUID for ${unresolvable}. Database write aborted.`);
        }
      }
      if (payloads.length > 0) {
        const { error } = await client.from("marks").upsert(payloads, { onConflict: "student_id,subject_id,exam_id" });
        if (error) {
          if (error.code === "42P01" || error.code === "23502" || error.code === "23503" || error.code === "PGRST204" || error.code === "23505") {
            console.warn("Supabase saveBulkMarks DB insert warning:", error.message);
          } else {
            console.error("Supabase saveBulkMarks error:", error);
            throw new Error(`Failed to save marks in database: ${error.message}`);
          }
        }
      }
    }
    const map = /* @__PURE__ */ new Map();
    list.forEach((m) => {
      const key = `${m.student_id}_${m.subject_id}_${m.exam_id}`;
      map.set(key, m);
    });
    newMarks.forEach((m) => {
      const key = `${m.student_id}_${m.subject_id}_${m.exam_id}`;
      map.set(key, m);
    });
    setStorage(KEYS.MARKS, Array.from(map.values()));
  },
  // --- GRADES ---
  getGrades: () => getStorage(KEYS.GRADES, initialGrades),
  updateGrades: async (grades) => {
    setStorage(KEYS.GRADES, grades);
    const client = getSupabaseClient();
    if (client) {
      try {
        const payloads = grades.map((g) => ({
          id: g.id || `gr_${(g.grade_code || g.grade || "x").toLowerCase()}`,
          grade_code: g.grade_code || g.grade || "",
          performance_level: g.performance_level || "ME",
          minimum_score: typeof g.minimum_score === "number" ? g.minimum_score : g.minimum_marks ?? 0,
          maximum_score: typeof g.maximum_score === "number" ? g.maximum_score : g.maximum_marks ?? 100,
          minimum_marks: typeof g.minimum_marks === "number" ? g.minimum_marks : g.minimum_score ?? 0,
          maximum_marks: typeof g.maximum_marks === "number" ? g.maximum_marks : g.maximum_score ?? 100,
          points: typeof g.points === "number" ? g.points : 0,
          descriptor: g.descriptor || "",
          remarks: g.remarks || "",
          grade: g.grade || g.grade_code || "",
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        }));
        const { error } = await client.from("cbe_grades").upsert(payloads, { onConflict: "id" });
        if (error) {
          if (error.code === "42P01" || error.code === "PGRST205") {
            console.warn("cbe_grades table missing in database. Local memory updated.");
          } else if (error.message?.includes("updated_at") || error.code === "PGRST204" || error.code === "42703") {
            const payloadsNoTime = payloads.map(({ updated_at, ...rest }) => rest);
            const { error: err2 } = await client.from("cbe_grades").upsert(payloadsNoTime, { onConflict: "id" });
            if (err2 && err2.code !== "42P01" && err2.code !== "PGRST205") {
              console.warn("cbe_grades table upsert retry warning:", err2);
            }
          } else {
            console.error("Supabase error updating cbe_grades:", error);
            throw new Error(`Failed to update grading boundaries in database: ${error.message}`);
          }
        }
      } catch (err) {
        console.error("Error updating grades in Supabase:", err);
        throw err;
      }
    }
    return grades;
  },
  // --- VERIFICATION LOGS ---
  getVerificationLogs: (examId) => {
    const logs = getStorage(KEYS.VERIFICATIONS, []);
    if (examId) {
      return logs.filter((l) => l.exam_id === examId);
    }
    return logs;
  },
  addVerificationLog: (log) => {
    const logs = getStorage(KEYS.VERIFICATIONS, []);
    const updated = [log, ...logs];
    setStorage(KEYS.VERIFICATIONS, updated);
    return log;
  },
  // --- ACADEMIC YEARS & TERMS ---
  getAcademicYears: () => getStorage(KEYS.ACADEMIC_YEARS, initialAcademicYears),
  addAcademicYear: async (ay) => {
    const client = createSupabaseClient();
    const ayUuid = isUUID(ay.id) ? ay.id : generateUUID();
    const startDate = ay.start_date || `${ay.year}-01-01`;
    const endDate = ay.end_date || `${ay.year}-12-31`;
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const finalAy = {
      ...ay,
      id: ayUuid,
      year: Number(ay.year),
      status: ay.status || "Upcoming",
      start_date: startDate,
      end_date: endDate,
      created_at: ay.created_at || nowIso,
      updated_at: ay.updated_at || nowIso
    };
    if (client) {
      if (finalAy.status === "Active") {
        const { error: deactErr } = await client.from("academic_years").update({ status: "Closed", updated_at: nowIso }).eq("status", "Active");
        if (deactErr && deactErr.code !== "42P01" && deactErr.code !== "PGRST205") {
          console.error("Supabase error deactivating current active year:", deactErr);
          throw new Error(`Failed to update active academic year: ${deactErr.message}`);
        }
      }
      const payload = {
        id: finalAy.id,
        year: finalAy.year,
        status: finalAy.status,
        start_date: finalAy.start_date,
        end_date: finalAy.end_date
      };
      const { data, error } = await client.from("academic_years").insert([payload]).select().maybeSingle();
      if (error) {
        console.error("Supabase error inserting academic year:", error);
        if (error.code === "23505") {
          throw new Error(`Academic Year ${finalAy.year} already exists in database.`);
        }
        if (error.code !== "42P01" && error.code !== "PGRST205") {
          throw new Error(`Failed to save Academic Year in database: ${error.message}`);
        }
      } else if (data && isUUID(data.id)) {
        finalAy.id = data.id;
        finalAy.created_at = data.created_at || finalAy.created_at;
        finalAy.updated_at = data.updated_at || finalAy.updated_at;
      }
    }
    const list = getStorage(KEYS.ACADEMIC_YEARS, initialAcademicYears);
    let updatedList = list.filter((y) => y.id !== finalAy.id && y.year !== finalAy.year);
    if (finalAy.status === "Active") {
      updatedList = updatedList.map((y) => ({
        ...y,
        status: y.status === "Active" ? "Closed" : y.status
      }));
    }
    const updated = [...updatedList, finalAy];
    setStorage(KEYS.ACADEMIC_YEARS, updated);
    return finalAy;
  },
  updateAcademicYear: async (ay) => {
    const client = createSupabaseClient();
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    let targetId = ay.id;
    if (!isUUID(targetId)) {
      const list2 = getStorage(KEYS.ACADEMIC_YEARS, initialAcademicYears);
      const matched = list2.find((y) => y.id === ay.id || y.year === ay.year);
      if (matched && isUUID(matched.id)) {
        targetId = matched.id;
      }
    }
    if (client) {
      if (!isUUID(targetId)) {
        throw new Error(`Cannot update academic year: Invalid database ID for year ${ay.year}`);
      }
      if (ay.status === "Active") {
        const { error: deactErr } = await client.from("academic_years").update({ status: "Closed", updated_at: nowIso }).eq("status", "Active").neq("id", targetId);
        if (deactErr && deactErr.code !== "42P01" && deactErr.code !== "PGRST205") {
          console.error("Supabase error updating active years:", deactErr);
          throw new Error(`Failed to update active academic year: ${deactErr.message}`);
        }
      }
      const payload = {
        year: ay.year,
        status: ay.status,
        start_date: ay.start_date || `${ay.year}-01-01`,
        end_date: ay.end_date || `${ay.year}-12-31`,
        updated_at: nowIso
      };
      const { data, error } = await client.from("academic_years").update(payload).eq("id", targetId).select().maybeSingle();
      if (error && error.code !== "42P01" && error.code !== "PGRST205") {
        console.error("Supabase error updating academic year:", error);
        throw new Error(`Failed to update Academic Year in database: ${error.message}`);
      }
    }
    const finalAy = {
      ...ay,
      id: targetId,
      updated_at: nowIso
    };
    const list = getStorage(KEYS.ACADEMIC_YEARS, initialAcademicYears);
    const updated = list.map((y) => {
      if (y.id === targetId || y.id === ay.id || y.year === ay.year) {
        return finalAy;
      }
      if (finalAy.status === "Active" && y.status === "Active") {
        return { ...y, status: "Closed" };
      }
      return y;
    });
    setStorage(KEYS.ACADEMIC_YEARS, updated);
    return finalAy;
  },
  setActiveAcademicYear: async (id) => {
    const list = getStorage(KEYS.ACADEMIC_YEARS, initialAcademicYears);
    let target = list.find((y) => y.id === id || y.year.toString() === id);
    const client = createSupabaseClient();
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    let targetUuid = target && isUUID(target.id) ? target.id : isUUID(id) ? id : null;
    if (!targetUuid && client && target) {
      const { data: dbY } = await client.from("academic_years").select("id").eq("year", target.year).maybeSingle();
      if (dbY && isUUID(dbY.id)) {
        targetUuid = dbY.id;
      }
    }
    if (client) {
      if (!targetUuid || !isUUID(targetUuid)) {
        throw new Error(`Cannot activate academic year: Unresolvable database UUID for "${id}"`);
      }
      const { error: closeErr } = await client.from("academic_years").update({ status: "Closed", updated_at: nowIso }).eq("status", "Active").neq("id", targetUuid);
      if (closeErr && closeErr.code !== "42P01" && closeErr.code !== "PGRST205") {
        console.error("Supabase error closing active academic years:", closeErr);
        throw new Error(`Failed to deactivate current academic year: ${closeErr.message}`);
      }
      const { error: actErr } = await client.from("academic_years").update({ status: "Active", updated_at: nowIso }).eq("id", targetUuid);
      if (actErr && actErr.code !== "42P01" && actErr.code !== "PGRST205") {
        console.error("Supabase error activating academic year:", actErr);
        throw new Error(`Failed to set Active Academic Year in database: ${actErr.message}`);
      }
    }
    let targetYear = target ? { ...target, id: targetUuid || target.id, status: "Active", updated_at: nowIso } : list[0];
    const updated = list.map((y) => {
      if (y.id === id || y.id === targetUuid || target && y.year === target.year) {
        targetYear = { ...y, id: targetUuid || y.id, status: "Active", updated_at: nowIso };
        return targetYear;
      }
      return { ...y, status: y.status === "Active" ? "Closed" : y.status };
    });
    setStorage(KEYS.ACADEMIC_YEARS, updated);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("session-changed", { detail: { yearId: targetYear.id, year: targetYear.year } }));
    }
    return targetYear;
  },
  getActiveAcademicYear: () => {
    const years = getStorage(KEYS.ACADEMIC_YEARS, initialAcademicYears);
    const active = years.find((y) => y.status === "Active");
    return active || years.find((y) => y.year === 2026) || years[0] || initialAcademicYears[1];
  },
  // --- SCHOOL TERMS ---
  getSchoolTerms: (academicYearId) => {
    const terms = getStorage(KEYS.SCHOOL_TERMS, initialTerms);
    if (academicYearId) {
      return terms.filter((t) => t.academic_year_id === academicYearId || t.year.toString() === academicYearId);
    }
    return terms;
  },
  addSchoolTerm: async (term) => {
    const client = createSupabaseClient();
    const termUuid = isUUID(term.id) ? term.id : generateUUID();
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    let ayId = isUUID(term.academic_year_id) ? term.academic_year_id : null;
    if (!ayId) {
      const years = api.getAcademicYears();
      const matchedYear = years.find((y) => y.id === term.academic_year_id || y.year === term.year);
      if (matchedYear && isUUID(matchedYear.id)) {
        ayId = matchedYear.id;
      }
    }
    if (!ayId && client) {
      const { data: dbYear } = await client.from("academic_years").select("id").eq("year", term.year).maybeSingle();
      if (dbYear && isUUID(dbYear.id)) {
        ayId = dbYear.id;
      }
    }
    if (client) {
      if (!ayId || !isUUID(ayId)) {
        throw new Error(`Failed to create school term in database: Unresolvable Academic Year UUID for Year ${term.year}`);
      }
      if (term.status === "Active") {
        const { error: closeErr } = await client.from("school_terms").update({ status: "Closed", updated_at: nowIso }).eq("academic_year_id", ayId).eq("status", "Active");
        if (closeErr && closeErr.code !== "42P01" && closeErr.code !== "PGRST205") {
          console.error("Supabase error deactivating active term in year:", closeErr);
          throw new Error(`Failed to update active term in database: ${closeErr.message}`);
        }
      }
      const termNumber = term.term_number || (term.term_name === "Term 1" ? 1 : term.term_name === "Term 2" ? 2 : 3);
      const payload = {
        id: termUuid,
        academic_year_id: ayId,
        year: term.year,
        term_name: term.term_name,
        term_number: termNumber,
        status: term.status || "Upcoming",
        opening_date: term.opening_date,
        closing_date: term.closing_date,
        mid_term_opening_date: term.mid_term_opening_date || null,
        mid_term_closing_date: term.mid_term_closing_date || null
      };
      const { data, error } = await client.from("school_terms").insert([payload]).select().maybeSingle();
      if (error) {
        console.error("Supabase error inserting school term:", error);
        if (error.code === "23505") {
          throw new Error(`${term.term_name} already exists for academic year ${term.year}.`);
        }
        if (error.code !== "42P01" && error.code !== "PGRST205") {
          throw new Error(`Failed to save School Term in database: ${error.message}`);
        }
      } else if (data && isUUID(data.id)) {
        payload.id = data.id;
      }
    }
    const finalTerm = {
      ...term,
      id: termUuid,
      academic_year_id: ayId || term.academic_year_id,
      created_at: term.created_at || nowIso,
      updated_at: term.updated_at || nowIso
    };
    const list = getStorage(KEYS.SCHOOL_TERMS, initialTerms);
    let updatedList = list.filter((t) => t.id !== finalTerm.id);
    if (finalTerm.status === "Active") {
      updatedList = updatedList.map(
        (t) => t.academic_year_id === finalTerm.academic_year_id && t.status === "Active" ? { ...t, status: "Closed" } : t
      );
    }
    const updated = [...updatedList, finalTerm];
    setStorage(KEYS.SCHOOL_TERMS, updated);
    return finalTerm;
  },
  updateSchoolTerm: async (term) => {
    const client = createSupabaseClient();
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    let targetTermId = term.id;
    let ayId = isUUID(term.academic_year_id) ? term.academic_year_id : null;
    if (!ayId) {
      const years = api.getAcademicYears();
      const matchedYear = years.find((y) => y.id === term.academic_year_id || y.year === term.year);
      if (matchedYear && isUUID(matchedYear.id)) {
        ayId = matchedYear.id;
      }
    }
    if (client) {
      if (!isUUID(targetTermId)) {
        let query = client.from("school_terms").select("id, academic_year_id");
        if (ayId) query = query.eq("academic_year_id", ayId);
        else query = query.eq("year", term.year);
        query = query.eq("term_name", term.term_name);
        const { data: dbTerm } = await query.maybeSingle();
        if (dbTerm && isUUID(dbTerm.id)) {
          targetTermId = dbTerm.id;
          if (!ayId && isUUID(dbTerm.academic_year_id)) {
            ayId = dbTerm.academic_year_id;
          }
        }
      }
      if (!isUUID(targetTermId)) {
        throw new Error(`Cannot update school term: Unresolvable database ID for ${term.term_name} (${term.year})`);
      }
      if (term.status === "Active" && ayId) {
        const { error: closeErr } = await client.from("school_terms").update({ status: "Closed", updated_at: nowIso }).eq("academic_year_id", ayId).eq("status", "Active").neq("id", targetTermId);
        if (closeErr && closeErr.code !== "42P01" && closeErr.code !== "PGRST205") {
          console.error("Supabase error closing active terms in year:", closeErr);
          throw new Error(`Failed to update active term in database: ${closeErr.message}`);
        }
      }
      const termNumber = term.term_number || (term.term_name === "Term 1" ? 1 : term.term_name === "Term 2" ? 2 : 3);
      const payload = {
        term_name: term.term_name,
        term_number: termNumber,
        status: term.status,
        opening_date: term.opening_date,
        closing_date: term.closing_date,
        mid_term_opening_date: term.mid_term_opening_date || null,
        mid_term_closing_date: term.mid_term_closing_date || null,
        updated_at: nowIso
      };
      if (ayId) {
        payload.academic_year_id = ayId;
        payload.year = term.year;
      }
      const { error } = await client.from("school_terms").update(payload).eq("id", targetTermId);
      if (error && error.code !== "42P01" && error.code !== "PGRST205") {
        console.error("Supabase error updating school term:", error);
        throw new Error(`Failed to update School Term in database: ${error.message}`);
      }
    }
    const finalTerm = {
      ...term,
      id: targetTermId,
      academic_year_id: ayId || term.academic_year_id,
      updated_at: nowIso
    };
    const list = getStorage(KEYS.SCHOOL_TERMS, initialTerms);
    const updated = list.map((t) => {
      if (t.id === targetTermId || t.id === term.id || t.academic_year_id === finalTerm.academic_year_id && t.term_name === finalTerm.term_name) {
        return finalTerm;
      }
      if (finalTerm.status === "Active" && t.academic_year_id === finalTerm.academic_year_id && t.status === "Active") {
        return { ...t, status: "Closed" };
      }
      return t;
    });
    setStorage(KEYS.SCHOOL_TERMS, updated);
    return finalTerm;
  },
  setActiveTerm: async (termId) => {
    const list = getStorage(KEYS.SCHOOL_TERMS, initialTerms);
    let target = list.find((t) => t.id === termId);
    const client = createSupabaseClient();
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    let targetUuid = target && isUUID(target.id) ? target.id : isUUID(termId) ? termId : null;
    let ayId = target?.academic_year_id;
    if (client) {
      if (!targetUuid && target) {
        const { data: dbTerm } = await client.from("school_terms").select("id, academic_year_id").eq("year", target.year).eq("term_name", target.term_name).maybeSingle();
        if (dbTerm && isUUID(dbTerm.id)) {
          targetUuid = dbTerm.id;
          ayId = dbTerm.academic_year_id;
        }
      }
      if (!targetUuid || !isUUID(targetUuid)) {
        throw new Error(`Cannot activate school term: Unresolvable database UUID for "${termId}"`);
      }
      if (!ayId) {
        const { data: dbTerm } = await client.from("school_terms").select("academic_year_id").eq("id", targetUuid).maybeSingle();
        if (dbTerm && isUUID(dbTerm.academic_year_id)) {
          ayId = dbTerm.academic_year_id;
        }
      }
      if (ayId) {
        const { error: closeErr } = await client.from("school_terms").update({ status: "Closed", updated_at: nowIso }).eq("academic_year_id", ayId).eq("status", "Active").neq("id", targetUuid);
        if (closeErr && closeErr.code !== "42P01" && closeErr.code !== "PGRST205") {
          console.error("Supabase error closing active terms in year:", closeErr);
          throw new Error(`Failed to deactivate active terms: ${closeErr.message}`);
        }
      }
      const { error: actErr } = await client.from("school_terms").update({ status: "Active", updated_at: nowIso }).eq("id", targetUuid);
      if (actErr && actErr.code !== "42P01" && actErr.code !== "PGRST205") {
        console.error("Supabase error activating school term:", actErr);
        throw new Error(`Failed to set Active Term in database: ${actErr.message}`);
      }
    }
    let activeTerm = target ? { ...target, id: targetUuid || target.id, status: "Active", updated_at: nowIso } : list[0];
    const updated = list.map((t) => {
      if (t.id === termId || t.id === targetUuid) {
        activeTerm = { ...t, id: targetUuid || t.id, status: "Active", updated_at: nowIso };
        return activeTerm;
      }
      if (ayId && (t.academic_year_id === ayId || target && t.academic_year_id === target.academic_year_id) && t.status === "Active") {
        return { ...t, status: "Closed" };
      }
      return t;
    });
    setStorage(KEYS.SCHOOL_TERMS, updated);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("session-changed", { detail: { termId: activeTerm.id, termName: activeTerm.term_name } }));
    }
    return activeTerm;
  },
  getActiveTerm: () => {
    const activeYear = api.getActiveAcademicYear();
    const terms = getStorage(KEYS.SCHOOL_TERMS, initialTerms);
    const activeTerm = terms.find((t) => t.academic_year_id === activeYear.id && t.status === "Active") || terms.find((t) => t.year === activeYear.year && t.status === "Active") || terms.find((t) => t.status === "Active") || terms.find((t) => t.term_name === "Term 2") || terms[0];
    return activeTerm;
  },
  checkAcademicYearCanBeDeletedSync: (id) => {
    const years = getStorage(KEYS.ACADEMIC_YEARS, initialAcademicYears);
    const targetYear = years.find((y) => y.id === id);
    if (!targetYear || targetYear.status === "Active") return false;
    const terms = getStorage(KEYS.SCHOOL_TERMS, initialTerms);
    const linkedTerms = terms.filter((t) => t.academic_year_id === id || t.year === targetYear.year);
    if (linkedTerms.length > 0) return false;
    const exams = getStorage(KEYS.EXAMS, []);
    const linkedExams = exams.filter((e) => e.academic_year_id === id || e.year === targetYear.year);
    if (linkedExams.length > 0) return false;
    const students = getStorage(KEYS.STUDENTS, []);
    const hasStudentPromo = students.some(
      (s) => s.promotion_history?.some(
        (p) => p.academic_year_id === id || p.from_year === targetYear.year || p.to_year === targetYear.year
      )
    );
    if (hasStudentPromo) return false;
    return true;
  },
  checkAcademicYearCanBeDeleted: async (id) => {
    const years = getStorage(KEYS.ACADEMIC_YEARS, initialAcademicYears);
    const targetYear = years.find((y) => y.id === id);
    if (!targetYear) {
      return { canDelete: false, reason: "Academic year record not found." };
    }
    if (targetYear.status === "Active") {
      return { canDelete: false, reason: "This academic year is currently ACTIVE and cannot be deleted." };
    }
    const terms = getStorage(KEYS.SCHOOL_TERMS, initialTerms);
    const linkedTerms = terms.filter((t) => t.academic_year_id === id || t.year === targetYear.year);
    if (linkedTerms.length > 0) {
      return { canDelete: false, reason: "This academic year contains school terms and cannot be deleted." };
    }
    const exams = getStorage(KEYS.EXAMS, []);
    const linkedExams = exams.filter((e) => e.academic_year_id === id || e.year === targetYear.year);
    if (linkedExams.length > 0) {
      return { canDelete: false, reason: "This academic year contains academic records and cannot be deleted." };
    }
    const students = getStorage(KEYS.STUDENTS, []);
    const hasStudentPromo = students.some(
      (s) => s.promotion_history?.some(
        (p) => p.academic_year_id === id || p.from_year === targetYear.year || p.to_year === targetYear.year
      )
    );
    if (hasStudentPromo) {
      return { canDelete: false, reason: "This academic year contains academic records and cannot be deleted." };
    }
    const client = createSupabaseClient();
    if (client) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(id)) {
        try {
          const { data: dbExams, error: exErr } = await client.from("examinations").select("id").or(`academic_year_id.eq.${id},year.eq.${targetYear.year}`).limit(1);
          if (!exErr && dbExams && dbExams.length > 0) {
            return { canDelete: false, reason: "This academic year contains academic records and cannot be deleted." };
          }
        } catch (err) {
          console.warn("Supabase check error for academic year:", err);
        }
      }
    }
    return { canDelete: true };
  },
  deleteAcademicYear: async (id) => {
    const check = await api.checkAcademicYearCanBeDeleted(id);
    if (!check.canDelete) {
      return { success: false, message: check.reason || "This academic year contains academic records and cannot be deleted." };
    }
    const years = getStorage(KEYS.ACADEMIC_YEARS, initialAcademicYears);
    const targetYear = years.find((y) => y.id === id);
    if (!targetYear) {
      return { success: false, message: "Academic year record not found." };
    }
    const client = createSupabaseClient();
    if (client) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(id)) {
        try {
          const { error } = await client.from("academic_years").delete().eq("id", id);
          if (error && error.code !== "42P01" && error.code !== "22P02" && error.code !== "PGRST205") {
            console.error("Database error deleting academic year:", error);
            return { success: false, message: `Database error deleting academic year: ${error.message}` };
          }
        } catch (err) {
          console.warn("Supabase delete academic year error:", err);
        }
      }
    }
    const updated = years.filter((y) => y.id !== id);
    setStorage(KEYS.ACADEMIC_YEARS, updated);
    return { success: true, message: `Academic Year ${targetYear.year} deleted successfully.` };
  },
  checkSchoolTermCanBeDeletedSync: (id) => {
    const terms = getStorage(KEYS.SCHOOL_TERMS, initialTerms);
    const targetTerm = terms.find((t) => t.id === id);
    if (!targetTerm || targetTerm.status === "Active" || targetTerm.status === "Archived") return false;
    const exams = getStorage(KEYS.EXAMS, []);
    const linkedExams = exams.filter(
      (e) => e.term_id === id || e.term === targetTerm.term_name && (e.academic_year_id === targetTerm.academic_year_id || e.year === targetTerm.year)
    );
    if (linkedExams.length > 0) return false;
    const students = getStorage(KEYS.STUDENTS, []);
    const hasStudentPromo = students.some(
      (s) => s.promotion_history?.some(
        (p) => p.from_term === targetTerm.term_name && p.from_year === targetTerm.year || p.to_term === targetTerm.term_name && p.to_year === targetTerm.year
      )
    );
    if (hasStudentPromo) return false;
    return true;
  },
  checkSchoolTermCanBeDeleted: async (id) => {
    const terms = getStorage(KEYS.SCHOOL_TERMS, initialTerms);
    const targetTerm = terms.find((t) => t.id === id);
    if (!targetTerm) {
      return { canDelete: false, reason: "Term record not found." };
    }
    if (targetTerm.status === "Active") {
      return { canDelete: false, reason: "This term is currently ACTIVE and cannot be deleted." };
    }
    if (targetTerm.status === "Archived") {
      return { canDelete: false, reason: "Archived terms cannot be directly deleted." };
    }
    const exams = getStorage(KEYS.EXAMS, []);
    const linkedExams = exams.filter(
      (e) => e.term_id === id || e.term === targetTerm.term_name && (e.academic_year_id === targetTerm.academic_year_id || e.year === targetTerm.year)
    );
    if (linkedExams.length > 0) {
      return { canDelete: false, reason: "This term contains academic records and cannot be deleted." };
    }
    const students = getStorage(KEYS.STUDENTS, []);
    const hasStudentPromo = students.some(
      (s) => s.promotion_history?.some(
        (p) => p.from_term === targetTerm.term_name && p.from_year === targetTerm.year || p.to_term === targetTerm.term_name && p.to_year === targetTerm.year
      )
    );
    if (hasStudentPromo) {
      return { canDelete: false, reason: "This term contains academic records and cannot be deleted." };
    }
    const client = createSupabaseClient();
    if (client) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(id)) {
        try {
          const { data: dbExams, error: exErr } = await client.from("examinations").select("id").eq("term_id", id).limit(1);
          if (!exErr && dbExams && dbExams.length > 0) {
            return { canDelete: false, reason: "This term contains academic records and cannot be deleted." };
          }
        } catch (err) {
          console.warn("Supabase check error for term:", err);
        }
      }
    }
    return { canDelete: true };
  },
  deleteSchoolTerm: async (id) => {
    const check = await api.checkSchoolTermCanBeDeleted(id);
    if (!check.canDelete) {
      return { success: false, message: check.reason || "This term contains academic records and cannot be deleted." };
    }
    const terms = getStorage(KEYS.SCHOOL_TERMS, initialTerms);
    const targetTerm = terms.find((t) => t.id === id);
    if (!targetTerm) {
      return { success: false, message: "Term record not found." };
    }
    const client = createSupabaseClient();
    if (client) {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(id)) {
        try {
          const { error } = await client.from("school_terms").delete().eq("id", id);
          if (error && error.code !== "42P01" && error.code !== "22P02" && error.code !== "PGRST205") {
            console.error("Database error deleting school term:", error);
            return { success: false, message: `Database error deleting school term: ${error.message}` };
          }
        } catch (err) {
          console.warn("Supabase delete school term error:", err);
        }
      }
    }
    const updated = terms.filter((t) => t.id !== id);
    setStorage(KEYS.SCHOOL_TERMS, updated);
    return { success: true, message: `${targetTerm.term_name} (${targetTerm.year}) deleted successfully.` };
  },
  // --- AUTHORITATIVE COHORT RANKING FOR LEARNER PORTAL ---
  fetchLearnerExamRanking: async (examId) => {
    if (!examId) return null;
    try {
      const client = createSupabaseClient();
      let token = void 0;
      if (client) {
        const { data: sessionData } = await client.auth.getSession();
        token = sessionData?.session?.access_token;
      }
      if (!token) {
        const authUser = getStorage(KEYS.CURRENT_USER, null);
        token = authUser?.token;
      }
      const headers = { "Content-Type": "application/json" };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const url = buildApiUrl(`/api/learner/exam-ranking?exam_id=${encodeURIComponent(examId)}${token ? `&token=${encodeURIComponent(token)}` : ""}`);
      const res = await fetch(url, {
        method: "GET",
        headers
      });
      if (!res.ok) {
        return null;
      }
      const json = await res.json();
      if (json && typeof json === "object" && !json.error) {
        return json;
      }
      return null;
    } catch (e) {
      console.warn("Could not fetch learner exam ranking:", e);
      return null;
    }
  },
  // --- REALTIME & CONNECTIVITY API (Stage 8A, 8D & Priority 2) ---
  subscribeToMarksRealtime: (callback) => subscribeToMarksRealtime(callback),
  unsubscribeFromMarksRealtime: (callback) => unsubscribeFromMarksRealtime(callback),
  reconcileMarksOnReconnect: () => reconcileMarksOnReconnect(),
  getConnectionStatus: () => getConnectionStatus(),
  setConnectionStatus: (status) => setConnectionStatus(status),
  subscribeToConnectionStatus: (listener) => subscribeToConnectionStatus(listener),
  // --- RESET ALL DATA ---
  resetToDefaultSeed: () => {
    Object.keys(memoryStorage).forEach((key) => delete memoryStorage[key]);
    initDatabase();
  }
};

// src/utils/markUtils.ts
function evaluateMark(mark) {
  if (!mark) {
    return {
      status: "Blank",
      percentage: null,
      rawScore: null,
      outOf: 100,
      displayScore: "",
      displayPercentage: "",
      displayStatus: "Blank"
    };
  }
  const rawMarkStr = typeof mark.marks === "string" ? mark.marks.trim().toUpperCase() : "";
  if (mark.special_status === "X" || rawMarkStr === "X") {
    return {
      status: "X",
      percentage: null,
      rawScore: null,
      outOf: mark.out_of || 100,
      displayScore: "X",
      displayPercentage: "X",
      displayStatus: "X (Missing Mark)"
    };
  }
  if (mark.special_status === "Y" || rawMarkStr === "Y") {
    const reason = mark.irregularity_reason || "Absent";
    return {
      status: "Y",
      percentage: null,
      rawScore: null,
      outOf: mark.out_of || 100,
      irregularityReason: reason,
      displayScore: "Y",
      displayPercentage: "Y",
      displayStatus: `Y (${reason})`
    };
  }
  if (mark.special_status === "Blank" || rawMarkStr === "BLANK" || rawMarkStr === "-") {
    return {
      status: "Blank",
      percentage: null,
      rawScore: null,
      outOf: mark.out_of || 100,
      displayScore: "",
      displayPercentage: "",
      displayStatus: "Blank"
    };
  }
  const numRaw = typeof mark.raw_score === "number" && !isNaN(mark.raw_score) ? mark.raw_score : typeof mark.score === "number" && !isNaN(mark.score) ? mark.score : typeof mark.raw_score === "string" && mark.raw_score.trim() !== "" && !isNaN(Number(mark.raw_score)) ? Number(mark.raw_score) : typeof mark.score === "string" && mark.score.trim() !== "" && !isNaN(Number(mark.score)) ? Number(mark.score) : NaN;
  const numMarks = typeof mark.marks === "number" && !isNaN(mark.marks) ? mark.marks : typeof mark.marks === "string" && mark.marks.trim() !== "" && !isNaN(Number(mark.marks)) ? Number(mark.marks) : typeof mark.percentage === "number" && !isNaN(mark.percentage) ? mark.percentage : NaN;
  const hasRawScore = !isNaN(numRaw);
  const hasMarks = !isNaN(numMarks);
  if (hasRawScore || hasMarks) {
    const outOf = mark.out_of && mark.out_of > 0 ? mark.out_of : 100;
    const rawScore = hasRawScore ? numRaw : numMarks;
    const percentage = outOf > 0 ? rawScore / outOf * 100 : rawScore;
    const clampedPct = Math.min(100, Math.max(0, percentage));
    return {
      status: "Normal",
      percentage: clampedPct,
      rawScore,
      outOf,
      displayScore: outOf !== 100 ? `${rawScore}/${outOf}` : formatPercentage(clampedPct),
      displayPercentage: formatPercentage(clampedPct, true),
      displayStatus: "Normal"
    };
  }
  return {
    status: "Blank",
    percentage: null,
    rawScore: null,
    outOf: 100,
    displayScore: "",
    displayPercentage: "",
    displayStatus: "Blank"
  };
}
function roundPercentage(val) {
  if (val === null || val === void 0 || val === "") return null;
  const num = typeof val === "number" ? val : parseFloat(String(val));
  if (isNaN(num)) return null;
  return Math.round(num);
}
function formatPercentage(val, includeSymbol = false, fallback = "-") {
  if (val === null || val === void 0 || val === "") return fallback;
  const num = typeof val === "number" ? val : parseFloat(String(val));
  if (isNaN(num)) return String(val);
  const rounded = roundPercentage(num);
  if (rounded === null) return fallback;
  const str = String(rounded);
  return includeSymbol ? `${str}%` : str;
}

// src/services/analysisEngine.ts
function isStudentEligibleForExam(student, examination, studentMarksForExam = []) {
  if (!student) return false;
  if (studentMarksForExam && studentMarksForExam.length > 0) {
    return true;
  }
  if (student.enrolment_status === "future") {
    return false;
  }
  if (!examination) {
    return student.active !== false && student.enrolment_status !== "inactive";
  }
  const examYear = examination.year;
  const examTerm = examination.term;
  if (student.intake_year) {
    if (student.intake_year > examYear) {
      return false;
    }
    if (student.intake_year === examYear && student.intake_term && examTerm) {
      const termOrder = {
        "Term 1": 1,
        "Term 2": 2,
        "Term 3": 3
      };
      const intakeTermNum = termOrder[student.intake_term] || 1;
      const examTermNum = termOrder[examTerm] || 1;
      if (intakeTermNum > examTermNum) {
        return false;
      }
    }
  }
  if (student.admission_date) {
    const examDateStr = examination.start_date || examination.end_date || examination.date_created;
    if (examDateStr) {
      const admTime = new Date(student.admission_date).getTime();
      const examTime = new Date(examDateStr).getTime();
      if (!isNaN(admTime) && !isNaN(examTime)) {
        if (examTime < admTime) {
          return false;
        }
      }
    }
  }
  return student.active !== false && student.enrolment_status !== "inactive";
}
function applyCompetitionRanking(items, isTieFn, setRankFn) {
  let currentRank = 1;
  items.forEach((item, index) => {
    if (index > 0) {
      const prevItem = items[index - 1];
      if (!isTieFn(item, prevItem)) {
        currentRank = index + 1;
      }
    } else {
      currentRank = 1;
    }
    setRankFn(item, currentRank);
  });
  return items;
}
var CBE_8_POINT_GRADES = [
  {
    id: "gr_ee1",
    grade_code: "EE1",
    performance_level: "EE",
    minimum_score: 90,
    maximum_score: 100,
    points: 8,
    remarks: "Outstanding Performance",
    descriptor: "Exceeding Expectations",
    grade: "EE1",
    minimum_marks: 90,
    maximum_marks: 100
  },
  {
    id: "gr_ee2",
    grade_code: "EE2",
    performance_level: "EE",
    minimum_score: 75,
    maximum_score: 89,
    points: 7,
    remarks: "Excellent Performance",
    descriptor: "Exceeding Expectations",
    grade: "EE2",
    minimum_marks: 75,
    maximum_marks: 89
  },
  {
    id: "gr_me1",
    grade_code: "ME1",
    performance_level: "ME",
    minimum_score: 58,
    maximum_score: 74,
    points: 6,
    remarks: "Good Performance",
    descriptor: "Meeting Expectations",
    grade: "ME1",
    minimum_marks: 58,
    maximum_marks: 74
  },
  {
    id: "gr_me2",
    grade_code: "ME2",
    performance_level: "ME",
    minimum_score: 41,
    maximum_score: 57,
    points: 5,
    remarks: "Satisfactory Performance",
    descriptor: "Meeting Expectations",
    grade: "ME2",
    minimum_marks: 41,
    maximum_marks: 57
  },
  {
    id: "gr_ae1",
    grade_code: "AE1",
    performance_level: "AE",
    minimum_score: 31,
    maximum_score: 40,
    points: 4,
    remarks: "Developing Competency",
    descriptor: "Approaching Expectations",
    grade: "AE1",
    minimum_marks: 31,
    maximum_marks: 40
  },
  {
    id: "gr_ae2",
    grade_code: "AE2",
    performance_level: "AE",
    minimum_score: 21,
    maximum_score: 30,
    points: 3,
    remarks: "Needs More Practice",
    descriptor: "Approaching Expectations",
    grade: "AE2",
    minimum_marks: 21,
    maximum_marks: 30
  },
  {
    id: "gr_be1",
    grade_code: "BE1",
    performance_level: "BE",
    minimum_score: 11,
    maximum_score: 20,
    points: 2,
    remarks: "Requires Intervention",
    descriptor: "Below Expectations",
    grade: "BE1",
    minimum_marks: 11,
    maximum_marks: 20
  },
  {
    id: "gr_be2",
    grade_code: "BE2",
    performance_level: "BE",
    minimum_score: 0,
    maximum_score: 10,
    points: 1,
    remarks: "Immediate Support Required",
    descriptor: "Below Expectations",
    grade: "BE2",
    minimum_marks: 0,
    maximum_marks: 10
  }
];
function getGradeForMark(mark, grades = []) {
  const safeGrades = grades && grades.length > 0 ? grades : CBE_8_POINT_GRADES;
  const sortedGrades = [...safeGrades].sort((a, b) => {
    const minA = a.minimum_score ?? a.minimum_marks ?? 0;
    const minB = b.minimum_score ?? b.minimum_marks ?? 0;
    return minB - minA;
  });
  const roundedMark = Math.round(mark);
  for (const g of sortedGrades) {
    const min = g.minimum_score ?? g.minimum_marks ?? 0;
    if (roundedMark >= min) {
      return g;
    }
  }
  return CBE_8_POINT_GRADES[7];
}
function getLearnerReportSubjects(student, classObj, subjects, teachers) {
  if (classObj) {
    if (classObj.allocated_subject_ids && classObj.allocated_subject_ids.length > 0) {
      return getAllocatedSubjectsForClass(classObj, subjects);
    }
  }
  const stdGrade = classObj?.class_name || student?.grade || "";
  return getApplicableSubjectsForGrade(stdGrade, subjects);
}
function calculateExamResults(examId, students = [], marksList = [], grades = [], classes = [], subjects = []) {
  const safeStudents = students || [];
  const safeMarksList = marksList || [];
  const safeGrades = grades || [];
  const safeClasses = classes || [];
  const safeSubjects = subjects || [];
  const examObj = typeof api !== "undefined" && api.getExaminations ? api.getExaminations().find((e) => e.id === examId || e.exam_code === examId || e.exam_name === examId) : void 0;
  const validExamIds = new Set(
    [examId, examObj?.id, examObj?.exam_code, examObj?.exam_name].filter(Boolean)
  );
  const examMarks = safeMarksList.filter((m) => validExamIds.has(m.exam_id));
  const studentTotals = [];
  safeStudents.forEach((std) => {
    const stdMatches = (mStudentId) => {
      const sIdStr = String(mStudentId).trim().toLowerCase();
      if (std.id && String(std.id).trim().toLowerCase() === sIdStr) return true;
      if (std.admission_number && String(std.admission_number).trim().toLowerCase() === sIdStr) return true;
      return false;
    };
    const stdAllExamMarks = examMarks.filter((m) => stdMatches(m.student_id));
    if (!isStudentEligibleForExam(std, examObj, stdAllExamMarks)) {
      return;
    }
    let stdClass = (std.stream_id ? safeClasses.find((c) => c.stream_id === std.stream_id) : void 0) || safeClasses.find((c) => c.id === std.class_id);
    let stdContextGrade = std.grade;
    let stdContextStreamId = std.stream_id;
    if (examObj) {
      const examContext = getLearnerClassAtExamTime(std, examObj, safeClasses);
      if (examContext) {
        const resolvedHistClass = (examContext.stream_id ? safeClasses.find((c) => c.stream_id === examContext.stream_id || c.id === examContext.stream_id) : void 0) || (examContext.class_id ? safeClasses.find((c) => c.id === examContext.class_id || c.stream_id === examContext.class_id) : void 0);
        if (resolvedHistClass) {
          stdClass = resolvedHistClass;
        }
        if (examContext.stream_id) {
          stdContextStreamId = examContext.stream_id;
        }
        if (examContext.grade) {
          stdContextGrade = examContext.grade;
        }
      }
    }
    const effectiveStudent = stdContextGrade !== std.grade ? { ...std, grade: stdContextGrade } : std;
    const poolSubjects = safeSubjects.length > 0 ? safeSubjects : typeof api !== "undefined" && api.getSubjects ? api.getSubjects() : [];
    const learnerAllocatedSubjects = getLearnerReportSubjects(
      effectiveStudent,
      stdClass,
      poolSubjects,
      typeof api !== "undefined" && api.getTeachers ? api.getTeachers() : []
    );
    let applicableSubjects;
    if (safeSubjects.length > 0) {
      const safeSubjectIdSet = new Set(safeSubjects.map((s) => String(s.id)));
      const filteredAllocated = learnerAllocatedSubjects.filter((s) => safeSubjectIdSet.has(String(s.id)));
      applicableSubjects = filteredAllocated.length > 0 ? filteredAllocated : learnerAllocatedSubjects;
    } else {
      applicableSubjects = learnerAllocatedSubjects;
    }
    const validSubjectIds = applicableSubjects.length > 0 ? new Set(applicableSubjects.map((s) => String(s.id))) : null;
    const stdMarks = examMarks.filter(
      (m) => stdMatches(m.student_id) && (!validSubjectIds || validSubjectIds.has(String(m.subject_id)) || applicableSubjects.some(
        (sb) => String(m.subject_id) === String(sb.id) || sb.subject_code && String(m.subject_id) === String(sb.subject_code) || sb.subject_code && getShortCbeCode(String(m.subject_id)) === getShortCbeCode(sb.subject_code) || sb.subject_name && String(m.subject_id).toLowerCase() === sb.subject_name.toLowerCase() || safeSubjects.some((s) => s.id === m.subject_id && (s.id === sb.id || s.subject_code === sb.subject_code || getShortCbeCode(s.subject_code) === getShortCbeCode(sb.subject_code)))
      ))
    );
    let assessedSubjectCount = 0;
    let sumRawScore = 0;
    let sumOutOf = 0;
    let sumPercentage = 0;
    let sumPctRoundedTotal = 0;
    let sumPoints = 0;
    let hasMissingMark = false;
    let missingCount = 0;
    let irregularityCount = 0;
    applicableSubjects.forEach((sb) => {
      const markObj = stdMarks.find(
        (m) => String(m.subject_id) === String(sb.id) || sb.subject_code && String(m.subject_id) === String(sb.subject_code) || sb.subject_code && getShortCbeCode(String(m.subject_id)) === getShortCbeCode(sb.subject_code) || sb.subject_name && String(m.subject_id).toLowerCase() === sb.subject_name.toLowerCase() || safeSubjects.some((s) => s.id === m.subject_id && (s.id === sb.id || s.subject_code === sb.subject_code || getShortCbeCode(s.subject_code) === getShortCbeCode(sb.subject_code)))
      );
      const markInfo = evaluateMark(markObj);
      if (markInfo.status === "Normal" && markInfo.percentage !== null) {
        assessedSubjectCount++;
        sumRawScore += markInfo.rawScore;
        sumOutOf += markInfo.outOf;
        sumPercentage += markInfo.percentage;
        sumPctRoundedTotal += Math.round(markInfo.percentage);
        const gr = getGradeForMark(markInfo.percentage, safeGrades);
        sumPoints += gr.points;
      } else if (markInfo.status === "Y") {
        irregularityCount++;
      } else {
        hasMissingMark = true;
        missingCount++;
      }
    });
    if (applicableSubjects.length === 0 && stdMarks.length > 0) {
      stdMarks.forEach((m) => {
        const markInfo = evaluateMark(m);
        if (markInfo.status === "Normal" && markInfo.percentage !== null) {
          assessedSubjectCount++;
          sumRawScore += markInfo.rawScore;
          sumOutOf += markInfo.outOf;
          sumPercentage += markInfo.percentage;
          sumPctRoundedTotal += Math.round(markInfo.percentage);
          const gr = getGradeForMark(markInfo.percentage, safeGrades);
          sumPoints += gr.points;
        } else if (markInfo.status === "Y") {
          irregularityCount++;
        } else {
          hasMissingMark = true;
          missingCount++;
        }
      });
    }
    const expectedSubjectCount = applicableSubjects.length > 0 ? applicableSubjects.length : 1;
    const isComplete = !hasMissingMark && irregularityCount === 0 && assessedSubjectCount > 0;
    const totalMissingCount = missingCount;
    const rawGrade = effectiveStudent.grade || stdClass?.class_name || "";
    const gradeKey = extractGradeName(rawGrade) || rawGrade || "";
    const totalMarks = sumPctRoundedTotal;
    const totalMaxMarks = assessedSubjectCount * 100;
    const avgMarks = assessedSubjectCount > 0 ? Math.round(totalMarks / assessedSubjectCount) : 0;
    const avgPoints = assessedSubjectCount > 0 ? Math.round(sumPoints / assessedSubjectCount * 100) / 100 : 0;
    const overallGradeObj = getGradeForMark(avgMarks, safeGrades);
    const resolvedStreamId = stdClass?.stream_id || stdContextStreamId || std.stream_id || (stdClass ? `${stdClass.id}_${stdClass.stream || "default"}` : std.class_id || "unassigned");
    studentTotals.push({
      student_id: std.id,
      resolved_class_id: stdClass?.id || std.class_id || "unassigned",
      resolved_stream_id: resolvedStreamId,
      resolved_grade_key: gradeKey || "Unassigned",
      total_marks: totalMarks,
      total_max_marks: totalMaxMarks,
      subject_count: assessedSubjectCount,
      average: avgMarks,
      total_points: sumPoints,
      average_points: avgPoints,
      overallGradeObj,
      is_complete: isComplete,
      missing_subjects_count: totalMissingCount
    });
  });
  const completeTotals = studentTotals.filter((s) => s.is_complete);
  const incompleteTotals = studentTotals.filter((s) => !s.is_complete);
  const gradeGroups = /* @__PURE__ */ new Map();
  completeTotals.forEach((item) => {
    const gradeKey = item.resolved_grade_key || "Unassigned";
    if (!gradeGroups.has(gradeKey)) {
      gradeGroups.set(gradeKey, []);
    }
    gradeGroups.get(gradeKey).push(item);
  });
  const finalResults = [];
  gradeGroups.forEach((gradeCohort) => {
    gradeCohort.sort((a, b) => b.total_marks - a.total_marks);
    const isCohortTie = (a, b) => {
      return Math.round(a.total_marks ?? 0) === Math.round(b.total_marks ?? 0);
    };
    const gradeResultsWithOverallRank = [];
    applyCompetitionRanking(gradeCohort, isCohortTie, (item, rank) => {
      gradeResultsWithOverallRank.push({
        item,
        overallRank: rank,
        class_id: item.resolved_class_id || "unassigned",
        stream_id: item.resolved_stream_id || "unassigned"
      });
    });
    const streamGroups = /* @__PURE__ */ new Map();
    gradeResultsWithOverallRank.forEach((entry) => {
      const streamId = entry.stream_id;
      if (!streamGroups.has(streamId)) {
        streamGroups.set(streamId, []);
      }
      streamGroups.get(streamId).push(entry);
    });
    streamGroups.forEach((streamCohort) => {
      streamCohort.sort((a, b) => b.item.total_marks - a.item.total_marks);
      applyCompetitionRanking(
        streamCohort,
        (a, b) => isCohortTie(a.item, b.item),
        (entry, streamRank) => {
          const { item, overallRank } = entry;
          const code = item.overallGradeObj.grade_code || item.overallGradeObj.grade || "ME1";
          const level = item.overallGradeObj.performance_level || "ME";
          finalResults.push({
            id: `res_${examId}_${item.student_id}`,
            student_id: item.student_id,
            exam_id: examId,
            total_marks: item.total_marks,
            total_max_marks: item.total_max_marks,
            subject_count: item.subject_count,
            average: item.average,
            total_points: item.total_points,
            average_points: item.average_points,
            grade_code: code,
            performance_level: level,
            grade: code,
            points: item.overallGradeObj.points,
            position: overallRank,
            // Grade Position (Overall Position within Grade)
            class_position: streamRank,
            // Stream Position
            stream_position: streamRank,
            // Stream Position
            remarks: item.overallGradeObj.remarks,
            is_complete: true,
            status: "Complete",
            missing_subjects_count: item.missing_subjects_count
          });
        }
      );
    });
  });
  incompleteTotals.forEach((item) => {
    const isAssessed = item.subject_count > 0;
    const code = isAssessed ? item.overallGradeObj.grade_code || item.overallGradeObj.grade || "ME1" : "-";
    const level = isAssessed ? item.overallGradeObj.performance_level || "ME" : "-";
    finalResults.push({
      id: `res_${examId}_${item.student_id}`,
      student_id: item.student_id,
      exam_id: examId,
      total_marks: item.total_marks,
      total_max_marks: item.total_max_marks,
      subject_count: item.subject_count,
      average: item.average,
      // provisional average
      total_points: item.total_points,
      average_points: item.average_points,
      grade_code: code,
      performance_level: level,
      grade: code,
      points: isAssessed ? item.overallGradeObj.points : 0,
      position: 0,
      class_position: 0,
      stream_position: 0,
      remarks: item.subject_count > 0 ? "Provisional Assessment (Partial Subjects Entered)" : "Incomplete Assessment (Pending Marks)",
      is_complete: false,
      status: "Provisional",
      missing_subjects_count: item.missing_subjects_count
    });
  });
  return finalResults;
}

// server.ts
var UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
function isUUID3(str) {
  if (!str || typeof str !== "string") return false;
  return UUID_REGEX.test(str.trim());
}
var CLASS_STREAM_SEED_MAP = {
  "cls_pp1_b": { class_name: "PP1", stream: "Blue", education_level: "Pre-Primary" },
  "cls_pp2_b": { class_name: "PP2", stream: "Blue", education_level: "Pre-Primary" },
  "cls_g1_b": { class_name: "Grade 1", stream: "Blue", education_level: "Lower Primary" },
  "cls_g2_b": { class_name: "Grade 2", stream: "Blue", education_level: "Lower Primary" },
  "cls_g3_b": { class_name: "Grade 3", stream: "Blue", education_level: "Lower Primary" },
  "cls_g4_b": { class_name: "Grade 4", stream: "Blue", education_level: "Upper Primary" },
  "cls_g5_b": { class_name: "Grade 5", stream: "Blue", education_level: "Upper Primary" },
  "cls_g5_r": { class_name: "Grade 5", stream: "Red", education_level: "Upper Primary" },
  "cls_g6_b": { class_name: "Grade 6", stream: "Blue", education_level: "Upper Primary" },
  "cls_7e": { class_name: "Grade 7", stream: "East", education_level: "Junior School" },
  "cls_7w": { class_name: "Grade 7", stream: "West", education_level: "Junior School" },
  "cls_8e": { class_name: "Grade 8", stream: "East", education_level: "Junior School" },
  "cls_8w": { class_name: "Grade 8", stream: "West", education_level: "Junior School" },
  "cls_9a": { class_name: "Grade 9", stream: "Alpha", education_level: "Junior School" },
  "cls_grade9": { class_name: "Grade 9", stream: "Alpha", education_level: "Junior School" },
  "cls_grade9_alpha": { class_name: "Grade 9", stream: "Alpha", education_level: "Junior School" }
};
var SUBJECT_SEED_MAP = {
  "sb_pp_lang": { subject_name: "Language Activities", subject_code: "LANG ACT", education_level: "Pre-Primary" },
  "sb_pp_math": { subject_name: "Mathematical Activities", subject_code: "MATH ACT", education_level: "Pre-Primary" },
  "sb_pp_env": { subject_name: "Environmental Activities", subject_code: "ENV ACT", education_level: "Pre-Primary" },
  "sb_pp_psy": { subject_name: "Psychomotor & Creative Activities", subject_code: "PSYCH ACT", education_level: "Pre-Primary" },
  "sb_pp_re": { subject_name: "Christian Religious Education", subject_code: "CRE", education_level: "Pre-Primary" },
  "sb_lp_eng": { subject_name: "English Language Activities", subject_code: "ENG LP", education_level: "Lower Primary" },
  "sb_lp_kis": { subject_name: "Kiswahili Language Activities", subject_code: "KIS LP", education_level: "Lower Primary" },
  "sb_lp_mat": { subject_name: "Mathematical Activities", subject_code: "MAT LP", education_level: "Lower Primary" },
  "sb_lp_env": { subject_name: "Environmental Activities", subject_code: "ENV LP", education_level: "Lower Primary" },
  "sb_lp_hng": { subject_name: "Hygiene and Nutrition", subject_code: "HNG LP", education_level: "Lower Primary" },
  "sb_lp_crt": { subject_name: "Creative Activities", subject_code: "CREAT LP", education_level: "Lower Primary" },
  "sb_lp_re": { subject_name: "Christian Religious Education", subject_code: "CRE", education_level: "Lower Primary" },
  "sb_up_eng": { subject_name: "English Language", subject_code: "ENG UP", education_level: "Upper Primary" },
  "sb_up_kis": { subject_name: "Kiswahili Language", subject_code: "KIS UP", education_level: "Upper Primary" },
  "sb_up_mat": { subject_name: "Mathematics", subject_code: "MAT UP", education_level: "Upper Primary" },
  "sb_up_sci": { subject_name: "Science and Technology", subject_code: "SCI UP", education_level: "Upper Primary" },
  "sb_up_agr": { subject_name: "Agriculture & Nutrition", subject_code: "AGR UP", education_level: "Upper Primary" },
  "sb_up_sst": { subject_name: "Social Studies", subject_code: "SST UP", education_level: "Upper Primary" },
  "sb_up_crt": { subject_name: "Creative Arts", subject_code: "CREAT UP", education_level: "Upper Primary" },
  "sb_up_re": { subject_name: "Christian Religious Education", subject_code: "CRE", education_level: "Upper Primary" },
  "sb_eng": { subject_name: "English", subject_code: "ENG", education_level: "Junior School" },
  "sb_kis": { subject_name: "Kiswahili", subject_code: "KIS", education_level: "Junior School" },
  "sb_mat": { subject_name: "Mathematics", subject_code: "MAT", education_level: "Junior School" },
  "sb_sci": { subject_name: "Integrated Science", subject_code: "SCI", education_level: "Junior School" },
  "sb_cas": { subject_name: "Creative Arts and Sports", subject_code: "CAS", education_level: "Junior School" },
  "sb_sst": { subject_name: "Social Studies", subject_code: "SST", education_level: "Junior School" },
  "sb_cre": { subject_name: "Christian Religious Education", subject_code: "CRE", education_level: "Junior School" },
  "sb_agn": { subject_name: "Agriculture and Nutrition", subject_code: "AGN", education_level: "Junior School" },
  "sb_pts": { subject_name: "Pre-Technical Studies", subject_code: "PRE TECH", education_level: "Junior School" },
  "sb_hed": { subject_name: "Health Education", subject_code: "HED", education_level: "Junior School" },
  "sb_bst": { subject_name: "Business Studies", subject_code: "BST", education_level: "Junior School" },
  "sb_cs": { subject_name: "Computer Science", subject_code: "CS", education_level: "Junior School" }
};
async function resolveAllocationUUIDs(supabaseAdmin, alloc) {
  let resolvedClassId = null;
  let resolvedStreamId = null;
  let resolvedSubjectId = null;
  if (isUUID3(alloc.stream_id)) {
    const { data: strmData } = await supabaseAdmin.from("streams").select("id, class_id").eq("id", alloc.stream_id).maybeSingle();
    if (strmData) {
      resolvedStreamId = strmData.id;
      resolvedClassId = strmData.class_id;
    }
  }
  const rawClassId = alloc.class_id || alloc.stream_id;
  if (!resolvedClassId && isUUID3(rawClassId)) {
    const { data: clsData } = await supabaseAdmin.from("classes").select("id").eq("id", rawClassId).maybeSingle();
    if (clsData) {
      resolvedClassId = clsData.id;
      if (isUUID3(alloc.stream_id)) {
        const { data: strmData } = await supabaseAdmin.from("streams").select("id").eq("id", alloc.stream_id).eq("class_id", resolvedClassId).maybeSingle();
        if (strmData) {
          resolvedStreamId = strmData.id;
        } else {
          throw new Error(`Stream with ID "${alloc.stream_id}" does not exist under the specified class.`);
        }
      } else if (alloc.stream) {
        const { data: strmData } = await supabaseAdmin.from("streams").select("id").eq("class_id", resolvedClassId).ilike("stream_name", alloc.stream).maybeSingle();
        if (strmData) {
          resolvedStreamId = strmData.id;
        }
      }
    } else {
      const { data: strmData } = await supabaseAdmin.from("streams").select("id, class_id").eq("id", rawClassId).maybeSingle();
      if (strmData) {
        resolvedStreamId = strmData.id;
        resolvedClassId = strmData.class_id;
      } else {
        throw new Error(`Class or stream with ID "${rawClassId}" could not be found.`);
      }
    }
  } else if (!resolvedClassId && rawClassId) {
    const seedMeta = CLASS_STREAM_SEED_MAP[rawClassId] || {};
    let className = alloc.class_name || seedMeta.class_name;
    let streamName = alloc.stream || alloc.stream_name || seedMeta.stream;
    if (!className && typeof rawClassId === "string") {
      if (!rawClassId.startsWith("cls_")) {
        className = rawClassId;
      } else {
        const clean = rawClassId.replace(/^cls_/, "").replace(/_/g, " ");
        const match = clean.match(/(grade\s*\d+|pp\d+|playgroup)(\s+([a-z0-9]+))?/i);
        if (match) {
          className = match[1].replace(/grade\s*/i, "Grade ").replace(/pp\s*/i, "PP").trim();
          if (!streamName && match[3]) streamName = match[3];
        } else {
          className = clean;
        }
      }
    }
    if (!className) {
      throw new Error(`Unable to resolve class name for identifier "${rawClassId}".`);
    }
    const { data: matchingClasses, error: clsErr } = await supabaseAdmin.from("classes").select("id, class_name").ilike("class_name", className);
    if (clsErr) {
      throw new Error(`Database query error while resolving class "${className}": ${clsErr.message}`);
    }
    let targetClass = null;
    if (matchingClasses && matchingClasses.length === 1) {
      targetClass = matchingClasses[0];
    } else if (matchingClasses && matchingClasses.length > 1) {
      const exact = matchingClasses.find((c) => c.class_name === className);
      if (exact) targetClass = exact;
      else targetClass = matchingClasses[0];
    } else {
      const parseGradeLevel = (name) => {
        const match = name.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      };
      const { data: newClass, error: createClsErr } = await supabaseAdmin.from("classes").insert([{ class_name: className, grade_level: parseGradeLevel(className), capacity: 40 }]).select().single();
      if (createClsErr || !newClass) {
        throw new Error(`Class "${className}" could not be found or created in database: ${createClsErr?.message || "Unknown error"}`);
      }
      targetClass = newClass;
    }
    resolvedClassId = targetClass.id;
    if (streamName) {
      const { data: matchingStreams, error: strmErr } = await supabaseAdmin.from("streams").select("id, stream_name").eq("class_id", resolvedClassId).ilike("stream_name", streamName);
      if (strmErr) {
        throw new Error(`Database query error while resolving stream "${streamName}": ${strmErr.message}`);
      }
      if (matchingStreams && matchingStreams.length === 1) {
        resolvedStreamId = matchingStreams[0].id;
      } else if (matchingStreams && matchingStreams.length > 1) {
        const exactStrm = matchingStreams.find((s) => s.stream_name === streamName);
        if (exactStrm) resolvedStreamId = exactStrm.id;
        else resolvedStreamId = matchingStreams[0].id;
      } else {
        const { data: newStream, error: createStrmErr } = await supabaseAdmin.from("streams").insert([{ class_id: resolvedClassId, stream_name: streamName, capacity: 40 }]).select().single();
        if (createStrmErr || !newStream) {
          throw new Error(`Stream "${streamName}" could not be created under class "${className}": ${createStrmErr?.message || "Unknown error"}`);
        }
        resolvedStreamId = newStream.id;
      }
    }
  }
  const rawSubjectId = alloc.subject_id;
  if (isUUID3(rawSubjectId)) {
    const { data: sbData } = await supabaseAdmin.from("subjects").select("id").eq("id", rawSubjectId).maybeSingle();
    if (sbData) {
      resolvedSubjectId = sbData.id;
    } else {
      throw new Error(`Subject with ID "${rawSubjectId}" could not be found.`);
    }
  } else if (rawSubjectId) {
    const seedSbMeta = SUBJECT_SEED_MAP[rawSubjectId] || {};
    const subjectCode = alloc.subject_code || seedSbMeta.subject_code;
    const subjectName = alloc.subject_name || seedSbMeta.subject_name || (typeof rawSubjectId === "string" && !rawSubjectId.startsWith("sb_") ? rawSubjectId : rawSubjectId);
    const eduLevel = alloc.education_level || seedSbMeta.education_level;
    if (!subjectCode && !subjectName) {
      throw new Error(`Unable to resolve subject code or name for identifier "${rawSubjectId}".`);
    }
    let query = supabaseAdmin.from("subjects").select("*");
    if (subjectCode && subjectName) {
      query = query.or(`subject_code.eq.${subjectCode},subject_name.ilike.${subjectName}`);
    } else if (subjectCode) {
      query = query.eq("subject_code", subjectCode);
    } else {
      query = query.ilike("subject_name", subjectName);
    }
    const { data: matchingSubjects, error: sbErr } = await query;
    if (sbErr) {
      throw new Error(`Database query error while resolving subject: ${sbErr.message}`);
    }
    let targetSubject = null;
    if (matchingSubjects && matchingSubjects.length > 0) {
      if (matchingSubjects.length === 1) {
        targetSubject = matchingSubjects[0];
      } else {
        if (eduLevel) {
          const matchEdu = matchingSubjects.find((s) => s.education_level === eduLevel);
          if (matchEdu) targetSubject = matchEdu;
        }
        if (!targetSubject && subjectCode) {
          const exactCode = matchingSubjects.find((s) => s.subject_code === subjectCode);
          if (exactCode) targetSubject = exactCode;
        }
        if (!targetSubject) {
          targetSubject = matchingSubjects[0];
        }
      }
    } else {
      const finalSubjectName = subjectName || rawSubjectId;
      const finalSubjectCode = subjectCode || (subjectName ? subjectName.substring(0, 8).toUpperCase() : rawSubjectId.substring(0, 8).toUpperCase());
      const { data: newSubject, error: createSbErr } = await supabaseAdmin.from("subjects").insert([{ subject_name: finalSubjectName, subject_code: finalSubjectCode, category: "Core", learning_area: eduLevel || "Grade 1\u20139" }]).select().single();
      if (createSbErr || !newSubject) {
        throw new Error(`Subject "${finalSubjectName}" could not be created in database: ${createSbErr?.message || "Unknown error"}`);
      }
      targetSubject = newSubject;
    }
    resolvedSubjectId = targetSubject.id;
  }
  if (!resolvedSubjectId) {
    throw new Error(`Teacher allocation could not be created because subject reference is invalid or missing.`);
  }
  return {
    class_id: resolvedClassId,
    stream_id: resolvedStreamId,
    subject_id: resolvedSubjectId
  };
}
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.use(import_express.default.json());
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });
  app.post("/api/admin/create-teacher", async (req, res) => {
    try {
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
        return res.status(500).json({ error: "Server missing Supabase credentials." });
      }
      const supabaseAdmin = (0, import_supabase_js2.createClient)(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });
      const supabaseAnon = (0, import_supabase_js2.createClient)(supabaseUrl, supabaseAnonKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });
      const {
        adminId,
        role,
        name,
        email,
        phone,
        tsc_number,
        username,
        status,
        temporary_password,
        force_password_change,
        is_class_teacher,
        class_teacher_of_id
      } = req.body;
      const canonicalizeRole = (roleInput) => {
        if (!roleInput || typeof roleInput !== "string") return "class_teacher";
        const cleaned = roleInput.trim().toLowerCase().replace(/[\s-]+/g, "_");
        if (cleaned === "admin" || cleaned === "administrator") return "admin";
        if (cleaned === "class_teacher" || cleaned === "classteacher" || cleaned === "class") return "class_teacher";
        if (cleaned === "subject_teacher" || cleaned === "subjectteacher" || cleaned === "subject") return "subject_teacher";
        return "class_teacher";
      };
      const dbRole = canonicalizeRole(role);
      const computedIsClassTeacher = typeof is_class_teacher === "boolean" ? is_class_teacher : dbRole === "class_teacher";
      let token = null;
      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7).trim();
      } else if (req.body && typeof req.body.token === "string" && req.body.token.trim()) {
        token = req.body.token.trim();
      }
      if (!token) {
        return res.status(401).json({ error: "Unauthorized: Missing authentication token." });
      }
      const { data: authUserData, error: tokenError } = await supabaseAdmin.auth.getUser(token);
      if (tokenError || !authUserData || !authUserData.user) {
        return res.status(401).json({ error: "Unauthorized: Invalid or expired authentication token." });
      }
      const authenticatedUserId = authUserData.user.id;
      let adminUser = null;
      const { data: userById } = await supabaseAdmin.from("users").select("id, role").eq("id", authenticatedUserId).maybeSingle();
      if (userById) {
        adminUser = userById;
      } else if (authUserData.user.email) {
        const { data: userByEmail } = await supabaseAdmin.from("users").select("id, role").eq("email", authUserData.user.email.toLowerCase()).maybeSingle();
        if (userByEmail) adminUser = userByEmail;
      }
      if (!adminUser) {
        return res.status(401).json({ error: "Unauthorized: Authenticated user record not found in database." });
      }
      if (adminUser.role !== "admin") {
        return res.status(403).json({ error: "Forbidden: Only administrators can create accounts." });
      }
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: temporary_password,
        email_confirm: true,
        user_metadata: {
          role: dbRole,
          name,
          phone,
          tsc_number,
          username,
          status,
          force_password_change
        }
      });
      if (authError) {
        if (authError.message.includes("User already registered") || authError.message.includes("already exists") || authError.message.includes("already been registered")) {
          return res.status(400).json({ error: "A user account with this email address has already been registered." });
        }
        return res.status(400).json({ error: authError.message });
      }
      const authUserId = authData.user.id;
      const { data: userData, error: userError } = await supabaseAdmin.from("users").insert([{
        id: authUserId,
        // Matches the auth user ID
        name,
        email,
        role: dbRole,
        teacher_id: null,
        student_id: null
      }]).select().single();
      if (userError) {
        console.error("Database user creation error:", userError);
        await supabaseAdmin.auth.admin.deleteUser(authUserId);
        if (userError.message && userError.message.includes("users_role_check")) {
          return res.status(400).json({ error: "Failed to create user account: Invalid role specified. Please select a valid role (Class Teacher, Subject Teacher, or Administrator)." });
        }
        return res.status(400).json({ error: `Failed to create application user: ${userError.message}` });
      }
      userData.role = dbRole;
      const { data: existingTeacher } = await supabaseAdmin.from("teachers").select("*").ilike("email", email.trim().toLowerCase()).maybeSingle();
      let teacherData = null;
      let isExistingTeacher = false;
      if (existingTeacher) {
        isExistingTeacher = true;
        const { data: updatedTeacher, error: updateTErr } = await supabaseAdmin.from("teachers").update({
          user_id: authUserId,
          teacher_name: name || existingTeacher.teacher_name,
          phone: phone || existingTeacher.phone,
          tsc_number: tsc_number || existingTeacher.tsc_number,
          is_class_teacher: computedIsClassTeacher
        }).eq("id", existingTeacher.id).select().single();
        if (updateTErr) {
          console.error("Database teacher profile update/link error:", updateTErr);
          await supabaseAdmin.from("users").delete().eq("id", authUserId);
          await supabaseAdmin.auth.admin.deleteUser(authUserId);
          return res.status(400).json({ error: `Failed to link teacher profile: ${updateTErr.message}` });
        }
        teacherData = updatedTeacher;
      } else {
        const { data: newTeacher, error: teacherError } = await supabaseAdmin.from("teachers").insert([{
          user_id: authUserId,
          teacher_name: name,
          tsc_number: tsc_number || null,
          phone: phone || null,
          email,
          is_class_teacher: computedIsClassTeacher
        }]).select().single();
        if (teacherError) {
          console.error("Database teacher profile creation error:", teacherError);
          await supabaseAdmin.from("users").delete().eq("id", authUserId);
          await supabaseAdmin.auth.admin.deleteUser(authUserId);
          return res.status(400).json({ error: `Failed to create teacher profile: ${teacherError.message}` });
        }
        teacherData = newTeacher;
      }
      await supabaseAdmin.from("users").update({ teacher_id: teacherData.id }).eq("id", authUserId);
      userData.teacher_id = teacherData.id;
      if (computedIsClassTeacher && class_teacher_of_id) {
        try {
          if (isUUID3(class_teacher_of_id)) {
            await supabaseAdmin.from("streams").update({ class_teacher_id: teacherData.id }).eq("id", class_teacher_of_id);
          }
        } catch (strmErr) {
          console.warn("Could not update streams.class_teacher_id:", strmErr);
        }
      }
      const allocations = req.body.allocations || [];
      if (allocations.length > 0) {
        const allocationInserts = [];
        for (const alloc of allocations) {
          try {
            const resolved = await resolveAllocationUUIDs(supabaseAdmin, alloc);
            const item = {
              teacher_id: teacherData.id,
              subject_id: resolved.subject_id
            };
            if (resolved.class_id) item.class_id = resolved.class_id;
            if (resolved.stream_id) item.stream_id = resolved.stream_id;
            allocationInserts.push(item);
          } catch (resErr) {
            console.error(`Allocation resolution failed for alloc:`, alloc, resErr.message);
            if (isExistingTeacher) {
              await supabaseAdmin.from("teachers").update({ user_id: null }).eq("id", teacherData.id);
            } else {
              await supabaseAdmin.from("teachers").delete().eq("id", teacherData.id);
            }
            await supabaseAdmin.from("users").delete().eq("id", authUserId);
            await supabaseAdmin.auth.admin.deleteUser(authUserId);
            return res.status(400).json({
              error: `Teacher allocation could not be created: ${resErr.message}`
            });
          }
        }
        if (allocationInserts.length > 0) {
          const { error: allocError } = await supabaseAdmin.from("teacher_subjects").insert(allocationInserts);
          if (allocError) {
            console.error("Failed to create teacher allocations in teacher_subjects:", allocError);
            if (isExistingTeacher) {
              await supabaseAdmin.from("teachers").update({ user_id: null }).eq("id", teacherData.id);
            } else {
              await supabaseAdmin.from("teachers").delete().eq("id", teacherData.id);
            }
            await supabaseAdmin.from("users").delete().eq("id", authUserId);
            await supabaseAdmin.auth.admin.deleteUser(authUserId);
            return res.status(400).json({
              error: `Failed to save teacher allocations: ${allocError.message}`
            });
          }
        }
      }
      return res.status(200).json({
        user: userData,
        teacher: teacherData
      });
    } catch (err) {
      console.error("Error in /api/admin/create-teacher:", err);
      return res.status(500).json({ error: "Internal server error during account creation." });
    }
  });
  app.post("/api/admin/create-learner", async (req, res) => {
    let createdStudentId = null;
    let authUserId = null;
    try {
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: "Server missing Supabase credentials." });
      }
      const supabaseAdmin = (0, import_supabase_js2.createClient)(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });
      let token = null;
      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7).trim();
      } else if (req.body && typeof req.body.token === "string" && req.body.token.trim()) {
        token = req.body.token.trim();
      }
      if (!token) {
        return res.status(401).json({ error: "Unauthorized: Missing authentication token." });
      }
      const { data: authUserData, error: tokenError } = await supabaseAdmin.auth.getUser(token);
      if (tokenError || !authUserData || !authUserData.user) {
        return res.status(401).json({ error: "Unauthorized: Invalid or expired authentication token." });
      }
      const authenticatedUserId = authUserData.user.id;
      let adminUser = null;
      const { data: userById } = await supabaseAdmin.from("users").select("id, role").eq("id", authenticatedUserId).maybeSingle();
      if (userById) {
        adminUser = userById;
      } else if (authUserData.user.email) {
        const { data: userByEmail } = await supabaseAdmin.from("users").select("id, role").eq("email", authUserData.user.email.toLowerCase()).maybeSingle();
        if (userByEmail) adminUser = userByEmail;
      }
      if (!adminUser) {
        return res.status(401).json({ error: "Unauthorized: Authenticated user record not found in database." });
      }
      if (adminUser.role !== "admin") {
        return res.status(403).json({ error: "Forbidden: Only administrators can provision learner accounts." });
      }
      const studentInput = req.body.student || req.body;
      const customPassword = req.body.password;
      if (!studentInput || typeof studentInput !== "object") {
        return res.status(400).json({ error: "Invalid request payload: student object is required." });
      }
      const firstName = (studentInput.first_name || "").trim();
      const lastName = (studentInput.last_name || "").trim();
      const secondName = (studentInput.second_name || "").trim();
      const rawAdmissionNumber = (studentInput.admission_number || "").trim();
      const rawGender = (studentInput.gender || "M").toString().trim();
      const dob = studentInput.dob ? String(studentInput.dob).trim() : null;
      if (!rawAdmissionNumber) {
        return res.status(400).json({ error: "Admission number is required." });
      }
      const normalizedAdm = rawAdmissionNumber.toUpperCase();
      let fullName = studentInput.full_name ? String(studentInput.full_name).trim() : "";
      if (!fullName) {
        if (!firstName && !lastName) {
          return res.status(400).json({ error: "Learner name (first and last name) is required." });
        }
        fullName = `${firstName}${secondName ? " " + secondName : ""} ${lastName}`.trim();
      }
      const canonicalGender = rawGender === "M" || rawGender.toLowerCase() === "boy" || rawGender.toLowerCase() === "male" ? "M" : "F";
      const { data: existingStudent, error: checkError } = await supabaseAdmin.from("students").select("id, admission_number").ilike("admission_number", normalizedAdm).maybeSingle();
      if (checkError) {
        console.error("Error checking student admission number uniqueness:", checkError);
        return res.status(500).json({ error: `Database error verifying admission number: ${checkError.message}` });
      }
      if (existingStudent) {
        return res.status(409).json({
          error: `Admission number "${normalizedAdm}" already exists in the student directory.`
        });
      }
      let targetClassId = null;
      let targetStreamId = null;
      if (isUUID3(studentInput.stream_id)) {
        const { data: strmMatch } = await supabaseAdmin.from("streams").select("id, class_id").eq("id", studentInput.stream_id).maybeSingle();
        if (strmMatch) {
          targetStreamId = strmMatch.id;
          targetClassId = strmMatch.class_id;
        }
      }
      if (!targetClassId && isUUID3(studentInput.class_id)) {
        const { data: clsMatch } = await supabaseAdmin.from("classes").select("id").eq("id", studentInput.class_id).maybeSingle();
        if (clsMatch) {
          targetClassId = clsMatch.id;
          if (!targetStreamId) {
            const { data: defStream } = await supabaseAdmin.from("streams").select("id").eq("class_id", clsMatch.id).limit(1);
            if (defStream && defStream.length > 0) {
              targetStreamId = defStream[0].id;
            }
          }
        }
      }
      if (!targetClassId) {
        const { data: defaultClasses } = await supabaseAdmin.from("classes").select("id").limit(1);
        if (defaultClasses && defaultClasses.length > 0) {
          targetClassId = defaultClasses[0].id;
          const { data: defStream } = await supabaseAdmin.from("streams").select("id").eq("class_id", targetClassId).limit(1);
          if (defStream && defStream.length > 0) {
            targetStreamId = defStream[0].id;
          }
        }
      }
      const cleanEmailPrefix = normalizedAdm.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
      const canonicalEmail = `${cleanEmailPrefix}@learner.cbe.ac.ke`;
      const initialPassword = typeof customPassword === "string" && customPassword.trim().length >= 6 ? customPassword.trim() : "Learner@2026";
      const rawEnrolmentStatus = studentInput.enrolment_status;
      const computedEnrolmentStatus = rawEnrolmentStatus === "future" || rawEnrolmentStatus === "inactive" || rawEnrolmentStatus === "active" ? rawEnrolmentStatus : studentInput.active === false ? "inactive" : "active";
      const computedActive = computedEnrolmentStatus === "active";
      const studentPayload = {
        admission_number: normalizedAdm,
        full_name: fullName,
        gender: canonicalGender,
        class_id: targetClassId,
        stream_id: targetStreamId,
        dob: dob || null,
        active: computedActive
      };
      const { data: createdStudent, error: createStudentErr } = await supabaseAdmin.from("students").insert([studentPayload]).select().single();
      if (createStudentErr || !createdStudent) {
        console.error("Failed to insert student record:", createStudentErr);
        if (createStudentErr?.code === "23505") {
          return res.status(409).json({ error: `Admission number "${normalizedAdm}" already exists.` });
        }
        return res.status(400).json({ error: `Failed to create student record: ${createStudentErr?.message || "Unknown database error"}` });
      }
      createdStudentId = createdStudent.id;
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: canonicalEmail,
        password: initialPassword,
        email_confirm: true,
        user_metadata: {
          role: "learner",
          name: fullName,
          student_id: createdStudentId,
          admission_number: normalizedAdm,
          enrolment_status: computedEnrolmentStatus,
          active: computedActive,
          status: computedActive ? "Active" : "Disabled"
        }
      });
      if (authError || !authData || !authData.user) {
        console.error("Failed to create Supabase Auth account for learner:", authError);
        await supabaseAdmin.from("students").delete().eq("id", createdStudentId);
        createdStudentId = null;
        if (authError?.message?.includes("User already registered") || authError?.message?.includes("already been registered")) {
          return res.status(409).json({ error: `An authentication account with email "${canonicalEmail}" already exists.` });
        }
        return res.status(400).json({ error: `Failed to provision Auth credentials: ${authError?.message || "Unknown Auth error"}` });
      }
      authUserId = authData.user.id;
      const { data: userProfile, error: userProfileErr } = await supabaseAdmin.from("users").insert([{
        id: authUserId,
        name: fullName,
        email: canonicalEmail,
        role: "learner",
        student_id: createdStudentId,
        teacher_id: null
      }]).select().single();
      if (userProfileErr || !userProfile) {
        console.error("Failed to create public.users profile for learner:", userProfileErr);
        await supabaseAdmin.auth.admin.deleteUser(authUserId);
        await supabaseAdmin.from("students").delete().eq("id", createdStudentId);
        authUserId = null;
        createdStudentId = null;
        return res.status(400).json({ error: `Failed to create learner user profile: ${userProfileErr?.message || "Unknown database error"}` });
      }
      try {
        const actionType = computedEnrolmentStatus === "future" ? "LEARNER_REGISTERED_FUTURE" : "LEARNER_REGISTERED_ACTIVE";
        const admissionDate = studentInput.admission_date || (computedActive ? (/* @__PURE__ */ new Date()).toISOString().split("T")[0] : null);
        await supabaseAdmin.from("audit_logs").insert([{
          user_id: adminUser.id,
          user_email: adminUser.email || authUserData.user.email,
          action_type: actionType,
          entity_table: "students",
          entity_id: createdStudentId,
          details: {
            admission_number: normalizedAdm,
            full_name: fullName,
            class_id: targetClassId,
            stream_id: targetStreamId,
            enrolment_status: computedEnrolmentStatus,
            active: computedActive,
            admission_date: admissionDate,
            auth_user_id: authUserId,
            email: canonicalEmail
          },
          ip_address: req.ip || req.headers["x-forwarded-for"] || null,
          created_at: (/* @__PURE__ */ new Date()).toISOString()
        }]);
      } catch (auditErr) {
        console.warn("Could not insert audit log for learner registration:", auditErr);
      }
      return res.status(201).json({
        success: true,
        student: createdStudent,
        user: userProfile,
        credentials: {
          admission_number: normalizedAdm,
          email: canonicalEmail,
          initial_password: initialPassword
        }
      });
    } catch (err) {
      console.error("Unhandled exception in /api/admin/create-learner:", err);
      if (authUserId) {
        try {
          const supabaseUrl = process.env.VITE_SUPABASE_URL;
          const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
          if (supabaseUrl && supabaseServiceKey) {
            const supabaseAdmin = (0, import_supabase_js2.createClient)(supabaseUrl, supabaseServiceKey);
            await supabaseAdmin.from("users").delete().eq("id", authUserId);
            await supabaseAdmin.auth.admin.deleteUser(authUserId);
          }
        } catch (rbErr) {
          console.warn("Rollback authUser error:", rbErr);
        }
      }
      if (createdStudentId) {
        try {
          const supabaseUrl = process.env.VITE_SUPABASE_URL;
          const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
          if (supabaseUrl && supabaseServiceKey) {
            const supabaseAdmin = (0, import_supabase_js2.createClient)(supabaseUrl, supabaseServiceKey);
            await supabaseAdmin.from("students").delete().eq("id", createdStudentId);
          }
        } catch (rbErr) {
          console.warn("Rollback student error:", rbErr);
        }
      }
      return res.status(500).json({ error: `Internal server error during learner provisioning: ${err?.message || "Unknown error"}` });
    }
  });
  const deleteLearnerHandler = async (req, res) => {
    try {
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: "Server missing Supabase credentials." });
      }
      const supabaseAdmin = (0, import_supabase_js2.createClient)(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });
      const authHeader = req.headers.authorization;
      const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : req.body?.token || req.query?.token;
      if (!token) {
        return res.status(401).json({ error: "Unauthorized: Missing authentication token." });
      }
      const { data: authUserData, error: tokenError } = await supabaseAdmin.auth.getUser(token);
      if (tokenError || !authUserData || !authUserData.user) {
        return res.status(401).json({ error: "Unauthorized: Invalid or expired authentication token." });
      }
      const authenticatedUserId = authUserData.user.id;
      let adminUser = null;
      const { data: userById } = await supabaseAdmin.from("users").select("id, role").eq("id", authenticatedUserId).maybeSingle();
      if (userById) {
        adminUser = userById;
      } else if (authUserData.user.email) {
        const { data: userByEmail } = await supabaseAdmin.from("users").select("id, role").eq("email", authUserData.user.email.toLowerCase()).maybeSingle();
        if (userByEmail) adminUser = userByEmail;
      }
      if (!adminUser) {
        return res.status(401).json({ error: "Unauthorized: Authenticated user record not found in database." });
      }
      if (adminUser.role !== "admin") {
        return res.status(403).json({ error: "Forbidden: Only administrators can delete learner accounts." });
      }
      const studentId = req.body?.student_id || req.body?.id || req.body?.studentId;
      if (!studentId || typeof studentId !== "string" || !studentId.trim()) {
        return res.status(400).json({ error: "Invalid request payload: student_id is required." });
      }
      const cleanStudentId = studentId.trim();
      if (!isUUID3(cleanStudentId)) {
        return res.status(400).json({ error: "Invalid student UUID format." });
      }
      const { data: targetStudent, error: findError } = await supabaseAdmin.from("students").select("id, admission_number, full_name, active").eq("id", cleanStudentId).maybeSingle();
      if (findError) {
        console.error("Error finding student in public.students:", findError);
        return res.status(500).json({ error: `Database error querying learner: ${findError.message}` });
      }
      if (!targetStudent) {
        return res.status(404).json({ error: "Learner not found in the student directory." });
      }
      const marksPromise = supabaseAdmin.from("marks").select("id", { count: "exact", head: true }).eq("student_id", cleanStudentId);
      const attendancePromise = supabaseAdmin.from("attendance").select("id", { count: "exact", head: true }).eq("student_id", cleanStudentId);
      const reportCardsPromise = supabaseAdmin.from("report_cards").select("id", { count: "exact", head: true }).eq("student_id", cleanStudentId);
      const meritListsPromise = supabaseAdmin.from("merit_lists").select("id", { count: "exact", head: true }).eq("student_id", cleanStudentId);
      const [marksRes, attRes, rcRes, mlRes] = await Promise.all([
        marksPromise,
        attendancePromise,
        reportCardsPromise,
        meritListsPromise
      ]);
      const marksCount = marksRes.count || 0;
      const attCount = attRes.count || 0;
      const rcCount = rcRes.count || 0;
      const mlCount = mlRes.count || 0;
      const totalProtectedRecords = marksCount + attCount + rcCount + mlCount;
      if (totalProtectedRecords > 0) {
        return res.status(409).json({
          error: `Cannot permanently delete learner "${targetStudent.full_name}" (${targetStudent.admission_number}) because ${totalProtectedRecords} protected academic/history record(s) exist (${marksCount} mark(s), ${attCount} attendance, ${rcCount} report card(s), ${mlCount} merit list(s)). To preserve academic history, please Deactivate or Archive the learner instead.`,
          blocked: true,
          academic_records_count: totalProtectedRecords,
          details: {
            marks_count: marksCount,
            attendance_count: attCount,
            report_cards_count: rcCount,
            merit_lists_count: mlCount
          }
        });
      }
      const { data: learnerUserProfile, error: userFindErr } = await supabaseAdmin.from("users").select("id, email, role, student_id, teacher_id").eq("student_id", cleanStudentId).maybeSingle();
      if (userFindErr) {
        console.error("Error querying learner profile in public.users:", userFindErr);
        return res.status(500).json({ error: `Database error querying learner user profile: ${userFindErr.message}` });
      }
      let authUserIdToDelete = null;
      if (learnerUserProfile) {
        if (learnerUserProfile.role !== "learner") {
          return res.status(500).json({
            error: `Integrity check failed: Associated user profile ${learnerUserProfile.id} does not have learner role (found role: "${learnerUserProfile.role}"). Deletion aborted for security.`
          });
        }
        if (learnerUserProfile.id === adminUser.id || learnerUserProfile.id === authenticatedUserId) {
          return res.status(500).json({
            error: "Integrity check failed: Attempted to delete the calling administrator account. Deletion aborted."
          });
        }
        if (learnerUserProfile.teacher_id !== null) {
          return res.status(500).json({
            error: "Integrity check failed: User profile is associated with a teacher record. Deletion aborted."
          });
        }
        authUserIdToDelete = learnerUserProfile.id;
      }
      if (!authUserIdToDelete && targetStudent.admission_number) {
        const cleanEmailPrefix = targetStudent.admission_number.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
        const canonicalEmail = `${cleanEmailPrefix}@learner.cbe.ac.ke`;
        try {
          const { data: authList } = await supabaseAdmin.auth.admin.listUsers();
          const matchAuth = authList?.users?.find(
            (u) => u.email?.toLowerCase() === canonicalEmail || u.user_metadata?.student_id === cleanStudentId || u.user_metadata?.role === "learner" && u.user_metadata?.admission_number === targetStudent.admission_number
          );
          if (matchAuth && matchAuth.id !== adminUser.id) {
            authUserIdToDelete = matchAuth.id;
          }
        } catch (e) {
          console.warn("Could not query auth.users by email prefix:", e);
        }
      }
      if (learnerUserProfile) {
        const { error: delUserErr } = await supabaseAdmin.from("users").delete().eq("id", learnerUserProfile.id).eq("role", "learner");
        if (delUserErr) {
          console.error("Error deleting learner profile from public.users:", delUserErr);
          return res.status(500).json({ error: `Failed to delete learner user profile from database: ${delUserErr.message}` });
        }
      }
      const { error: delStudentErr } = await supabaseAdmin.from("students").delete().eq("id", cleanStudentId);
      if (delStudentErr) {
        console.error("Error deleting student from public.students:", delStudentErr);
        return res.status(500).json({ error: `Failed to delete student record from database: ${delStudentErr.message}` });
      }
      let authDeleted = false;
      let authDeleteErrorMsg = null;
      if (authUserIdToDelete && isUUID3(authUserIdToDelete)) {
        try {
          const { error: authDelErr } = await supabaseAdmin.auth.admin.deleteUser(authUserIdToDelete);
          if (!authDelErr || authDelErr.message?.toLowerCase().includes("not found") || authDelErr.status === 404) {
            authDeleted = true;
          } else {
            authDeleteErrorMsg = authDelErr.message;
          }
        } catch (authEx) {
          authDeleteErrorMsg = authEx?.message || "Exception during Auth user deletion";
        }
      } else {
        authDeleted = true;
      }
      if (!authDeleted && authDeleteErrorMsg) {
        console.error(`Student DB deletion succeeded, but Supabase Auth account deletion failed for student_id: ${cleanStudentId}, auth_user_id: ${authUserIdToDelete}. Error: ${authDeleteErrorMsg}`);
        return res.status(500).json({
          error: `Database records cleared, but failed to delete Supabase Auth account: ${authDeleteErrorMsg}`,
          database_deleted: true,
          auth_deleted: false,
          cleanup_required: true,
          student_id: cleanStudentId,
          auth_user_id: authUserIdToDelete
        });
      }
      return res.status(200).json({
        success: true,
        database_deleted: true,
        auth_deleted: authDeleted,
        student_id: cleanStudentId,
        admission_number: targetStudent.admission_number,
        message: `Learner "${targetStudent.full_name}" (${targetStudent.admission_number}) deleted successfully.`
      });
    } catch (err) {
      console.error("Unhandled exception in /api/admin/delete-learner:", err);
      return res.status(500).json({ error: `Internal server error during learner deletion: ${err?.message || "Unknown error"}` });
    }
  };
  app.post("/api/admin/delete-learner", deleteLearnerHandler);
  app.delete("/api/admin/delete-learner", deleteLearnerHandler);
  const setLearnerStatusHandler = async (req, res) => {
    try {
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: "Server missing Supabase credentials." });
      }
      const supabaseAdmin = (0, import_supabase_js2.createClient)(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });
      let token = null;
      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7).trim();
      } else if (req.body && typeof req.body.token === "string" && req.body.token.trim()) {
        token = req.body.token.trim();
      }
      if (!token) {
        return res.status(401).json({ error: "Unauthorized: Missing authentication token." });
      }
      const { data: authUserData, error: tokenError } = await supabaseAdmin.auth.getUser(token);
      if (tokenError || !authUserData || !authUserData.user) {
        return res.status(401).json({ error: "Unauthorized: Invalid or expired authentication token." });
      }
      const authenticatedUserId = authUserData.user.id;
      let adminUser = null;
      const { data: userById } = await supabaseAdmin.from("users").select("id, role, email").eq("id", authenticatedUserId).maybeSingle();
      if (userById) {
        adminUser = userById;
      } else if (authUserData.user.email) {
        const { data: userByEmail } = await supabaseAdmin.from("users").select("id, role, email").eq("email", authUserData.user.email.toLowerCase()).maybeSingle();
        if (userByEmail) adminUser = userByEmail;
      }
      if (!adminUser) {
        return res.status(401).json({ error: "Unauthorized: Authenticated user record not found in database." });
      }
      if (adminUser.role !== "admin") {
        return res.status(403).json({ error: "Forbidden: Only administrators can modify learner active status." });
      }
      const { student_id, active, enrolment_status, reason } = req.body || {};
      if (!student_id || typeof student_id !== "string") {
        return res.status(400).json({ error: "Invalid request: student_id is required." });
      }
      let targetEnrolmentStatus;
      let targetActive;
      let targetStatus;
      if (enrolment_status === "future") {
        targetEnrolmentStatus = "future";
        targetActive = false;
        targetStatus = "Disabled";
      } else if (enrolment_status === "inactive") {
        targetEnrolmentStatus = "inactive";
        targetActive = false;
        targetStatus = "Disabled";
      } else if (enrolment_status === "active") {
        targetEnrolmentStatus = "active";
        targetActive = true;
        targetStatus = "Active";
      } else if (typeof active === "boolean") {
        targetActive = active;
        targetEnrolmentStatus = active ? "active" : "inactive";
        targetStatus = active ? "Active" : "Disabled";
      } else {
        return res.status(400).json({ error: "Invalid request: active (boolean) or enrolment_status ('future' | 'active' | 'inactive') is required." });
      }
      const cleanStudentId = student_id.trim();
      const { data: targetStudent, error: findStudentErr } = await supabaseAdmin.from("students").select("*").eq("id", cleanStudentId).maybeSingle();
      if (findStudentErr || !targetStudent) {
        return res.status(404).json({ error: `Student with ID "${cleanStudentId}" was not found.` });
      }
      const previousActive = targetStudent.active ?? true;
      const { error: updateStudentErr } = await supabaseAdmin.from("students").update({
        active: targetActive,
        updated_at: (/* @__PURE__ */ new Date()).toISOString()
      }).eq("id", cleanStudentId);
      if (updateStudentErr) {
        console.error("Error updating student active status:", updateStudentErr);
        return res.status(500).json({ error: `Failed to update student active status: ${updateStudentErr.message}` });
      }
      let userProfileUpdated = false;
      const { data: matchedUsers } = await supabaseAdmin.from("users").select("id, email, status, role").eq("student_id", cleanStudentId).eq("role", "learner");
      if (matchedUsers && matchedUsers.length > 0) {
        for (const userRecord of matchedUsers) {
          const { error: updateUserErr } = await supabaseAdmin.from("users").update({
            status: targetStatus,
            updated_at: (/* @__PURE__ */ new Date()).toISOString()
          }).eq("id", userRecord.id);
          if (!updateUserErr) {
            userProfileUpdated = true;
          }
          try {
            await supabaseAdmin.auth.admin.updateUserById(userRecord.id, {
              user_metadata: {
                status: targetStatus,
                active: targetActive,
                enrolment_status: targetEnrolmentStatus
              }
            });
          } catch (authMetaErr) {
            console.warn(`Could not update Auth metadata for user ${userRecord.id}:`, authMetaErr);
          }
        }
      }
      let actionType = targetActive ? "LEARNER_REACTIVATED" : "LEARNER_DEACTIVATED";
      let outcomeMessage = `Learner "${targetStudent.full_name}" (${targetStudent.admission_number}) successfully ${targetActive ? "reactivated" : "deactivated"}.`;
      if (req.body?.action === "admit") {
        actionType = "LEARNER_ADMITTED";
        outcomeMessage = `Learner "${targetStudent.full_name}" (${targetStudent.admission_number}) successfully admitted.`;
      } else if (targetEnrolmentStatus === "future") {
        actionType = "LEARNER_MARKED_FUTURE";
        outcomeMessage = `Learner "${targetStudent.full_name}" (${targetStudent.admission_number}) registered as future enrolment.`;
      }
      const admissionDate = req.body?.admission_date || (req.body?.action === "admit" ? (/* @__PURE__ */ new Date()).toISOString().split("T")[0] : null);
      try {
        await supabaseAdmin.from("audit_logs").insert([{
          user_id: adminUser.id,
          user_email: adminUser.email || authUserData.user.email,
          action_type: actionType,
          entity_table: "students",
          entity_id: cleanStudentId,
          details: {
            admission_number: targetStudent.admission_number,
            full_name: targetStudent.full_name,
            class_id: targetStudent.class_id,
            stream_id: targetStudent.stream_id,
            previous_active: previousActive,
            new_active: targetActive,
            enrolment_status: targetEnrolmentStatus,
            user_status: targetStatus,
            user_profile_updated: userProfileUpdated,
            admission_date: admissionDate,
            reason: reason || null
          },
          ip_address: req.ip || req.headers["x-forwarded-for"] || null,
          created_at: (/* @__PURE__ */ new Date()).toISOString()
        }]);
      } catch (auditErr) {
        console.warn("Could not insert audit log for learner status update:", auditErr);
      }
      return res.status(200).json({
        success: true,
        student_id: cleanStudentId,
        admission_number: targetStudent.admission_number,
        full_name: targetStudent.full_name,
        active: targetActive,
        enrolment_status: targetEnrolmentStatus,
        admission_date: admissionDate,
        status: targetStatus,
        action: actionType,
        message: outcomeMessage
      });
    } catch (err) {
      console.error("Unhandled exception in /api/admin/set-learner-status:", err);
      return res.status(500).json({ error: `Internal server error during status update: ${err?.message || "Unknown error"}` });
    }
  };
  app.post("/api/admin/set-learner-status", setLearnerStatusHandler);
  app.put("/api/admin/set-learner-status", setLearnerStatusHandler);
  const updateTeacherHandler = async (req, res) => {
    try {
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: "Server missing Supabase credentials." });
      }
      const supabaseAdmin = (0, import_supabase_js2.createClient)(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });
      let token = null;
      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7).trim();
      } else if (req.body && typeof req.body.token === "string" && req.body.token.trim()) {
        token = req.body.token.trim();
      }
      if (!token) {
        return res.status(401).json({ error: "Unauthorized: Missing authentication token." });
      }
      const { data: authUserData, error: tokenError } = await supabaseAdmin.auth.getUser(token);
      if (tokenError || !authUserData || !authUserData.user) {
        return res.status(401).json({ error: "Unauthorized: Invalid or expired authentication token." });
      }
      const authenticatedUserId = authUserData.user.id;
      let adminUser = null;
      const { data: userById } = await supabaseAdmin.from("users").select("id, role").eq("id", authenticatedUserId).maybeSingle();
      if (userById) {
        adminUser = userById;
      } else if (authUserData.user.email) {
        const { data: userByEmail } = await supabaseAdmin.from("users").select("id, role").eq("email", authUserData.user.email.toLowerCase()).maybeSingle();
        if (userByEmail) adminUser = userByEmail;
      }
      if (!adminUser) {
        return res.status(401).json({ error: "Unauthorized: Authenticated user record not found in database." });
      }
      if (adminUser.role !== "admin") {
        return res.status(403).json({ error: "Forbidden: Only administrators can update teacher accounts." });
      }
      const { teacher } = req.body || {};
      if (!teacher) {
        return res.status(400).json({ error: "Teacher object is required." });
      }
      const teacherIdInput = teacher.id;
      const targetEmail = teacher.email ? teacher.email.trim().toLowerCase() : "";
      let targetTeacherId = isUUID3(teacherIdInput) ? teacherIdInput : null;
      if (!targetTeacherId) {
        if (targetEmail) {
          const { data: tByEmail } = await supabaseAdmin.from("teachers").select("id").eq("email", targetEmail).maybeSingle();
          if (tByEmail) targetTeacherId = tByEmail.id;
        }
        if (!targetTeacherId && teacherIdInput) {
          const { data: tById } = await supabaseAdmin.from("teachers").select("id").eq("id", teacherIdInput).maybeSingle();
          if (tById) targetTeacherId = tById.id;
        }
      }
      if (!targetTeacherId) {
        return res.status(404).json({ error: "Teacher record not found in database." });
      }
      const isClassTeacher = Boolean(teacher.is_class_teacher);
      const { data: updatedTeacher, error: updateTErr } = await supabaseAdmin.from("teachers").update({
        teacher_name: teacher.teacher_name,
        email: teacher.email,
        phone: teacher.phone || null,
        tsc_number: teacher.tsc_number || null,
        is_class_teacher: isClassTeacher
      }).eq("id", targetTeacherId).select().maybeSingle();
      if (updateTErr) {
        console.error("Error updating teacher in DB:", updateTErr);
        return res.status(400).json({ error: `Failed to update teacher: ${updateTErr.message}` });
      }
      if (targetEmail) {
        await supabaseAdmin.from("users").update({
          name: teacher.teacher_name,
          email: teacher.email,
          role: isClassTeacher ? "class_teacher" : "subject_teacher"
        }).or(`teacher_id.eq.${targetTeacherId},email.eq.${targetEmail}`);
      }
      await supabaseAdmin.from("streams").update({ class_teacher_id: null }).eq("class_teacher_id", targetTeacherId);
      if (isClassTeacher && teacher.class_teacher_of_id && isUUID3(teacher.class_teacher_of_id)) {
        await supabaseAdmin.from("streams").update({ class_teacher_id: targetTeacherId }).eq("id", teacher.class_teacher_of_id);
      }
      if (teacher.allocations !== void 0) {
        const allocations = teacher.allocations || [];
        const rawInserts = [];
        for (const alloc of allocations) {
          try {
            const resolved = await resolveAllocationUUIDs(supabaseAdmin, alloc);
            if (resolved.subject_id) {
              rawInserts.push({
                subject_id: resolved.subject_id,
                class_id: resolved.class_id || null,
                stream_id: resolved.stream_id || null
              });
            }
          } catch (resErr) {
            console.warn(`Allocation resolution warning during update:`, resErr.message);
            return res.status(400).json({ error: `Failed to resolve allocation: ${resErr.message}` });
          }
        }
        const seenKeys = /* @__PURE__ */ new Set();
        const allocPayload = [];
        for (const item of rawInserts) {
          const key = `${item.subject_id}_${item.class_id || "null"}_${item.stream_id || "null"}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            allocPayload.push(item);
          }
        }
        const { data: rpcAllocRes, error: rpcAllocErr } = await supabaseAdmin.rpc("update_teacher_allocations_atomic", {
          p_teacher_id: targetTeacherId,
          p_allocations: allocPayload
        });
        if (rpcAllocErr) {
          if (rpcAllocErr.code === "PGRST202") {
            const { data: existingAllocs } = await supabaseAdmin.from("teacher_subjects").select("subject_id, class_id, stream_id").eq("teacher_id", targetTeacherId);
            const { error: delAllocErr } = await supabaseAdmin.from("teacher_subjects").delete().eq("teacher_id", targetTeacherId);
            if (delAllocErr) {
              console.error("Error clearing old allocations in fallback:", delAllocErr);
              return res.status(400).json({ error: `Failed to update allocations: ${delAllocErr.message}` });
            }
            if (allocPayload.length > 0) {
              const inserts = allocPayload.map((a) => ({ teacher_id: targetTeacherId, ...a }));
              const { error: insAllocErr } = await supabaseAdmin.from("teacher_subjects").insert(inserts);
              if (insAllocErr) {
                console.error("Failed to insert new allocations in fallback, restoring original allocations:", insAllocErr);
                if (existingAllocs && existingAllocs.length > 0) {
                  await supabaseAdmin.from("teacher_subjects").insert(existingAllocs.map((a) => ({ teacher_id: targetTeacherId, ...a })));
                }
                return res.status(400).json({ error: `Failed to save teacher allocations: ${insAllocErr.message}` });
              }
            }
          } else {
            console.error("RPC update_teacher_allocations_atomic failed:", rpcAllocErr);
            return res.status(400).json({ error: `Failed to update teacher allocations: ${rpcAllocErr.message}` });
          }
        }
      }
      return res.status(200).json({
        success: true,
        teacher: updatedTeacher
      });
    } catch (err) {
      console.error("Error in /api/admin/update-teacher:", err);
      return res.status(500).json({ error: "Internal server error during teacher update." });
    }
  };
  app.post("/api/admin/update-teacher", updateTeacherHandler);
  app.put("/api/admin/update-teacher", updateTeacherHandler);
  const deleteTeacherHandler = async (req, res) => {
    try {
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: "Server missing Supabase credentials." });
      }
      const supabaseAdmin = (0, import_supabase_js2.createClient)(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });
      const { teacherId, email, userId } = req.body || {};
      let token = null;
      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7).trim();
      } else if (req.body && typeof req.body.token === "string" && req.body.token.trim()) {
        token = req.body.token.trim();
      }
      if (!token) {
        return res.status(401).json({ error: "Unauthorized: Missing authentication token." });
      }
      const { data: authUserData, error: tokenError } = await supabaseAdmin.auth.getUser(token);
      if (tokenError || !authUserData || !authUserData.user) {
        return res.status(401).json({ error: "Unauthorized: Invalid or expired authentication token." });
      }
      const authenticatedUserId = authUserData.user.id;
      let adminUser = null;
      const { data: userById } = await supabaseAdmin.from("users").select("id, role").eq("id", authenticatedUserId).maybeSingle();
      if (userById) {
        adminUser = userById;
      } else if (authUserData.user.email) {
        const { data: userByEmail } = await supabaseAdmin.from("users").select("id, role").eq("email", authUserData.user.email.toLowerCase()).maybeSingle();
        if (userByEmail) adminUser = userByEmail;
      }
      if (!adminUser) {
        return res.status(401).json({ error: "Unauthorized: Authenticated user record not found in database." });
      }
      if (adminUser.role !== "admin") {
        return res.status(403).json({ error: "Forbidden: Only administrators can delete teacher accounts." });
      }
      const cleanTeacherId = teacherId ? String(teacherId).trim() : null;
      const cleanUserId = userId ? String(userId).trim() : null;
      const cleanEmail = email ? String(email).trim().toLowerCase() : null;
      if (!cleanTeacherId && !cleanUserId && !cleanEmail) {
        return res.status(400).json({ error: "Missing teacher identifier: teacherId, userId, or email required." });
      }
      let resolvedTeacherId = cleanTeacherId;
      let resolvedUserId = cleanUserId;
      let resolvedEmail = cleanEmail;
      let isAlreadyDeleted = false;
      let rpcRes = null;
      let rpcErr = null;
      const rpcCall = await supabaseAdmin.rpc("delete_teacher_atomic", {
        p_teacher_id: cleanTeacherId,
        p_user_id: cleanUserId,
        p_email: cleanEmail
      });
      rpcRes = rpcCall.data;
      rpcErr = rpcCall.error;
      if (rpcErr) {
        if (rpcErr.code === "PGRST202") {
          console.warn("RPC delete_teacher_atomic not found in schema cache (PGRST202). Executing direct database fallback deletion.");
          let foundTeacherId = cleanTeacherId;
          let foundUserId = cleanUserId;
          let foundEmail = cleanEmail;
          if (cleanTeacherId) {
            const { data: t } = await supabaseAdmin.from("teachers").select("id, user_id, email").eq("id", cleanTeacherId).maybeSingle();
            if (t) {
              foundTeacherId = t.id;
              if (t.user_id) foundUserId = t.user_id;
              if (t.email) foundEmail = t.email.toLowerCase();
            }
          } else if (cleanEmail) {
            const { data: t } = await supabaseAdmin.from("teachers").select("id, user_id, email").ilike("email", cleanEmail).maybeSingle();
            if (t) {
              foundTeacherId = t.id;
              if (t.user_id) foundUserId = t.user_id;
              if (t.email) foundEmail = t.email.toLowerCase();
            }
          } else if (cleanUserId) {
            const { data: t } = await supabaseAdmin.from("teachers").select("id, user_id, email").eq("user_id", cleanUserId).maybeSingle();
            if (t) {
              foundTeacherId = t.id;
              if (t.user_id) foundUserId = t.user_id;
              if (t.email) foundEmail = t.email.toLowerCase();
            }
          }
          if (!foundUserId && foundTeacherId) {
            const { data: u } = await supabaseAdmin.from("users").select("id, email").eq("teacher_id", foundTeacherId).maybeSingle();
            if (u) {
              foundUserId = u.id;
              if (u.email && !foundEmail) foundEmail = u.email.toLowerCase();
            }
          }
          if (!foundUserId && cleanUserId) {
            const { data: u } = await supabaseAdmin.from("users").select("id, email").eq("id", cleanUserId).maybeSingle();
            if (u) {
              foundUserId = u.id;
              if (u.email && !foundEmail) foundEmail = u.email.toLowerCase();
            }
          }
          if (!foundUserId && foundEmail) {
            const { data: u } = await supabaseAdmin.from("users").select("id, email").ilike("email", foundEmail).maybeSingle();
            if (u) {
              foundUserId = u.id;
            }
          }
          if (!foundTeacherId && !foundUserId) {
            rpcRes = {
              success: true,
              already_deleted: true,
              teacher_id: cleanTeacherId,
              user_id: cleanUserId,
              email: cleanEmail
            };
          } else {
            if (foundTeacherId) {
              await supabaseAdmin.from("teacher_subjects").delete().eq("teacher_id", foundTeacherId);
              await supabaseAdmin.from("streams").update({ class_teacher_id: null }).eq("class_teacher_id", foundTeacherId);
              await supabaseAdmin.from("teachers").delete().eq("id", foundTeacherId);
            }
            if (foundEmail) {
              await supabaseAdmin.from("teachers").delete().ilike("email", foundEmail);
            }
            if (foundUserId) {
              await supabaseAdmin.from("users").delete().eq("id", foundUserId);
            }
            if (foundTeacherId) {
              await supabaseAdmin.from("users").delete().eq("teacher_id", foundTeacherId);
            }
            if (foundEmail) {
              await supabaseAdmin.from("users").delete().ilike("email", foundEmail);
            }
            rpcRes = {
              success: true,
              already_deleted: false,
              teacher_id: foundTeacherId || cleanTeacherId,
              user_id: foundUserId || cleanUserId,
              email: foundEmail || cleanEmail
            };
          }
        } else {
          console.error("RPC delete_teacher_atomic failed:", rpcErr);
          return res.status(500).json({
            error: `Database atomic teacher deletion failed: ${rpcErr.message || "RPC execution error"}`
          });
        }
      }
      if (!rpcRes || typeof rpcRes !== "object") {
        return res.status(500).json({ error: "Database atomic teacher deletion failed: Invalid response from RPC function." });
      }
      if (!rpcRes.success) {
        return res.status(500).json({ error: rpcRes.error || "Database atomic teacher deletion failed." });
      }
      isAlreadyDeleted = !!rpcRes.already_deleted;
      if (rpcRes.teacher_id) resolvedTeacherId = String(rpcRes.teacher_id);
      if (rpcRes.user_id) resolvedUserId = String(rpcRes.user_id);
      if (rpcRes.email) resolvedEmail = String(rpcRes.email).toLowerCase();
      let authDeleteSuccess = false;
      let authDeleteErrorMsg = null;
      const candidateAuthUuids = /* @__PURE__ */ new Set();
      if (resolvedUserId && isUUID3(resolvedUserId)) candidateAuthUuids.add(resolvedUserId);
      if (cleanUserId && isUUID3(cleanUserId)) candidateAuthUuids.add(cleanUserId);
      if (resolvedTeacherId && isUUID3(resolvedTeacherId)) candidateAuthUuids.add(resolvedTeacherId);
      if (cleanTeacherId && isUUID3(cleanTeacherId)) candidateAuthUuids.add(cleanTeacherId);
      const targetEmail = (resolvedEmail || cleanEmail || "").toLowerCase().trim();
      if (candidateAuthUuids.size > 0) {
        for (const authUuid of candidateAuthUuids) {
          try {
            const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(authUuid);
            if (!authErr) {
              authDeleteSuccess = true;
            } else if (authErr.message?.toLowerCase().includes("not found") || authErr.status === 404) {
              authDeleteSuccess = true;
            } else {
              authDeleteErrorMsg = authErr.message;
            }
          } catch (err) {
            authDeleteErrorMsg = err?.message || "Auth deletion exception";
          }
        }
      }
      if (!authDeleteSuccess && targetEmail) {
        try {
          const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
          const matchAuth = listData?.users?.find((u) => u.email?.toLowerCase() === targetEmail);
          if (matchAuth) {
            const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(matchAuth.id);
            if (!authErr || authErr.message?.toLowerCase().includes("not found") || authErr.status === 404) {
              authDeleteSuccess = true;
            } else {
              authDeleteErrorMsg = authErr.message;
            }
          } else {
            authDeleteSuccess = true;
          }
        } catch (err) {
          authDeleteErrorMsg = err?.message || "Auth list/delete exception";
        }
      }
      if (candidateAuthUuids.size === 0 && !targetEmail) {
        authDeleteSuccess = true;
      }
      if (!authDeleteSuccess && authDeleteErrorMsg) {
        console.error(`Teacher DB deletion succeeded, but Supabase Auth account deletion failed for teacher_id: ${resolvedTeacherId || cleanTeacherId}, user_id: ${resolvedUserId || cleanUserId}, email: ${targetEmail || cleanEmail}. Error: ${authDeleteErrorMsg}`);
        return res.status(500).json({
          error: `Database records cleared, but failed to delete Supabase Auth account: ${authDeleteErrorMsg}`,
          database_deleted: true,
          auth_deleted: false,
          cleanup_required: true,
          teacher_id: resolvedTeacherId || cleanTeacherId,
          user_id: resolvedUserId || cleanUserId,
          email: targetEmail || cleanEmail
        });
      }
      return res.status(200).json({
        success: true,
        database_deleted: true,
        auth_deleted: true,
        already_deleted: isAlreadyDeleted,
        message: isAlreadyDeleted ? "Teacher account was already deleted or does not exist." : "Teacher and associated records deleted successfully."
      });
    } catch (err) {
      console.error("Error in /api/admin/delete-teacher:", err);
      return res.status(500).json({ error: "Internal server error during teacher deletion." });
    }
  };
  app.post("/api/admin/delete-teacher", deleteTeacherHandler);
  app.delete("/api/admin/delete-teacher", deleteTeacherHandler);
  const resetPasswordHandler = async (req, res) => {
    try {
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: "Server missing Supabase credentials." });
      }
      const supabaseAdmin = (0, import_supabase_js2.createClient)(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });
      const { emailOrUserId, newPassword, forcePasswordChange = true, email, teacherId, userId } = req.body || {};
      if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
        return res.status(400).json({ error: "Invalid password: Must be at least 6 characters long." });
      }
      let token = null;
      const authHeader = req.headers.authorization || req.headers.Authorization;
      if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7).trim();
      } else if (req.body && typeof req.body.token === "string" && req.body.token.trim()) {
        token = req.body.token.trim();
      }
      if (!token) {
        return res.status(401).json({ error: "Unauthorized: Missing authentication token." });
      }
      const { data: authUserData, error: tokenError } = await supabaseAdmin.auth.getUser(token);
      if (tokenError || !authUserData || !authUserData.user) {
        return res.status(401).json({ error: "Unauthorized: Invalid or expired authentication token." });
      }
      const authenticatedUserId = authUserData.user.id;
      let isAdmin = false;
      const { data: callerUser } = await supabaseAdmin.from("users").select("role").eq("id", authenticatedUserId).maybeSingle();
      if (callerUser && (callerUser.role === "admin" || callerUser.role === "administrator")) {
        isAdmin = true;
      } else {
        const { data: callerTeacher } = await supabaseAdmin.from("teachers").select("role").eq("user_id", authenticatedUserId).maybeSingle();
        if (callerTeacher && (callerTeacher.role === "admin" || callerTeacher.role === "administrator")) {
          isAdmin = true;
        }
      }
      if (!isAdmin) {
        return res.status(403).json({ error: "Forbidden: Only administrators can reset user passwords." });
      }
      let targetAuthUserId = null;
      const cleanTarget = (emailOrUserId || email || "").trim().toLowerCase();
      if (userId && isUUID3(userId)) {
        targetAuthUserId = userId;
      } else if (teacherId) {
        const { data: tRow } = await supabaseAdmin.from("teachers").select("user_id").eq("id", teacherId).maybeSingle();
        if (tRow?.user_id) {
          targetAuthUserId = tRow.user_id;
        }
      }
      if (!targetAuthUserId && cleanTarget) {
        const { data: uRow } = await supabaseAdmin.from("users").select("id").eq("email", cleanTarget).maybeSingle();
        if (uRow?.id) {
          targetAuthUserId = uRow.id;
        }
      }
      if (!targetAuthUserId && cleanTarget) {
        const { data: tRow } = await supabaseAdmin.from("teachers").select("user_id").eq("email", cleanTarget).maybeSingle();
        if (tRow?.user_id) {
          targetAuthUserId = tRow.user_id;
        }
      }
      if (!targetAuthUserId && cleanTarget) {
        try {
          const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
          const matchAuth = listData?.users?.find((u) => u.email?.toLowerCase() === cleanTarget);
          if (matchAuth) {
            targetAuthUserId = matchAuth.id;
          }
        } catch (lErr) {
          console.warn("Error searching Auth users by email:", lErr);
        }
      }
      if (!targetAuthUserId) {
        return res.status(404).json({ error: "Target user account not found in Supabase Auth." });
      }
      const { data: updateRes, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        targetAuthUserId,
        {
          password: newPassword,
          user_metadata: { force_password_change: !!forcePasswordChange }
        }
      );
      if (updateError) {
        console.error("Supabase Auth updateUserById error:", updateError);
        return res.status(500).json({ error: `Supabase Auth error: ${updateError.message}` });
      }
      await supabaseAdmin.from("users").update({
        force_password_change: !!forcePasswordChange,
        temporary_password: null
      }).eq("id", targetAuthUserId);
      if (cleanTarget) {
        await supabaseAdmin.from("teachers").update({
          force_password_change: !!forcePasswordChange,
          temporary_password: null
        }).eq("email", cleanTarget);
      }
      return res.status(200).json({
        success: true,
        message: "Password updated successfully in Supabase Auth.",
        targetAuthUserId
      });
    } catch (err) {
      console.error("Error in /api/admin/reset-password:", err);
      return res.status(500).json({ error: "Internal server error during password reset." });
    }
  };
  app.post("/api/admin/reset-password", resetPasswordHandler);
  app.post("/api/auth/resolve-identifier", async (req, res) => {
    try {
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: "Server missing Supabase credentials." });
      }
      const supabaseAdmin = (0, import_supabase_js2.createClient)(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      });
      const { identifier } = req.body || {};
      if (!identifier || typeof identifier !== "string") {
        return res.status(400).json({ error: "Identifier required" });
      }
      const trimmed = identifier.trim();
      if (trimmed.includes("@")) {
        return res.json({ email: trimmed.toLowerCase() });
      }
      const alphanumeric = trimmed.replace(/[^a-z0-9]/gi, "");
      const { data: dbTeachers } = await supabaseAdmin.from("teachers").select("*").or(`tsc_number.ilike.%${trimmed}%,tsc_number.ilike.%${alphanumeric}%,username.ilike.${trimmed}`).limit(1);
      if (dbTeachers && dbTeachers.length > 0 && dbTeachers[0].email) {
        return res.json({ email: dbTeachers[0].email.toLowerCase(), teacher: dbTeachers[0] });
      }
      const { data: dbUsers } = await supabaseAdmin.from("users").select("*").or(`email.ilike.%${trimmed}%,name.ilike.%${trimmed}%`).limit(1);
      if (dbUsers && dbUsers.length > 0 && dbUsers[0].email) {
        return res.json({ email: dbUsers[0].email.toLowerCase(), user: dbUsers[0] });
      }
      const { data: dbStudents } = await supabaseAdmin.from("students").select("*").or(`admission_number.ilike.${trimmed},admission_number.ilike.%${alphanumeric}%`).limit(1);
      if (dbStudents && dbStudents.length > 0) {
        const dbStudent = dbStudents[0];
        if (dbStudent.enrolment_status === "future") {
          return res.status(403).json({
            error: "This learner account is registered for future intake and has not yet been activated. Please contact school administration.",
            code: "LEARNER_FUTURE",
            active: false,
            enrolment_status: "future",
            student_id: dbStudent.id,
            admission_number: dbStudent.admission_number
          });
        }
        if (dbStudent.active === false || dbStudent.enrolment_status === "inactive") {
          return res.status(403).json({
            error: "This learner account is inactive or transferred. Please contact school administration.",
            code: "LEARNER_INACTIVE",
            active: false,
            enrolment_status: "inactive",
            student_id: dbStudent.id,
            admission_number: dbStudent.admission_number
          });
        }
        const { data: dbLearnerUsers } = await supabaseAdmin.from("users").select("*").eq("student_id", dbStudent.id).limit(1);
        if (dbLearnerUsers && dbLearnerUsers.length > 0) {
          const dbLearnerUser = dbLearnerUsers[0];
          if (dbLearnerUser.status === "Disabled") {
            return res.status(403).json({
              error: "This learner account is inactive or transferred. Please contact school administration.",
              code: "LEARNER_INACTIVE",
              active: false,
              student_id: dbStudent.id,
              admission_number: dbStudent.admission_number
            });
          }
          if (dbLearnerUser.email) {
            return res.json({
              email: dbLearnerUser.email.toLowerCase(),
              user: dbLearnerUser,
              student: dbStudent
            });
          }
        }
        const learnerEmail = `${dbStudent.admission_number.toLowerCase().replace(/[^a-z0-9-]/g, "")}@learner.cbe.ac.ke`;
        return res.json({
          email: learnerEmail,
          student: dbStudent
        });
      }
      return res.json({ email: null });
    } catch (err) {
      console.error("Error in /api/auth/resolve-identifier:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });
  app.get("/api/learner/class-teachers", async (req, res) => {
    try {
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: "Server missing Supabase credentials." });
      }
      const supabaseAdmin = (0, import_supabase_js2.createClient)(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      });
      const { data: streams, error: streamErr } = await supabaseAdmin.from("streams").select("id, class_id, stream_name, class_teacher_id").not("class_teacher_id", "is", null);
      if (streamErr || !streams || streams.length === 0) {
        return res.json({ teachers: [] });
      }
      const teacherIds = Array.from(
        new Set(streams.map((s) => s.class_teacher_id).filter((id) => Boolean(id) && isUUID3(id)))
      );
      if (teacherIds.length === 0) {
        return res.json({ teachers: [] });
      }
      const { data: teachers, error: teacherErr } = await supabaseAdmin.from("teachers").select("id, teacher_name, email").in("id", teacherIds);
      if (teacherErr) {
        return res.status(400).json({ error: teacherErr.message });
      }
      return res.json({
        teachers: (teachers || []).map((t) => ({
          id: t.id,
          teacher_name: t.teacher_name,
          email: t.email
        }))
      });
    } catch (err) {
      console.error("Error in /api/learner/class-teachers:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });
  app.get("/api/learner/exam-ranking", async (req, res) => {
    try {
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseUrl || !supabaseServiceKey) {
        return res.status(500).json({ error: "Server missing Supabase credentials." });
      }
      const supabaseAdmin = (0, import_supabase_js2.createClient)(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      });
      const authHeader = req.headers.authorization || req.headers.Authorization;
      let token = null;
      if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7).trim();
      } else if (req.query && typeof req.query.token === "string") {
        token = req.query.token.trim();
      }
      let authenticatedUserId = null;
      let authEmail = null;
      if (token) {
        const { data: authUserData, error: tokenError } = await supabaseAdmin.auth.getUser(token);
        if (!tokenError && authUserData?.user) {
          authenticatedUserId = authUserData.user.id;
          authEmail = authUserData.user.email ? authUserData.user.email.toLowerCase().trim() : null;
        }
      }
      if (!authenticatedUserId && !authEmail) {
        return res.status(401).json({ error: "Unauthorized: Authentication token is required." });
      }
      let targetStudentId = null;
      const { data: userById } = authenticatedUserId ? await supabaseAdmin.from("users").select("*").eq("id", authenticatedUserId).maybeSingle() : { data: null };
      let currentUser = userById;
      if (!currentUser && authEmail) {
        const { data: userByEmail } = await supabaseAdmin.from("users").select("*").eq("email", authEmail).maybeSingle();
        if (userByEmail) currentUser = userByEmail;
      }
      if (currentUser?.role === "learner" || currentUser?.student_id) {
        targetStudentId = currentUser.student_id;
      }
      if (!targetStudentId && authEmail) {
        const admPrefix = authEmail.split("@")[0];
        const { data: stdByAdm } = await supabaseAdmin.from("students").select("id").ilike("admission_number", admPrefix).maybeSingle();
        if (stdByAdm) targetStudentId = stdByAdm.id;
      }
      if ((!currentUser || currentUser.role === "admin" || currentUser.role === "class_teacher" || currentUser.role === "subject_teacher") && req.query.student_id) {
        targetStudentId = String(req.query.student_id).trim();
      }
      if (!targetStudentId) {
        return res.status(403).json({ error: "Forbidden: Learner student identity could not be established." });
      }
      const examId = (req.query.exam_id || req.query.examId || req.query.id || "").toString().trim();
      if (!examId || !isUUID3(examId)) {
        return res.status(400).json({ error: "Valid exam_id is required." });
      }
      const [
        { data: studentRow, error: stdErr },
        { data: examRow, error: examErr },
        { data: dbStudents, error: allStdErr },
        { data: dbClasses, error: classErr },
        { data: dbStreams, error: streamErr },
        { data: dbSubjects, error: subErr },
        { data: dbGrades, error: grErr },
        { data: dbMarks, error: markErr }
      ] = await Promise.all([
        supabaseAdmin.from("students").select("*").eq("id", targetStudentId).maybeSingle(),
        supabaseAdmin.from("examinations").select("*").eq("id", examId).maybeSingle(),
        supabaseAdmin.from("students").select("*").eq("active", true),
        supabaseAdmin.from("classes").select("*"),
        supabaseAdmin.from("streams").select("*"),
        supabaseAdmin.from("subjects").select("*"),
        supabaseAdmin.from("grades").select("*"),
        supabaseAdmin.from("marks").select("*").eq("exam_id", examId)
      ]);
      if (stdErr || !studentRow) {
        return res.status(404).json({ error: "Learner record not found." });
      }
      if (examErr || !examRow) {
        return res.status(404).json({ error: "Examination not found." });
      }
      if (studentRow.active === false || studentRow.enrolment_status === "inactive" || studentRow.enrolment_status === "future") {
        return res.status(403).json({ error: "Learner record is inactive." });
      }
      const mergedClasses = [];
      (dbClasses || []).forEach((c) => {
        const cStreams = (dbStreams || []).filter((s) => s.class_id === c.id);
        if (cStreams.length > 0) {
          cStreams.forEach((st) => {
            mergedClasses.push({
              id: c.id,
              stream_id: st.id,
              class_name: c.class_name,
              stream: st.stream_name || "A",
              capacity: st.capacity || c.capacity || 40,
              class_teacher_id: st.class_teacher_id || void 0,
              education_level: c.education_level,
              status: c.status || "Active"
            });
          });
        } else {
          mergedClasses.push({
            id: c.id,
            stream_id: c.id,
            class_name: c.class_name,
            stream: c.stream || "",
            capacity: c.capacity || 40,
            education_level: c.education_level,
            status: c.status || "Active"
          });
        }
      });
      const allActiveStudents = (dbStudents || []).map((s) => {
        const matchedClass = (s.stream_id ? mergedClasses.find((c) => c.stream_id === s.stream_id || c.id === s.stream_id) : void 0) || (s.class_id ? mergedClasses.find((c) => c.id === s.class_id || c.stream_id === s.class_id) : void 0);
        return {
          ...s,
          name: s.name || s.full_name || "",
          grade: s.grade || matchedClass?.class_name || ""
        };
      });
      if (!allActiveStudents.some((s) => s.id === studentRow.id)) {
        const matchedTargetClass = (studentRow.stream_id ? mergedClasses.find((c) => c.stream_id === studentRow.stream_id || c.id === studentRow.stream_id) : void 0) || (studentRow.class_id ? mergedClasses.find((c) => c.id === studentRow.class_id || c.stream_id === studentRow.class_id) : void 0);
        allActiveStudents.push({
          ...studentRow,
          name: studentRow.name || studentRow.full_name || "",
          grade: studentRow.grade || matchedTargetClass?.class_name || ""
        });
      }
      const examResults = calculateExamResults(
        examId,
        allActiveStudents,
        dbMarks || [],
        dbGrades || [],
        mergedClasses,
        dbSubjects || []
      );
      const targetResult = examResults.find((r) => r.student_id === studentRow.id);
      const gradeStudentIds = getGradeCohortStudentIds(studentRow, allActiveStudents, examRow, mergedClasses);
      const gradeResults = examResults.filter((r) => gradeStudentIds.has(r.student_id));
      const totalGradeAssessedStudents = gradeResults.filter((r) => r.is_complete !== false).length || gradeResults.length || 1;
      const streamStudentIds = getStreamCohortStudentIds(studentRow, allActiveStudents, examRow, mergedClasses);
      const streamResults = examResults.filter((r) => streamStudentIds.has(r.student_id));
      const streamAssessedStudentsCount = streamResults.filter((r) => r.is_complete !== false).length || streamResults.length || 1;
      const isAssessmentComplete = targetResult ? targetResult.is_complete !== false : false;
      const streamRank = isAssessmentComplete && (targetResult?.class_position || targetResult?.position) ? targetResult.class_position || targetResult.position : null;
      const overallRank = isAssessmentComplete && targetResult?.position ? targetResult.position : null;
      return res.json({
        stream_rank: streamRank,
        stream_total: streamAssessedStudentsCount,
        overall_rank: overallRank,
        overall_total: totalGradeAssessedStudents,
        is_complete: isAssessmentComplete,
        total_marks: targetResult?.total_marks || 0,
        average: targetResult?.average || 0,
        total_points: targetResult?.total_points || 0,
        performance_level: targetResult?.performance_level || "Pending",
        grade_code: targetResult?.grade_code || "Pending"
      });
    } catch (err) {
      console.error("Error in /api/learner/exam-ranking:", err);
      return res.status(500).json({ error: "Internal server error calculating learner cohort ranking." });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.get(["/server.cjs", "/server.cjs.map"], (req, res) => res.status(404).end());
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
