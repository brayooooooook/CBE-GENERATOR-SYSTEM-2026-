const fs = require('fs');
const file = 'src/components/ReportsView.tsx';
let content = fs.readFileSync(file, 'utf8');

const dlPdfBtn = `) : (
            <button
              onClick={handleDownloadSinglePdf}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-sm transition flex items-center space-x-1.5"
            >
              <Download className="w-4 h-4" />
              <span>Download PDF Report</span>
            </button>
          )}`;

const newDlPdfBtn = `) : reportTab === 'individual' ? (
            <button
              onClick={handleDownloadSinglePdf}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-sm transition flex items-center space-x-1.5"
            >
              <Download className="w-4 h-4" />
              <span>Download PDF Report</span>
            </button>
          ) : null}`;

content = content.replace(dlPdfBtn, newDlPdfBtn);

fs.writeFileSync(file, content);
