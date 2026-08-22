const fs = require('fs');
let content = fs.readFileSync('src/components/ReportsView.tsx', 'utf8');

// Insert isSelectionComplete definition before handleDownloadSinglePdf
content = content.replace(
  /  const handleDownloadSinglePdf = async \(\) => \{/,
  `  const isSelectionComplete = React.useMemo(() => {
    if (!selectedExamId || !selectedClassId || !selectedStreamId) return false;
    if (reportTab === 'individual' && !selectedStudentId) return false;
    if (reportTab === 'subject' && !selectedSubjectId) return false;
    return true;
  }, [selectedExamId, selectedClassId, selectedStreamId, selectedStudentId, selectedSubjectId, reportTab]);

  const handleDownloadSinglePdf = async () => {`
);

// Add Placeholder Render Logic right before TAB 1
const tab1Marker = "{/* TAB 1: INDIVIDUAL LEARNER ASSESSMENT REPORT */}";
const placeholder = `
          {/* SELECTION INCOMPLETE PLACEHOLDER */}
          {!isSelectionComplete ? (
            <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-8 text-center space-y-4 max-w-lg mx-auto my-12 shadow-sm">
              <div className="inline-flex p-3 bg-amber-100 text-amber-700 rounded-full">
                <Filter className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Selection Required</h2>
                <p className="text-sm text-slate-600 mt-2 font-medium">Please select:</p>
                <ul className="text-sm text-slate-700 text-left list-disc pl-8 mt-2 space-y-1 mx-auto max-w-xs font-semibold">
                  <li>Examination</li>
                  <li>Class</li>
                  <li>Stream (where applicable)</li>
                  {reportTab === 'individual' && <li>Learner (for individual reports)</li>}
                  {reportTab === 'subject' && <li>Learning Area (Subject)</li>}
                </ul>
              </div>
              <p className="text-xs text-slate-500 font-medium">before generating reports.</p>
              
              {selectedClassId && selectedStreamId && targetStudents.length === 0 && (
                <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold inline-block">
                  ⚠️ No learners found for the selected class and stream.
                </div>
              )}
            </div>
          ) : (
            <>
`;

content = content.replace(tab1Marker, placeholder + "\n          " + tab1Marker);

// Close the React Fragment at the very bottom
content = content.replace(
  "      )}\n        </>\n      )}\n    </div>\n  );\n};",
  "      )}\n            </>\n          )}\n        </>\n      )}\n    </div>\n  );\n};"
);

fs.writeFileSync('src/components/ReportsView.tsx', content);
