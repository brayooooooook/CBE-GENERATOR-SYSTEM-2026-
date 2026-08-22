const fs = require('fs');
const file = 'src/components/ExaminationManagement.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace imports
content = content.replace(
  "import { isTermModifiable, canViewTermData, getTermStatusMessage } from '../utils/termStatusUtils';",
  "import { isTermModifiable, canViewTermData, getTermStatusMessage, canPlanExams, canApproveExams } from '../utils/termStatusUtils';"
);

// Replace term closed check in header to reflect the whole thing
content = content.replace(
  "const canModify = isTermModifiable(activeTermObj.status);",
  "const canModify = isTermModifiable(activeTermObj.status);\n  const canPlan = canPlanExams(activeTermObj.status);\n  const canApprove = canApproveExams(activeTermObj.status);"
);

// Hide add exam form if !canPlan
content = content.replace(
  "{isAdding ? (",
  "{isAdding && canPlan ? ("
);

// Remove the Add button if !canPlan
content = content.replace(
  /<button\s+onClick=\{\(\) => setIsAdding\(true\)\}\s+className="bg-slate-900[\s\S]*?<\/button>/,
  `{canPlan && (<button
            onClick={() => setIsAdding(true)}
            className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md transition flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Schedule New Examination</span>
          </button>)}`
);

// Status action buttons
content = content.replace(
  "{/* Status Action Buttons */}",
  "{/* Status Action Buttons */}\n                {canApprove && ex.status === 'Draft' && (\n                  <button\n                    onClick={() => {\n                      onUpdateStatus(ex.id, 'Provisional');\n                    }}\n                    className=\"bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm transition\"\n                  >\n                    Submit for Provisional Verification\n                  </button>\n                )}\n                {canApprove && ex.status === 'Provisional' && (\n                  <div className=\"flex items-center space-x-2\">\n                    <button\n                      onClick={() => {\n                        onUpdateStatus(ex.id, 'Approved');\n                      }}\n                      className=\"bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm transition flex items-center space-x-1\"\n                    >\n                      <Lock className=\"w-3.5 h-3.5\" />\n                      <span>Approve & Lock Official Results</span>\n                    </button>\n                    <button\n                      onClick={() => {\n                        onUpdateStatus(ex.id, 'Draft');\n                      }}\n                      className=\"bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold px-3 py-1.5 rounded-lg transition\"\n                    >\n                      Revert to Draft\n                    </button>\n                  </div>\n                )}\n                {canApprove && ex.status === 'Approved' && (\n                  <button\n                    onClick={() => {\n                      onUpdateStatus(ex.id, 'Provisional');\n                    }}\n                    className=\"bg-slate-200 hover:bg-amber-100 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-lg transition flex items-center space-x-1\"\n                  >\n                    <Unlock className=\"w-3.5 h-3.5\" />\n                    <span>Unlock for Corrections</span>\n                  </button>\n                )}\n                {/* DELETE BUTTON - ADMINISTRATOR ONLY */}\n                {isAdmin && canPlan && ex.status === 'Draft' && (\n                  <button\n                    type=\"button\"\n                    disabled={isDeleting}\n                    onClick={() => {\n                      setExamToDelete(ex);\n                      setDeleteError(null);\n                    }}\n                    className=\"bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm transition flex items-center space-x-1 border border-rose-700\"\n                    title=\"Permanently Delete Examination (Admin Only)\"\n                  >\n                    <Trash2 className=\"w-3.5 h-3.5\" />\n                    <span>Delete Examination</span>\n                  </button>\n                )}"
);

// We need to remove the old action buttons block since we appended it.
content = content.replace(
  /\{\/\* Status Action Buttons \*\/\}[\s\S]*?\{\/\* DELETE BUTTON - ADMINISTRATOR ONLY \*\/\}[\s\S]*?<\/button>\s*\)\}\s*<\/div>/,
  "{/* Action buttons handled above */}\n              </div>"
);

fs.writeFileSync(file, content);
console.log('Patched ExaminationManagement');
