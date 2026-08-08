const fs = require('fs');
const file = 'src/components/StudentDashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

// Add import
content = content.replace(
  "import { canViewTermData, getTermStatusMessage } from \"../utils/termStatusUtils\";",
  "import { canViewTermData, getTermStatusMessage } from \"../utils/termStatusUtils\";\nimport { ChartWrapper } from './ChartWrapper';"
);

// Replace the chart div with ChartWrapper
const oldChart = `{examProgressData.length > 0 ? (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">`;
const newChart = `<ChartWrapper className="h-64 w-full" hasData={examProgressData.length > 0}>
            <ResponsiveContainer width="100%" height="100%">`;

content = content.replace(oldChart, newChart);

content = content.replace(
  `            </ResponsiveContainer>
          </div>
        ) : (
          <div className="text-center py-8 text-slate-400 text-xs">No exam trend data available yet.</div>
        )}`,
  `            </ResponsiveContainer>
          </ChartWrapper>`
);

fs.writeFileSync(file, content);
