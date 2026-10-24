import sys
import wave

from piper import PiperVoice
from piper.config import SynthesisConfig


def main() -> None:
    model_path, text, output_path, rate = sys.argv[1:5]
    voice = PiperVoice.load(model_path)
    config = SynthesisConfig(length_scale=100.0 / float(rate), volume=1.0)
    with wave.open(output_path, "wb") as output:
        voice.synthesize_wav(text, output, syn_config=config)


if __name__ == "__main__":
    main()
