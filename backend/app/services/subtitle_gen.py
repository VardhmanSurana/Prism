import logging
import asyncio
import tempfile
import os

logger = logging.getLogger(__name__)

_whisper_model = None
_wav2vec2_processor = None
_wav2vec2_model = None


def _get_whisper_model():
    global _whisper_model
    if _whisper_model is None:
        from faster_whisper import WhisperModel
        _whisper_model = WhisperModel("small.en", device="cpu", compute_type="int8")
    return _whisper_model


def _get_wav2vec2():
    global _wav2vec2_processor, _wav2vec2_model
    if _wav2vec2_processor is None:
        from transformers import Wav2Vec2ForCTC, Wav2Vec2Processor
        _wav2vec2_processor = Wav2Vec2Processor.from_pretrained("facebook/wav2vec2-base-960h")
        _wav2vec2_model = Wav2Vec2ForCTC.from_pretrained("facebook/wav2vec2-base-960h")
    return _wav2vec2_processor, _wav2vec2_model


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
            model = _get_whisper_model()
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

            processor, model = _get_wav2vec2()

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
