const fs = require('fs');
const file = 'src/components/AdminDashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

// Add import
content = content.replace(
  "import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';",
  "import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';\nimport { ChartWrapper } from './ChartWrapper';"
);

// Replace the chart div with ChartWrapper
const oldChart = `<div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">`;
const newChart = `<ChartWrapper className="h-64 w-full" hasData={chartData.some(d => d.count > 0)}>
            <ResponsiveContainer width="100%" height="100%">`;

content = content.replace(oldChart, newChart);

content = content.replace(
  `            </ResponsiveContainer>
          </div>`,
  `            </ResponsiveContainer>
          </ChartWrapper>`
);

fs.writeFileSync(file, content);
