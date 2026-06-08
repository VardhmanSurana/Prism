"""End-to-end smoke test for SD 1.5 inpainting and SAM.

Run from backend dir: ./.venv/bin python scripts/smoke_test_inference.py
"""
import io
import logging
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from PIL import Image
import numpy as np
import torch

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("smoke")


def make_test_image() -> tuple[Image.Image, Image.Image]:
    img = Image.new("RGB", (512, 512), color=(180, 180, 180))
    arr = np.array(img)
    arr[100:250, 200:400] = (220, 30, 30)
    img = Image.fromarray(arr)
    mask = Image.new("L", (512, 512), 0)
    mask_arr = np.array(mask)
    mask_arr[100:250, 200:400] = 255
    mask = Image.fromarray(mask_arr)
    return img, mask


def vram_mb() -> float:
    if not torch.cuda.is_available():
        return 0.0
    return torch.cuda.memory_allocated() / 1024 / 1024


def test_sam():
    log.info("=" * 60)
    log.info("TEST: SAM via transformers")
    log.info("=" * 60)
    t0 = time.time()
    from app.services.inference.sam_seg import sam_segment_from_points
    img, _ = make_test_image()
    log.info(f"  before load: VRAM={vram_mb():.0f}MB")
    mask = sam_segment_from_points(img, [(300, 175)], positive=True)
    log.info(f"  after load+run: VRAM={vram_mb():.0f}MB, elapsed={time.time()-t0:.1f}s")
    assert mask is not None, "SAM returned None"
    assert mask.size == img.size, f"size mismatch: {mask.size} vs {img.size}"
    arr = np.array(mask)
    white_frac = (arr > 127).mean()
    log.info(f"  mask coverage: {white_frac*100:.1f}% (should be > 0)")
    assert white_frac > 0.001, f"mask too small: {white_frac*100:.2f}%"
    log.info("  PASS: SAM")
    return True


def test_sd15_remove():
    log.info("=" * 60)
    log.info("TEST: SD 1.5 inpainting (remove)")
    log.info("=" * 60)
    t0 = time.time()
    from app.services.inference.sd_inpaint import sd15_remove
    img, mask = make_test_image()
    log.info(f"  before load: VRAM={vram_mb():.0f}MB")
    out = sd15_remove(img, mask, num_steps=8)
    log.info(f"  after load+run: VRAM={vram_mb():.0f}MB, elapsed={time.time()-t0:.1f}s")
    assert out is not None, "sd15_remove returned None"
    assert out.size == img.size, f"size mismatch: {out.size} vs {img.size}"
    out_arr = np.array(out.convert("RGB"))
    r_mean = out_arr[100:250, 200:400, 0].mean()
    g_mean = out_arr[100:250, 200:400, 1].mean()
    log.info(f"  inpainted region R={r_mean:.0f} G={g_mean:.0f} (was R=220, G=30)")
    log.info("  PASS: SD 1.5 REMOVE")
    return out


def test_sd15_replace():
    log.info("=" * 60)
    log.info("TEST: SD 1.5 inpainting (replace)")
    log.info("=" * 60)
    from app.services.inference.sd_inpaint import sd15_replace
    img, mask = make_test_image()
    out = sd15_replace(img, mask, "a lush green tree", num_steps=8)
    log.info(f"  VRAM={vram_mb():.0f}MB")
    assert out is not None and out.size == img.size
    log.info("  PASS: SD 1.5 REPLACE")
    return out


def main():
    log.info(f"CUDA available: {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        log.info(f"GPU: {torch.cuda.get_device_name(0)}")
        log.info(f"VRAM total: {torch.cuda.get_device_properties(0).total_memory/1e9:.2f} GB")
    log.info("")

    sam_ok = False
    try:
        sam_ok = test_sam()
    except Exception as e:
        log.error(f"  FAIL: SAM: {e}", exc_info=True)
        import traceback
        traceback.print_exc()

    if sam_ok:
        # Free SAM VRAM before loading SD 1.5
        log.info("Unloading SAM to free VRAM...")
        from app.services.inference import sam_seg
        sam_seg._model = None
        sam_seg._processor = None
        import gc
        gc.collect()
        torch.cuda.empty_cache()
        log.info(f"  VRAM after unload: {vram_mb():.0f}MB")

    sd_ok = False
    try:
        test_sd15_remove()
        sd_ok = True
    except Exception as e:
        log.error(f"  FAIL: SD 1.5 REMOVE: {e}", exc_info=True)

    if sd_ok:
        try:
            test_sd15_replace()
        except Exception as e:
            log.error(f"  FAIL: SD 1.5 REPLACE: {e}", exc_info=True)

    log.info("")
    log.info("=" * 60)
    log.info(f"RESULT: SAM={'PASS' if sam_ok else 'FAIL'}  SD15={'PASS' if sd_ok else 'FAIL'}")
    log.info("=" * 60)
    sys.exit(0 if (sam_ok and sd_ok) else 1)


if __name__ == "__main__":
    main()
