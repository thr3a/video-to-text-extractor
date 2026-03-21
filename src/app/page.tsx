'use client';

import {
  Alert,
  Box,
  Button,
  Card,
  Group,
  Image,
  Loader,
  NumberInput,
  Progress,
  SimpleGrid,
  Stack,
  Stepper,
  Text,
  Textarea,
  Title
} from '@mantine/core';
import { useDisclosure, useInterval } from '@mantine/hooks';
import { IconDownload, IconPlayerStop, IconUpload, IconX } from '@tabler/icons-react';
import { useCallback, useRef, useState } from 'react';
import { CropCanvas } from '@/features/video-ocr/CropCanvas';
import type { CropRect, JobStatusResponse, PreviewFrame, UploadResponse } from '@/lib/types';

export default function Page() {
  const [active, setActive] = useState(0);

  // Step1: アップロード
  const [uploading, setUploading] = useState(false);
  const [uploadData, setUploadData] = useState<UploadResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step2: フレーム選択・クロップ
  const [selectedFrame, setSelectedFrame] = useState<PreviewFrame | null>(null);
  const [cropRect, setCropRect] = useState<CropRect | null>(null);

  // Step3: 設定
  const [intervalSeconds, setIntervalSeconds] = useState<number>(2);

  // Step4: 処理・結果
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatusResponse | null>(null);
  const [processing, { open: startProcessing, close: stopProcessing }] = useDisclosure(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ポーリング
  const pollInterval = useInterval(async () => {
    if (!jobId) return;
    const res = await fetch(`/api/process/${jobId}`);
    const data = (await res.json()) as JobStatusResponse;
    setJobStatus(data);
    if (data.status === 'completed' || data.status === 'cancelled' || data.status === 'error') {
      pollInterval.stop();
      stopProcessing();
    }
  }, 2000);

  const handleFileSelect = useCallback(async (file: File) => {
    setUploading(true);
    setErrorMessage(null);
    const form = new FormData();
    form.append('video', file);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const data = (await res.json()) as UploadResponse;
      setUploadData(data);
      setActive(1);
    } catch {
      setErrorMessage('アップロードに失敗しました');
    } finally {
      setUploading(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) void handleFileSelect(file);
    },
    [handleFileSelect]
  );

  const handleStartProcess = async () => {
    if (!uploadData || !cropRect) return;
    setErrorMessage(null);
    setJobStatus(null);
    startProcessing();

    const res = await fetch('/api/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoId: uploadData.videoId,
        cropRect,
        intervalSeconds
      })
    });
    const data = (await res.json()) as { jobId: string };
    setJobId(data.jobId);
    setActive(3);
    pollInterval.start();
  };

  const handleCancel = async () => {
    if (!jobId) return;
    await fetch(`/api/process/${jobId}/cancel`, { method: 'POST' });
    pollInterval.stop();
    stopProcessing();
  };

  const handleDownload = () => {
    if (!jobStatus) return;
    const text = jobStatus.texts.join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ocr_result.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const frameUrl = (frame: PreviewFrame) =>
    `/api/frames?videoId=${uploadData?.videoId}&filename=${frame.filename}&type=preview`;

  const isCompleted = jobStatus?.status === 'completed';
  const isCancelled = jobStatus?.status === 'cancelled';
  const isError = jobStatus?.status === 'error';
  const progressValue =
    jobStatus && jobStatus.totalFrames > 0 ? Math.round((jobStatus.processedFrames / jobStatus.totalFrames) * 100) : 0;

  return (
    <Stack gap='lg'>
      <Stepper active={active} onStepClick={setActive} allowNextStepsSelect={false}>
        {/* Step 1: 動画選択 */}
        <Stepper.Step label='動画選択'>
          <Card withBorder p='xl' mt='md'>
            <Stack align='center' gap='md'>
              <Box
                style={{
                  border: '2px dashed #ced4da',
                  borderRadius: 8,
                  padding: 40,
                  textAlign: 'center',
                  cursor: 'pointer',
                  width: '100%'
                }}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
              >
                <IconUpload size={40} color='gray' />
                <Text mt='sm' c='dimmed'>
                  動画ファイルをドラッグ&amp;ドロップ、またはクリックして選択
                </Text>
                <Text size='xs' c='dimmed' mt={4}>
                  ffmpegが対応する動画フォーマット（mp4, mkv, movなど）
                </Text>
              </Box>
              <input
                ref={fileInputRef}
                type='file'
                accept='video/*'
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFileSelect(file);
                }}
              />
              {uploading && (
                <Group>
                  <Loader size='sm' />
                  <Text>アップロード中・プレビューフレーム生成中...</Text>
                </Group>
              )}
              {errorMessage && (
                <Alert color='red' icon={<IconX />}>
                  {errorMessage}
                </Alert>
              )}
            </Stack>
          </Card>
        </Stepper.Step>

        {/* Step 2: 字幕領域選択 */}
        <Stepper.Step label='領域選択'>
          <Stack mt='md' gap='md'>
            {uploadData && (
              <>
                <Text size='sm'>字幕が映るフレームを選択し、字幕領域をドラッグして指定してください</Text>
                <SimpleGrid cols={5}>
                  {uploadData.previewFrames.map((frame) => (
                    <Box
                      key={frame.filename}
                      style={{
                        cursor: 'pointer',
                        border:
                          selectedFrame?.filename === frame.filename ? '3px solid #228be6' : '3px solid transparent',
                        borderRadius: 4
                      }}
                      onClick={() => {
                        setSelectedFrame(frame);
                        setCropRect(null);
                      }}
                    >
                      <Image src={frameUrl(frame)} alt={`${Math.round(frame.timestamp)}秒`} radius='sm' />
                      <Text size='xs' ta='center' c='dimmed'>
                        {Math.round(frame.timestamp)}秒
                      </Text>
                    </Box>
                  ))}
                </SimpleGrid>

                {selectedFrame && (
                  <CropCanvas imageUrl={frameUrl(selectedFrame)} onChange={setCropRect} currentRect={cropRect} />
                )}

                {cropRect && (
                  <Text size='sm' c='green'>
                    領域選択済み（x:{(cropRect.x * 100).toFixed(1)}% y:
                    {(cropRect.y * 100).toFixed(1)}% 幅:{(cropRect.w * 100).toFixed(1)}% 高さ:
                    {(cropRect.h * 100).toFixed(1)}%）
                  </Text>
                )}

                <Group>
                  <Button variant='default' onClick={() => setActive(0)}>
                    戻る
                  </Button>
                  <Button disabled={!cropRect} onClick={() => setActive(2)}>
                    次へ
                  </Button>
                </Group>
              </>
            )}
          </Stack>
        </Stepper.Step>

        {/* Step 3: OCR設定 */}
        <Stepper.Step label='OCR設定'>
          <Stack mt='md' gap='md' maw={400}>
            <NumberInput
              label='フレーム抽出間隔（秒）'
              description='N秒ごとに1フレーム抽出してOCRします'
              value={intervalSeconds}
              onChange={(v) => setIntervalSeconds(typeof v === 'number' ? v : 2)}
              min={1}
              max={60}
              step={1}
            />

            {uploadData && (
              <Text size='sm' c='dimmed'>
                動画長さ: {Math.round(uploadData.duration)}秒 → 約{Math.ceil(uploadData.duration / intervalSeconds)}
                フレーム処理予定
              </Text>
            )}

            <Group>
              <Button variant='default' onClick={() => setActive(1)}>
                戻る
              </Button>
              <Button onClick={() => void handleStartProcess()} loading={processing}>
                OCR処理開始
              </Button>
            </Group>
          </Stack>
        </Stepper.Step>

        {/* Step 4: 処理・結果 */}
        <Stepper.Step label='結果'>
          <Stack mt='md' gap='md'>
            {processing && (
              <Card withBorder>
                <Stack gap='xs'>
                  <Group justify='space-between'>
                    <Group>
                      <Loader size='sm' />
                      <Text>
                        処理中... {jobStatus?.processedFrames ?? 0} / {jobStatus?.totalFrames ?? '?'} フレーム
                      </Text>
                    </Group>
                    <Button
                      color='red'
                      variant='outline'
                      leftSection={<IconPlayerStop size={16} />}
                      onClick={() => void handleCancel()}
                    >
                      中止
                    </Button>
                  </Group>
                  {jobStatus && jobStatus.totalFrames > 0 && <Progress value={progressValue} animated />}
                  {jobStatus && jobStatus.texts.length > 0 && (
                    <Text size='sm' c='dimmed'>
                      取得済みテキスト: {jobStatus.texts.length}件
                    </Text>
                  )}
                </Stack>
              </Card>
            )}

            {isCancelled && (
              <Alert color='yellow' icon={<IconX />}>
                処理を中止しました
              </Alert>
            )}

            {isError && (
              <Alert color='red' icon={<IconX />}>
                エラー: {jobStatus?.error ?? '不明なエラー'}
              </Alert>
            )}

            {(isCompleted || isCancelled || (jobStatus?.texts?.length ?? 0) > 0) && (
              <Stack gap='xs'>
                <Group justify='space-between'>
                  <Title order={5}>抽出テキスト（{jobStatus?.texts.length ?? 0}件）</Title>
                  {(isCompleted || isCancelled) && (
                    <Button
                      leftSection={<IconDownload size={16} />}
                      onClick={handleDownload}
                      disabled={(jobStatus?.texts.length ?? 0) === 0}
                    >
                      テキストをダウンロード
                    </Button>
                  )}
                </Group>
                <Textarea value={jobStatus?.texts.join('\n') ?? ''} readOnly autosize minRows={10} maxRows={30} />
              </Stack>
            )}

            {isCompleted && (
              <Button
                variant='default'
                onClick={() => {
                  setActive(0);
                  setUploadData(null);
                  setSelectedFrame(null);
                  setCropRect(null);
                  setJobId(null);
                  setJobStatus(null);
                }}
              >
                最初からやり直す
              </Button>
            )}
          </Stack>
        </Stepper.Step>
      </Stepper>
    </Stack>
  );
}
