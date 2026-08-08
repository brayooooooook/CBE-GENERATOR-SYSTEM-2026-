const fs = require('fs');
let content = fs.readFileSync('src/components/ExaminationAnalysisValidation.tsx', 'utf8');

const replacement = `
          <h2 className="text-lg font-bold text-slate-900">Selection Required</h2>
          <div className="text-xs text-slate-600 max-w-md mx-auto text-left space-y-2">
            <p>Please select:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Education Level</li>
              <li>Class</li>
              <li>Stream (where applicable)</li>
              <li>Academic Year</li>
              <li>Term</li>
              <li>Examination</li>
            </ul>
            <p>to begin Examination Analysis & Validation.</p>
          </div>
`;

content = content.replace(/<h2 className="text-lg font-bold text-slate-900">Selection Required<\/h2>\s*<p className="text-xs text-slate-600 max-w-md mx-auto">\s*Please select the Education Level, Class, Academic Year, Term, and Examination using the filter bar above to start examination validation and quality control\.\s*<\/p>/, replacement.trim());

fs.writeFileSync('src/components/ExaminationAnalysisValidation.tsx', content);
