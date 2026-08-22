const fs = require('fs');
const file = 'src/components/Header.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(/onNavigateToDatabase\?: \(\) => void;/g, 'onNavigateToSystem?: () => void;');
code = code.replace(/onNavigateToDatabase,/g, 'onNavigateToSystem,');

const buttonStr = `{/* System Settings & Database button (Admin only) */}
            {currentUser.role === 'admin' && <SessionSwitcher />}
            {currentUser.role === 'admin' && (
              <button
                onClick={onNavigateToDatabase || onOpenSupabaseModal}
                className="hidden lg:flex items-center space-x-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-3 py-1.5 rounded-full border border-slate-700 transition font-medium"
                title="System Settings & Database"
              >
                <Database className="w-3.5 h-3.5 text-emerald-400" />
                <span>Database Settings</span>
              </button>
            )}`;

const newButtonStr = `{/* System Settings button (Admin only) */}
            {currentUser.role === 'admin' && <SessionSwitcher />}
            {currentUser.role === 'admin' && (
              <button
                onClick={onNavigateToSystem}
                className="hidden lg:flex items-center space-x-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-3 py-1.5 rounded-full border border-slate-700 transition font-medium"
                title="System Settings"
              >
                <Settings className="w-3.5 h-3.5 text-emerald-400" />
                <span>System Settings</span>
              </button>
            )}`;

code = code.replace(buttonStr, newButtonStr);

fs.writeFileSync(file, code);
console.log('Patched Header.tsx');
