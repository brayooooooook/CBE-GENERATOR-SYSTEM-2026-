const fs = require('fs');
const file = 'src/components/UnauthorizedView.tsx';
let content = fs.readFileSync(file, 'utf8');

const titleOld = `<h2 className="text-xl font-bold text-white">Unauthorized Page Access</h2>`;
const titleNew = `<h2 className="text-xl font-bold text-white">Access Denied</h2>`;
content = content.replace(titleOld, titleNew);

const descOld = `<p className="text-xs text-slate-400 leading-relaxed">
            Your current account role (<span className="text-blue-400 font-bold capitalize">{currentRole}</span>) does not have authorization permissions to view or edit this restricted module.
          </p>`;
const descNew = `<p className="text-xs text-slate-400 leading-relaxed">
            You do not have permission to access this module.<br />
            Please contact the system administrator if you believe this is an error.
          </p>`;
content = content.replace(descOld, descNew);

const secPolOld = `<div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 text-left text-xs text-slate-400 space-y-1">
          <span className="font-semibold text-slate-300">Security Policy:</span>
          <p>Role-Based Access Control (RBAC) is strictly enforced throughout the CBE System. Please switch to an authorized module or return to your dashboard.</p>
        </div>`;
const secPolNew = ``;
content = content.replace(secPolOld, secPolNew);

fs.writeFileSync(file, content);
