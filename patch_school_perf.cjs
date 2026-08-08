const fs = require('fs');
const file = 'src/components/SchoolPerformanceAnalytics.tsx';
let content = fs.readFileSync(file, 'utf8');

// Add import
content = content.replace(
  "import { api } from \"../lib/storage\";",
  "import { api } from \"../lib/storage\";\nimport { ChartWrapper } from './ChartWrapper';"
);

// Class Mean Performance Comparison (%)
let oldChart = `<div className="h-64">
                <ResponsiveContainer width="100%" height="100%">`;
let newChart = `<ChartWrapper className="h-64 w-full" hasData={classChartData.some(d => d['Mean Score (%)'] > 0)}>
                <ResponsiveContainer width="100%" height="100%">`;

content = content.replace(oldChart, newChart);

content = content.replace(
  `                </ResponsiveContainer>
              </div>
            </div>`,
  `                </ResponsiveContainer>
              </ChartWrapper>
            </div>`
);

// Competency Level Distribution
oldChart = `<div className="h-64 flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">`;
newChart = `<ChartWrapper className="h-64 w-full" hasData={pieChartData.some(d => d.value > 0)}>
                <ResponsiveContainer width="100%" height="100%">`;

content = content.replace(oldChart, newChart);

content = content.replace(
  `                </ResponsiveContainer>
              </div>
            </div>`,
  `                </ResponsiveContainer>
              </ChartWrapper>
            </div>`
);

// Subject Performance Standings across School (%)
oldChart = `<div className="h-72">
              <ResponsiveContainer width="100%" height="100%">`;
newChart = `<ChartWrapper className="h-72 w-full" hasData={subjectChartData.some(d => d['Mean Score (%)'] > 0)}>
              <ResponsiveContainer width="100%" height="100%">`;

content = content.replace(oldChart, newChart);

content = content.replace(
  `              </ResponsiveContainer>
            </div>
          </div>`,
  `              </ResponsiveContainer>
            </ChartWrapper>
          </div>`
);

fs.writeFileSync(file, content);
