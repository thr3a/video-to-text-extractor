export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { jobStore } from '@/lib/jobStore';

export async function GET(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = jobStore.get(jobId);

  if (!job) {
    return NextResponse.json({ error: 'ジョブが見つかりません' }, { status: 404 });
  }

  return NextResponse.json({
    status: job.status,
    totalFrames: job.totalFrames,
    processedFrames: job.processedFrames,
    texts: job.texts,
    error: job.error
  });
}
