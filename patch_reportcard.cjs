const fs = require('fs');
const file = 'src/components/LearnerReportCard.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  "savedRemarks?: LearnerReportComment;",
  "savedRemarks?: LearnerReportComment;\n  canModify?: boolean;"
);

content = content.replace(
  "export const LearnerReportCard: React.FC<LearnerReportCardProps> = ({",
  "export const LearnerReportCard: React.FC<LearnerReportCardProps> = ({\n  canModify = false,"
);

content = content.replace(
  "onClick={() => setIsEditing(!isEditing)}",
  "onClick={() => setIsEditing(!isEditing)}\n              disabled={!canModify}"
);

fs.writeFileSync(file, content);
