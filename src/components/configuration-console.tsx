'use client';

import { useEffect, useRef } from 'react';
import { CheckCircle2, XCircle, Loader2, Circle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export type StepStatus = 'pending' | 'processing' | 'success' | 'error';

export interface ConfigurationStep {
  name: string;
  status: StepStatus;
  error?: string;
}

export interface DomainQueueItem {
  domain: string;
  status: StepStatus;
  steps?: ConfigurationStep[];
  error?: string;
  nameservers?: string[];
}

interface ConfigurationConsoleProps {
  steps?: ConfigurationStep[];
  domainQueue?: DomainQueueItem[];
  title?: string;
}

export function ConfigurationConsole({ 
  steps = [], 
  domainQueue = [],
  title = 'Configuration Progress' 
}: ConfigurationConsoleProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const isBulkMode = domainQueue.length > 0;

  // Auto-scroll to bottom when new steps are added
  useEffect(() => {
    if (contentRef.current) {
      const viewport = contentRef.current.closest('[data-radix-scroll-area-viewport]') as HTMLElement;
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
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

  return (
    <Card className="w-full">
      <CardContent className="p-0">
        <div className="border-b px-4 py-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">{title}</h3>
          {totalCount > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {processingCount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {processingCount} processing
                </Badge>
              )}
              <span>
                {completedCount} / {totalCount} completed
              </span>
            </div>
          )}
        </div>
        <ScrollArea className="h-[400px]">
          <div ref={contentRef} className="p-4 space-y-2">
            {isBulkMode ? (
              // Bulk mode: Show domain queue
              domainQueue.length === 0 ? (
                <div className="text-muted-foreground text-center py-8">Waiting to start...</div>
              ) : (
                domainQueue.map((item, index) => (
                  <div
                    key={`${item.domain}-${index}`}
                    className={cn(
                      'border rounded-lg p-3 space-y-2 transition-all',
                      item.status === 'processing' && 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20',
                      item.status === 'success' && 'border-green-500 bg-green-50/50 dark:bg-green-950/20',
                      item.status === 'error' && 'border-red-500 bg-red-50/50 dark:bg-red-950/20',
                      item.status === 'pending' && 'border-muted bg-muted/30'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className={cn('flex-shrink-0', getStatusColor(item.status))}>
                          {getStatusIcon(item.status)}
                        </span>
                        <span className={cn(
                          'font-medium truncate',
                          item.status === 'error' && 'text-red-600 dark:text-red-400',
                          item.status === 'success' && 'text-green-600 dark:text-green-400',
                          item.status === 'processing' && 'text-blue-600 dark:text-blue-400'
                        )}>
                          {item.domain}
                        </span>
                        <Badge variant={getStatusBadgeVariant(item.status)} className="text-xs flex-shrink-0">
                          {item.status}
                        </Badge>
                      </div>
                    </div>
                    
                    {item.error && (
                      <div className="ml-6 text-xs text-red-500 break-words bg-red-100 dark:bg-red-950/30 p-2 rounded">
                        <strong>Error:</strong> {item.error}
                      </div>
                    )}

                    {item.steps && item.steps.length > 0 && (
                      <div className="ml-6 space-y-1 border-l-2 border-muted pl-3">
                        {item.steps.map((step, stepIndex) => (
                          <div
                            key={`${item.domain}-step-${stepIndex}`}
                            className={cn(
                              'flex items-center gap-2 text-xs',
                              step.status === 'processing' && 'animate-pulse'
                            )}
                          >
                            <span className={cn('flex-shrink-0', getStatusColor(step.status))}>
                              {getStatusIcon(step.status)}
                            </span>
                            <span className={cn(
                              'truncate',
                              step.status === 'error' && 'text-red-500',
                              step.status === 'success' && 'text-green-500'
                            )}>
                              {step.name}
                            </span>
                            {step.error && (
                              <span className="text-red-500 text-xs ml-2 truncate">
                                ({step.error})
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {item.nameservers && item.nameservers.length > 0 && (
                      <div className="ml-6 mt-2 p-2 bg-muted/50 rounded text-xs">
                        <div className="font-medium mb-1">Nameservers:</div>
                        <div className="space-y-0.5">
                          {item.nameservers.map((ns, nsIndex) => (
                            <div key={nsIndex} className="font-mono text-muted-foreground">
                              {ns}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )
            ) : (
              // Single mode: Show steps
              steps.length === 0 ? (
                <div className="text-muted-foreground text-center py-8">Waiting to start...</div>
              ) : (
                steps.map((step, index) => (
                  <div
                    key={`${step.name}-${index}`}
                    className={cn(
                      'flex items-start gap-2 py-1',
                      step.status === 'processing' && 'animate-pulse'
                    )}
                  >
                    <span className={cn('flex-shrink-0 mt-0.5', getStatusColor(step.status))}>
                      {getStatusIcon(step.status)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn('font-medium', getStatusColor(step.status))}>
                          [{getStatusText(step.status)}]
                        </span>
                        <span className={cn(
                          step.status === 'error' && 'text-red-500',
                          step.status === 'success' && 'text-green-500'
                        )}>
                          {step.name}
                        </span>
                      </div>
                      {step.error && (
                        <div className="mt-1 ml-6 text-xs text-red-500 break-words">
                          Error: {step.error}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )
            )}
          </div>
        </ScrollArea>
        {!isBulkMode && steps.length > 0 && (
          <div className="border-t px-4 py-2 text-xs text-muted-foreground">
            {completedCount} / {totalCount} completed
          </div>
        )}
      </CardContent>
    </Card>
  );
}

