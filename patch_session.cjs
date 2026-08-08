const fs = require('fs');
const file = 'src/components/SessionSwitcher.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  '{year.year} - {term.term_name} {activeYear.id === year.id && activeTerm.id === term.id ? \'(Active)\' : \'\'}',
  '{term.term_name} • {year.year} {activeYear.id === year.id && activeTerm.id === term.id ? \'(Active)\' : \'\'}'
);

code = code.replace(
  'className="bg-transparent text-xs font-semibold text-slate-100 outline-none cursor-pointer hover:text-white appearance-none"',
  'className="bg-transparent text-xs font-semibold text-slate-100 outline-none cursor-pointer hover:text-white appearance-none max-w-[100px] md:max-w-none truncate"'
);

code = code.replace(
  'className="flex items-center space-x-2 bg-slate-800/80 px-2 py-1.5 rounded-xl border border-slate-700"',
  'className="flex items-center space-x-1 md:space-x-2 bg-slate-800/80 px-1.5 md:px-2 py-1 md:py-1.5 rounded-xl border border-slate-700 w-full overflow-hidden"'
);

fs.writeFileSync(file, code);
console.log('Patched SessionSwitcher.tsx');
