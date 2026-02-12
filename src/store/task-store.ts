import { create } from 'zustand';

export type TaskType = 'refresh_all' | 'refresh_zones' | 'refresh_dns' | 'refresh_ssl';

export interface TaskLog {
    id: string;
    timestamp: number;
    message: string;
    type: 'info' | 'error' | 'success' | 'running';
}

export interface TaskState {
    // Active task state
    activeTask: {
        id: string;
        title: string;
        type: TaskType;
    } | null;
    status: 'idle' | 'running' | 'paused' | 'stopped' | 'completed' | 'error';
    progress: number; // 0-100
    logs: TaskLog[];
    processedItems: number;
    totalItems: number;

    // UI state
    isMinimized: boolean;
    isVisible: boolean;

    // Actions
    startTask: (type: TaskType, title: string, totalItems?: number) => void;
    updateProgress: (progress: number, processedItems?: number) => void;
    pauseTask: () => void;
    resumeTask: () => void;
    stopTask: () => void;
    addLog: (message: string, type?: 'info' | 'error' | 'success') => void;
    completeTask: () => void;
    failTask: (error: string) => void;
    resetTask: () => void;
    minimize: (minimized: boolean) => void;
    close: () => void;
}

export const useTaskStore = create<TaskState>((set, get) => ({
    activeTask: null,
    status: 'idle',
    progress: 0,
    logs: [],
    processedItems: 0,
    totalItems: 0,
    isMinimized: false,
    isVisible: false,

    startTask: (type, title, totalItems = 0) => {
        set({
            activeTask: { id: crypto.randomUUID(), title, type },
            status: 'running',
            progress: 0,
            processedItems: 0,
            totalItems,
            logs: [],
            isVisible: true,
            isMinimized: false,
        });
    },

    updateProgress: (progress, processedItems) => {
        set((state) => ({
            progress,
            processedItems: processedItems !== undefined ? processedItems : state.processedItems
        }));
    },

    pauseTask: () => {
        const { status, addLog } = get();
        if (status === 'running') {
            set({ status: 'paused' });
            addLog('Task paused', 'info');
        }
    },

    resumeTask: () => {
        const { status, addLog } = get();
        if (status === 'paused') {
            set({ status: 'running' });
            addLog('Task resumed', 'info');
        }
    },

    stopTask: () => {
        const { status, addLog } = get();
        if (status === 'running' || status === 'paused') {
            set({ status: 'stopped' });
            addLog('Task stopped by user', 'error');
        }
    },

    addLog: (message, type = 'info') => {
        const log: TaskLog = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            message,
            type,
        };
        set((state) => ({ logs: [...state.logs, log] }));
    },

    completeTask: () => {
        set({ status: 'completed', progress: 100 });
    },

    failTask: (error) => {
        get().addLog(error, 'error');
        set({ status: 'error' });
    },

    resetTask: () => {
        set({
            activeTask: null,
            status: 'idle',
            progress: 0,
            processedItems: 0,
            totalItems: 0,
            logs: [],
            isVisible: false,
        });
    },

    minimize: (isMinimized) => {
        set({ isMinimized });
    },

    close: () => {
        set({ isVisible: false });
    },
}));
