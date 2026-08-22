const fs = require('fs');
const file = 'src/components/DeveloperSettingsPage.tsx';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  'interface DatabaseSettingsPageProps',
  'interface DeveloperSettingsPageProps'
);

code = code.replace(
  'export const DatabaseSettingsPage: React.FC<DatabaseSettingsPageProps> =',
  'export const DeveloperSettingsPage: React.FC<DeveloperSettingsPageProps> ='
);

code = code.replace(
  '<span>Administration &bull; System Settings</span>',
  '<span>Developer Mode &bull; Restricted Access</span>'
);

code = code.replace(
  '<span>Database Connection & Engine Settings</span>',
  '<span>Developer Tools & Diagnostics</span>'
);

code = code.replace(
  'DatabaseSettingsPageProps',
  'DeveloperSettingsPageProps'
);

fs.writeFileSync(file, code);
console.log('Patched DeveloperSettingsPage.tsx');
