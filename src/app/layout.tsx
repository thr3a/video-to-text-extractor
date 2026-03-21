// import React from 'react';
import '@mantine/core/styles.css';

import { ColorSchemeScript, Container, MantineProvider, mantineHtmlProps, Title } from '@mantine/core';
import type { Metadata } from 'next';
import { Providers } from '@/providers';
import { theme } from '@/theme';

export const metadata: Metadata = {
  title: '動画字幕OCR',
  description: '動画から字幕テキストを抽出するツール'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang='ja' {...mantineHtmlProps}>
      <head>
        <meta name='viewport' content='minimum-scale=1, initial-scale=1, width=device-width, user-scalable=no' />
        <ColorSchemeScript />
      </head>
      <body>
        <MantineProvider theme={theme}>
          <Providers>
            <Container>
              <Title mt={'md'} order={2}>
                動画字幕OCR
              </Title>
              <Title order={6} mb={'md'} c={'dimmed'}>
                動画から字幕テキストを抽出するツール
              </Title>
              {children}
            </Container>
          </Providers>
        </MantineProvider>
      </body>
    </html>
  );
}
