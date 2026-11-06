"""Local speech-to-text with faster-whisper (no API key, runs on CPU).

Audio in, plain text out. The text is then treated exactly like a typed
note: it goes through the extractor and never reaches a patient message.
"""

import os
import tempfile
import threading
from functools import lru_cache

MODEL_SIZE = os.getenv("WHISPER_MODEL", "base")


def available() -> bool:
    try:
        import faster_whisper  # noqa: F401
    except ImportError:
        return False
    return True


@lru_cache(maxsize=1)
def _model():
    from faster_whisper import WhisperModel

    return WhisperModel(MODEL_SIZE, device="cpu", compute_type="int8")


def warm_up() -> None:
    """Load the model in the background so the first tap isn't slow."""
    if available() and os.getenv("WHISPER_WARMUP", "1") != "0":
        threading.Thread(target=_model, daemon=True).start()


def transcribe(audio: bytes, hint: str = "") -> str:
    # ponytail: temp file because PyAV decodes webm/mp4 most reliably from disk
    with tempfile.NamedTemporaryFile(suffix=".webm") as f:
        f.write(audio)
        f.flush()
        segments, _ = _model().transcribe(
            f.name,
            language="en",
            beam_size=1,
            vad_filter=True,
            initial_prompt=hint or None,  # patient names bias the spelling
        )
        return " ".join(s.text.strip() for s in segments).strip()
