import { Track } from '@/store/videoEditorStore';

export function renderTextOverlays(
  ctx: CanvasRenderingContext2D,
  tracks: Track[],
  currentTime: number,
  videoWidth: number,
  videoHeight: number,
): void {
  for (const track of tracks) {
    if (track.type !== 'text' && track.type !== 'subtitle') continue;

    for (const clip of track.clips) {
      const clipStart = clip.startTime;
      const clipEnd = clipStart + clip.duration;

      if (currentTime < clipStart || currentTime >= clipEnd) continue;
      if (!clip.text) continue;

      const x = (clip.x ?? 50) / 100 * videoWidth;
      const y = (clip.y ?? 50) / 100 * videoHeight;

      const fontSize = clip.fontSize ?? 24;
      const fontFamily = clip.fontFamily ?? 'Arial';
      const fontColor = clip.fontColor ?? '#ffffff';
      const fontWeight = clip.fontWeight ?? 'normal';
      const textAlign = clip.textAlign ?? 'center';

      ctx.save();
      ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
      ctx.fillStyle = fontColor;
      ctx.textAlign = textAlign;
      ctx.textBaseline = 'middle';

      ctx.shadowColor = 'rgba(0,0,0,0.7)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;

      ctx.fillText(clip.text, x, y);
      ctx.restore();
    }
  }
}
