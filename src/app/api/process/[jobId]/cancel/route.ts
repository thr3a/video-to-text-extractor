export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { jobStore, processMap } from '@/lib/jobStore';

export async function POST(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = jobStore.get(jobId);

  if (!job) {
    return NextResponse.json({ error: 'ジョブが見つかりません' }, { status: 404 });
  }

  job.cancelRequested = true;

  // 実行中のffmpegプロセスを終了
  const proc = processMap.get(jobId);
  if (proc) {
    proc.kill('SIGTERM');
    processMap.delete(jobId);
  }

  return NextResponse.json({ ok: true });
}
