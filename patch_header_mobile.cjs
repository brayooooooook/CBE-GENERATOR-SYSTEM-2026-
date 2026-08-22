const fs = require('fs');
const file = 'src/components/Header.tsx';
let code = fs.readFileSync(file, 'utf8');

const targetStr = `<div className="flex items-center justify-between h-16">`;

const replacementStr = `<div className="flex flex-col md:flex-row md:items-center justify-between h-auto min-h-[4rem] py-2 md:py-0 gap-3 md:gap-0">
          {/* Row 1: Mobile Toggle & Brand */}
          <div className="flex items-center space-x-2 md:space-x-3 w-full md:w-auto">
            <button
              onClick={onToggleSidebar}
              className="md:hidden p-1.5 -ml-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 focus:outline-none shrink-0"
              aria-label="Toggle Navigation"
            >
              <Menu className="w-6 h-6" />
            </button>

            <div className="flex items-center space-x-2 md:space-x-3 cursor-pointer overflow-hidden min-w-0 flex-1" onClick={onOpenSchoolProfile}>
              <div className="bg-blue-600 p-1.5 rounded-lg text-white shadow-sm flex items-center justify-center w-8 h-8 md:w-10 md:h-10 shrink-0">
                {school.logo_url ? (
                  <img
                    src={school.logo_url}
                    alt="School Logo"
                    className="w-6 h-6 md:w-7 md:h-7 object-contain rounded"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <GraduationCap className="w-5 h-5 md:w-6 md:h-6" />
                )}
              </div>
              <div className="min-w-0 truncate">
                <h1 className="text-sm md:text-lg font-bold tracking-tight text-white leading-snug truncate">
                  {school.school_name || 'CBE Assessment System'}
                </h1>
                <p className="text-xs text-blue-300 hidden md:block truncate">
                  CBE GENERATOR SYSTEM {school.county ? \`• \${school.county} County\` : ''}
                </p>
              </div>
            </div>
          </div>

          {/* Row 2: User Profile & Actions */}
          <div className="flex items-center justify-between md:justify-end space-x-2 w-full md:w-auto overflow-hidden">
            {/* System Settings button (Admin only) */}
            <div className="shrink-1 min-w-0 flex md:flex-initial overflow-hidden">
              {currentUser.role === 'admin' && <SessionSwitcher />}
            </div>

            {currentUser.role === 'admin' && (
              <button
                onClick={onNavigateToSystem}
                className="hidden lg:flex shrink-0 items-center space-x-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-3 py-1.5 rounded-full border border-slate-700 transition font-medium"
                title="System Settings"
              >
                <Settings className="w-3.5 h-3.5 text-emerald-400" />
                <span>System Settings</span>
              </button>
            )}

            {/* User Profile Info Badge */}
            <div className="flex items-center space-x-2 bg-slate-800/80 px-2 md:px-3 py-1 md:py-1.5 rounded-xl border border-slate-700 shrink-0">
              <div className="w-6 h-6 md:w-7 md:h-7 rounded-full bg-blue-600 text-white flex items-center justify-center font-extrabold text-[10px] md:text-xs uppercase shadow-sm shrink-0">
                {(currentUser.name || 'Admin').slice(0, 2)}
              </div>
              <div className="text-[10px] md:text-xs">
                <div className="font-bold text-slate-100 max-w-[60px] md:max-w-[140px] truncate">{currentUser.name || 'Admin'}</div>
                <div className="text-[9px] md:text-[10px] text-blue-300 capitalize font-medium items-center space-x-1 hidden md:flex">
                  {currentUser.role === 'admin' && <Shield className="w-3 h-3 text-blue-400" />}
                  {currentUser.role === 'teacher' && <UserCheck className="w-3 h-3 text-emerald-400" />}
                  {currentUser.role === 'student' && <BookOpen className="w-3 h-3 text-amber-400" />}
                  <span>{currentUser.role} Account</span>
                </div>
              </div>
            </div>

            {/* Logout Button */}
            <button
              onClick={onLogout}
              className="flex items-center justify-center space-x-1.5 text-[10px] md:text-xs bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white px-2.5 md:px-3 py-1.5 md:py-1.5 min-h-[28px] rounded-xl border border-rose-500/30 font-semibold transition shrink-0"
              title="Sign Out of System"
            >
              <LogOut className="w-3.5 h-3.5 md:w-4 md:h-4" />
              <span className="hidden md:inline">Logout</span>
            </button>
          </div>
        </div>`;

const searchStr = `<div className="flex items-center justify-between h-16">`;
const endStr = `</div>
        </div>
      </div>
    </header>`;

const startIndex = code.indexOf(searchStr);
if (startIndex !== -1) {
  const endIndex = code.lastIndexOf(endStr);
  code = code.substring(0, startIndex) + replacementStr + code.substring(endIndex + 6);
  fs.writeFileSync(file, code);
  console.log('Patched Header.tsx');
} else {
  console.log('Target string not found');
}
