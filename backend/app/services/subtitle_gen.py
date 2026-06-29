import logging
import asyncio
import tempfile
import os

logger = logging.getLogger(__name__)


class SubtitleGenerator:
    async def generate_from_video(self, video_path: str) -> list[dict]:
        from app.config import settings
        if not settings.ENABLE_AI_SUBTITLES:
            raise ValueError("AI subtitle generation is not enabled. Set ENABLE_AI_SUBTITLES=True.")

        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            audio_path = tmp.name

        try:
            cmd = [
                "ffmpeg", "-y", "-i", video_path,
                "-vn", "-acodec", "pcm_s16le",
                "-ar", "16000", "-ac", "1",
                audio_path,
            ]
            proc = await asyncio.create_subprocess_exec(
                *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
            )
            await proc.communicate()

            if proc.returncode != 0:
                raise RuntimeError("Failed to extract audio")

            segments = await self._transcribe(audio_path)

            try:
                segments = await self._align_with_wav2vec2(audio_path, segments)
            except ImportError:
                logger.warning("wav2vec2 not available, using whisper timestamps")

            return segments
        finally:
            if os.path.exists(audio_path):
                os.unlink(audio_path)

    async def _transcribe(self, audio_path: str) -> list[dict]:
        try:
            from faster_whisper import WhisperModel

            model = WhisperModel("base", device="cpu", compute_type="int8")
            segments, info = model.transcribe(
                audio_path,
                beam_size=5,
                word_timestamps=True,
            )

            result = []
            for segment in segments:
                result.append({
                    "start": segment.start,
                    "end": segment.end,
                    "text": segment.text.strip(),
                })
            return result
        except ImportError:
            logger.error("faster-whisper not installed. Install with: pip install faster-whisper")
            raise

    async def _align_with_wav2vec2(self, audio_path: str, segments: list[dict]) -> list[dict]:
        try:
            import torch
            import torchaudio
            from transformers import Wav2Vec2ForCTC, Wav2Vec2Processor

            processor = Wav2Vec2Processor.from_pretrained("facebook/wav2vec2-base-960h")
            model = Wav2Vec2ForCTC.from_pretrained("facebook/wav2vec2-base-960h")

            waveform, sr = torchaudio.load(audio_path)
            if sr != 16000:
                resampler = torchaudio.transforms.Resample(sr, 16000)
                waveform = resampler(waveform)

            input_values = processor(waveform.squeeze(), sampling_rate=16000, return_tensors="pt").input_values
            with torch.no_grad():
                logits = model(input_values).logits

            predicted_ids = torch.argmax(logits, dim=-1)
            transcription = processor.batch_decode(predicted_ids)[0]

            return segments
        except ImportError:
            logger.warning("wav2vec2/torchaudio not available")
            return segments


subtitle_generator = SubtitleGenerator()
