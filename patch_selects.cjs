const fs = require('fs');
let content = fs.readFileSync('src/components/ExaminationAnalysisValidation.tsx', 'utf8');

// Update Stream select
content = content.replace(
  /<select[\s\S]*?value={selectedStreamId}[\s\S]*?disabled={!selectedClassId}[\s\S]*?>[\s\S]*?<\/select>/m,
  `<select
              value={selectedStreamId}
              onChange={(e) => setSelectedStreamId(e.target.value)}
              disabled={!selectedClassId}
              className="w-full bg-slate-50 border border-slate-300 text-slate-900 rounded-lg p-2 text-xs font-semibold focus:ring-2 focus:ring-amber-500 disabled:opacity-50"
            >
              {!selectedClassId ? (
                <option value="">Select Class First...</option>
              ) : (
                <>
                  <option value="all">All Streams</option>
                  {availableStreams.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.stream}
                    </option>
                  ))}
                </>
              )}
            </select>`
);

// Update Academic Year select
content = content.replace(
  /<select[\s\S]*?value={selectedYear}[\s\S]*?onChange={\(e\) => setSelectedYear\(Number\(e\.target\.value\)\)}[\s\S]*?>[\s\S]*?<\/select>/m,
  `<select
              value={selectedYear}
              onChange={(e) => {
                 setSelectedYear(e.target.value ? Number(e.target.value) : '');
                 setSelectedTerm('');
                 setSelectedExamId('');
              }}
              className="w-full bg-slate-50 border border-slate-300 text-slate-900 rounded-lg p-2 text-xs font-semibold focus:ring-2 focus:ring-amber-500"
            >
              <option value="">Select Academic Year...</option>
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>`
);

// Update Term select
content = content.replace(
  /<select[\s\S]*?value={selectedTerm}[\s\S]*?onChange={\(e\) => setSelectedTerm\(e\.target\.value\)}[\s\S]*?>[\s\S]*?<\/select>/m,
  `<select
              value={selectedTerm}
              onChange={(e) => {
                 setSelectedTerm(e.target.value);
                 setSelectedExamId('');
              }}
              disabled={!selectedYear}
              className="w-full bg-slate-50 border border-slate-300 text-slate-900 rounded-lg p-2 text-xs font-semibold focus:ring-2 focus:ring-amber-500 disabled:opacity-50"
            >
              {!selectedYear ? (
                <option value="">Select Year First...</option>
              ) : (
                <>
                  <option value="">Select Term...</option>
                  {availableTerms.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </>
              )}
            </select>`
);

// Update Examination select
content = content.replace(
  /<select[\s\S]*?value={selectedExamId}[\s\S]*?onChange={\(e\) => setSelectedExamId\(e\.target\.value\)}[\s\S]*?disabled={availableExams\.length === 0}[\s\S]*?>[\s\S]*?<\/select>/m,
  `<select
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              disabled={!selectedTerm || availableExams.length === 0}
              className="w-full bg-slate-50 border border-slate-300 text-slate-900 rounded-lg p-2 text-xs font-semibold focus:ring-2 focus:ring-amber-500 disabled:opacity-50"
            >
              {!selectedTerm ? (
                <option value="">Select Term First...</option>
              ) : availableExams.length === 0 ? (
                <option value="" disabled>No exam found</option>
              ) : (
                <>
                  <option value="">Select Exam...</option>
                  {availableExams.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.exam_name} [{ex.status}]
                    </option>
                  ))}
                </>
              )}
            </select>`
);

fs.writeFileSync('src/components/ExaminationAnalysisValidation.tsx', content);
