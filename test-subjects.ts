import { getApplicableSubjectsForGrade } from './src/types';

const mockSubjects = [
  { id: '1', subject_name: 'Language', subject_code: 'LAN' },
  { id: '2', subject_name: 'Mathematics', subject_code: 'MAT' },
  { id: '3', subject_name: 'Kiswahili', subject_code: 'KIS' },
  { id: '4', subject_name: 'Science & Technology', subject_code: 'SCT' },
  { id: '5', subject_name: 'English', subject_code: 'ENG' },
  { id: '6', subject_name: 'Creative', subject_code: 'CREA' },
  { id: '7', subject_name: 'Pre-Technical Studies', subject_code: 'PTS' },
  { id: '8', subject_name: 'Psychomotor & Creative', subject_code: 'P&C' },
  { id: '9', subject_name: 'Social Studies', subject_code: 'SST' },
  { id: '10', subject_name: 'Creative Arts', subject_code: 'CA' },
  { id: '11', subject_name: 'Integrated Science', subject_code: 'ISC' },
  { id: '12', subject_name: 'Environmental', subject_code: 'ENV' },
  { id: '13', subject_name: 'CRE', subject_code: 'CRE' },
  { id: '14', subject_name: 'Agriculture', subject_code: 'AGR' },
] as any[];

const result = getApplicableSubjectsForGrade('Grade 9', mockSubjects);
console.log(result.map(s => s.subject_name));
