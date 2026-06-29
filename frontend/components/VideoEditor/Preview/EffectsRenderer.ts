import { Track } from '@/store/videoEditorStore';

export function renderEffects(
  ctx: CanvasRenderingContext2D,
  tracks: Track[],
  currentTime: number,
  videoWidth: number,
  videoHeight: number,
): void {
  for (const track of tracks) {
    if (track.type !== 'video') continue;

    for (const clip of track.clips) {
      const clipStart = clip.startTime;
      const clipEnd = clipStart + clip.duration;

      if (currentTime < clipStart || currentTime >= clipEnd) continue;
      if (!clip.effects || clip.effects.length === 0) continue;

      for (const effect of clip.effects) {
        switch (effect.type) {
          case 'vignette': {
            const intensity = effect.params.intensity ?? 0.4;
            const gradient = ctx.createRadialGradient(
              videoWidth / 2, videoHeight / 2, videoWidth * 0.3,
              videoWidth / 2, videoHeight / 2, videoWidth * 0.7,
            );
            gradient.addColorStop(0, 'rgba(0,0,0,0)');
            gradient.addColorStop(1, `rgba(0,0,0,${intensity})`);
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, videoWidth, videoHeight);
            break;
          }
          case 'brightness': {
            const value = effect.params.value ?? 0;
            ctx.fillStyle = `rgba(255,255,255,${Math.max(0, value * 0.1)})`;
            ctx.globalCompositeOperation = 'overlay';
            ctx.fillRect(0, 0, videoWidth, videoHeight);
            ctx.globalCompositeOperation = 'source-over';
            break;
          }
          case 'contrast': {
            const value = effect.params.value ?? 0;
            ctx.fillStyle = `rgba(128,128,128,${Math.abs(value) * 0.01})`;
            ctx.globalCompositeOperation = value > 0 ? 'overlay' : 'soft-light';
            ctx.fillRect(0, 0, videoWidth, videoHeight);
            ctx.globalCompositeOperation = 'source-over';
            break;
          }
        }
      }
    }
  }
}
