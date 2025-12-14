'use client';

import { useEffect, useRef } from 'react';
import { CheckCircle2, XCircle, Loader2, Circle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { CopyButton } from '@/components/ui/copy-button';

export type StepStatus = 'pending' | 'processing' | 'success' | 'error';

export interface ConfigurationStep {
  name: string;
  status: StepStatus;
  error?: string;
  variable?: string; // The setting value being applied (e.g., "strict", "on", "off")
}

export interface DomainQueueItem {
  domain: string;
  status: StepStatus;
  steps?: ConfigurationStep[];
  error?: string;
  nameservers?: string[];
  rootIPAddress?: string;
  proxied?: boolean;
}

interface ConfigurationConsoleProps {
  steps?: ConfigurationStep[];
  domainQueue?: DomainQueueItem[];
  title?: string;
  className?: string;
  /**
   * Minimum height the console should reserve. Defaults adapt to bulk mode.
   */
  minHeight?: string;
  /**
   * Maximum height the console should occupy. Defaults to 75vh.
   */
  maxHeight?: string;
  /**
   * Dense mode tightens spacing for cramped layouts.
   */
  dense?: boolean;
}

export function ConfigurationConsole({ 
  steps = [], 
  domainQueue = [], 
  title = 'Configuration Progress',
  className,
  minHeight,
  maxHeight,
  dense = false,
}: ConfigurationConsoleProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const isBulkMode = domainQueue.length > 0;
  const resolvedMinHeight = minHeight ?? (isBulkMode ? '420px' : '320px');
  const resolvedMaxHeight = maxHeight ?? '75vh';

  // Auto-scroll to bottom when new steps are added
  useEffect(() => {
    if (contentRef.current) {
      const scrollContainer = contentRef.current.parentElement;
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [steps, domainQueue]);

  const getStatusIcon = (status: StepStatus) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'pending':
        return <Circle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusText = (status: StepStatus) => {
    switch (status) {
      case 'success':
        return '✓';
      case 'error':
        return '✗';
      case 'processing':
        return '→';
      case 'pending':
        return '○';
    }
  };

  const getStatusColor = (status: StepStatus) => {
    switch (status) {
      case 'success':
        return 'text-green-500';
      case 'error':
        return 'text-red-500';
      case 'processing':
        return 'text-blue-500';
      case 'pending':
        return 'text-muted-foreground';
    }
  };

  const getStatusBadgeVariant = (status: StepStatus): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case 'success':
        return 'default';
      case 'error':
        return 'destructive';
      case 'processing':
        return 'secondary';
      case 'pending':
        return 'outline';
    }
  };

  const completedCount = isBulkMode
    ? domainQueue.filter(d => d.status === 'success').length
    : steps.filter(s => s.status === 'success').length;
  
  const totalCount = isBulkMode ? domainQueue.length : steps.length;
  const processingCount = isBulkMode
    ? domainQueue.filter(d => d.status === 'processing').length
    : steps.filter(s => s.status === 'processing').length;
  
  const errorCount = isBulkMode
    ? domainQueue.filter(d => d.status === 'error').length
    : steps.filter(s => s.status === 'error').length;

  // Collect all nameservers from all domains
  const allNameservers = isBulkMode 
    ? Array.from(new Set(domainQueue.flatMap(item => item.nameservers || [])))
    : [];

  return (
    <Card
      className={cn(
        'w-full flex flex-col h-full',
        dense ? 'text-sm' : '',
        className
      )}
      style={{ minHeight: resolvedMinHeight, maxHeight: resolvedMaxHeight }}
    >
      <CardContent className="p-0 flex flex-col h-full min-h-0">
        <div
          className={cn(
            'border-b flex items-center justify-between bg-muted/30 flex-shrink-0',
            dense ? 'px-3 py-2' : 'px-4 py-3'
          )}
        >
          <h3 className="text-sm font-semibold">{title}</h3>
          {totalCount > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {processingCount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {processingCount} processing
                </Badge>
              )}
              {errorCount > 0 && (
                <Badge 
                  variant="destructive" 
                  className="text-xs bg-red-600 text-white border-red-700 dark:bg-red-700 dark:text-white dark:border-red-800"
                >
                  {errorCount} error{errorCount !== 1 ? 's' : ''}
                </Badge>
              )}
              <span className="font-medium">
                {completedCount} / {totalCount} completed
              </span>
            </div>
          )}
        </div>
        
        {allNameservers.length > 0 && (
          <div
            className={cn(
              'border-b bg-muted/20 flex-shrink-0',
              dense ? 'px-3 py-1.5' : 'px-4 py-2'
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium mb-1 text-muted-foreground">Nameservers:</div>
                <div className="flex flex-wrap gap-1.5">
                  {allNameservers.map((ns, nsIndex) => (
                    <div 
                      key={nsIndex} 
                      className="flex items-center gap-1.5 px-2 py-1 bg-background border rounded text-xs font-mono text-muted-foreground group hover:bg-muted transition-colors"
                    >
                      <span className="truncate max-w-[200px]">{ns}</span>
                      <CopyButton
                        text={ns}
                        successMessage="Copied to clipboard"
                        size="icon"
                        className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity"
                        copyIconClassName="h-3 w-3"
                        checkIconClassName="h-3 w-3"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 min-h-0 relative overflow-y-auto">
          <div
            ref={contentRef}
            className={cn('space-y-3', dense ? 'p-3' : 'p-4')}
          >
            {isBulkMode ? (
              // Bulk mode: Show domain queue
              domainQueue.length === 0 ? (
                <div className="text-muted-foreground text-center py-12">
                  <Circle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Waiting to start...</p>
                </div>
              ) : (
                domainQueue.map((item, index) => (
                  <div
                    key={`${item.domain}-${index}`}
                    className={cn(
                      'border rounded-lg p-4 space-y-3 transition-all duration-200',
                      item.status === 'processing' && 'border-blue-500/50 bg-blue-50/50 dark:bg-blue-950/20 shadow-sm',
                      item.status === 'success' && 'border-green-500/50 bg-green-50/50 dark:bg-green-950/20 shadow-sm',
                      item.status === 'error' && 'border-red-500/50 bg-red-50/50 dark:bg-red-950/20 shadow-sm',
                      item.status === 'pending' && 'border-muted bg-muted/30'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5 flex-1 min-w-0">
                        <span className={cn('flex-shrink-0 mt-0.5', getStatusColor(item.status))}>
                          {getStatusIcon(item.status)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={cn(
                              'font-semibold break-words',
                              item.status === 'error' && 'text-red-600 dark:text-red-400',
                              item.status === 'success' && 'text-green-600 dark:text-green-400',
                              item.status === 'processing' && 'text-blue-600 dark:text-blue-400'
                            )}>
                              {item.domain}
                            </span>
                            <Badge 
                              variant={getStatusBadgeVariant(item.status)} 
                              className={cn(
                                'text-xs flex-shrink-0',
                                item.status === 'error' && 'bg-red-600 text-white border-red-700 dark:bg-red-700 dark:text-white dark:border-red-800'
                              )}
                            >
                              {item.status}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {item.error && (
                      <div className="ml-7 space-y-1">
                        <div className="text-xs font-medium text-red-600 dark:text-red-400">Error:</div>
                        <div className="text-xs text-red-600 dark:text-red-500 break-words bg-red-100 dark:bg-red-950/40 p-2.5 rounded border border-red-200 dark:border-red-900/50">
                          {item.error}
                        </div>
                      </div>
                    )}

                    {item.steps && item.steps.length > 0 && (
                      <div className="ml-7 space-y-2 border-l-2 border-muted/50 pl-3">
                        {item.steps.map((step, stepIndex) => (
                          <div
                            key={`${item.domain}-step-${stepIndex}`}
                            className={cn(
                              'flex items-start gap-2.5 text-xs',
                              step.status === 'processing' && 'animate-pulse'
                            )}
                          >
                            <span className={cn('flex-shrink-0 mt-0.5', getStatusColor(step.status))}>
                              {getStatusIcon(step.status)}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={cn(
                                  'break-words',
                                  step.status === 'error' && 'text-red-600 dark:text-red-400 font-medium',
                                  step.status === 'success' && 'text-green-600 dark:text-green-400'
                                )}>
                                  {step.name}
                                </span>
                                {step.variable && (
                                  <Badge variant="outline" className="text-xs font-mono">
                                    {step.variable}
                                  </Badge>
                                )}
                              </div>
                              {step.error && (
                                <div className="mt-1 text-red-600 dark:text-red-500 break-words text-xs bg-red-50 dark:bg-red-950/30 p-1.5 rounded">
                                  {step.error}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )
            ) : (
              // Single mode: Show steps
              steps.length === 0 ? (
                <div className="text-muted-foreground text-center py-12">
                  <Circle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Waiting to start...</p>
                </div>
              ) : (
                steps.map((step, index) => (
                  <div
                    key={`${step.name}-${index}`}
                    className={cn(
                      'flex items-start gap-3 py-2 transition-all',
                      step.status === 'processing' && 'animate-pulse'
                    )}
                  >
                    <span className={cn('flex-shrink-0 mt-0.5', getStatusColor(step.status))}>
                      {getStatusIcon(step.status)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn('font-medium text-xs', getStatusColor(step.status))}>
                          [{getStatusText(step.status)}]
                        </span>
                        <span className={cn(
                          'break-words',
                          step.status === 'error' && 'text-red-600 dark:text-red-400 font-medium',
                          step.status === 'success' && 'text-green-600 dark:text-green-400'
                        )}>
                          {step.name}
                        </span>
                        {step.variable && (
                          <Badge variant="outline" className="text-xs font-mono">
                            {step.variable}
                          </Badge>
                        )}
                      </div>
                      {step.error && (
                        <div className="mt-2 ml-6 text-xs text-red-600 dark:text-red-500 break-words bg-red-50 dark:bg-red-950/30 p-2 rounded border border-red-200 dark:border-red-900/50">
                          <strong>Error:</strong> {step.error}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )
            )}
          </div>
        </div>
        {!isBulkMode && steps.length > 0 && (
          <div className="border-t px-4 py-2 text-xs text-muted-foreground bg-muted/30 flex-shrink-0">
            {completedCount} / {totalCount} completed
          </div>
        )}
      </CardContent>
    </Card>
  );
}

