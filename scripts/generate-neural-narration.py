import asyncio
import json
import re
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "scripts" / "generate-demo-narration.ps1"
OUTPUT = ROOT / "artifacts" / "narration-neural"
FFPROBE = ROOT / "artifacts" / "tools" / "ffmpeg" / "ffmpeg-9.0.2-essentials_build" / "bin" / "ffprobe.exe"


def load_cues():
    content = SOURCE.read_text(encoding="utf-8-sig")
    pattern = re.compile(
        r"@\{ scene='(?P<scene>[^']+)'; zh='(?P<zh>[^']+)'; en='(?P<en>[^']+)' \}"
    )
    cues = [match.groupdict() for match in pattern.finditer(content)]
    if not cues:
        raise RuntimeError("No narration cues found")
    return cues


def duration(path: Path) -> float:
    result = subprocess.run(
        [str(FFPROBE), "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", str(path)],
        check=True,
        capture_output=True,
        text=True,
    )
    return round(float(result.stdout.strip()), 3)


async def render_one(text: str, voice: str, output: Path, rate: str, pitch: str):
    import edge_tts

    communicate = edge_tts.Communicate(text, voice, rate=rate, pitch=pitch, volume="+4%")
    await communicate.save(str(output))


async def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    cues = load_cues()
    settings = {
        "zh": ("zh-CN-YunyangNeural", "-4%", "-2Hz"),
        "en": ("en-US-AriaNeural", "-3%", "+0Hz"),
    }
    timeline = []
    index = 0
    for cue in cues:
        for language in ("zh", "en"):
            voice, rate, pitch = settings[language]
            name = f"{index:02d}-{language}.mp3"
            output = OUTPUT / name
            print(f"Rendering {cue['scene']} ({language}) with {voice}", flush=True)
            if not output.exists() or output.stat().st_size == 0:
                await render_one(cue[language], voice, output, rate, pitch)
            timeline.append(
                {
                    "scene": cue["scene"],
                    "lang": language,
                    "text": cue[language],
                    "zh": cue["zh"],
                    "en": cue["en"],
                    "file": name,
                    "duration": duration(output),
                    "voice": voice,
                }
            )
            index += 1
    (OUTPUT / "timeline.json").write_text(
        json.dumps(timeline, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps({"output": str(OUTPUT), "clips": len(timeline)}, ensure_ascii=False))


if __name__ == "__main__":
    sys.path.insert(0, str(ROOT / "artifacts" / "tools" / "edge_tts"))
    asyncio.run(main())
