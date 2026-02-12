'use client';

import React, { useEffect, useRef } from 'react';
import { useTaskStore } from '@/store/task-store';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import {
    X,
    Minimize2,
    Maximize2,
    Loader2,
    CheckCircle2,
    AlertCircle,
    Terminal
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function TaskOperationWindow() {
    const {
        activeTask,
        status,
        progress,
        logs,
        processedItems,
        totalItems,
        isVisible,
        isMinimized,
        minimize,
        close,
        pauseTask,
        resumeTask,
        stopTask
    } = useTaskStore();

    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom of logs
    useEffect(() => {
        if (scrollRef.current) {
            const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (scrollContainer) {
                scrollContainer.scrollTop = scrollContainer.scrollHeight;
            }
        }
    }, [logs, isMinimized]);

    if (!isVisible || !activeTask) return null;

    return (
        <div
            className={cn(
                "fixed bottom-4 right-4 z-50 w-full max-w-md shadow-2xl transition-all duration-300",
                isMinimized ? "w-auto" : "w-full max-w-md",
                "animate-in slide-in-from-bottom-4 fade-in duration-300"
            )}
        >
            <Card className="overflow-hidden border-primary/20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                {/* Header */}
                <div className="flex items-center justify-between p-3 border-b bg-muted/30">
                    <div className="flex items-center gap-2">
                        {status === 'running' ? (
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        ) : status === 'completed' ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : status === 'error' ? (
                            <AlertCircle className="h-4 w-4 text-destructive" />
                        ) : (
                            <Terminal className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="font-semibold text-sm truncate max-w-[200px]">
                            {activeTask.title}
                        </span>
                    </div>
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => minimize(!isMinimized)}
                        >
                            {isMinimized ? (
                                <Maximize2 className="h-3.5 w-3.5" />
                            ) : (
                                <Minimize2 className="h-3.5 w-3.5" />
                            )}
                        </Button>
                        {status !== 'running' && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 hover:text-destructive"
                                onClick={close}
                            >
                                <X className="h-3.5 w-3.5" />
                            </Button>
                        )}
                    </div>
                </div>

                {/* Expanded Content */}
                {!isMinimized && (
                    <div className="p-0">
                        {/* Progress Section */}
                        <div className="p-4 space-y-3 border-b">
                            <div className="flex justify-between text-xs text-muted-foreground">
                                <div className="flex gap-4">
                                    <span>Progress</span>
                                    {totalItems > 0 && (
                                        <span>{processedItems} / {totalItems}</span>
                                    )}
                                </div>
                                <span>{progress}%</span>
                            </div>
                            <Progress value={progress} className="h-2" />

                            <div className="flex items-center justify-between mt-2">
                                <div className="text-xs text-muted-foreground truncate flex-1 mr-2">
                                    {logs.length > 0 ? logs[logs.length - 1].message : 'Initializing...'}
                                </div>

                                {/* Controls */}
                                {status === 'running' || status === 'paused' ? (
                                    <div className="flex gap-1">
                                        {status === 'running' ? (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-6 px-2 text-xs"
                                                onClick={pauseTask}
                                            >
                                                Pause
                                            </Button>
                                        ) : (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-6 px-2 text-xs"
                                                onClick={resumeTask}
                                            >
                                                Resume
                                            </Button>
                                        )}
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            className="h-6 px-2 text-xs"
                                            onClick={stopTask}
                                        >
                                            Stop
                                        </Button>
                                    </div>
                                ) : null}
                            </div>
                        </div>

                        {/* Logs Section */}
                        <div className="bg-black/5 dark:bg-black/20">
                            <ScrollArea className="h-[200px]" ref={scrollRef}>
                                <div className="p-3 space-y-1.5 font-mono text-xs">
                                    {logs.length === 0 && (
                                        <div className="text-muted-foreground italic p-2 text-center">
                                            Waiting for logs...
                                        </div>
                                    )}
                                    {logs.map((log) => (
                                        <div key={log.id} className="flex gap-2 text-foreground/80">
                                            <span className="text-muted-foreground shrink-0 select-none">
                                                {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                            </span>
                                            <span className={cn(
                                                "break-words",
                                                log.type === 'error' && "text-destructive",
                                                log.type === 'success' && "text-green-500",
                                                log.type === 'info' && "text-foreground"
                                            )}>
                                                {log.message}
                                                {log.type === 'running' && <span className="animate-pulse">...</span>}
                                            </span>
                                        </div>
                                    ))}
                                    {status === 'running' && (
                                        <div className="flex gap-2 text-muted-foreground/50 animate-pulse">
                                            <span className="opacity-0">00:00:00</span>
                                            <span>_</span>
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </div>
                    </div>
                )}
            </Card>
        </div>
    );
}
