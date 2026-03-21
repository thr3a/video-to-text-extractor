export const dynamic = 'force-dynamic';

import { exec, spawn } from 'node:child_process';
import crypto from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { promisify } from 'node:util';
import { NextResponse } from 'next/server';
import { jobStore, processMap } from '@/lib/jobStore';
import type { CropRect, ProcessRequest } from '@/lib/types';

const execAsync = promisify(exec);
const OCR_API = 'http://deep01.local:3200/analyze';

const buildCropFilter = (crop: CropRect, frameWidth: number, frameHeight: number): string => {
  const x = Math.round(crop.x * frameWidth);
  const y = Math.round(crop.y * frameHeight);
  const w = Math.round(crop.w * frameWidth);
  const h = Math.round(crop.h * frameHeight);
  // crop=w:h:x:y
  return `crop=${w}:${h}:${x}:${y}`;
};

const callOCR = async (imagePath: string): Promise<string> => {
  const imageBuffer = readFileSync(imagePath);
  const blob = new Blob([imageBuffer], { type: 'image/jpeg' });
  const form = new FormData();
  form.append('file', blob, 'frame.jpg');

  const response = await fetch(`${OCR_API}?format=horizontal`, {
    method: 'POST',
    body: form
  });

  const result = (await response.json()) as { format: string; content: string };
  return result.content.trim();
};

const processJob = async (
  jobId: string,
  videoPath: string,
  ocrDir: string,
  cropFilter: string,
  intervalSeconds: number
) => {
  const job = jobStore.get(jobId);
  if (!job) return;

  job.status = 'processing';

  // ffmpegでフレーム抽出（クロップ付き）
  const fps = `1/${intervalSeconds}`;
  const ffmpegArgs = [
    '-i',
    videoPath,
    '-vf',
    `fps=${fps},${cropFilter}`,
    '-q:v',
    '2',
    `${ocrDir}/frame_%05d.jpg`,
    '-y'
  ];

  await new Promise<void>((resolve) => {
    const proc = spawn('ffmpeg', ffmpegArgs);
    processMap.set(jobId, proc);

    proc.on('close', () => {
      processMap.delete(jobId);
      resolve();
    });
    proc.on('error', () => {
      processMap.delete(jobId);
      resolve();
    });
  });

  if (job.cancelRequested) {
    job.status = 'cancelled';
    return;
  }

  // 抽出されたフレームを列挙
  let frames: string[] = [];
  try {
    frames = readdirSync(ocrDir)
      .filter((f) => f.endsWith('.jpg'))
      .sort()
      .map((f) => `${ocrDir}/${f}`);
  } catch {
    job.status = 'error';
    job.error = 'フレームの読み込みに失敗しました';
    return;
  }

  job.totalFrames = frames.length;

  // 各フレームをOCR処理
  for (const framePath of frames) {
    if (job.cancelRequested) {
      job.status = 'cancelled';
      return;
    }

    try {
      const text = await callOCR(framePath);
      if (text) {
        const lastText = job.texts[job.texts.length - 1];
        if (text !== lastText) {
          job.texts.push(text);
        }
      }
    } catch {
      // 個別フレームのOCRエラーは無視して続行
    }

    job.processedFrames += 1;
  }

  job.status = 'completed';
};

export async function POST(request: Request) {
  const body = (await request.json()) as ProcessRequest;
  const { videoId, cropRect, intervalSeconds } = body;

  if (!videoId || !cropRect || !intervalSeconds) {
    return NextResponse.json({ error: 'パラメータが不足しています' }, { status: 400 });
  }

  const dir = `/tmp/vto-${videoId}`;
  const ocrDir = `${dir}/ocr`;
  mkdirSync(ocrDir, { recursive: true });

  // 動画ファイルを検索
  const { stdout: lsOut } = await execAsync(`ls "${dir}"/video.* 2>/dev/null | head -1`);
  const videoPath = lsOut.trim();

  if (!videoPath) {
    return NextResponse.json({ error: '動画ファイルが見つかりません' }, { status: 404 });
  }

  // 動画の解像度を取得
  const { stdout: probeOut } = await execAsync(
    `ffprobe -v quiet -select_streams v:0 -show_entries stream=width,height -print_format json "${videoPath}"`
  );
  const probeResult = JSON.parse(probeOut) as { streams: Array<{ width: number; height: number }> };
  const { width: frameWidth, height: frameHeight } = probeResult.streams[0];

  const cropFilter = buildCropFilter(cropRect, frameWidth, frameHeight);

  const jobId = crypto.randomUUID();
  jobStore.set(jobId, {
    id: jobId,
    videoId,
    status: 'pending',
    totalFrames: 0,
    processedFrames: 0,
    texts: [],
    cancelRequested: false
  });

  // バックグラウンドで処理開始（awaitしない）
  void processJob(jobId, videoPath, ocrDir, cropFilter, intervalSeconds);

  return NextResponse.json({ jobId });
}
