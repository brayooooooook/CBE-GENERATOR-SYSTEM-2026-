import { getApplicableSubjectsForGrade } from './src/types';
import { initialSubjects } from './src/data/seedData';

const result = getApplicableSubjectsForGrade('Grade 9', initialSubjects);
console.log(result.map(s => s.subject_name));
