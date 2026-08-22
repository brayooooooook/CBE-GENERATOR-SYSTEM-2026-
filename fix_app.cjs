const fs = require('fs');
const file = 'src/App.tsx';
let code = fs.readFileSync(file, 'utf8');
const oldTeacher = "const activeTeacher = getActiveTeacher(currentUser, api.getTeachers());";
const newTeacher = "const activeTeacher = React.useMemo(() => getActiveTeacher(currentUser, api.getTeachers()), [currentUser]);";
if (code.includes(oldTeacher)) {
    code = code.replace(oldTeacher, newTeacher);
    fs.writeFileSync(file, code);
}
