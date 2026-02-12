import { NextRequest, NextResponse } from 'next/server';
import OpenAI, { toFile } from 'openai';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import { writeFile, readFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { env } from '@/lib/env';

export const runtime = 'nodejs';

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

// Use bundled ffmpeg binary
ffmpeg.setFfmpegPath(ffmpegStatic!);

async function convertToWav(inputBuffer: Buffer): Promise<Buffer> {
  const inputPath = join(tmpdir(), `transcribe-in-${randomUUID()}`);
  const outputPath = join(tmpdir(), `transcribe-out-${randomUUID()}.wav`);

  try {
    await writeFile(inputPath, inputBuffer);

    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .toFormat('wav')
        .audioChannels(1)
        .audioFrequency(16000)
        .on('error', reject)
        .on('end', () => resolve())
        .save(outputPath);
    });

    return await readFile(outputPath);
  } finally {
    await unlink(inputPath).catch(() => {});
    await unlink(outputPath).catch(() => {});
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File | null;

    if (!audioFile) {
      return NextResponse.json({ error: 'Missing audio field' }, { status: 400 });
    }

    const arrayBuffer = await audioFile.arrayBuffer();
    const inputBuffer = Buffer.from(arrayBuffer);

    // Skip very small files (likely silent or corrupted)
    if (inputBuffer.length < 1000) {
      return NextResponse.json({ text: '' });
    }

    const wavBuffer = await convertToWav(inputBuffer);
    const file = await toFile(wavBuffer, 'audio.wav', {
      type: 'audio/wav',
    });

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: 'gpt-4o-transcribe',
    });

    return NextResponse.json({ text: transcription.text || '' });
  } catch (error) {
    console.error('Transcription error:', error);
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Transcription failed', detail },
      { status: 500 }
    );
  }
}
