const fs = require('fs');
let content = fs.readFileSync('src/components/ReportsView.tsx', 'utf8');

// Replace Exam Select
content = content.replace(
  /<select[\s\S]*?value=\{selectedExamId\}[\s\S]*?onChange=\{\(e\) => setSelectedExamId\(e\.target\.value\)\}[\s\S]*?>[\s\S]*?\{exams\.map\(\(ex\) => \([\s\S]*?<\/select>/,
  `<select
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
          </select>`
);

// Replace Class Select
content = content.replace(
  /<select[\s\S]*?value=\{selectedClassId\}[\s\S]*?onChange=\{\(e\) => \{[\s\S]*?setSelectedClassId\(e\.target\.value\);[\s\S]*?setSelectedStreamId\(''\);[\s\S]*?\}\}[\s\S]*?>[\s\S]*?\{uniqueClasses\.map\(\(className\) => \{[\s\S]*?<\/select>/,
  `<select
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
          </select>`
);

// Replace Stream Select
content = content.replace(
  /<select[\s\S]*?value=\{selectedStreamId\}[\s\S]*?onChange=\{\(e\) => setSelectedStreamId\(e\.target\.value\)\}[\s\S]*?>[\s\S]*?\{accessibleClasses[\s\S]*?<\/select>/,
  `<select
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
          </select>`
);

// Replace Subject Select
content = content.replace(
  /<select[\s\S]*?value=\{selectedSubjectId\}[\s\S]*?onChange=\{\(e\) => setSelectedSubjectId\(e\.target\.value\)\}[\s\S]*?>[\s\S]*?\{displaySubjects\.map\(\(sb\) => \([\s\S]*?<\/select>/,
  `<select
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
            </select>`
);

// Replace Learner Select
content = content.replace(
  /<select[\s\S]*?value=\{selectedStudentId\}[\s\S]*?onChange=\{\(e\) => setSelectedStudentId\(e\.target\.value\)\}[\s\S]*?>[\s\S]*?\{targetStudents\.length > 0 \? \([\s\S]*?<\/select>/,
  `<select
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
            </select>`
);

fs.writeFileSync('src/components/ReportsView.tsx', content);
