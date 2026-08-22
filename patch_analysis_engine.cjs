const fs = require('fs');
const file = 'src/services/analysisEngine.ts';
let code = fs.readFileSync(file, 'utf8');

const target = `export function getStudentExpectedSubjects(
  student: Student,
  subjects: Subject[],
  classObj?: ClassStream,
  teachers?: Teacher[]
): Subject[] {
  const stdGrade = student.grade || classObj?.class_name || '';
  let applicableSubjects = getApplicableSubjectsForGrade(stdGrade, subjects);

  const safeTeachers = teachers || (typeof api !== 'undefined' ? api.getTeachers() : []);

  if (classObj) {
    const classId = classObj.id;
    const allocatedSubjectIds = new Set<string>();
    let hasClassTeacher = false;

    safeTeachers.forEach(t => {
      if (t.class_teacher_of_id === classId) {
        hasClassTeacher = true;
      }
      (t.allocations || []).forEach(a => {
        if (a.class_id === classId) {
          allocatedSubjectIds.add(a.subject_id);
        }
      });
    });

    const isLowerPrimary = ['Pre-Primary', 'Lower Primary'].includes(classObj.education_level || getEducationLevelForGrade(classObj.class_name));

    if (isLowerPrimary && hasClassTeacher && allocatedSubjectIds.size === 0) {
      // Fallback for PP1, PP2 and Lower Primary: if they have a class teacher but no explicit allocations, assume all apply as per CBE rule.
    } else {
      // For Upper Primary and Junior School, or if not using the fallback, strictly intersect!
      // If there are no allocations at all, this will correctly result in an empty list, meaning no subjects are offered yet.
      applicableSubjects = applicableSubjects.filter(s => allocatedSubjectIds.has(s.id));
    }
  }

  return applicableSubjects;
}`;

const replace = `export function getStudentExpectedSubjects(
  student: Student,
  subjects: Subject[],
  classObj?: ClassStream,
  teachers?: Teacher[] // kept for signature compatibility
): Subject[] {
  if (classObj) {
    // If the class has explicit allocations via allocated_subject_ids, use them directly
    if (classObj.allocated_subject_ids && classObj.allocated_subject_ids.length > 0) {
      return getAllocatedSubjectsForClass(classObj, subjects);
    }
  }

  // Fallback to purely grade-based applicable subjects if no explicit class allocation exists yet
  const stdGrade = student.grade || classObj?.class_name || '';
  return getApplicableSubjectsForGrade(stdGrade, subjects);
}`;

if (code.includes(target)) {
    fs.writeFileSync(file, code.replace(target, replace));
    console.log("Patched getStudentExpectedSubjects successfully.");
} else {
    console.log("Could not find target content to replace.");
}
