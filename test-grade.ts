import { extractGradeName, getEducationLevelForGrade } from './src/types';

console.log(extractGradeName('9 Blue'));
console.log(getEducationLevelForGrade(extractGradeName('9 Blue') || '9 Blue'));

console.log(extractGradeName('Grade 9 - BLUE'));
console.log(getEducationLevelForGrade(extractGradeName('Grade 9 - BLUE') || 'Grade 9 - BLUE'));
