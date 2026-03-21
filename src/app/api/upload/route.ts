export const dynamic = 'force-dynamic';
export const maxDuration = 300;

import { exec } from 'node:child_process';
import crypto from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { promisify } from 'node:util';
import { NextResponse } from 'next/server';
import type { PreviewFrame } from '@/lib/types';

const execAsync = promisify(exec);

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get('video');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: '動画ファイルが見つかりません' }, { status: 400 });
  }

  const videoId = crypto.randomUUID();
  const dir = `/tmp/vto-${videoId}`;
  const previewDir = `${dir}/preview`;

  mkdirSync(previewDir, { recursive: true });

  const nameParts = file.name.split('.');
  const ext = nameParts.length > 1 ? (nameParts.pop() ?? 'mp4') : 'mp4';
  const videoPath = `${dir}/video.${ext}`;

  // ファイルをディスクに保存
  const buffer = Buffer.from(await file.arrayBuffer());
  writeFileSync(videoPath, buffer);

  // 動画の長さを取得
  const { stdout: probeOut } = await execAsync(`ffprobe -v quiet -print_format json -show_format "${videoPath}"`);
  const probeResult = JSON.parse(probeOut) as { format: { duration: string } };
  const duration = parseFloat(probeResult.format.duration);

  // 10等分したタイムスタンプでプレビューフレームを抽出
  const percentages = [5, 15, 25, 35, 45, 55, 65, 75, 85, 95];
  const timestamps = percentages.map((p) => duration * (p / 100));

  await Promise.all(
    timestamps.map(async (ts, i) => {
      const safeTs = Math.min(ts, duration - 0.1);
      const outFile = `${previewDir}/frame_${String(i).padStart(2, '0')}.jpg`;
      try {
        await execAsync(
          `ffmpeg -ss ${safeTs.toFixed(3)} -i "${videoPath}" -vframes 1 -q:v 2 "${outFile}" -y 2>/dev/null`
        );
      } catch {
        // フレーム抽出失敗は無視
      }
    })
  );

  const previewFrames: PreviewFrame[] = timestamps.map((ts, i) => ({
    filename: `frame_${String(i).padStart(2, '0')}.jpg`,
    timestamp: ts
  }));

  return NextResponse.json({
    videoId,
    duration,
    originalName: file.name,
    previewFrames
  });
}
