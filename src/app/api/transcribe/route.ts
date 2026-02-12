import { NextRequest, NextResponse } from 'next/server';
import OpenAI, { toFile } from 'openai';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import { writeFile, readFile, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { env } from '@/lib/env';

export const runtime = 'nodejs';

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

// Use bundled ffmpeg when the binary exists (ffmpeg-static path can be wrong in some runtimes)
const bundledPath = ffmpegStatic && existsSync(ffmpegStatic)
  ? ffmpegStatic
  : (() => {
      const fromCwd = join(process.cwd(), 'node_modules', 'ffmpeg-static', 'ffmpeg');
      return existsSync(fromCwd) ? fromCwd : null;
    })();
if (bundledPath) {
  ffmpeg.setFfmpegPath(bundledPath);
}

const MIME_BY_EXT: Record<string, string> = {
  webm: 'audio/webm',
  m4a: 'audio/mp4',
  mp4: 'audio/mp4',
  oga: 'audio/ogg',
  ogg: 'audio/ogg',
};

function getInputFormat(ext: string): string {
  if (ext === 'webm') return 'webm';
  if (ext === 'm4a' || ext === 'mp4') return 'mov';
  if (ext === 'oga' || ext === 'ogg') return 'ogg';
  return ext || 'webm';
}

async function convertToWav(inputBuffer: Buffer, inputExt: string): Promise<Buffer> {
  const format = getInputFormat(inputExt);
  const inputPath = join(tmpdir(), `transcribe-in-${randomUUID()}.${inputExt || 'webm'}`);
  const outputPath = join(tmpdir(), `transcribe-out-${randomUUID()}.wav`);

  try {
    await writeFile(inputPath, inputBuffer);

    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .inputOptions(['-f', format, '-fflags', '+genpts+igndts', '-err_detect', 'ignore_err'])
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

    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/0718865c-6677-4dac-b4e1-1fa618bb874f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api/transcribe/route.ts:POST',message:'Transcribe received',data:{inputLen:inputBuffer.length},timestamp:Date.now(),hypothesisId:'T3'})}).catch(()=>{});
    // #endregion
    // Skip very small files (likely silent or corrupted)
    if (inputBuffer.length < 1000) {
      return NextResponse.json({ text: '' });
    }

    const ext = (audioFile.name.split('.').pop() || 'webm').toLowerCase();
    const mimeType = MIME_BY_EXT[ext] || 'audio/webm';

    // Try sending the chunk directly first (OpenAI accepts webm/m4a/ogg). Many MediaRecorder
    // chunks are valid; fragmented ones often fail ffmpeg with "Invalid data".
    let text = '';
    try {
      const directFile = await toFile(inputBuffer, `audio.${ext}`, { type: mimeType });
      const directResult = await openai.audio.transcriptions.create({
        file: directFile,
        model: 'gpt-4o-transcribe',
        language: 'en',
      });
      text = directResult.text || '';
    } catch {
      // Direct upload failed (e.g. invalid/fragmented chunk); fall back to ffmpeg conversion.
      try {
        const wavBuffer = await convertToWav(inputBuffer, ext);
        const wavFile = await toFile(wavBuffer, 'audio.wav', { type: 'audio/wav' });
        const wavResult = await openai.audio.transcriptions.create({
          file: wavFile,
          model: 'gpt-4o-transcribe',
          language: 'en',
        });
        text = wavResult.text || '';
      } catch {
        // Both paths failed; return empty so client doesn't get 500 for every bad chunk.
      }
    }

    const transcription = { text };

    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/0718865c-6677-4dac-b4e1-1fa618bb874f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api/transcribe/route.ts:success',message:'Transcribe success',data:{textLen:(transcription.text||'').length},timestamp:Date.now(),hypothesisId:'T3'})}).catch(()=>{});
    // #endregion
    return NextResponse.json({ text: transcription.text || '' });
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/0718865c-6677-4dac-b4e1-1fa618bb874f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api/transcribe/route.ts:catch',message:'Transcribe error',data:{detail:error instanceof Error ? error.message : String(error)},timestamp:Date.now(),hypothesisId:'T3'})}).catch(()=>{});
    // #endregion
    console.error('Transcription error:', error);
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Transcription failed', detail },
      { status: 500 }
    );
  }
}
