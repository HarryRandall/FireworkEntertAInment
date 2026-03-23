# Audio Analyser (ShowCrafter)

Small Python script for analysing songs and producing firework cue outputs.

## Setup

```bash
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r prototypes/audio-analyser/requirements.txt
```

## Usage

```bash
python prototypes/audio-analyser/showcrafter.py data/media/audio/example_1.mp3
python prototypes/audio-analyser/showcrafter.py data/media/audio/example_2.mp3 --json
python prototypes/audio-analyser/showcrafter.py data/media/audio/example_3.mp3 --play
```
