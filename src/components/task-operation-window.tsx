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
    Terminal,
    Play,
    Pause,
    Square
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
                "fixed bottom-4 right-4 z-50 shadow-2xl transition-all duration-300 ease-in-out",
                isMinimized ? "w-auto" : "w-80", // Fixed width for compact look
                "animate-in slide-in-from-bottom-4 fade-in duration-300"
            )}
        >
            <Card className="overflow-hidden border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-xl">
                {/* Header */}
                <div className="flex items-center justify-between gap-2 px-3 py-2 border-b bg-muted/40 h-9">
                    <div className="flex items-center gap-2 overflow-hidden">
                        {status === 'running' ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
                        ) : status === 'completed' ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                        ) : status === 'error' ? (
                            <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                        ) : (
                            <Terminal className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        )}
                        <span className="font-medium text-xs truncate select-none">
                            {activeTask.title}
                        </span>
                    </div>
                    <div className="flex items-center gap-0.5 ml-2 shrink-0">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 hover:bg-muted"
                            onClick={() => minimize(!isMinimized)}
                        >
                            {isMinimized ? (
                                <Maximize2 className="h-3 w-3 text-muted-foreground" />
                            ) : (
                                <Minimize2 className="h-3 w-3 text-muted-foreground" />
                            )}
                        </Button>
                        {status !== 'running' && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 hover:bg-destructive/10 hover:text-destructive"
                                onClick={close}
                            >
                                <X className="h-3 w-3" />
                            </Button>
                        )}
                    </div>
                </div>

                {/* Expanded Content */}
                {!isMinimized && (
                    <div className="flex flex-col">
                        {/* Progress Section */}
                        <div className="px-3 py-2 space-y-2 bg-background/50">
                            <div className="flex justify-between items-end text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                                <span>Progress</span>
                                <span className="text-foreground">{Math.round(progress)}%</span>
                            </div>
                            <Progress value={progress} className="h-1" />

                            <div className="flex justify-between text-[10px] text-muted-foreground">
                                <span>{processedItems} / {totalItems} items</span>

                                {status === 'running' && (
                                    <span className="animate-pulse text-primary">Processing...</span>
                                )}
                            </div>
                        </div>

                        {/* Logs Section */}
                        <div className="border-t border-border/40 bg-muted/20">
                            <ScrollArea className="h-[140px] w-full" ref={scrollRef}>
                                <div className="p-2 space-y-1 font-mono text-[10px]">
                                    {logs.length === 0 && (
                                        <div className="text-muted-foreground/60 italic px-1 text-center py-8">
                                            Initializing task...
                                        </div>
                                    )}
                                    {logs.map((log) => (
                                        <div key={log.id} className="flex gap-2 leading-tight">
                                            <span className="text-muted-foreground/50 shrink-0 select-none w-10">
                                                {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                            </span>
                                            <span className={cn(
                                                "break-words flex-1",
                                                log.type === 'error' && "text-destructive",
                                                log.type === 'success' && "text-green-600 dark:text-green-500",
                                                log.type === 'info' && "text-foreground/80"
                                            )}>
                                                {log.message}
                                            </span>
                                        </div>
                                    ))}
                                    {status === 'running' && (
                                        <div className="flex gap-2 text-primary/50 animate-pulse">
                                            <span className="w-10 opacity-0">-</span>
                                            <span>_</span>
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </div>

                        {/* Footer Controls */}
                        {status === 'running' || status === 'paused' ? (
                            <div className="p-1 border-t bg-muted/30 flex justify-end gap-1">
                                {status === 'running' ? (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 px-2 text-[10px] gap-1.5 hover:bg-background border border-transparent hover:border-border/60"
                                        onClick={pauseTask}
                                    >
                                        <Pause className="h-3 w-3" />
                                        Pause
                                    </Button>
                                ) : (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 px-2 text-[10px] gap-1.5 hover:bg-background border border-transparent hover:border-border/60 text-primary"
                                        onClick={resumeTask}
                                    >
                                        <Play className="h-3 w-3" />
                                        Resume
                                    </Button>
                                )}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 text-[10px] gap-1.5 hover:bg-destructive/10 hover:text-destructive border border-transparent hover:border-destructive/20"
                                    onClick={stopTask}
                                >
                                    <Square className="h-3 w-3 fill-current" />
                                    Stop
                                </Button>
                            </div>
                        ) : null}
                    </div>
                )}
            </Card>
        </div>
    );
}
