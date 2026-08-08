import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  Shield,
  UserCheck,
  BookOpen,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
import { School, User as AppUser, Role } from '../types';
import { authService } from '../services/authService';
import { getSupabaseClient } from '../lib/storage';

interface LoginPageProps {
  school: School;
  onLoginSuccess: (user: AppUser) => void;
  dbStatusSuccess?: boolean;
}

type UIRole = 'admin' | 'class_teacher' | 'subject_teacher';

export const LoginPage: React.FC<LoginPageProps> = ({
  school,
  onLoginSuccess,
  dbStatusSuccess = true,
}) => {
  const [selectedRole, setSelectedRole] = useState<UIRole>('admin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [logoError, setLogoError] = useState(false);
  const [currentSchool, setCurrentSchool] = useState<School>(school);
  
  const [isForgotPasswordMode, setIsForgotPasswordMode] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccessMsg, setResetSuccessMsg] = useState<string | null>(null);

  // Fetch branding information dynamically from school_profile in Supabase
  useEffect(() => {
    let isMounted = true;
    const fetchSchoolProfile = async () => {
      try {
        const client = getSupabaseClient();
        if (client) {
          const { data, error } = await client.from('school_profile').select('*').limit(1);
          if (!error && data && data.length > 0) {
            const sp = data[0];
            if (sp.school_name && sp.school_name.trim().length > 0 && isMounted) {
              const postalVal = sp.postal_code || sp.address || '';
              setCurrentSchool({
                id: sp.id || 'sch_001',
                school_name: sp.school_name.trim(),
                motto: sp.motto || sp.school_motto || '',
                county: sp.county || '',
                postal_code: postalVal,
                address: postalVal,
                email: sp.email || sp.email_address || '',
              });
            }
          }
        }
      } catch (err) {
        // Fallback gracefully to school prop
      }
    };

    fetchSchoolProfile();

    if (school?.school_name?.trim()) {
      setCurrentSchool(school);
    }

    return () => {
      isMounted = false;
    };
  }, [school]);

  const hasSchoolProfile = Boolean(currentSchool?.school_name && currentSchool.school_name.trim().length > 0 && currentSchool.school_name !== 'Anon Hack');
  const displaySchoolName = hasSchoolProfile ? currentSchool.school_name : 'MUCHORWE COMPREHENSIVE SCHOOL';

  const handleSelectRole = (role: UIRole) => {
    setSelectedRole(role);
    setErrorMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please enter both email address and password.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    const mappedRole: Role = selectedRole === 'admin' ? 'admin' : (selectedRole === 'class_teacher' ? 'class_teacher' : 'subject_teacher');

    try {
      const result = await authService.signIn(email, password, mappedRole);
      if (result.error) {
        setErrorMsg(result.error);
      } else if (result.user) {
        onLoginSuccess(result.user);
      } else {
        setErrorMsg('Authentication failed. Please verify credentials.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resetLoading) return;
    if (!email.trim()) {
      setErrorMsg('Please enter your registered email address.');
      return;
    }
    
    setResetLoading(true);
    setErrorMsg(null);
    setResetSuccessMsg(null);
    
    try {
      const { success, error } = await authService.resetPassword(email);
      if (success) {
        setResetSuccessMsg('A password reset link has been sent to your email. Please check your inbox and spam folder.');
      } else {
        setErrorMsg(error || 'No account was found with this email address.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#020617] via-[#0B1437] to-[#071126] flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8 text-slate-200">
      <div className="w-full max-w-md space-y-8 relative z-10">
        
        {/* School Branding */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            {hasSchoolProfile && currentSchool.logo_url && !logoError ? (
              <img
                src={currentSchool.logo_url}
                alt={displaySchoolName}
                onError={() => setLogoError(true)}
                className="w-20 h-20 sm:w-24 sm:h-24 object-contain drop-shadow-xl"
              />
            ) : (
              <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[#176B45] text-white mb-2 shadow-lg shadow-[#0F5132]/50">
                <GraduationCap className="w-8 h-8 sm:w-10 sm:h-10" />
              </div>
            )}
          </div>
          
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white uppercase">
              {displaySchoolName}
            </h1>
            <p className="text-sm sm:text-base text-slate-400 font-medium">
              CBE Generator System
            </p>
          </div>
        </div>

        {/* Login Container */}
        <div className="bg-[#111827] rounded-2xl shadow-2xl shadow-black/50 border border-slate-800 p-6 sm:p-8 space-y-8">
          
          {/* Welcome Section */}
          <div className="text-center space-y-1.5">
            <h2 className="text-lg font-semibold text-white">
              {isForgotPasswordMode ? 'Reset Password' : 'Welcome Back'}
            </h2>
            <p className="text-sm text-slate-400">
              {isForgotPasswordMode 
                ? 'Enter your email address to receive a password reset link.'
                : 'Please sign in to continue.'}
            </p>
          </div>

          {!isForgotPasswordMode && (
            <div className="space-y-3">
              <label className="block text-sm font-medium text-slate-300 text-center">
                Sign in as
              </label>
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => handleSelectRole('admin')}
                  className={`p-3 rounded-xl border text-center transition flex flex-col items-center justify-center space-y-2 ${
                    selectedRole === 'admin'
                      ? 'bg-[#176B45]/15 border-[#2E7D5B] text-[#E8F3EE] ring-1 ring-[#2E7D5B]/50'
                      : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <Shield className="w-5 h-5" />
                  <span className="text-xs font-semibold">Administrator</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectRole('class_teacher')}
                  className={`p-3 rounded-xl border text-center transition flex flex-col items-center justify-center space-y-2 ${
                    selectedRole === 'class_teacher'
                      ? 'bg-[#176B45]/15 border-[#2E7D5B] text-[#E8F3EE] ring-1 ring-[#2E7D5B]/50'
                      : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <UserCheck className="w-5 h-5" />
                  <span className="text-xs font-semibold leading-tight">Class Teacher</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectRole('subject_teacher')}
                  className={`p-3 rounded-xl border text-center transition flex flex-col items-center justify-center space-y-2 ${
                    selectedRole === 'subject_teacher'
                      ? 'bg-[#176B45]/15 border-[#2E7D5B] text-[#E8F3EE] ring-1 ring-[#2E7D5B]/50'
                      : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <BookOpen className="w-5 h-5" />
                  <span className="text-xs font-semibold leading-tight">Subject Teacher</span>
                </button>
              </div>
            </div>
          )}

          {/* Error & Success Messages */}
          {errorMsg && (
            <div className="bg-red-950/50 border border-red-900/50 text-red-400 text-sm p-4 rounded-xl flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>{errorMsg}</div>
            </div>
          )}
          {resetSuccessMsg && (
            <div className="bg-green-950/50 border border-green-900/50 text-green-400 text-sm p-4 rounded-xl flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
              <div>{resetSuccessMsg}</div>
            </div>
          )}

          {/* Form */}
          {!isForgotPasswordMode ? (
            <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-300">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-5 h-5" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@school.ac.ke"
                  required
                  className="w-full pl-11 pr-4 py-2.5 bg-[#020617]/50 border border-slate-700 rounded-xl text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#176B45] focus:border-[#176B45] transition placeholder-slate-600"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-slate-300">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-11 pr-12 py-2.5 bg-[#020617]/50 border border-slate-700 rounded-xl text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#176B45] focus:border-[#176B45] transition placeholder-slate-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <div className="flex justify-end pt-1">
                <button 
                  type="button" 
                  onClick={() => {
                    setIsForgotPasswordMode(true);
                    setErrorMsg(null);
                    setResetSuccessMsg(null);
                  }}
                  className="text-sm font-medium text-[#2E7D5B] hover:text-[#E8F3EE] transition"
                >
                  Forgot Password?
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-[#176B45] to-[#0F5132] hover:from-[#0F5132] hover:to-[#176B45] text-white font-medium rounded-xl shadow-lg shadow-[#0F5132]/20 transition flex items-center justify-center space-x-2 disabled:opacity-70 disabled:cursor-not-allowed mt-4"
            >
              {loading ? (
                <div className="flex items-center space-x-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Signing in...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </div>
              )}
            </button>
          </form>
          ) : (
            <form onSubmit={handleForgotPassword} className="space-y-5">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-300">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                    <Mail className="w-5 h-5" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@school.ac.ke"
                    required
                    className="w-full pl-11 pr-4 py-2.5 bg-[#020617]/50 border border-slate-700 rounded-xl text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#176B45] focus:border-[#176B45] transition placeholder-slate-600"
                  />
                </div>
              </div>

              <div className="pt-2 space-y-3">
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-medium rounded-xl shadow-lg shadow-blue-900/20 transition flex items-center justify-center space-x-2 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {resetLoading ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Sending reset link...</span>
                    </div>
                  ) : (
                    <span>Send Reset Link</span>
                  )}
                </button>
                
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPasswordMode(false);
                    setErrorMsg(null);
                    setResetSuccessMsg(null);
                  }}
                  className="w-full py-2.5 px-4 bg-transparent hover:bg-slate-800 text-slate-300 font-medium rounded-xl transition flex items-center justify-center"
                >
                  Back to Sign In
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-slate-500 text-sm space-y-1 mt-8">
          <p>© 2026 {hasSchoolProfile ? currentSchool.school_name : 'Muchorwe Comprehensive School'}</p>
          <p>CBE Generator System</p>
        </div>
      </div>
    </div>
  );
};

