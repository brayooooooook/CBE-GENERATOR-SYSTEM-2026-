const fs = require('fs');
const file = 'src/services/authService.ts';
let content = fs.readFileSync(file, 'utf8');

const startIndex = content.indexOf('    if (client) {');
const endIndex = content.indexOf('  async resetPassword(');

if (startIndex === -1 || endIndex === -1) {
  console.log("Could not find bounds.");
  process.exit(1);
}

const before = content.slice(0, startIndex);
const after = content.slice(endIndex);

const replaceStr = `    if (client) {
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
`;

content = before + replaceStr + after.slice(after.indexOf('  async resetPassword(') + 31);
// Wait, after.slice will slice off '  async resetPassword(', let's just append `after` to `before + replaceStr` and adjust `replaceStr`.

const finalContent = before + replaceStr.replace(`  /**\n   * Reset Password via Supabase Auth\n   */\n`, '') + after;
fs.writeFileSync(file, finalContent);
console.log("Patched correctly.");
