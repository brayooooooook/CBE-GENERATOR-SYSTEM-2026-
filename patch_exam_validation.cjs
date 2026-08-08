const fs = require('fs');
const file = 'src/components/ExaminationAnalysisValidation.tsx';
let content = fs.readFileSync(file, 'utf8');

const target = `  const learnerSubjects = useMemo(() => {
    if (!selectedClassObject) return [];
    return getApplicableSubjectsForGrade(selectedClassObject.class_name, subjects);
  }, [selectedClassObject, subjects]);`;

const replacement = `  const learnerSubjects = useMemo(() => {
    if (!selectedClassObject) return [];
    const baseApplicable = getApplicableSubjectsForGrade(selectedClassObject.class_name, subjects);
    
    if (currentUser?.role === 'admin') return baseApplicable;
    
    if (currentUser?.role === 'teacher') {
      const isClassTeacher = activeTeacher?.is_class_teacher && (activeTeacher?.class_teacher_of_id === selectedClassObject.id || selectedClassObject.class_teacher_id === activeTeacher.id);
      
      if (isClassTeacher) {
         return baseApplicable;
      }
      
      const assignedIds = getTeacherAssignedSubjectIds(activeTeacher);
      return baseApplicable.filter(s => assignedIds.includes(s.id));
    }
    
    return baseApplicable;
  }, [selectedClassObject, subjects, currentUser, activeTeacher]);`;

content = content.replace(target, replacement);

fs.writeFileSync(file, content);
