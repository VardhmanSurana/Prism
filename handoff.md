# Handoff Document

**Project Goal**
Fix VideoPlayer bugs and build full-GPU ffmpeg pipeline with `scale_cuda` filter support for HLS segmented transcoding.

## 1 Codebase Overview
## 1 Codebase Overview
- **Prism** — photo/video management app (FastAPI backend + React/TypeScript frontend)
- **Hybrid GPU System** — 4-tier auto-detect + manual override for video encoding
- **VideoPlayer** (`frontend/components/viewers/lightbox/VideoPlayer.tsx`, ~1072 lines) — HLS.js + native `<video>` fallback, automatic transcode fallback, keyboard shortcuts, PiP, filmstrip
- **HLS route** (`backend/app/routes/hls.py`) — segmented on-demand transcoding (6s MPEG-TS segments, cached to disk), uses `_probe_nvenc()` + `_probe_scale_cuda()` for GPU detection
- **Media route** (`backend/app/routes/media.py`) — single-file `/transcode` endpoint, same GPU probe functions
- **GPU probe** (`media.py`) — `_probe_nvenc()` tests h264_nvenc; `_probe_scale_cuda()` tests CUDA filter; `_probe_vaapi()` tests VA-API (tries custom ffmpeg then system ffmpeg); all cached for process lifetime
- **GPU mode selector** (`media.py`) — `_select_gpu_mode()` reads `GPU_ENCODING_MODE` setting, returns "auto"/"nvenc"/"vaapi"/"cpu"; respects `ENABLE_GPU_ENCODING` for backward compat
- **VA-API ffmpeg routing** — VAAPI encoding uses `/usr/bin/ffmpeg` (system) since custom CUDA build lacks VA-API; NVENC uses `FFMPEG_PATH` (custom build)
- **FFmpeg config** — new `FFMPEG_PATH` setting in `backend/app/config.py` + `.env` points to custom CUDA-enabled build at `/home/chotaxdon/Work/Repo/ffmpeg-install/bin/ffmpeg`
- **GPU_ENCODING_MODE** — new setting: "auto" | "nvenc" | "vaapi" | "cpu" (default: "auto")
- **ENABLE_GPU_ENCODING** — existing toggle, False = cpu mode (backward compat)

## 2 In--Flight Work

### Completed This Session
- **scale_cuda fix**: Root cause — distro ffmpeg had `--enable-nvenc` but NOT `--enable-cuda-nvcc`, so `scale_cuda` filter was missing. Added `_probe_scale_cuda()` and three-way GPU selection (full GPU / partial GPU / CPU)
- **ffmpeg compiled from source**: Built ffmpeg 8.1.2 at `/home/chotaxdon/Work/Repo/ffmpeg-install/` with `--enable-cuda-nvcc --enable-nonfree --nvccflags="-ccbin /usr/bin/g++-15 -gencode arch=compute_86,code=sm_86"` — GCC 15 needed because CUDA 13.2 doesn't support GCC 16+
- **hwupload_cuda fix**: `-hwaccel_output_format cuda` fails with MKV files + input-side seeking (`-ss` before `-i`). Fixed by using `hwupload_cuda` in filter chain instead — works universally, 10.8x encode speed vs 5.96x with CPU scale
- **FFMPEG_PATH config**: Added `FFMPEG_PATH` to Settings + `.env`, updated all ffmpeg calls in `hls.py` and `media.py` to use `settings.FFMPEG_PATH or "ffmpeg"`
- **HLS cache cleared**: Deleted stale cache for `[Exiled-Destiny]_FMA_Brotherhood_Ep01`
- **Hybrid GPU system**: 4-tier auto-detect + manual override (NVENC+CUDA → NVENC → VAAPI → CPU)
- **VAAPI support**: Added `_probe_vaapi()` with dual-ffmpeg probing (custom CUDA build + system ffmpeg)
- **GPU_ENCODING_MODE setting**: "auto" | "nvenc" | "vaapi" | "cpu" with backward compat via ENABLE_GPU_ENCODING
- **VA-API ffmpeg routing**: VAAPI encoding uses system ffmpeg (`/usr/bin/ffmpeg`) since custom CUDA build lacks VA-API

### From Prior Session (VideoPlayer bugs)
- HLS playlist cache invalidation (size + mtime in hash)
- `onAbort` false positives (readyState < 2 check)
- Progress bar ref, stale closure fixes, codec detection memoization, keyboard effect deps

## 3 Known Issues / Risks
## 3 Known Issues / Risks
- **ffmpeg custom build is static** (`--enable-static`, no `--enable-shared`) — binaries are self-contained but large. Re-run configure without `--enable-static --disable-shared` if shared libs are preferred
- **VA-API uses system ffmpeg** — VAAPI encoding requires `/usr/bin/ffmpeg` (system) while NVENC uses custom CUDA build. Both must be installed.
- **Vulkan Video encode unavailable** — `h264_vulkan` encoder listed in ffmpeg but fails with "Function not implemented" (encode extension not available in NVIDIA 595.80 driver)
- **Intel iGPU VAAPI tested** — Works with system ffmpeg on Alder Lake (ADL GT2)
- **HDR tone-mapping with scale_cuda** — `hdr_vf` (zscale + tonemap) is appended after `hwdownload` which is correct, but HDR source files through the full GPU pipeline need testing
- **GCC version constraint** — CUDA 13.2 requires GCC ≤ 15; if system upgrades GCC past 15, the custom ffmpeg will need recompilation with a newer CUDA toolkit
- **Other ffmpeg callers not updated** — `video_export.py`, `nle_preview.py`, `nle_proxy.py`, `video.py`, `subtitle_gen.py`, `upload.py` still use bare `"ffmpeg"` from PATH. Only `hls.py` and `media.py` use `FFMPEG_PATH`

## 4 Next Actions (Immediate TODOs)
## 4 Next Actions (Immediate TODOs)
- [ ] Restart backend (`uvicorn --reload`) so it picks up the new code + FFMPEG_PATH
- [ ] Test HLS playback of an MKV anime episode end-to-end (seg 139+ should now encode via full GPU)
- [ ] Test HLS playback of an MP4 file to confirm the full GPU pipeline works with `-hwaccel_output_format cuda` path too (MP4s may support NVDEC directly)
- [ ] Run backend tests: `cd backend && uv run python -m pytest tests/ -x -q`
- [ ] Consider adding `FFMPEG_PATH` usage to remaining ffmpeg callers (`video.py`, `nle_proxy.py`, etc.) for consistent GPU support
- [ ] Test HDR content through the full GPU pipeline (zscale + tonemap + scale_cuda)
- [ ] Test VAAPI encoding end-to-end with Intel iGPU (enable `ENABLE_GPU_ENCODING=true` in .env)
- [ ] Benchmark VAAPI vs NVENC vs CPU for 1080p/4K content
- [ ] Add GPU encoding mode selector to Settings UI (shows detected GPU)

## 5 Documentation & Resources

- **Custom ffmpeg build**: `/home/chotaxdon/Work/Repo/ffmpeg-8.1.2/` (source), `/home/chotaxdon/Work/Repo/ffmpeg-install/bin/ffmpeg` (installed binary)
- **ffmpeg configure flags used**:
  ```
  --enable-gpl --enable-nonfree --enable-cuda-nvcc --enable-nvenc --enable-nvdec
  --enable-libx264 --enable-libx265 --enable-libfdk-aac --enable-libvpx
  --enable-libaom --enable-libdav1d --cc=gcc-15 --cxx=g++-15
  --nvccflags="-ccbin /usr/bin/g++-15 -gencode arch=compute_86,code=sm_86"
  ```
- **GPU**: NVIDIA RTX, compute capability 8.6, driver 595.80, CUDA 13.2
- **FFmpeg build config log**: `/home/chotaxdon/Work/Repo/ffmpeg-8.1.2/ffbuild/config.log`
- **HLS cache**: `~/.local/share/prism/hls_cache/<source_hash>/`
- **Test file**: `/mnt/disk1/Media/Anime/[Exiled-Destiny] Fullmetal Alchemist Brotherhood/[Exiled-Destiny]_Fullmetal_Alchemist_Brotherhood_Ep01_(E94132AD).mkv` (1469s, H.264 High, 720x480, interleaved SAR)
