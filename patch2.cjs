const fs = require('fs');
const file = 'src/services/analysisEngine.ts';
let code = fs.readFileSync(file, 'utf8');

const regex = /export function getStudentExpectedSubjects\([\s\S]*?return applicableSubjects;\s*\}/;

const replace = `export function getStudentExpectedSubjects(
  student: Student,
  subjects: Subject[],
  classObj?: ClassStream,
  teachers?: Teacher[] // kept for signature compatibility
): Subject[] {
  if (classObj) {
    if (classObj.allocated_subject_ids && classObj.allocated_subject_ids.length > 0) {
      return getAllocatedSubjectsForClass(classObj, subjects);
    }
  }
  const stdGrade = student.grade || classObj?.class_name || '';
  return getApplicableSubjectsForGrade(stdGrade, subjects);
}`;

if (regex.test(code)) {
    fs.writeFileSync(file, code.replace(regex, replace));
    console.log("Patched successfully.");
} else {
    console.log("Regex didn't match.");
}
