#!/usr/bin/env python3
"""
Render ARAM's voice clips with AI4Bharat Indic Parler-TTS (Apache 2.0).

Run this ONCE, offline, on a free GPU (Colab or Kaggle). The output is a set of small MP3s
committed to public/audio/ and served as static files by Vercel. Nothing synthesises at
runtime: browser TTS has no Tamil voice on most devices and none at all on Firefox, and
with 27 fixed lines shared by all 15,000 users, per-visit synthesis would regenerate
identical sentences thousands of times — on a platform that has no GPU to do it on.

    pip install git+https://github.com/huggingface/parler-tts.git soundfile numpy
    huggingface-cli login          # the model is gated; accept its terms on HF first
    python scripts/render_tts.py --dry-run
    python scripts/render_tts.py

Indic Parler-TTS was chosen over IndicF5 for two reasons: it covers English as well as
Tamil (IndicF5 is Indic-only, so it cannot speak half of this app), and the voice is set by
a written description rather than a reference recording, so no one has to supply or license
a cloned voice.

Voice consistency is the thing to watch. All 27 lines must sound like the same person, so
the description below names a speaker and is reused verbatim for every clip in a language.
Check the model card's recommended speakers per language and put one in --desc-*; an
unnamed description drifts between generations and ARAM ends up sounding like a committee.

MP3 rather than Opus or AAC: Opus-in-Ogg is unreliable in Safari and Firefox's AAC support
depends on system codecs. MP3 decodes everywhere, which is the entire point of clips.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
I18N = ROOT / "src" / "i18n"
MANIFEST = ROOT / "src" / "speech" / "spokenKeys.ts"
OUT_ROOT = ROOT / "public" / "audio"

MODEL_ID = "ai4bharat/indic-parler-tts"
MP3_BITRATE = "48k"  # mono speech; well under 1 MB total across both languages
SEED = 7  # fixed so a re-run reproduces the same voice rather than a new one
COLAB_FILENAME = "aram_colab_render.py"

# Raw model output needs conditioning before it can be played back to back. Tamil came out
# ~11 LUFS quieter than English and both languages ended mid-sound, so clips ran into each
# other as clipped fragments of speech. loudnorm matches levels across languages; the fades
# stop each clip starting and stopping on a discontinuity; the pads give sentences air.
AUDIO_FILTER = (
    "loudnorm=I=-16:TP=-1.5:LRA=11,aresample=24000,"
    "afade=t=in:st=0:d=0.04,areverse,afade=t=in:st=0:d=0.06,areverse,"
    "adelay=60:all=1,apad=pad_dur=0.12"
)

# A calm, unhurried read: the same voice tells a distressed child they are not alone, and
# reads consent terms to their parent. Replace the speaker name with one the model card
# recommends for that language — see the note in the docstring.
DEFAULT_DESC = (
    "{speaker} speaks in a warm, gentle, reassuring voice at a slow and unhurried pace. "
    "The recording is very clear and close-sounding, with no background noise."
)
DEFAULT_SPEAKER = {"en": "Mary", "ta": "Jaya"}

GREETING_PLACEHOLDER = "greeting.__timeOfDay__"
GREETING_KEYS = [
    "greeting.morning",
    "greeting.afternoon",
    "greeting.evening",
    "greeting.night",
]

# Matches one authored line in spokenKeys.ts, e.g.
#   { key: 's04.title', trigger: 'auto', tier: 'A' },
#   { key: GREETING_PLACEHOLDER, trigger: 'auto', tier: 'B' },
LINE_RE = re.compile(
    r"\{\s*key:\s*(?:'(?P<quoted>[^']+)'|(?P<ident>[A-Z_][A-Z0-9_]*))\s*,"
    r"\s*trigger:\s*'(?P<trigger>\w+)'\s*,"
    r"\s*tier:\s*'(?P<tier>\w)'\s*,?\s*\}"
)
ENABLED_RE = re.compile(r"ENABLED_TIERS:\s*Tier\[\]\s*=\s*\[(?P<body>[^\]]*)\]")

# Emoji live in the JSX, not the strings, but strip defensively — a stray symbol read aloud
# as "sparkles" in the middle of a consent sentence is jarring.
EMOJI_RE = re.compile(
    "[\U0001f300-\U0001faff\U00002600-\U000027bf\U0001f1e6-\U0001f1ff️‍]+"
)


def die(msg: str) -> None:
    sys.exit(f"error: {msg}")


def load_manifest() -> list[str]:
    """Extract the shipping key list from spokenKeys.ts (the single source of truth)."""
    src = MANIFEST.read_text(encoding="utf-8")

    enabled_match = ENABLED_RE.search(src)
    if not enabled_match:
        die(f"could not find ENABLED_TIERS in {MANIFEST}")
    enabled = set(re.findall(r"'(\w)'", enabled_match.group("body")))
    if not enabled:
        die("ENABLED_TIERS is empty — nothing to render")

    keys: list[str] = []
    seen: set[str] = set()
    for m in LINE_RE.finditer(src):
        if m.group("tier") not in enabled:
            continue
        raw = m.group("quoted") or m.group("ident")
        expanded = GREETING_KEYS if raw in (GREETING_PLACEHOLDER, "GREETING_PLACEHOLDER") else [raw]
        for k in expanded:
            if k not in seen:
                seen.add(k)
                keys.append(k)

    if not keys:
        die(f"parsed 0 keys from {MANIFEST} — the authored format may have changed")
    print(f"manifest: {len(keys)} keys across tiers {sorted(enabled)}")
    return keys


def lookup(strings: dict, key: str) -> str | None:
    node = strings
    for part in key.split("."):
        if not isinstance(node, dict) or part not in node:
            return None
        node = node[part]
    return node if isinstance(node, str) else None


def clean(text: str) -> str:
    return re.sub(r"\s+", " ", EMOJI_RE.sub("", text)).strip()


def collect(lang: str, keys: list[str]) -> dict[str, str]:
    """Resolve every key to spoken text, failing loudly on gaps rather than shipping silence."""
    strings = json.loads((I18N / f"{lang}.json").read_text(encoding="utf-8"))
    out: dict[str, str] = {}
    for key in keys:
        text = lookup(strings, key)
        if text is None:
            die(f"[{lang}] key '{key}' is in the manifest but missing from {lang}.json")
        # A clip cannot contain a runtime value. If one appears, the manifest is pointing at
        # an interpolated string and the clip would say "{{name}}" out loud.
        if "{{" in text:
            die(f"[{lang}] key '{key}' contains interpolation and must not be spoken: {text!r}")
        out[key] = clean(text)
    return out


def to_mp3(wav: Path, mp3: Path, rate: int) -> None:
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-af", AUDIO_FILTER,
         "-codec:a", "libmp3lame", "-b:a", MP3_BITRATE, "-ac", "1", "-ar", str(rate),
         str(mp3)],
        check=True,
    )


def render(lang: str, texts: dict[str, str], description: str, force: bool) -> None:
    import soundfile as sf
    import torch
    from parler_tts import ParlerTTSForConditionalGeneration
    from transformers import AutoTokenizer

    # Flow through the decoder is slow on CPU and fine on a T4. Say which one is in use
    # loudly — silently falling back to CPU on Colab is an expensive thing to notice late.
    device = "cuda:0" if torch.cuda.is_available() else "cpu"
    if device == "cpu":
        print(f"[{lang}] device: CPU — no GPU found. Expect hours, not minutes.")
        print(f"[{lang}] On Colab: Runtime > Change runtime type > T4 GPU, then rerun.")
    else:
        print(f"[{lang}] device: {device} ({torch.cuda.get_device_name(0)})")

    print(f"[{lang}] loading {MODEL_ID}…")
    model = ParlerTTSForConditionalGeneration.from_pretrained(MODEL_ID).to(device)
    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
    desc_tokenizer = AutoTokenizer.from_pretrained(model.config.text_encoder._name_or_path)
    rate = model.config.sampling_rate

    out_dir = OUT_ROOT / lang
    out_dir.mkdir(parents=True, exist_ok=True)
    tmp = out_dir / "_tmp.wav"

    desc_ids = desc_tokenizer(description, return_tensors="pt").to(device)
    print(f"[{lang}] voice: {description}")

    for i, (key, text) in enumerate(texts.items(), 1):
        mp3 = out_dir / f"{key}.mp3"
        if mp3.exists() and not force:
            print(f"[{lang}] {i}/{len(texts)} {key} — exists, skipping")
            continue

        print(f"[{lang}] {i}/{len(texts)} {key}: {text[:60]}…")
        # Re-seed per clip so each one is reproducible on its own: a single bad line can be
        # re-rendered with --force without disturbing the 26 that were already approved.
        torch.manual_seed(SEED)
        prompt_ids = tokenizer(text, return_tensors="pt").to(device)
        generation = model.generate(
            input_ids=desc_ids.input_ids,
            attention_mask=desc_ids.attention_mask,
            prompt_input_ids=prompt_ids.input_ids,
            prompt_attention_mask=prompt_ids.attention_mask,
        )
        sf.write(tmp, generation.cpu().numpy().squeeze(), samplerate=rate)
        to_mp3(tmp, mp3, rate)

    tmp.unlink(missing_ok=True)
    clips = list(out_dir.glob("*.mp3"))
    total = sum(f.stat().st_size for f in clips)
    print(f"[{lang}] done — {len(clips)} clips, {total / 1_048_576:.2f} MB")


COLAB_TEMPLATE = '''#!/usr/bin/env python3
"""
ARAM voice render — self-contained. Generated by scripts/render_tts.py --emit-colab.
Do not edit by hand; regenerate when the spoken strings or the manifest change.

Every line ARAM says is embedded below, so this file needs no checkout of the repo. In
Google Colab:

    1. Runtime > Change runtime type > T4 GPU
    2. Upload this file (folder icon in the left sidebar), then run these in a cell:

       !pip install -q git+https://github.com/huggingface/parler-tts.git soundfile numpy
       from huggingface_hub import notebook_login; notebook_login()
       !python {filename}

    3. Download aram-audio.zip and unzip it into public/audio/ in the repo.

The model is gated: accept the terms at huggingface.co/ai4bharat/indic-parler-tts first.
"""

import shutil
import subprocess
import sys
from pathlib import Path

MODEL_ID = "{model_id}"
MP3_BITRATE = "{bitrate}"
SEED = {seed}
OUT = Path("audio")

# Conditions raw model output so clips can play back to back: matches loudness across
# languages, and stops each clip beginning or ending on a discontinuity.
AUDIO_FILTER = (
    "{audio_filter}"
)

# Reused verbatim for every clip in a language: all of these lines must sound like one
# person. If a voice drifts or sounds wrong, change the speaker name here to one the model
# card recommends for that language and re-run.
DESCRIPTIONS = {descriptions}

TEXTS = {texts}


def main() -> None:
    import soundfile as sf
    import torch
    from parler_tts import ParlerTTSForConditionalGeneration
    from transformers import AutoTokenizer

    if not shutil.which("ffmpeg"):
        sys.exit("error: ffmpeg not found")

    device = "cuda:0" if torch.cuda.is_available() else "cpu"
    if device == "cpu":
        print("device: CPU — no GPU found. Expect hours, not minutes.")
        print("Colab: Runtime > Change runtime type > T4 GPU, then rerun.")
    else:
        print(f"device: {{device}} ({{torch.cuda.get_device_name(0)}})")

    print(f"loading {{MODEL_ID}} …")
    model = ParlerTTSForConditionalGeneration.from_pretrained(MODEL_ID).to(device)
    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
    desc_tokenizer = AutoTokenizer.from_pretrained(model.config.text_encoder._name_or_path)
    rate = model.config.sampling_rate

    for lang, entries in TEXTS.items():
        out_dir = OUT / lang
        out_dir.mkdir(parents=True, exist_ok=True)
        tmp = out_dir / "_tmp.wav"
        desc = DESCRIPTIONS[lang]
        print(f"\\n[{{lang}}] voice: {{desc}}")

        desc_ids = desc_tokenizer(desc, return_tensors="pt").to(device)
        for i, (key, text) in enumerate(entries.items(), 1):
            mp3 = out_dir / f"{{key}}.mp3"
            if mp3.exists():
                print(f"[{{lang}}] {{i}}/{{len(entries)}} {{key}} — exists, skipping")
                continue
            print(f"[{{lang}}] {{i}}/{{len(entries)}} {{key}}: {{text[:60]}}…")
            # Per-clip seed: one bad line can be deleted and re-rendered without
            # disturbing the others that were already listened to and approved.
            torch.manual_seed(SEED)
            prompt_ids = tokenizer(text, return_tensors="pt").to(device)
            generation = model.generate(
                input_ids=desc_ids.input_ids,
                attention_mask=desc_ids.attention_mask,
                prompt_input_ids=prompt_ids.input_ids,
                prompt_attention_mask=prompt_ids.attention_mask,
            )
            sf.write(tmp, generation.cpu().numpy().squeeze(), samplerate=rate)
            subprocess.run(
                ["ffmpeg", "-y", "-loglevel", "error", "-i", str(tmp), "-af", AUDIO_FILTER,
                 "-codec:a", "libmp3lame", "-b:a", MP3_BITRATE, "-ac", "1",
                 "-ar", str(rate), str(mp3)],
                check=True,
            )
        tmp.unlink(missing_ok=True)

    shutil.make_archive("aram-audio", "zip", OUT)
    clips = list(OUT.rglob("*.mp3"))
    size = sum(f.stat().st_size for f in clips) / 1_048_576
    print(f"\\ndone — {{len(clips)}} clips, {{size:.2f}} MB -> aram-audio.zip")
    print("Unzip into public/audio/ so you get public/audio/en/*.mp3 and .../ta/*.mp3")


if __name__ == "__main__":
    main()
'''


def emit_colab(texts: dict[str, dict[str, str]]) -> str:
    """Build a standalone render script with every spoken string baked in.

    Colab often cannot reach a private repo, and uploading the whole project just to read
    two JSON files and a manifest is busywork. Generating from the same parsed data keeps
    the embedded copy honest — regenerate rather than hand-editing the output.
    """
    descriptions = {
        lang: DEFAULT_DESC.format(speaker=DEFAULT_SPEAKER.get(lang, "The speaker"))
        for lang in texts
    }
    return COLAB_TEMPLATE.format(
        filename=COLAB_FILENAME,
        model_id=MODEL_ID,
        bitrate=MP3_BITRATE,
        seed=SEED,
        audio_filter=AUDIO_FILTER,
        descriptions=json.dumps(descriptions, ensure_ascii=False, indent=4),
        texts=json.dumps(texts, ensure_ascii=False, indent=4),
    )


def main() -> None:
    p = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    p.add_argument("--desc-en", help="voice description for English (see docstring)")
    p.add_argument("--desc-ta", help="voice description for Tamil")
    p.add_argument("--langs", default="en,ta", help="languages to render (default: en,ta)")
    p.add_argument("--force", action="store_true", help="re-render clips that already exist")
    p.add_argument("--dry-run", action="store_true", help="print what would be spoken and exit")
    p.add_argument(
        "--emit-colab",
        action="store_true",
        help=f"write {COLAB_FILENAME}, a standalone script needing no repo checkout",
    )
    args = p.parse_args()

    keys = load_manifest()
    langs = [l.strip() for l in args.langs.split(",") if l.strip()]
    texts = {lang: collect(lang, keys) for lang in langs}

    if args.dry_run:
        for lang in langs:
            print(f"\n── {lang} ── {len(texts[lang])} clips")
            for key, text in texts[lang].items():
                print(f"  {key}\n    {text}")
        return

    if args.emit_colab:
        out = ROOT / "scripts" / COLAB_FILENAME
        out.write_text(emit_colab(texts), encoding="utf-8")
        total = sum(len(v) for v in texts.values())
        print(f"wrote {out} — {total} clips across {len(texts)} languages")
        print("Upload it to Colab; it needs no checkout of this repo.")
        return

    if not shutil.which("ffmpeg"):
        die("ffmpeg not found — needed to convert WAV to MP3")

    descs = {"en": args.desc_en, "ta": args.desc_ta}
    for lang in langs:
        desc = descs.get(lang) or DEFAULT_DESC.format(
            speaker=DEFAULT_SPEAKER.get(lang, "The speaker")
        )
        render(lang, texts[lang], desc, args.force)

    print(
        "\nNext: listen to every Tamil clip with a native speaker before release "
        "(README already flags ta.json as a first pass), then commit public/audio/."
    )


if __name__ == "__main__":
    main()
