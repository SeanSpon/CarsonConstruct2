import { memo, useState, useCallback } from 'react';
import { 
  AlertCircle, 
  AlertTriangle, 
  Info, 
  CheckCircle2, 
  ChevronDown,
  ChevronRight,
  Wand2,
  RefreshCw,
  XCircle,
  Play,
  Clock,
} from 'lucide-react';
import { useStore } from '../../stores/store';
import type { QACheck } from '../../types';

interface QAPanelProps {
  className?: string;
  onRunChecks: () => void;
  onFixIssue: (checkId: string) => void;
  onFixAll: () => void;
  onJumpToTimestamp: (timestamp: number) => void;
}

const severityConfig = {
  error: {
    icon: XCircle,
    bgColor: 'bg-red-500/20',
    textColor: 'text-red-400',
    borderColor: 'border-red-500/30',
    label: 'Error',
  },
  warning: {
    icon: AlertTriangle,
    bgColor: 'bg-amber-500/20',
    textColor: 'text-amber-400',
    borderColor: 'border-amber-500/30',
    label: 'Warning',
  },
  info: {
    icon: Info,
    bgColor: 'bg-blue-500/20',
    textColor: 'text-blue-400',
    borderColor: 'border-blue-500/30',
    label: 'Info',
  },
};

function QAPanel({
  className,
  onRunChecks,
  onFixIssue,
  onFixAll,
  onJumpToTimestamp,
}: QAPanelProps) {
  const { qaChecks, qaRunning, markQACheckFixed } = useStore();
  const [expandedIssues, setExpandedIssues] = useState<Set<string>>(new Set());

  const errorCount = qaChecks.filter(c => c.severity === 'error' && !c.fixed).length;
  const warningCount = qaChecks.filter(c => c.severity === 'warning' && !c.fixed).length;
  const infoCount = qaChecks.filter(c => c.severity === 'info' && !c.fixed).length;
  const fixableCount = qaChecks.filter(c => c.autoFixable && !c.fixed).length;
  const allPassed = errorCount === 0;

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIssues(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleFixIssue = useCallback((check: QACheck) => {
    onFixIssue(check.id);
    markQACheckFixed(check.id);
  }, [onFixIssue, markQACheckFixed]);

  const formatTimestamp = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Group issues by severity
  const groupedIssues = {
    error: qaChecks.filter(c => c.severity === 'error'),
    warning: qaChecks.filter(c => c.severity === 'warning'),
    info: qaChecks.filter(c => c.severity === 'info'),
  };

  return (
    <div className={`flex flex-col bg-sz-bg-secondary rounded-xl border border-sz-border ${className || ''} no-select`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-sz-border">
        <div className="flex items-center gap-3">
          {allPassed ? (
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
              <AlertCircle className="w-4 h-4 text-red-400" />
            </div>
          )}
          <div>
            <h3 className="font-medium text-sz-text text-sm">
              Quality Check
            </h3>
            <p className="text-xs text-sz-text-muted">
              {allPassed 
                ? 'All checks passed!' 
                : `${errorCount} error${errorCount !== 1 ? 's' : ''}, ${warningCount} warning${warningCount !== 1 ? 's' : ''}`
              }
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {fixableCount > 0 && (
            <button
              onClick={onFixAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sz-accent/10 text-sz-accent text-sm hover:bg-sz-accent/20 transition-colors"
            >
              <Wand2 className="w-3.5 h-3.5" />
              Fix All ({fixableCount})
            </button>
          )}
          <button
            onClick={onRunChecks}
            disabled={qaRunning}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sz-bg-tertiary text-sz-text-secondary text-sm hover:text-sz-text hover:bg-sz-bg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${qaRunning ? 'animate-spin' : ''}`} />
            {qaRunning ? 'Checking...' : 'Re-check'}
          </button>
        </div>
      </div>

      {/* Summary badges */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-sz-border">
        {errorCount > 0 && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-red-500/20 text-red-400">
            <XCircle className="w-3 h-3" />
            {errorCount} errors
          </span>
        )}
        {warningCount > 0 && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-500/20 text-amber-400">
            <AlertTriangle className="w-3 h-3" />
            {warningCount} warnings
          </span>
        )}
        {infoCount > 0 && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-500/20 text-blue-400">
            <Info className="w-3 h-3" />
            {infoCount} info
          </span>
        )}
        {allPassed && qaChecks.length > 0 && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-500/20 text-emerald-400">
            <CheckCircle2 className="w-3 h-3" />
            All passed
          </span>
        )}
      </div>

      {/* Issues list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {qaChecks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-12 h-12 rounded-full bg-sz-bg-tertiary flex items-center justify-center mb-3">
              <CheckCircle2 className="w-6 h-6 text-sz-text-muted" />
            </div>
            <p className="text-sz-text-secondary text-sm mb-1">No issues found</p>
            <p className="text-sz-text-muted text-xs">
              Run quality checks to verify your edit
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {(['error', 'warning', 'info'] as const).map(severity => {
              const issues = groupedIssues[severity];
              if (issues.length === 0) return null;
              
              const config = severityConfig[severity];
              const Icon = config.icon;
              
              return (
                <div key={severity} className="space-y-1">
                  {issues.map(issue => {
                    const isExpanded = expandedIssues.has(issue.id);
                    
                    return (
                      <div
                        key={issue.id}
                        className={`rounded-lg border ${config.borderColor} ${
                          issue.fixed ? 'opacity-50' : ''
                        }`}
                      >
                        <button
                          onClick={() => toggleExpanded(issue.id)}
                          className={`w-full flex items-start gap-3 p-3 text-left ${config.bgColor} rounded-lg`}
                        >
                          <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${config.textColor}`} />
                          
                          <div className="flex-1 min-w-0 allow-select">
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-medium ${issue.fixed ? 'line-through text-sz-text-muted' : 'text-sz-text'}`}>
                                {issue.message}
                              </span>
                              {issue.fixed && (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              )}
                            </div>
                            
                            {issue.timestamp !== undefined && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onJumpToTimestamp(issue.timestamp!);
                                }}
                                className="flex items-center gap-1 mt-1 text-xs text-sz-text-secondary hover:text-sz-accent transition-colors"
                              >
                                <Clock className="w-3 h-3" />
                                {formatTimestamp(issue.timestamp)}
                                <Play className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                          
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-sz-text-muted flex-shrink-0" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-sz-text-muted flex-shrink-0" />
                          )}
                        </button>
                        
                        {isExpanded && !issue.fixed && (
                          <div className="px-3 pb-3 pt-1 border-t border-sz-border/50">
                            {issue.autoFixable && (
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-sz-text-muted">
                                  Auto-fixable
                                </span>
                                <button
                                  onClick={() => handleFixIssue(issue)}
                                  className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-sz-accent text-white hover:bg-sz-accent-hover transition-colors"
                                >
                                  <Wand2 className="w-3 h-3" />
                                  Fix
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer - export readiness */}
      <div className="px-4 py-3 border-t border-sz-border">
        {allPassed ? (
          <div className="flex items-center gap-2 text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-sm font-medium">Ready to export</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-amber-400">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm">
              {errorCount > 0 
                ? 'Fix errors before exporting' 
                : 'Review warnings before exporting'
              }
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(QAPanel);
