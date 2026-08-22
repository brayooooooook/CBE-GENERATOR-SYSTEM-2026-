const fs = require('fs');
let content = fs.readFileSync('src/components/ReportsView.tsx', 'utf8');

const filterPanelRegex = /\{\/\* Filter Controls Panel \(Hidden in Print\) \*\/\}[\s\S]*?\{\/\* MANDATORY CHECKPOINT GUARD FOR OFFICIAL REPORTS \*\/\}/;

const replacement = `{/* Filter Controls Panel (Hidden in Print) */}
      <div className="print:hidden bg-slate-900 text-white rounded-xl p-4 shadow-md border border-slate-800 flex flex-wrap items-center gap-4 text-xs">
        <div>
          <label className="block text-slate-400 font-semibold mb-1">Select Examination:</label>
          <select
            value={selectedExamId}
            onChange={(e) => setSelectedExamId(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white rounded-lg p-2 font-semibold focus:outline-none"
          >
            <option value="">Select Examination...</option>
            {exams.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.exam_name} [{ex.status}]
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-slate-400 font-semibold mb-1">Select Class:</label>
          <select
            value={selectedClassId}
            onChange={(e) => {
              setSelectedClassId(e.target.value);
              setSelectedStreamId('');
              setSelectedStudentId('');
            }}
            disabled={!selectedExamId}
            className="bg-slate-800 border border-slate-700 text-white rounded-lg p-2 font-semibold focus:outline-none disabled:opacity-50"
          >
            {!selectedExamId ? (
              <option value="">Select Exam First...</option>
            ) : (
              <>
                <option value="">Select Class...</option>
                {uniqueClasses.map((className) => {
                  const count = getFilteredStudents(accessibleStudents, accessibleClasses, className, 'all').length;
                  return (
                    <option key={className} value={className}>
                      {className} ({count} learners)
                    </option>
                  );
                })}
              </>
            )}
          </select>
        </div>

        <div>
          <label className="block text-slate-400 font-semibold mb-1">Select Stream:</label>
          <select
            value={selectedStreamId}
            onChange={(e) => {
              setSelectedStreamId(e.target.value);
              setSelectedStudentId('');
            }}
            disabled={!selectedClassId}
            className="bg-slate-800 border border-slate-700 text-white rounded-lg p-2 font-semibold focus:outline-none font-medium disabled:opacity-50"
          >
            {!selectedClassId ? (
              <option value="">Select Class First...</option>
            ) : (
              <>
                <option value="">Select Stream...</option>
                <option value="all">
                  All Streams ({selectedClassId || 'This Class'})
                </option>
                {accessibleClasses
                  .filter(
                    (c) =>
                      c.class_name.toLowerCase() === selectedClassId.toLowerCase() ||
                      c.id === selectedClassId
                  )
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.class_name} - {c.stream} ({accessibleStudents.filter((s) => s.class_id === c.id).length} learners)
                    </option>
                  ))}
              </>
            )}
          </select>
        </div>

        {reportTab === 'subject' && (
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Select Learning Area (Subject):</label>
            <select
              value={selectedSubjectId}
              onChange={(e) => setSelectedSubjectId(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-white rounded-lg p-2 font-semibold focus:outline-none max-w-xs"
            >
              <option value="">Select Subject...</option>
              {displaySubjects.map((sb) => (
                <option key={sb.id} value={sb.id}>
                  {sb.subject_name} ({sb.subject_code})
                </option>
              ))}
            </select>
          </div>
        )}

        {reportTab === 'individual' && (
          <div>
            <label className="block text-slate-400 font-semibold mb-1">Select Learner:</label>
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              disabled={!selectedStreamId}
              className="bg-slate-800 border border-slate-700 text-white rounded-lg p-2 font-semibold focus:outline-none max-w-xs disabled:opacity-50"
            >
              {!selectedStreamId ? (
                <option value="">Select Stream First...</option>
              ) : targetStudents.length > 0 ? (
                <>
                  <option value="">Select Learner...</option>
                  {targetStudents.map((std) => (
                    <option key={std.id} value={std.id}>
                      {std.full_name} ({std.admission_number})
                    </option>
                  ))}
                </>
              ) : (
                <option value="">No learners found</option>
              )}
            </select>
          </div>
        )}
      </div>

      {/* MANDATORY CHECKPOINT GUARD FOR OFFICIAL REPORTS */}`;

content = content.replace(filterPanelRegex, replacement);

fs.writeFileSync('src/components/ReportsView.tsx', content);
