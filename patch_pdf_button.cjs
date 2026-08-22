const fs = require('fs');
const file = 'src/components/SchoolPerformanceAnalytics.tsx';
let code = fs.readFileSync(file, 'utf8');

const targetStr = `{/* PDF Downloads Dropdown */}`;
const endStr = `        </div>
      )}
`;

const startIndex = code.indexOf(targetStr);
const endIndex = code.indexOf(endStr, startIndex) + endStr.length;

if (startIndex === -1 || endIndex < startIndex) {
  console.log("Could not find the target block");
  process.exit(1);
}

const replacement = `          {/* Comprehensive PDF Download */}
          <div className="ml-auto relative">
            <button
              disabled={isExporting}
              onClick={() => triggerPDFExport(() => exportComprehensiveAnalyticsPDF(analytics, comparison, school), 'Comprehensive Analytics Report')}
              className={\`px-4 py-2 text-xs font-bold rounded-xl shadow-md transition-all flex items-center space-x-2 \${
                isExporting 
                  ? 'bg-slate-400 text-slate-100 cursor-not-allowed' 
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }\`}
            >
              {isExporting ? (
                <>
                  <Activity className="w-4 h-4 animate-spin" />
                  <span>Generating {analytics.education_level_title} Analytics Report...</span>
                </>
              ) : (
                <>
                  <FileDown className="w-4 h-4" />
                  <span>Download PDF Reports</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {exportSuccessMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center space-x-2 animate-fade-in mb-4">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{exportSuccessMsg}</span>
        </div>
      )}
      
      {exportErrorMsg && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs font-semibold flex items-center space-x-2 animate-fade-in mb-4">
          <ShieldCheck className="w-4 h-4 text-red-600" />
          <span>{exportErrorMsg}</span>
        </div>
      )}
`;

const newCode = code.substring(0, startIndex) + replacement + code.substring(endIndex);
fs.writeFileSync(file, newCode);
console.log("Patched successfully");
