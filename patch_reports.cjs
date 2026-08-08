const fs = require('fs');
const file = 'src/components/ReportsView.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "export const ReportsView: React.FC<ReportsViewProps> = ({\n  school,",
  "export const ReportsView: React.FC<ReportsViewProps> = ({\n  school,"
);

content = content.replace(
  "  const [reportTab, setReportTab] = useState<'individual' | 'batch' | 'provisional' | 'merit' | 'subject' | 'grades'>('individual');",
  "  const activeTeacher = currentUser?.role === 'teacher' ? (teachers || []).find(t => t.id === currentUser.teacher_id || t.email === currentUser.email) : null;\n  const isSubjectTeacherOnly = currentUser?.role === 'teacher' && !activeTeacher?.is_class_teacher;\n  const [reportTab, setReportTab] = useState<'individual' | 'batch' | 'provisional' | 'merit' | 'subject' | 'grades'>(isSubjectTeacherOnly ? 'subject' : 'individual');"
);

const buttonsBlock = `<button
            onClick={() => setReportTab('individual')}
            className={\`px-3 py-2 text-xs font-bold rounded-lg transition \${
              reportTab === 'individual'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }\`}
          >
            Learner Report Form
          </button>
          <button
            onClick={() => setReportTab('batch')}
            className={\`px-3 py-2 text-xs font-bold rounded-lg transition flex items-center space-x-1 \${
              reportTab === 'batch'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }\`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Batch Class Reports ({targetStudents.length})</span>
          </button>
          <button
            onClick={() => setReportTab('provisional')}
            className={\`px-3 py-2 text-xs font-bold rounded-lg transition flex items-center space-x-1 \${
              reportTab === 'provisional'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }\`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Provisional Student Results</span>
          </button>
          <button
            onClick={() => setReportTab('merit')}
            className={\`px-3 py-2 text-xs font-bold rounded-lg transition \${
              reportTab === 'merit'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }\`}
          >
            Class Merit List
          </button>`;

const newButtonsBlock = `{!isSubjectTeacherOnly && (
            <>
              <button
                onClick={() => setReportTab('individual')}
                className={\`px-3 py-2 text-xs font-bold rounded-lg transition \${
                  reportTab === 'individual'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }\`}
              >
                Learner Report Form
              </button>
              <button
                onClick={() => setReportTab('batch')}
                className={\`px-3 py-2 text-xs font-bold rounded-lg transition flex items-center space-x-1 \${
                  reportTab === 'batch'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }\`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Batch Class Reports ({targetStudents.length})</span>
              </button>
              <button
                onClick={() => setReportTab('provisional')}
                className={\`px-3 py-2 text-xs font-bold rounded-lg transition flex items-center space-x-1 \${
                  reportTab === 'provisional'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }\`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Provisional Student Results</span>
              </button>
              <button
                onClick={() => setReportTab('merit')}
                className={\`px-3 py-2 text-xs font-bold rounded-lg transition \${
                  reportTab === 'merit'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }\`}
              >
                Class Merit List
              </button>
            </>
          )}`;
content = content.replace(buttonsBlock, newButtonsBlock);

const gradesButton = `<button
            onClick={() => setReportTab('grades')}
            className={\`px-3 py-2 text-xs font-bold rounded-lg transition \${
              reportTab === 'grades'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }\`}
          >
            Grade Distribution
          </button>`;
const newGradesButton = `{!isSubjectTeacherOnly && (
            <button
              onClick={() => setReportTab('grades')}
              className={\`px-3 py-2 text-xs font-bold rounded-lg transition \${
                reportTab === 'grades'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }\`}
            >
              Grade Distribution
            </button>
          )}`;
content = content.replace(gradesButton, newGradesButton);

fs.writeFileSync(file, content);
