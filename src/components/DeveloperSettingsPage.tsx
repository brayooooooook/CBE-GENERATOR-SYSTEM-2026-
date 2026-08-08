import React, { useState, useEffect } from 'react';
import {
  Database,
  Server,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Terminal,
  Shield,
  Key,
  Globe,
  Sliders,
  CheckSquare,
  AlertTriangle,
  Code2,
} from 'lucide-react';
import {
  SUPABASE_PART1,
  SUPABASE_PART2,
  SUPABASE_PART3,
  SUPABASE_PART4,
  SUPABASE_SQL_SCHEMA,
} from '../lib/supabaseSql';
import {
  getSupabaseCredentials,
  saveSupabaseCredentials,
  testSupabaseConnection,
} from '../lib/storage';

interface DeveloperSettingsPageProps {
  dbStatus: {
    checking: boolean;
    success: boolean;
    message: string;
    url?: string;
    error?: string;
    fixInstructions?: string;
    records?: any[];
  };
  onVerifyAndSync: () => Promise<void>;
}

export const DeveloperSettingsPage: React.FC<DeveloperSettingsPageProps> = ({
  dbStatus,
  onVerifyAndSync,
}) => {
  const [copied, setCopied] = useState(false);
  const [activeSqlTab, setActiveSqlTab] = useState<'part1' | 'part2' | 'part3' | 'part4' | 'full'>('part1');
  const [url, setUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [savedMsg, setSavedMsg] = useState('');

  useEffect(() => {
    const creds = getSupabaseCredentials();
    setUrl(creds.url || '');
    setAnonKey(creds.anonKey || '');
  }, []);

  const getSqlForTab = () => {
    switch (activeSqlTab) {
      case 'part1':
        return SUPABASE_PART1;
      case 'part2':
        return SUPABASE_PART2;
      case 'part3':
        return SUPABASE_PART3;
      case 'part4':
        return SUPABASE_PART4;
      case 'full':
        return SUPABASE_SQL_SCHEMA;
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(getSqlForTab());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveAndTest = async () => {
    saveSupabaseCredentials(url, anonKey);
    setSavedMsg('Database credentials saved!');
    setTimeout(() => setSavedMsg(''), 3000);
    await handleTestConnection(url, anonKey);
  };

  const handleTestConnection = async (testUrl?: string, testKey?: string) => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testSupabaseConnection(testUrl || url, testKey || anonKey);
      setTestResult(result);
      if (result.success) {
        await onVerifyAndSync();
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `Unexpected test failure: ${err.message || String(err)}`,
      });
    } finally {
      setTesting(false);
    }
  };

  const envUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  const isEnvProvided = Boolean(envUrl && envKey);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-lg border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-emerald-400 font-bold text-xs uppercase tracking-wider mb-1">
              <Shield className="w-4 h-4" />
              <span>Developer Mode &bull; Restricted Access</span>
            </div>
            <h1 className="text-xl font-bold flex items-center space-x-2 text-white">
              <Database className="w-6 h-6 text-emerald-400" />
              <span>Developer Tools & Diagnostics</span>
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Configure Supabase PostgreSQL backend endpoints, monitor connection health, and view or export database DDL schemas.
            </p>
          </div>

          <button
            onClick={() => handleTestConnection()}
            disabled={testing || dbStatus.checking}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-slate-950 font-bold px-4 py-2.5 rounded-xl shadow transition text-xs flex items-center space-x-2 self-start sm:self-center"
          >
            <RefreshCw className={`w-4 h-4 ${testing || dbStatus.checking ? 'animate-spin' : ''}`} />
            <span>{testing || dbStatus.checking ? 'Testing Connection...' : 'Re-test Connection'}</span>
          </button>
        </div>
      </div>

      {/* Grid: Health Status & Credentials */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Connection Health Overview */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center space-x-2">
              <Server className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Database Health Status</span>
            </h2>
            <span
              className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase border ${
                dbStatus.success
                  ? 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                  : 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800'
              }`}
            >
              {dbStatus.checking
                ? 'Verifying...'
                : dbStatus.success
                ? 'Connected & Operational'
                : 'Connection Failed'}
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 font-semibold text-[11px]">
                <span>Active Endpoint URL:</span>
                <span className="font-mono text-slate-900 dark:text-slate-100 font-bold">
                  {url || envUrl || 'Not Configured'}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 font-semibold text-[11px]">
                <span>Environment Variable Source:</span>
                <span
                  className={`px-2 py-0.5 rounded font-bold ${
                    isEnvProvided
                      ? 'bg-[#E8F3EE] dark:bg-emerald-950/80 text-[#176B45] dark:text-emerald-300'
                      : 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300'
                  }`}
                >
                  {isEnvProvided ? 'VITE_SUPABASE_URL (.env)' : 'Local Override / Storage'}
                </span>
              </div>
            </div>

            {/* Diagnostic Message */}
            <div
              className={`p-3.5 rounded-xl border space-y-2 ${
                dbStatus.success
                  ? 'bg-emerald-50/50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                  : 'bg-rose-50/50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
              }`}
            >
              <div className="flex items-start space-x-2">
                {dbStatus.success ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 mt-0.5 flex-shrink-0" />
                )}
                <div>
                  <div className="font-bold text-xs">
                    {dbStatus.success
                      ? 'Supabase Connection Verified'
                      : 'Database Connection Error'}
                  </div>
                  <div className="text-[11px] leading-relaxed mt-0.5">
                    {dbStatus.message}
                  </div>
                </div>
              </div>

              {dbStatus.fixInstructions && (
                <div className="mt-2 p-2.5 bg-rose-950 text-rose-200 font-mono text-[11px] rounded-lg border border-rose-800 whitespace-pre-line">
                  <div className="font-bold text-rose-300 mb-1 flex items-center space-x-1">
                    <Terminal className="w-3.5 h-3.5" />
                    <span>Resolution Instructions:</span>
                  </div>
                  {dbStatus.fixInstructions}
                </div>
              )}
            </div>

            {/* Test Results Output */}
            {testResult && (
              <div
                className={`p-3 border rounded-xl space-y-2 text-xs ${
                  testResult.success
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                    : 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                }`}
              >
                <div className="font-bold text-[11px]">
                  Manual Test Result: {testResult.message}
                </div>
                {testResult.success && testResult.records && (
                  <div>
                    <div className="font-mono text-[10px] font-bold text-emerald-800 dark:text-emerald-300 mb-1">
                      Sample `school_profile` Query Response:
                    </div>
                    <pre className="bg-slate-900 text-emerald-400 p-2 rounded text-[10px] font-mono overflow-x-auto max-h-28">
                      {JSON.stringify(testResult.records, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Credentials Form */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h2 className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center space-x-2">
              <Key className="w-4 h-4 text-[#176B45] dark:text-emerald-400" />
              <span>Supabase API Credentials</span>
            </h2>
            {savedMsg && (
              <span className="text-emerald-600 dark:text-emerald-400 text-xs font-bold animate-pulse">
                {savedMsg}
              </span>
            )}
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-700 dark:text-slate-200 font-semibold mb-1">
                Supabase Project URL (`VITE_SUPABASE_URL`):
              </label>
              <div className="relative">
                <Globe className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://your-project.supabase.co"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg pl-9 pr-3 py-2 font-mono text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-200 font-semibold mb-1">
                Supabase Anon Key (`VITE_SUPABASE_ANON_KEY`):
              </label>
              <div className="relative">
                <Key className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="password"
                  value={anonKey}
                  onChange={(e) => setAnonKey(e.target.value)}
                  placeholder="eyJhY2Nlc3NfdG9rZW4iOi..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg pl-9 pr-3 py-2 font-mono text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center space-x-2">
              <button
                onClick={handleSaveAndTest}
                disabled={testing}
                className="bg-slate-900 dark:bg-emerald-700 hover:bg-slate-800 dark:hover:bg-emerald-600 text-white font-bold px-4 py-2 rounded-lg text-xs transition flex items-center space-x-2 shadow-sm cursor-pointer"
              >
                {testing ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                ) : (
                  <Database className="w-3.5 h-3.5 text-emerald-400" />
                )}
                <span>Save Credentials & Test Connection</span>
              </button>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 italic pt-1">
              Note: System configurations are automatically saved in local environment storage and take effect immediately.
            </p>
          </div>
        </div>
      </div>

      {/* SQL Setup & DDL Schema Section */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-lg border border-slate-800 space-y-4 text-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <Code2 className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-white">
              PostgreSQL DDL Schema & Setup Tools
            </h2>
          </div>

          <button
            onClick={handleCopySql}
            className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs transition flex items-center space-x-1.5 self-start sm:self-auto"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Copied Active Script!' : `Copy ${activeSqlTab.toUpperCase()} Script`}</span>
          </button>
        </div>

        {/* Tabs for SQL Parts */}
        <div className="flex items-center space-x-1 border-b border-slate-800 pb-2 overflow-x-auto">
          {[
            { id: 'part1', label: 'Part 1 (Core Tables)' },
            { id: 'part2', label: 'Part 2 (Staff & Students)' },
            { id: 'part3', label: 'Part 3 (Assessments & Marks)' },
            { id: 'part4', label: 'Part 4 (Indexes & RLS)' },
            { id: 'full', label: 'Full Combined Schema' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSqlTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap text-xs transition ${
                activeSqlTab === tab.id
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-[11px] text-emerald-400 max-h-72 overflow-y-auto whitespace-pre leading-relaxed">
          {getSqlForTab()}
        </pre>

        <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700 text-slate-300 text-[11px] space-y-1">
          <div className="font-bold text-emerald-400 flex items-center space-x-1">
            <Terminal className="w-3.5 h-3.5" />
            <span>How to execute in Supabase:</span>
          </div>
          <ol className="list-decimal list-inside space-y-0.5 text-slate-300">
            <li>Log into your Supabase Dashboard at your project URL.</li>
            <li>Go to <strong>SQL Editor</strong> &rarr; Click <strong>New Query</strong>.</li>
            <li>Paste the copied script and click <strong>Run</strong>.</li>
          </ol>
        </div>
      </div>
    </div>
  );
};
