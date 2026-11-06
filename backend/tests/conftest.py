import os

# Tests never download the speech model.
os.environ["WHISPER_WARMUP"] = "0"
