import { getApplicableSubjectsForGrade } from './src/types';
import { initialSubjects } from './src/data/seedData';

const result = getApplicableSubjectsForGrade('', initialSubjects);
console.log(result.map(s => s.subject_name));
