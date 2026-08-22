const fs = require('fs');

const current = fs.readFileSync('src/services/authService.ts', 'utf8');
const headPart = current.slice(0, current.indexOf('  return {'));

const tailPart = current.slice(current.indexOf('Password(email: string): Promise<{ success: boolean; error: string | null }> {'));

const authServiceCode = `  return {
    id: sbUser.id || matchedUser?.id || \`usr_\${Date.now()}\`,
    name,
    email,
    role,
    teacher_id: matchedTeacherId,
    student_id: matchedStudentId,
    status,
    force_password_change: forcePasswordChange,
    last_login: new Date().toISOString()
  };
}

export const authService = {
  /**
   * Get current Supabase Auth Session
   */
  async getSession(): Promise<AppUser | null> {
    const client = createSupabaseClient();
    if (client) {
      try {
        const { data, error } = await client.auth.getSession();
        if (data?.session?.user) {
          return mapSupabaseUserToAppUser(data.session.user);
        }
      } catch (err) {
        console.warn('getSession error', err);
      }
    }
    const sessionRaw = localStorage.getItem('cbe_auth_session');
    if (sessionRaw) {
      try {
        return JSON.parse(sessionRaw);
      } catch(e) {}
    }
    return null;
  },

  /**
   * Sign In using email and password
   */
  async signIn(
    email: string,
    password: string,
    roleHint?: Role,
    metadataHint?: { name?: string; teacher_id?: string; student_id?: string }
  ): Promise<{ user: AppUser | null; error: string | null }> {
    const client = createSupabaseClient();
    const targetEmail = email.trim().toLowerCase();

    // 1. Check local Account Status first (Disabled / Locked check)
    const allUsers = api.getUsers();
    const allTeachers = api.getTeachers();
    const existingUser = allUsers.find((u) => u.email.toLowerCase() === targetEmail);
    const existingTeacher = allTeachers.find((t) => t.email.toLowerCase() === targetEmail);

    const accountStatus: AccountStatus =
      existingUser?.status || existingTeacher?.status || 'Active';

    if (accountStatus === 'Disabled') {
      recordLoginLog(
        targetEmail,
        existingUser?.name || existingTeacher?.teacher_name,
        roleHint || existingUser?.role,
        existingUser?.id,
        'Failed',
        'Your account has been disabled. Please contact the administrator.'
      );
      return {
        user: null,
        error: 'Your account has been disabled. Please contact the administrator.',
      };
    }

    if (accountStatus === 'Locked') {
      recordLoginLog(
        targetEmail,
        existingUser?.name || existingTeacher?.teacher_name,
        roleHint || existingUser?.role,
        existingUser?.id,
        'Failed',
        'Your account has been locked. Please contact the administrator.'
      );
      return {
        user: null,
        error: 'Your account has been locked. Please contact the administrator.',
      };
    }

    // Determine target role & metadata
    let targetRole: Role = roleHint || existingUser?.role || 'admin';
    let targetName = metadataHint?.name || existingUser?.name || existingTeacher?.teacher_name || 'User';
    let targetTeacherId = metadataHint?.teacher_id || existingUser?.teacher_id || existingTeacher?.id;
    let targetStudentId = metadataHint?.student_id || existingUser?.student_id;

    if (targetEmail.includes('admin') && !existingUser) {
      targetRole = 'admin';
      targetName = 'Administrator';
    } else if (targetEmail.includes('grace') && !existingTeacher) {
      targetRole = 'class_teacher';
      targetName = 'Madam Grace Wanjiku';
      targetTeacherId = 'tch_01';
    } else if (targetEmail.includes('david') && !existingTeacher) {
      targetRole = 'subject_teacher';
      targetName = 'Mr. David Otieno';
      targetTeacherId = 'tch_02';
    }

    const forcePasswordChange =
      existingUser?.force_password_change ?? existingTeacher?.force_password_change ?? false;
      
    const lastLoginIso = new Date().toISOString();

    if (client) {
      try {
        // Attempt Supabase Auth Sign In
        const { data, error } = await client.auth.signInWithPassword({
          email: targetEmail,
          password: password,
        });

        if (data?.session?.user) {
          const appUser = mapSupabaseUserToAppUser(data.session.user);
          appUser.status = accountStatus;
          appUser.force_password_change = forcePasswordChange;
          appUser.last_login = lastLoginIso;

          // Sync metadata to user & teacher
          if (existingTeacher) {
            api.updateTeacher({ ...existingTeacher, last_login: lastLoginIso });
          }
          if (existingUser) {
            api.updateUser({ ...existingUser, last_login: lastLoginIso });
          }
          
          recordLoginLog(appUser.email, appUser.name, appUser.role, appUser.id, 'Success');
          localStorage.setItem('cbe_auth_session', JSON.stringify(appUser));
          api.setCurrentUser(appUser);

          return { user: appUser, error: null };
        }

        if (error) {
          let errorMessage = error.message;
          if (errorMessage.toLowerCase().includes('rate limit')) {
            errorMessage = 'Too many login attempts. Please wait a moment and try again.';
          }
          
          recordLoginLog(targetEmail, targetName, targetRole, undefined, 'Failed', error.message);
          return { user: null, error: errorMessage };
        }
      } catch (err: any) {
        console.error('Supabase Auth error:', err);
        return { user: null, error: 'An unexpected error occurred during authentication.' };
      }
    }

    // If Supabase is not configured or failed to initialize
    return {
      user: null,
      error: 'Database connection not configured. Please ensure Supabase is set up properly.'
    };
  },

  /**
   * Reset Password via Supabase Auth
   */
  async reset`;

fs.writeFileSync('src/services/authService.ts', headPart + authServiceCode + tailPart);
