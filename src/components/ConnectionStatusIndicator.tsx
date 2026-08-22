import React, { useState, useRef, useEffect } from 'react';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Shield,
  Database,
  ExternalLink,
  ChevronDown,
  X,
} from 'lucide-react';
import { ConnectionStatus } from '../lib/storage';
import { User } from '../types';

export type StatusCategory = 'checking' | 'interrupted' | 'offline' | 'connected' | 'auth_required';

interface ConnectionStatusIndicatorProps {
  connectionStatus: ConnectionStatus;
  dbStatus?: {
    checking: boolean;
    success: boolean;
    message?: string;
    error?: string;
  };
  currentUser?: User | null;
  onNavigateToDiagnostics?: () => void;
  onRetryConnection?: () => Promise<void> | void;
}

export const ConnectionStatusIndicator: React.FC<ConnectionStatusIndicatorProps> = ({
  connectionStatus,
  dbStatus,
  currentUser,
  onNavigateToDiagnostics,
  onRetryConnection,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Determine normalized status category
  const getStatusCategory = (): StatusCategory => {
    if (connectionStatus === 'offline') {
      return 'offline';
    }
    if (dbStatus?.checking || connectionStatus === 'syncing' || connectionStatus === 'reconnecting') {
      return 'checking';
    }
    if (connectionStatus === 'realtime_unavailable' || (dbStatus && !dbStatus.success && !dbStatus.checking)) {
      return 'interrupted';
    }
    if (!currentUser && typeof window !== 'undefined' && window.location.hash.includes('login')) {
      return 'auth_required';
    }
    return 'connected';
  };

  const statusCategory = getStatusCategory();

  // Close popover on click outside or escape key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleRetry = async () => {
    if (isRetrying || !onRetryConnection) return;
    setIsRetrying(true);
    try {
      await onRetryConnection();
    } finally {
      setTimeout(() => setIsRetrying(false), 800);
    }
  };

  // Config mapping for visual styles & human-friendly labels
  const config = {
    connected: {
      dotBg: 'bg-emerald-400',
      pillBg: 'bg-emerald-950/40 hover:bg-emerald-950/60 border-emerald-500/30 text-emerald-100',
      icon: CheckCircle2,
      shortLabel: 'Connected',
      title: 'System Connected',
      description: 'Connected to the school database.',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    },
    checking: {
      dotBg: 'bg-amber-400 animate-pulse',
      pillBg: 'bg-amber-950/40 hover:bg-amber-950/60 border-amber-500/30 text-amber-100',
      icon: RefreshCw,
      iconClass: 'animate-spin',
      shortLabel: 'Connecting…',
      title: 'Connecting to System',
      description: 'Verifying connection and syncing records with the school database.',
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    },
    interrupted: {
      dotBg: 'bg-amber-400',
      pillBg: 'bg-amber-950/50 hover:bg-amber-950/70 border-amber-500/40 text-amber-100',
      icon: AlertTriangle,
      shortLabel: 'Reconnecting',
      title: 'Connection Interrupted',
      description: 'Temporary connection delay. Attempting to reconnect…',
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    },
    offline: {
      dotBg: 'bg-rose-400',
      pillBg: 'bg-rose-950/60 hover:bg-rose-950/80 border-rose-500/40 text-rose-100',
      icon: WifiOff,
      shortLabel: 'Offline',
      title: 'Offline Mode',
      description: 'No network connection detected. Please check your network connection.',
      badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    },
    auth_required: {
      dotBg: 'bg-blue-400',
      pillBg: 'bg-blue-950/40 hover:bg-blue-950/60 border-blue-500/30 text-blue-100',
      icon: Shield,
      shortLabel: 'Sign-in Required',
      title: 'Sign-in Required',
      description: 'Your sign-in session requires verification to access school data.',
      badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    },
  }[statusCategory];

  const Icon = config.icon;

  return (
    <div className="relative inline-block" ref={popoverRef}>
      {/* Compact Status Pill Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-emerald-400/40 ${config.pillBg}`}
        title={`Status: ${config.title}. Click for details.`}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        role="status"
        aria-live="polite"
      >
        <span className={`w-2 h-2 rounded-full ${config.dotBg} shrink-0`} />
        <span className="hidden sm:inline font-medium">{config.shortLabel}</span>
        <ChevronDown className={`w-3 h-3 opacity-60 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Accessible Detail Popover */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Connection Status Details"
          className="absolute right-0 sm:right-auto sm:left-0 top-full mt-2 w-72 sm:w-80 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl z-50 p-4 text-slate-200 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-md space-y-3.5"
        >
          {/* Popover Header */}
          <div className="flex items-start justify-between pb-2.5 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-lg ${config.badgeColor} border shrink-0`}>
                <Icon className={`w-4 h-4 ${'iconClass' in config ? config.iconClass : ''}`} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white leading-tight">{config.title}</h4>
                <span className="text-[10px] text-slate-400">System Status</span>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              aria-label="Close status popover"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Calm Human-Readable Explanation */}
          <p className="text-xs text-slate-300 leading-relaxed">{config.description}</p>

          {/* Connection Checks Summary */}
          <div className="bg-slate-950/60 rounded-xl p-2.5 border border-slate-800 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-[11px]">Network</span>
              <span className="inline-flex items-center gap-1 font-semibold text-[11px]">
                {connectionStatus === 'offline' ? (
                  <span className="text-rose-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Offline
                  </span>
                ) : (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Online
                  </span>
                )}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-[11px]">School Database</span>
              <span className="inline-flex items-center gap-1 font-semibold text-[11px]">
                {dbStatus?.checking ? (
                  <span className="text-amber-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" /> Checking…
                  </span>
                ) : dbStatus?.success !== false ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Connected
                  </span>
                ) : (
                  <span className="text-amber-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Reconnecting…
                  </span>
                )}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between gap-2 pt-1">
            {onRetryConnection && (
              <button
                type="button"
                onClick={handleRetry}
                disabled={isRetrying}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold border border-slate-700 transition cursor-pointer disabled:opacity-60"
              >
                <RefreshCw className={`w-3 h-3 ${isRetrying ? 'animate-spin text-emerald-400' : ''}`} />
                <span>{isRetrying ? 'Checking…' : 'Check Connection'}</span>
              </button>
            )}

            {/* Administrator Diagnostics Access */}
            {currentUser?.role === 'admin' && onNavigateToDiagnostics && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onNavigateToDiagnostics();
                }}
                className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/60 text-emerald-200 hover:text-white text-xs font-semibold transition cursor-pointer"
                title="Open Database Diagnostics & SQL Schema"
              >
                <Database className="w-3 h-3 text-emerald-400" />
                <span>Diagnostics</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
