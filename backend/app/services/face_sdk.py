"""Face SDK initialization and session management for InspireFace."""

import os
import sys
import logging
import atexit
import fcntl
import inspireface as isf
from app.config import settings

logger = logging.getLogger(__name__)

# ── Suppress InspireFace C-extension stdout/stderr banners ────────────────────
# The library calls C-level printf/puts at launch and again from an atexit
# handler on terminate — both are invisible to Python's capture mechanism.
# Redirect the underlying file descriptors (fd 1/2) for the entire process,
# restoring to the original pipe/terminal fd only at process shutdown.
_DEVNULL_FD = os.open(os.devnull, os.O_WRONLY)
_STDOUT_FD = 1          # standard Python sys.stdout fileno (never changes)
_STDERR_FD = 2
# _real_stdout_fd is a *copy* of the fd number that was pointed to by fd 1
# at import time (i.e. the terminal fd inherited from pytest or the shell).
_real_stdout_fd = os.dup(_STDOUT_FD)
_real_stderr_fd = os.dup(_STDERR_FD)
# Now redirect process-wide stdout/stderr to /dev/null.
os.dup2(_DEVNULL_FD, _STDOUT_FD)
os.dup2(_DEVNULL_FD, _STDERR_FD)


def _restore_stdio():
    """Restore fd 1/2 to the real outputs at process shutdown."""
    for saved_fd, target_fd in ((_real_stdout_fd, _STDOUT_FD),
                                 (_real_stderr_fd, _STDERR_FD)):
        try:
            # If the fd was already closed (e.g. by pytest's capture teardown),
            # skip restoration to avoid OSError/BadFileDescriptor.
            fcntl.fcntl(saved_fd, fcntl.F_GETFD)
            os.dup2(saved_fd, target_fd)
            os.close(saved_fd)
        except OSError:
            pass
    try:
        os.close(_DEVNULL_FD)
    except OSError:
        pass

atexit.register(_restore_stdio)


class FaceSDK:
    """Manages InspireFace SDK lifecycle and session."""

    def __init__(self):
        self._session = None
        self._launched = False

    def _ensure_launched(self):
        """Lazy launch InspireFace SDK and create session on first request."""
        if self._launched and self._session is not None:
            return

        if not self._launched:
            from app.agent.service import PrismAgent
            from app.services.vision_pipeline import unload_models
            from app.services.image_summary.llm import VisionManager
            PrismAgent.unload_llm()
            unload_models()
            VisionManager.unload_vision()

            if not isf.query_launch_status():
                backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
                local_model_path = os.path.join(backend_dir, "models", "face", "Pikachu")
                isf.launch(resource_path=local_model_path)
            self._launched = True

        if self._session is None:
            self._session = isf.InspireFaceSession(
                param=isf.HF_ENABLE_FACE_RECOGNITION,
                detect_mode=isf.HF_DETECT_MODE_ALWAYS_DETECT
            )
            self._session.set_detection_confidence_threshold(0.55)

    def shutdown(self):
        """Release session and terminate SDK resources on app shutdown."""
        if self._session is not None:
            try:
                self._session.release()
            except Exception as e:
                logger.warning(f"Failed to release face session: {e}")
            self._session = None
        if self._launched:
            try:
                isf.terminate()
            except Exception as e:
                logger.warning(f"Failed to terminate face SDK: {e}")
            self._launched = False

    @property
    def session(self):
        """Get the active InspireFace session, ensuring SDK is launched."""
        self._ensure_launched()
        return self._session

    def detect_faces(self, stream):
        try:
            return self.session.face_detection(stream)
        except Exception as e:
            logger.exception(f"InspireFace face detection failed: {e}")
            return []

    def extract_feature(self, stream, face):
        try:
            return self.session.face_feature_extract(stream, face)
        except Exception as e:
            logger.exception(f"Failed to extract face feature: {e}")
            return None

    def compare_features(self, feat1, feat2):
        try:
            return isf.feature_comparison(feat1, feat2)
        except Exception as e:
            logger.exception(f"Failed to compare two face features: {e}")
            return -1.0


face_sdk = FaceSDK()
