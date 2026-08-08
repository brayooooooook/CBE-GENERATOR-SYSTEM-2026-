const fs = require('fs');
let content = fs.readFileSync('src/components/ExaminationAnalysisValidation.tsx', 'utf8');

const replacement = `
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* 1. Education Level */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Education Level <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedLevel}
              onChange={(e) => {
                const lvl = e.target.value as EducationLevel;
                setSelectedLevel(lvl);
                setSelectedClassId('');
                setSelectedExamId('');
              }}
              className="w-full bg-slate-50 border border-slate-300 text-slate-900 rounded-lg p-2 text-xs font-semibold focus:ring-2 focus:ring-amber-500"
            >
              <option value="">Select Level...</option>
              {ALL_EDUCATION_LEVELS.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {lvl}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Class */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Class <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedClassId}
              onChange={(e) => {
                setSelectedClassId(e.target.value);
                setSelectedStreamId('');
                setSelectedExamId('');
              }}
              disabled={!selectedLevel}
              className="w-full bg-slate-50 border border-slate-300 text-slate-900 rounded-lg p-2 text-xs font-semibold focus:ring-2 focus:ring-amber-500 disabled:opacity-50"
            >
              {!selectedLevel ? (
                <option value="">Select Level First...</option>
              ) : uniqueClasses.length === 0 ? (
                <option value="" disabled>No active classes found for {selectedLevel}</option>
              ) : (
                <>
                  <option value="">Select Class...</option>
                  {uniqueClasses.map((className) => (
                    <option key={className} value={className}>
                      {className}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>

          {/* 3. Stream */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Stream
            </label>
            <select
              value={selectedStreamId}
              onChange={(e) => setSelectedStreamId(e.target.value)}
              disabled={!selectedClassId}
              className="w-full bg-slate-50 border border-slate-300 text-slate-900 rounded-lg p-2 text-xs font-semibold focus:ring-2 focus:ring-amber-500 disabled:opacity-50"
            >
              {!selectedClassId ? (
                <option value="">Select Class First...</option>
              ) : (
                <>
                  <option value="">Select Stream...</option>
                  <option value="all">All Streams</option>
                  {availableStreams.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.stream}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>

          {/* 4. Academic Year */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Academic Year <span className="text-rose-500">*</span>
            </label>
            <select
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
            </select>
          </div>

          {/* 5. Term */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Term <span className="text-rose-500">*</span>
            </label>
            <select
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
            </select>
          </div>

          {/* 6. Examination */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Examination <span className="text-rose-500">*</span>
            </label>
            <select
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
            </select>
          </div>
        </div>
`;

content = content.replace(/<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">[\s\S]*?<\/div>\s*<\/div>\s*\{\/\* Selection Incomplete Placeholder \*\/\}/, replacement + '\n      </div>\n\n      {/* Selection Incomplete Placeholder */}');

fs.writeFileSync('src/components/ExaminationAnalysisValidation.tsx', content);
