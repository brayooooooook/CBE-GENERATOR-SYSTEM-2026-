import { User as AppUser, Role, AccountStatus, LoginLog, Teacher, canonicalizeRole } from '../types';
import { createSupabaseClient, api } from '../lib/storage';

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export function isUUID(str: string | null | undefined): boolean {
  if (!str || typeof str !== 'string') return false;
  return UUID_REGEX.test(str.trim());
}

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface AuthSession {
  user: AppUser;
  token?: string;
  expiresAt?: number;
}

export interface AccountCreationPayload {
  role: Role;
  name: string;
  email: string;
  phone: string;
  tsc_number?: string;
  username?: string;
  status: AccountStatus;
  temporary_password: string;
  force_password_change: boolean;
  allocations?: any[];
  class_teacher_of_id?: string;
}

// Utility to parse browser & device specs from navigator
export function getBrowserDeviceInfo() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : 'Server';
  let browser = 'Chrome/Safari Browser';
  if (ua.includes('Firefox')) browser = 'Mozilla Firefox';
  else if (ua.includes('Edg')) browser = 'Microsoft Edge';
  else if (ua.includes('Chrome')) browser = 'Google Chrome';
  else if (ua.includes('Safari')) browser = 'Apple Safari';

  let device = 'Desktop Workstation';
  if (/Android/i.test(ua)) device = 'Android Mobile';
  else if (/iPhone|iPad|iPod/i.test(ua)) device = 'iOS Mobile';
  else if (/Macintosh/i.test(ua)) device = 'macOS Desktop';
  else if (/Windows/i.test(ua)) device = 'Windows PC';
  else if (/Linux/i.test(ua)) device = 'Linux Desktop';

  return {
    ip: '192.168.1.104 (Local LAN Proxy)',
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
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
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

let isExplicitLoginInProgress = false;

// Map Supabase auth user object to our AppUser
export function mapSupabaseUserToAppUser(sbUser: any): AppUser {
  if (!sbUser) {
    throw new Error('No Supabase user provided');
  }
  
  const meta = sbUser.user_metadata || {};
  const email = (sbUser.email || meta.email || '').trim().toLowerCase();

  // Find matching user from storage (synced from public.users)
  const users = api.getUsers();
  const matchedUser = users.find((u) => u.id === sbUser.id || u.email.toLowerCase() === email);
  
  const teachers = api.getTeachers();
  const matchedTeacher = teachers.find((t) => t.email.toLowerCase() === email || t.id === meta.teacher_id);

  // Authoritative role resolution:
  // If matchedUser exists from public.users, its role is AUTHORITATIVE over user_metadata.role!
  let role: Role;
  if (matchedUser && matchedUser.role) {
    const rawRole = (matchedUser.role as string).toLowerCase();
    if (rawRole === 'admin') {
      role = 'admin';
    } else if (rawRole === 'subject_teacher') {
      role = 'subject_teacher';
    } else if (rawRole === 'class_teacher') {
      role = 'class_teacher';
    } else if (rawRole === 'teacher') {
      const rawMetaRole = (meta.role as string || '').toLowerCase();
      if (rawMetaRole === 'subject_teacher') {
        role = 'subject_teacher';
      } else if (rawMetaRole === 'class_teacher') {
        role = 'class_teacher';
      } else if (matchedTeacher) {
        role = (matchedTeacher.is_class_teacher || Boolean(matchedTeacher.class_teacher_of_id)) ? 'class_teacher' : 'subject_teacher';
      } else {
        role = 'subject_teacher';
      }
    } else {
      role = matchedUser.role as Role;
    }
  } else if (meta.role) {
    const rawMetaRole = (meta.role as string).toLowerCase();
    if (rawMetaRole === 'admin') {
      role = 'admin';
    } else if (rawMetaRole === 'subject_teacher') {
      role = 'subject_teacher';
    } else if (rawMetaRole === 'class_teacher') {
      role = 'class_teacher';
    } else {
      role = meta.role as Role;
    }
  } else {
    // Safe default if no public.users or metadata role exists (never default to admin)
    role = 'class_teacher';
  }

  let name = matchedUser?.name || meta.name || matchedTeacher?.teacher_name || email.split('@')[0];
  let matchedTeacherId = matchedUser?.teacher_id || meta.teacher_id || matchedTeacher?.id;
  let matchedStudentId = matchedUser?.student_id || meta.student_id;

  if (role === 'admin') {
    matchedTeacherId = matchedUser?.teacher_id || undefined;
  }

  let status: AccountStatus = matchedUser?.status || matchedTeacher?.status || meta.status || 'Active';
  let forcePasswordChange = matchedUser?.force_password_change ?? matchedTeacher?.force_password_change ?? meta.force_password_change ?? false;

  return {
    id: sbUser.id || matchedUser?.id || generateUUID(),
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
        const { data: dbUsers } = await client.from('users').select('*');
        if (dbUsers && dbUsers.length > 0) {
          (api as any).syncUsersFromDatabase(dbUsers);
        }

        const { data, error } = await client.auth.getSession();
        if (data?.session?.user && !error) {
          return mapSupabaseUserToAppUser(data.session.user);
        }
      } catch (err) {
        console.warn('getSession error', err);
      }
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
      targetTeacherId = existingTeacher?.id;
    } else if (targetEmail.includes('david') && !existingTeacher) {
      targetRole = 'subject_teacher';
      targetName = 'Mr. David Otieno';
      targetTeacherId = existingTeacher?.id;
    }

    const forcePasswordChange =
      existingUser?.force_password_change ?? existingTeacher?.force_password_change ?? false;
      
    const lastLoginIso = new Date().toISOString();

    if (!client) {
      recordLoginLog(
        targetEmail,
        targetName,
        targetRole,
        undefined,
        'Failed',
        'Database authentication service is unavailable.'
      );
      return {
        user: null,
        error: 'Database authentication service is unavailable.',
      };
    }

    isExplicitLoginInProgress = true;
    try {
      // Attempt Supabase Auth Sign In
      const signInRes = await client.auth.signInWithPassword({
        email: targetEmail,
        password: password,
      });

      const data = signInRes.data;
      const error = signInRes.error;

      if (error) {
        recordLoginLog(targetEmail, targetName, targetRole, undefined, 'Failed', error.message);
        return { user: null, error: error.message };
      }

      if (data?.session?.user) {
        // Sync public.users to update local cache with authoritative user records
        const { data: dbUsers } = await client.from('users').select('*');
        if (dbUsers && dbUsers.length > 0) {
          (api as any).syncUsersFromDatabase(dbUsers);
        }

        const appUser = mapSupabaseUserToAppUser(data.session.user);
        appUser.status = accountStatus;
        appUser.last_login = lastLoginIso;

        // Role-mismatch verification: selected login role must match authoritative appUser.role
        if (roleHint && roleHint !== appUser.role) {
          const roleDisplayNames: Record<Role, string> = {
            admin: 'Administrator',
            class_teacher: 'Class Teacher',
            subject_teacher: 'Subject Teacher',
          };
          const actualDisplayName = roleDisplayNames[appUser.role] || 'Class Teacher';
          const errorMsg = `Role mismatch. This account is registered as ${actualDisplayName}. Please select ${actualDisplayName} and sign in again.`;

          recordLoginLog(appUser.email, appUser.name, roleHint, appUser.id, 'Failed', errorMsg);

          // Clean up Supabase auth session completely on role mismatch
          try {
            await client.auth.signOut();
          } catch (e) {
            // ignore signout errors
          }
          api.setCurrentUser(null);

          return { user: null, error: errorMsg };
        }

        // Sync metadata to user & teacher
        if (existingTeacher) {
          api.updateTeacher({ ...existingTeacher, last_login: lastLoginIso });
        }
        if (existingUser) {
          api.updateUser({ ...existingUser, last_login: lastLoginIso });
        }
        
        recordLoginLog(appUser.email, appUser.name, appUser.role, appUser.id, 'Success');
        api.setCurrentUser(appUser);

        return { user: appUser, error: null };
      }

      recordLoginLog(targetEmail, targetName, targetRole, undefined, 'Failed', 'Authentication failed.');
      return { user: null, error: 'Authentication failed.' };
    } catch (err: any) {
      console.error('Supabase Auth error:', err);
      const errMsg = err?.message || 'Authentication error occurred.';
      recordLoginLog(targetEmail, targetName, targetRole, undefined, 'Failed', errMsg);
      return { user: null, error: errMsg };
    } finally {
      isExplicitLoginInProgress = false;
    }
  },

  /**
   * Reset Password via Supabase Auth
   */
  async resetPassword(email: string): Promise<{ success: boolean; error: string | null }> {
    const client = createSupabaseClient();
    if (!client) {
      return { success: false, error: 'Database connection is not configured.' };
    }

    const cleanEmail = email.trim().toLowerCase();
    
    // 1. Verify email exists in the system
    const allUsers = api.getUsers();
    const allTeachers = api.getTeachers();
    const userExists = allUsers.some(u => u.email.toLowerCase() === cleanEmail) || 
                       allTeachers.some(t => t.email.toLowerCase() === cleanEmail);
                       
    if (!userExists) {
      return { success: false, error: 'No account was found with this email address.' };
    }

    // 2. Send reset link
    try {
      const { error } = await client.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: window.location.origin + '/#reset-password',
      });
      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to send password reset email.' };
    }
  },

  /**
   * Change User Password via Supabase Auth & clear force_password_change flag
   */
  async changePassword(
    currentPass: string,
    newPass: string,
    currentUser: AppUser
  ): Promise<{ success: boolean; error: string | null }> {
    const client = createSupabaseClient();
    if (client) {
      try {
        const { error } = await client.auth.updateUser({
          password: newPass,
          data: { force_password_change: false },
        });
        if (error) {
          console.warn('Supabase updateUser password error:', error.message);
          return { success: false, error: error.message };
        }

        // Persist force_password_change: false in public.users and public.teachers
        if (currentUser.id) {
          try {
            await client.from('users').update({ force_password_change: false }).eq('id', currentUser.id);
          } catch (e) {
            console.warn('Failed updating users table by id in Supabase:', e);
          }
        }
        if (currentUser.email) {
          try {
            await client.from('users').update({ force_password_change: false }).eq('email', currentUser.email.toLowerCase());
          } catch (e) {
            console.warn('Failed updating users table by email in Supabase:', e);
          }
          try {
            await client.from('teachers').update({ force_password_change: false }).eq('email', currentUser.email.toLowerCase());
          } catch (e) {
            console.warn('Failed updating teachers table by email in Supabase:', e);
          }
        }
      } catch (err: any) {
        console.error('Failed updating password via Supabase Auth:', err);
        return { success: false, error: err?.message || 'An error occurred while updating password.' };
      }
    }

    // Clear force_password_change flag in local store & user session
    const updatedUser: AppUser = {
      ...currentUser,
      force_password_change: false,
    };

    api.updateUser(updatedUser);

    if (currentUser.teacher_id) {
      const teachers = api.getTeachers();
      const tch = teachers.find((t) => t.id === currentUser.teacher_id || t.email.toLowerCase() === currentUser.email.toLowerCase());
      if (tch) {
        api.updateTeacher({ ...tch, force_password_change: false });
      }
    }

    api.setCurrentUser(updatedUser);

    return { success: true, error: null };
  },

  /**
   * Administrator-Created Account (Teacher, Admin, Student)
   */
  async adminCreateAccount(
    payload: AccountCreationPayload
  ): Promise<{ user: AppUser; teacher?: Teacher; error: string | null }> {
    try {
      const currentUser = api.getCurrentUser();
      if (!currentUser || currentUser.role !== 'admin') {
        return { user: null as any, error: 'Unauthorized: Only administrators can create accounts.' };
      }

      const canonicalRole = canonicalizeRole(payload.role);

      let data: any = null;
      let isJsonResponse = false;
      const client = createSupabaseClient();

      try {
        let accessToken: string | undefined;
        if (client) {
          try {
            const { data: sessionData } = await client.auth.getSession();
            accessToken = sessionData?.session?.access_token;
          } catch (e) {
            console.warn('Could not fetch session token for create-teacher request:', e);
          }
        }

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (accessToken) {
          headers['Authorization'] = `Bearer ${accessToken}`;
        }

        const response = await fetch('/api/admin/create-teacher', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            ...payload,
            role: canonicalRole,
            token: accessToken,
            adminId: currentUser.id,
            is_class_teacher: canonicalRole === 'class_teacher',
            name: payload.name.trim(),
            email: payload.email.trim().toLowerCase(),
            phone: payload.phone.trim(),
            tsc_number: payload.tsc_number?.trim(),
            username: (payload.username || payload.email.split('@')[0]).trim().toLowerCase()
          }),
        });

        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          data = await response.json();
          isJsonResponse = true;
        } else {
          const text = await response.text();
          console.warn('Server create-teacher returned non-JSON response:', response.status, text.slice(0, 150));
        }

        if (response.ok && isJsonResponse && data?.user) {
          const newTeacher: Teacher = {
            ...data.teacher,
            allocations: payload.allocations || []
          };
          api.addTeacher(newTeacher, data.user.id);
          api.addUser(data.user);
          return { user: data.user, teacher: newTeacher, error: null };
        }

        if (isJsonResponse && data?.error) {
          return { user: null as any, error: data.error };
        }

        if (!response.ok) {
          return { user: null as any, error: `Server error (${response.status}): Could not create teacher account in Supabase Auth.` };
        }
      } catch (fetchErr: any) {
        console.error('API call to /api/admin/create-teacher failed:', fetchErr);
        return { user: null as any, error: `Failed to create teacher account in Supabase Auth: ${fetchErr?.message || 'Network or server error.'}` };
      }

      return { user: null as any, error: 'Failed to create teacher account in Supabase Auth.' };
    } catch (err: any) {
      console.error('Exception in adminCreateAccount:', err);
      return { user: null as any, error: 'Internal error creating account.' };
    }
  },

  /**
   * Admin Delete Teacher Account & Associated Data
   */
  async adminDeleteTeacher(teacherId: string, email?: string): Promise<{ success: boolean; error: string | null }> {
    try {
      const currentUser = api.getCurrentUser();
      if (!currentUser || currentUser.role !== 'admin') {
        return { success: false, error: 'Unauthorized: Only administrators can delete teacher accounts.' };
      }

      const client = createSupabaseClient();
      let accessToken: string | undefined;
      if (client) {
        try {
          const { data: sessionData } = await client.auth.getSession();
          accessToken = sessionData?.session?.access_token;
        } catch (e) {
          console.warn('Could not fetch session token for delete-teacher request:', e);
        }
      }

      // Server API deletion request (sole authoritative deletion route)
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

        const response = await fetch('/api/admin/delete-teacher', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            teacherId,
            email,
            token: accessToken,
            adminId: currentUser.id,
          }),
        });

        const contentType = response.headers.get('content-type');
        let data: any = null;
        if (contentType && contentType.includes('application/json')) {
          data = await response.json();
        }

        if (response.ok && data?.success) {
          console.info('Server successfully deleted teacher:', teacherId);
          // Only update UI memory state after server deletion confirmed
          api.deleteTeacher(teacherId);
          return { success: true, error: null };
        }

        const errMsg = data?.error || `Server error (${response.status}): Could not delete teacher.`;
        return { success: false, error: errMsg };
      } catch (fetchErr: any) {
        console.error('API call to /api/admin/delete-teacher failed:', fetchErr);
        return { success: false, error: `Failed to delete teacher via server: ${fetchErr?.message || 'Network error.'}` };
      }
    } catch (err: any) {
      console.error('Exception in adminDeleteTeacher:', err);
      return { success: false, error: err.message || 'Error deleting teacher account.' };
    }
  },

  /**
   * Admin Reset Password for a User/Teacher
   */
  async adminResetPassword(
    emailOrUserId: string,
    newTempPassword: string,
    forcePasswordChange: boolean = true,
    adminUser?: AppUser | null
  ): Promise<{ success: boolean; error: string | null }> {
    const caller = adminUser || api.getCurrentUser();
    if (!caller || caller.role !== 'admin') {
      return { success: false, error: 'Unauthorized: Only administrators can reset user passwords.' };
    }

    const cleanTarget = emailOrUserId.trim().toLowerCase();

    const client = createSupabaseClient();
    let accessToken: string | undefined;
    if (client) {
      try {
        const { data: sessionData } = await client.auth.getSession();
        accessToken = sessionData?.session?.access_token;
      } catch (e) {
        console.warn('Could not fetch session token for reset-password request:', e);
      }
    }

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;

      const response = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          emailOrUserId: cleanTarget,
          email: cleanTarget,
          newPassword: newTempPassword,
          forcePasswordChange,
          token: accessToken,
          adminId: caller.id,
        }),
      });

      const contentType = response.headers.get('content-type');
      let data: any = null;
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      }

      if (!response.ok || !data?.success) {
        const errMsg = data?.error || `Server error (${response.status}): Could not reset password in Supabase Auth.`;
        return { success: false, error: errMsg };
      }

      // Success confirmed by Supabase Auth! Update local React memory state for force_password_change (no plain text password)
      const users = api.getUsers();
      const user = users.find((u) => u.id === emailOrUserId || u.email.toLowerCase() === cleanTarget);
      if (user) {
        api.updateUser({
          ...user,
          force_password_change: forcePasswordChange,
        });
      }

      const teachers = api.getTeachers();
      const teacher = teachers.find((t) => t.id === emailOrUserId || t.email.toLowerCase() === cleanTarget);
      if (teacher) {
        api.updateTeacher({
          ...teacher,
          force_password_change: forcePasswordChange,
        });
      }

      // Write Audit Log Record
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const timeStr = now.toTimeString().slice(0, 8);
      const adminName = caller?.name || 'Administrator';
      const targetName = teacher?.teacher_name || user?.name || cleanTarget;

      const auditLog: LoginLog = {
        id: `log_pwd_reset_${Date.now()}`,
        user_id: caller?.id || 'admin',
        email: caller?.email || 'admin@school.ac.ke',
        user_name: adminName,
        role: caller?.role || 'admin',
        timestamp: now.toISOString(),
        date: dateStr,
        time: timeStr,
        ip_address: '127.0.0.1 (Internal System)',
        device: 'Web Client',
        browser: 'Secure Admin Console',
        status: 'Success',
        reason: `ADMINISTRATOR PASSWORD RESET: Reset password for ${targetName} (${cleanTarget}) | Performed By: ${adminName}`,
      };

      api.addLoginLog(auditLog);

      return { success: true, error: null };
    } catch (fetchErr: any) {
      console.error('API call to /api/admin/reset-password failed:', fetchErr);
      return { success: false, error: `Failed to reset password: ${fetchErr?.message || 'Network error.'}` };
    }
  },

  /**
   * Update Account Status (Active, Disabled, Locked)
   */
  adminUpdateAccountStatus(
    emailOrUserId: string,
    status: AccountStatus
  ): void {
    const caller = api.getCurrentUser();
    if (!caller || caller.role !== 'admin') {
      console.warn('Unauthorized attempt to update account status');
      return;
    }

    const cleanTarget = emailOrUserId.trim().toLowerCase();
    const users = api.getUsers();
    const user = users.find((u) => u.id === emailOrUserId || u.email.toLowerCase() === cleanTarget);
    if (user) {
      api.updateUser({ ...user, status });
    }

    const teachers = api.getTeachers();
    const teacher = teachers.find(
      (t) => t.id === emailOrUserId || t.email.toLowerCase() === cleanTarget
    );
    if (teacher) {
      api.updateTeacher({ ...teacher, status });
    }
  },

  /**
   * Log out user from Supabase Auth and clear local session
   */
  async signOut(): Promise<void> {
    const client = createSupabaseClient();
    if (client) {
      try {
        await client.auth.signOut();
      } catch (err) {
        console.warn('Error during Supabase auth signOut:', err);
      }
    }

    api.setCurrentUser(null);
  },

  /**
   * Listen to Supabase Auth state changes
   */
  onAuthStateChange(callback: (user: AppUser | null) => void) {
    const client = createSupabaseClient();
    if (client) {
      const { data: authListener } = client.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN') {
          // If explicit login is running via authService.signIn, ignore global SIGNED_IN event.
          // authService.signIn will validate roleHint and handle session state explicitly.
          if (isExplicitLoginInProgress) {
            return;
          }
          if (session?.user) {
            const { data: dbUsers } = await client.from('users').select('*');
            if (dbUsers && dbUsers.length > 0) {
              (api as any).syncUsersFromDatabase(dbUsers);
            }
            const appUser = mapSupabaseUserToAppUser(session.user);
            api.setCurrentUser(appUser);
            callback(appUser);
          }
        } else if (event === 'TOKEN_REFRESHED') {
          if (session?.user) {
            const { data: dbUsers } = await client.from('users').select('*');
            if (dbUsers && dbUsers.length > 0) {
              (api as any).syncUsersFromDatabase(dbUsers);
            }
            const appUser = mapSupabaseUserToAppUser(session.user);
            api.setCurrentUser(appUser);
            callback(appUser);
          }
        } else if (event === 'SIGNED_OUT') {
          api.setCurrentUser(null);
          callback(null);
        }
      });

      return () => {
        authListener.subscription.unsubscribe();
      };
    }
    return () => {};
  },
};
