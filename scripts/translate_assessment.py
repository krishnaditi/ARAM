#!/usr/bin/env python3
"""
Machine first-pass translation of the assessment questions (the `assessment` section of
src/i18n/en.json) into Hindi, Tamil, Telugu and Malayalam, through OpenRouter.

    python3 scripts/translate_assessment.py            # all four languages
    python3 scripts/translate_assessment.py ta ml      # just these
    python3 scripts/translate_assessment.py --keys persona,red.bandT   # only new strings,
                                            # merged into the existing translations

Re-run it whenever the English assessment copy changes. It reads OPENROUTER_API_KEY and
OPENROUTER_MODEL from backend/.env and touches nothing but the `assessment` section,
which is kept as the last key of each language file so the rest of the file is untouched.

IMPORTANT: PHQ-2, GAD-2, ASSIST-Y and C-SSRS are validated instruments. A machine
translation is NOT a validated translation. Before pilot, replace these strings with the
official licensed translations (Columbia provides official Tamil and Hindi C-SSRS text)
and have a native speaker review the rest.
"""

from __future__ import annotations

import json
import os
import re
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
I18N = ROOT / "src" / "i18n"
LANGS = {"hi": "Hindi", "ta": "Tamil", "te": "Telugu", "ml": "Malayalam"}
SECTION = "assessment"

PROMPT = """Translate the values of this JSON object into {lang}, for school students aged 10 to 18 in India (many in government schools and hostels).

Rules:
- Use {lang}'s own script and simple, everyday words a child understands. Warm and gentle, never formal or clinical.
- Keep every key exactly as it is. Translate values only.
- Keep these exactly as they are: {{{{placeholders}}}} in double curly braces, HTML tags such as <b> and </b>, emojis, numbers, and the names ARAM, Tele-MANAS, Childline and Shakthi.
- Questionnaire items (mood, worry, substance and suicide questions) must keep their exact meaning. Do not soften, add to or leave out anything in them.
- For substances, use the words students in that region actually use (for example beedi, gutka, paan, ganja, bhang, arrack, Cool Lip can stay as commonly said).
- Return only the JSON object, nothing else.

{payload}"""


def env() -> tuple[str, str]:
    values = {}
    env_file = ROOT / "backend" / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                k, v = line.split("=", 1)
                values[k.strip()] = v.strip()
    key = os.getenv("OPENROUTER_API_KEY") or values.get("OPENROUTER_API_KEY", "")
    model = os.getenv("OPENROUTER_MODEL") or values.get("OPENROUTER_MODEL", "google/gemma-4-26b-a4b-it")
    if not key:
        sys.exit("OPENROUTER_API_KEY is not set (backend/.env)")
    return key, model


def flatten(d: dict, prefix: str = "") -> dict[str, str]:
    out = {}
    for k, v in d.items():
        path = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            out.update(flatten(v, path))
        else:
            out[path] = v
    return out


def markers(text: str) -> tuple:
    return (sorted(re.findall(r"\{\{\w+\}\}", text)), text.count("<b>"), text.count("</b>"))


def call(key: str, model: str, lang: str, chunk: dict) -> dict:
    body = json.dumps(
        {
            "model": model,
            "messages": [{"role": "user", "content": PROMPT.format(lang=lang, payload=json.dumps(chunk, ensure_ascii=False, indent=1))}],
            "temperature": 0.2,
            "max_tokens": 8000,
        }
    ).encode()
    req = urllib.request.Request(
        "https://openrouter.ai/api/v1/chat/completions",
        data=body,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json", "X-Title": "ARAM translations"},
    )
    with urllib.request.urlopen(req, timeout=180) as resp:
        text = json.loads(resp.read())["choices"][0]["message"]["content"]
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip())
    return json.loads(text)


def translate_chunk(key: str, model: str, lang: str, name: str, chunk: dict) -> dict:
    """One top-level subsection per request keeps replies short and reliable."""
    want = flatten(chunk)
    last_error = ""
    for _ in range(3):
        try:
            got = call(key, model, lang, chunk)
        except Exception as error:  # network, JSON or provider error: try again
            last_error = str(error)
            continue
        flat = flatten(got)
        bad = [k for k in want if k not in flat or not isinstance(flat[k], str) or markers(flat[k]) != markers(want[k])]
        if not bad and set(flat) == set(want):
            return got
        last_error = f"mismatched keys or placeholders: {bad[:5] or sorted(set(flat) ^ set(want))[:5]}"
    raise RuntimeError(f"{lang}/{name}: {last_error}")


def write_section(path: Path, section: dict) -> None:
    """Replaces (or appends) the `assessment` section as the file's last key, leaving the
    rest of the hand-formatted file byte-for-byte as it was."""
    text = path.read_text(encoding="utf-8")
    block = json.dumps(section, ensure_ascii=False, indent=2).replace("\n", "\n  ")
    marker = f',\n  "{SECTION}": '
    if marker in text:
        text = text[: text.index(marker)]
    else:
        text = text.rstrip()
        assert text.endswith("}"), path
        text = text[:-1].rstrip()
    path.write_text(f"{text}{marker}{block}\n}}\n", encoding="utf-8")
    json.loads(path.read_text(encoding="utf-8"))  # still valid JSON


def pick(d: dict, paths: list[str]) -> dict:
    """The parts of `d` named by dotted paths, keeping their nesting."""
    out: dict = {}
    for path in paths:
        src, dst = d, out
        *parents, leaf = path.split(".")
        for part in parents:
            src = src[part]
            dst = dst.setdefault(part, {})
        dst[leaf] = src[leaf]
    return out


def merge(base: dict, extra: dict) -> dict:
    for k, v in extra.items():
        base[k] = merge(base.get(k, {}), v) if isinstance(v, dict) and isinstance(base.get(k), dict) else v
    return base


def main() -> None:
    args = sys.argv[1:]
    keys: list[str] = []
    if "--keys" in args:
        i = args.index("--keys")
        keys = [k for k in args[i + 1].split(",") if k]
        del args[i : i + 2]
    langs = args or list(LANGS)
    key, model = env()
    source = json.loads((I18N / "en.json").read_text(encoding="utf-8"))[SECTION]
    if keys:
        source = pick(source, keys)
    print(f"Translating {len(flatten(source))} strings into {', '.join(langs)} with {model}")

    def run(code: str) -> str:
        with ThreadPoolExecutor(max_workers=4) as pool:
            parts = {name: pool.submit(translate_chunk, key, model, LANGS[code], name, chunk) for name, chunk in source.items()}
            translated = {name: future.result() for name, future in parts.items()}
        if keys:
            current = json.loads((I18N / f"{code}.json").read_text(encoding="utf-8")).get(SECTION, {})
            translated = merge(current, translated)
        write_section(I18N / f"{code}.json", translated)
        return code

    with ThreadPoolExecutor(max_workers=len(langs)) as pool:
        for future in [pool.submit(run, code) for code in langs]:
            print(f"  wrote {future.result()}.json")


if __name__ == "__main__":
    main()
