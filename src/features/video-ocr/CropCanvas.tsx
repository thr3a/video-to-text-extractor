'use client';

import { Text } from '@mantine/core';
import { useEffect, useRef, useState } from 'react';
import type { CropRect } from '@/lib/types';

type Props = {
  imageUrl: string;
  onChange: (rect: CropRect | null) => void;
  currentRect: CropRect | null;
};

export const CropCanvas = ({ imageUrl, onChange, currentRect }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const startPosRef = useRef({ x: 0, y: 0 });

  const drawCanvas = (rect: { x: number; y: number; w: number; h: number } | null) => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    if (!rect) return;
    // 選択矩形を描画
    ctx.strokeStyle = 'rgba(0, 120, 255, 1)';
    ctx.lineWidth = 2;
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    ctx.fillStyle = 'rgba(0, 120, 255, 0.15)';
    ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const img = new Image();
    img.src = imageUrl;
    img.onload = () => {
      imgRef.current = img;
      // アスペクト比を保ちながら最大800pxに収める
      const maxW = 800;
      const scale = Math.min(1, maxW / img.naturalWidth);
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);

      // 既存の選択範囲を描画
      if (currentRect) {
        const displayRect = {
          x: currentRect.x * canvas.width,
          y: currentRect.y * canvas.height,
          w: currentRect.w * canvas.width,
          h: currentRect.h * canvas.height
        };
        drawCanvas(displayRect);
      } else {
        drawCanvas(null);
      }
    };
    // currentRectは初回のみ使用するため依存配列から除外
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl]);

  const getCanvasPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    // getBoundingClientRect()のサイズとcanvas内部解像度が異なる場合のスケール補正
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getCanvasPos(e);
    startPosRef.current = pos;
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    const pos = getCanvasPos(e);
    const start = startPosRef.current;
    drawCanvas({
      x: Math.min(start.x, pos.x),
      y: Math.min(start.y, pos.y),
      w: Math.abs(pos.x - start.x),
      h: Math.abs(pos.y - start.y)
    });
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    setIsDragging(false);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pos = getCanvasPos(e);
    const start = startPosRef.current;

    const dispX = Math.min(start.x, pos.x);
    const dispY = Math.min(start.y, pos.y);
    const dispW = Math.abs(pos.x - start.x);
    const dispH = Math.abs(pos.y - start.y);

    if (dispW < 5 || dispH < 5) {
      // 小さすぎる選択は無視
      return;
    }

    // 正規化座標（0-1）に変換
    onChange({
      x: dispX / canvas.width,
      y: dispY / canvas.height,
      w: dispW / canvas.width,
      h: dispH / canvas.height
    });
  };

  return (
    <div>
      <Text size='sm' c='dimmed' mb={4}>
        ドラッグして字幕領域を選択してください
      </Text>
      <canvas
        ref={canvasRef}
        style={{
          cursor: 'crosshair',
          maxWidth: '100%',
          border: '1px solid #dee2e6',
          borderRadius: 4,
          display: 'block'
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
    </div>
  );
};
