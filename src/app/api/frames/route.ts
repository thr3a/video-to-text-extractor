export const dynamic = 'force-dynamic';

import { existsSync, readFileSync } from 'node:fs';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const videoId = searchParams.get('videoId');
  const filename = searchParams.get('filename');
  const type = searchParams.get('type') ?? 'preview'; // 'preview' or 'ocr'

  if (!videoId || !filename) {
    return NextResponse.json({ error: 'パラメータが不足しています' }, { status: 400 });
  }

  // パストラバーサル対策
  if (videoId.includes('/') || filename.includes('/') || filename.includes('..')) {
    return NextResponse.json({ error: '不正なパラメータです' }, { status: 400 });
  }

  const filePath = `/tmp/vto-${videoId}/${type}/${filename}`;

  if (!existsSync(filePath)) {
    return NextResponse.json({ error: 'ファイルが見つかりません' }, { status: 404 });
  }

  const buffer = readFileSync(filePath);
  return new Response(buffer, {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=3600'
    }
  });
}
