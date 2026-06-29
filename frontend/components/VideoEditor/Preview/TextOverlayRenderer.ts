import { Track } from '@/store/videoEditorStore';

export function renderTextOverlays(
  ctx: CanvasRenderingContext2D,
  tracks: Track[],
  currentTime: number,
  videoWidth: number,
  videoHeight: number,
  selectedClipId: string | null,
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

      if (clip.id === selectedClipId) {
        // Clear shadow settings for the selection box/handles
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        const textWidth = ctx.measureText(clip.text).width;
        const padX = 12;
        const padY = 8;
        const boxWidth = textWidth + padX * 2;
        const boxHeight = fontSize + padY * 2;

        let boxX = x - boxWidth / 2;
        if (textAlign === 'left') {
          boxX = x - padX;
        } else if (textAlign === 'right') {
          boxX = x - textWidth - padX;
        }
        const boxY = y - boxHeight / 2;

        // Draw orange outline box
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

        // Draw white corner circle handles
        const corners = [
          [boxX, boxY],
          [boxX + boxWidth, boxY],
          [boxX, boxY + boxHeight],
          [boxX + boxWidth, boxY + boxHeight],
        ];
        ctx.fillStyle = '#ffffff';
        for (const [cx, cy] of corners) {
          ctx.beginPath();
          ctx.arc(cx, cy, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }

      ctx.restore();
    }
  }
}
