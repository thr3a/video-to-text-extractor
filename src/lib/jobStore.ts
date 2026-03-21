import type { ChildProcess } from 'node:child_process';
import type { JobState } from './types';

// グローバル変数でホットリロード時もデータを保持する
type GlobalWithStore = typeof globalThis & {
  __jobStore?: Map<string, JobState>;
  __processMap?: Map<string, ChildProcess>;
};

const g = globalThis as GlobalWithStore;

if (!g.__jobStore) g.__jobStore = new Map();
export const jobStore: Map<string, JobState> = g.__jobStore;

if (!g.__processMap) g.__processMap = new Map();
export const processMap: Map<string, ChildProcess> = g.__processMap;
