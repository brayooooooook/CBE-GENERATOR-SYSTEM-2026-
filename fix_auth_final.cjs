const fs = require('fs');

const missingFunctions = `    ip: '192.168.1.104 (Local LAN Proxy)',
    device,
    browser,
  };
}

// Helper to record login history logs
export function recordLoginLog(
  email: string,
  user_name?: string,
  role?: Role,
  user_id?: string,
  status: 'Success' | 'Failed' = 'Success',
  reason?: string
): LoginLog {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = now.toTimeString().slice(0, 8);
  const devInfo = getBrowserDeviceInfo();

  const log: LoginLog = {
    id: \`log_\${Date.now()}_\${Math.random().toString(36).substring(2, 6)}\`,
    user_id,
    email: email.trim().toLowerCase(),
    user_name: user_name || email.split('@')[0],
    role: role || 'admin',
    timestamp: now.toISOString(),
    date: dateStr,
    time: timeStr,
    ip_address: devInfo.ip,
    device: devInfo.device,
    browser: devInfo.browser,
    status,
    reason,
  };

  return api.addLoginLog(log);
}

// Map Supabase auth user object to our AppUser
export function mapSupabaseUserToAppUser(sbUser: any): AppUser {
  if (!sbUser) {
    throw new Error('No Supabase user provided');
  }
  
  const meta = sbUser.user_metadata || {};
  const email = (sbUser.email || meta.email || '').trim().toLowerCase();

  // Find matching user from storage
  const users = api.getUsers();
  const matchedUser = users.find((u) => u.email.toLowerCase() === email || u.id === sbUser.id);
  
  const teachers = api.getTeachers();
  const matchedTeacher = teachers.find((t) => t.email.toLowerCase() === email || t.id === meta.teacher_id);

  let matchedTeacherId = meta.teacher_id || matchedTeacher?.id || matchedUser?.teacher_id;
  let matchedStudentId = meta.student_id || matchedUser?.student_id;
  
  let role: Role = meta.role || matchedUser?.role || 'admin';
  let name = meta.name || matchedUser?.name || matchedTeacher?.teacher_name || email.split('@')[0];
  let status: AccountStatus = matchedUser?.status || matchedTeacher?.status || meta.status || 'Active';
  let forcePasswordChange = matchedUser?.force_password_change ?? matchedTeacher?.force_password_change ?? meta.force_password_change ?? false;

  if (!meta.role && !matchedUser) {
    if (email.includes('admin')) {
      role = 'admin';
      name = name || 'System Administrator';
    } else if (email.includes('teacher') || email.includes('grace') || email.includes('david')) {
      role = 'class_teacher';
      if (matchedTeacher) {
        matchedTeacherId = matchedTeacher.id;
        name = matchedTeacher.teacher_name;
      } else {
        matchedTeacherId = 'tch_01';
      }
    }
  }

  return {`;

let content = fs.readFileSync('src/services/authService.ts', 'utf8');
content = content.replace(`  return {\n    id: sbUser.id`, missingFunctions + `\n    id: sbUser.id`);
fs.writeFileSync('src/services/authService.ts', content);
