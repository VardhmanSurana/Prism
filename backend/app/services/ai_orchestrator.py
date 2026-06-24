import os
import subprocess
import time
import signal
import logging
from pathlib import Path
from app.config import settings

logger = logging.getLogger(__name__)

class AIOrchestrator:
    _process = None
    _current_mode = None # 'agent' or 'vision'

    @classmethod
    def start_server(cls, mode: str):
        """Starts the llama-server with the specified mode and MTP flags."""
        if cls._current_mode == mode and cls._is_process_running():
            return True

        cls.stop_server()
        
        # Mutual Exclusion: Ensure other GPU models are unloaded
        try:
            from app.services.vision_pipeline import unload_models
            from app.services.face_sdk import face_sdk
            unload_models()
            face_sdk.shutdown()
        except Exception as e:
            logger.warning(f"Error clearing VRAM before server start: {e}")

        model_dir = Path(settings.BASE_DIR) / "models" / "llm"
        
        if mode == 'agent':
            model_path = model_dir / "gemma-4-E4B-it-qat-UD-Q4_K_XL.gguf"
            draft_path = model_dir / "gemma-4-E4B-it-Q4_0-MTP.gguf"
            port = 9090
        else: # vision
            model_path = model_dir / "gemma-4-E2B-it-qat-UD-Q4_K_XL.gguf"
            draft_path = model_dir / "gemma-4-E2B-it-Q4_0-MTP.gguf"
            mmproj_path = model_dir / "mmproj-BF16.gguf"
            port = 9091

        cmd = [
            "llama-server",
            "-m", str(model_path.absolute()),
            "--host", "0.0.0.0",
            "--port", str(port),
            "-ngl", "999",       # Full GPU offload
            "-c", "8192",        # Context size (larger for vision)
        ]

        if mode == 'vision':
            cmd.extend(["--mmproj", str(mmproj_path.absolute())])

        logger.info(f"Starting llama-server for {mode} mode: {' '.join(cmd)}")
        
        # Inherit LD_LIBRARY_PATH from environment
        env = os.environ.copy()
        if "/usr/local/cuda/lib64" not in env.get("LD_LIBRARY_PATH", ""):
            env["LD_LIBRARY_PATH"] = f"/usr/local/cuda/lib64:{env.get('LD_LIBRARY_PATH', '')}"
        
        # Capture stderr for debugging
        import tempfile
        stderr_file = tempfile.NamedTemporaryFile(mode='w+', suffix='.log', delete=False)
        
        cls._process = subprocess.Popen(
            cmd,
            stdout=subprocess.DEVNULL,
            stderr=stderr_file,
            env=env,
            preexec_fn=os.setsid # Create process group for clean cleanup
        )
        
        # Wait for server to be ready - loading 4GB can be slow
        max_retries = 60
        import httpx
        for i in range(max_retries):
            # Fail fast if process has terminated
            if cls._process and cls._process.poll() is not None:
                stderr_file.flush()
                stderr_file.seek(0)
                stderr_content = stderr_file.read() or "(empty)"
                logger.error(f"llama-server terminated unexpectedly during startup with code {cls._process.poll()}. stderr: {stderr_content[:500]}")
                if "OutOfDeviceMemory" in stderr_content or "failed to allocate" in stderr_content:
                    logger.error(
                        "TIP: llama-server failed due to low VRAM (ErrorOutOfDeviceMemory). "
                        "You can specify which Vulkan device to use (e.g. GGML_VK_VISIBLE_DEVICES=0 for your Intel Graphics which has more free VRAM) "
                        "by adding it to your backend/.env file."
                    )
                stderr_file.close()
                break

            try:
                # Use 127.0.0.1 for local health check
                with httpx.Client() as client:
                    resp = client.get(f"http://127.0.0.1:{port}/health", timeout=1.0)
                    if resp.status_code == 200:
                        logger.info(f"llama-server for {mode} is ready on port {port}")
                        cls._current_mode = mode
                        return True
                    else:
                        if i % 5 == 0:
                            logger.debug(f"Waiting for {mode} server... (status={resp.status_code}, {i}/{max_retries})")
            except Exception:
                if i % 5 == 0:
                    logger.debug(f"Waiting for {mode} server connection... ({i}/{max_retries})")
            
            time.sleep(1.0)
        
        logger.error(f"Failed to start llama-server for {mode}")
        cls.stop_server()
        return False

    @classmethod
    def stop_server(cls):
        """Kills the active llama-server process."""
        if cls._process:
            logger.info(f"Stopping llama-server ({cls._current_mode})...")
            try:
                os.killpg(os.getpgid(cls._process.pid), signal.SIGTERM)
                cls._process.wait(timeout=5)
            except Exception as e:
                logger.warning(f"Forcing kill on server: {e}")
                if cls._process:
                    cls._process.kill()
            
            cls._process = None
            cls._current_mode = None
            
            import torch
            if torch.cuda.is_available():
                torch.cuda.empty_cache()

    @classmethod
    def _is_process_running(cls):
        return cls._process is not None and cls._process.poll() is None

    @classmethod
    def get_api_url(cls):
        if cls._current_mode == 'agent':
            return "http://127.0.0.1:9090/v1"
        elif cls._current_mode == 'vision':
            return "http://127.0.0.1:9091/v1"
        return None
