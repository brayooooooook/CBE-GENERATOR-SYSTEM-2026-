import { describe, it, expect, vi } from 'vitest';
import { exportRawMarksAllSubjectsPDF } from '../services/rawMarksPdfExporter';
import { getFilteredStudents } from '../utils/filterUtils';
import { Student, ClassStream, Examination, Subject, Mark, Grade, School } from '../types';

// Mock jsPDF and jspdf-autotable
vi.mock('jspdf', () => {
  const MockDoc = function () {
    return {
      internal: {
        pageSize: {
          getWidth: () => 297,
          getHeight: () => 210,
        },
        getNumberOfPages: () => 1,
      },
      setPage: vi.fn(),
      addImage: vi.fn(),
      setFontSize: vi.fn(),
      setFont: vi.fn(),
      setTextColor: vi.fn(),
      text: vi.fn(),
      setDrawColor: vi.fn(),
      setLineWidth: vi.fn(),
      line: vi.fn(),
      rect: vi.fn(),
      save: vi.fn(),
    };
  };
  return {
    default: MockDoc,
    jsPDF: MockDoc,
  };
});

vi.mock('jspdf-autotable', () => ({
  default: vi.fn(),
}));

describe('Raw Marks All Subjects PDF Exporter', () => {
  const mockSchool: School = {
    id: 'sch_1',
    school_name: 'Sample CBE Academy',
    county: 'Nairobi',
    motto: 'Strive for Excellence',
    address: 'P.O. Box 100, Nairobi',
    phone: '0712345678',
    email: 'info@sample.ac.ke',
  };

  const mockExam: Examination = {
    id: 'exam_2026_t1_op',
    exam_name: 'Opening Assessment',
    exam_type: 'CAT',
    max_marks: 50,
    term: 'Term 1',
    year: 2026,
    status: 'Open',
    start_date: '2026-01-10',
    end_date: '2026-01-20',
  };

  const mockClasses: ClassStream[] = [
    {
      id: 'cls_g7',
      stream_id: 'strm_g7_east',
      class_name: 'Grade 7',
      stream: 'East',
      capacity: 45,
    },
    {
      id: 'cls_g7',
      stream_id: 'strm_g7_west',
      class_name: 'Grade 7',
      stream: 'West',
      capacity: 45,
    },
  ];

  const mockSubjects: Subject[] = [
    { id: 'sub_math', subject_name: 'Mathematics', subject_code: 'MATH', category: 'Core', status: 'Active' },
    { id: 'sub_eng', subject_name: 'English', subject_code: 'ENG', category: 'Core', status: 'Active' },
  ];

  const mockStudents: Student[] = [
    {
      id: 'std_1',
      admission_number: 'ADM001',
      full_name: 'Faith Achieng',
      gender: 'F',
      class_id: 'cls_g7',
      stream_id: 'strm_g7_east',
    } as Student,
    {
      id: 'std_2',
      admission_number: 'ADM002',
      full_name: 'Brian Kiprono',
      gender: 'M',
      class_id: 'cls_g7',
      stream_id: 'strm_g7_east',
    } as Student,
    {
      id: 'std_3',
      admission_number: 'ADM003',
      full_name: 'Alice Wambui',
      gender: 'F',
      class_id: 'cls_g7',
      stream_id: 'strm_g7_west',
    } as Student,
  ];

  const mockMarks: Mark[] = [
    {
      id: 'mk_1',
      student_id: 'std_1',
      subject_id: 'sub_math',
      exam_id: 'exam_2026_t1_op',
      score: 78,
      status: 'Present',
    } as unknown as Mark,
  ];

  const mockGrades: Grade[] = [];

  it('1. getFilteredStudents resolves students when passed a stream_id directly', () => {
    const eastStudents = getFilteredStudents(mockStudents, mockClasses, 'strm_g7_east', 'strm_g7_east', mockExam);
    expect(eastStudents.length).toBe(2);
    expect(eastStudents.map((s) => s.admission_number)).toEqual(['ADM001', 'ADM002']);
  });

  it('2. exportRawMarksAllSubjectsPDF successfully exports when selectedClassId is a stream_id', async () => {
    await expect(
      exportRawMarksAllSubjectsPDF({
        school: mockSchool,
        exam: mockExam,
        selectedClassId: 'strm_g7_east',
        selectedStreamId: 'strm_g7_east',
        students: mockStudents,
        subjects: mockSubjects,
        marks: mockMarks,
        grades: mockGrades,
        classes: mockClasses,
      })
    ).resolves.not.toThrow();
  });

  it('3. exportRawMarksAllSubjectsPDF successfully exports when selectedClassId is a class_name', async () => {
    await expect(
      exportRawMarksAllSubjectsPDF({
        school: mockSchool,
        exam: mockExam,
        selectedClassId: 'Grade 7',
        selectedStreamId: 'strm_g7_east',
        students: mockStudents,
        subjects: mockSubjects,
        marks: mockMarks,
        grades: mockGrades,
        classes: mockClasses,
      })
    ).resolves.not.toThrow();
  });

  it('4. exportRawMarksAllSubjectsPDF successfully exports for all streams of a class level', async () => {
    await expect(
      exportRawMarksAllSubjectsPDF({
        school: mockSchool,
        exam: mockExam,
        selectedClassId: 'Grade 7',
        selectedStreamId: 'all',
        students: mockStudents,
        subjects: mockSubjects,
        marks: mockMarks,
        grades: mockGrades,
        classes: mockClasses,
      })
    ).resolves.not.toThrow();
  });
});
