#!/usr/bin/env python3
import argparse
import json
import sys


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("audio_path")
    parser.add_argument("--model", default="small")
    parser.add_argument("--compute-type", default="int8")
    parser.add_argument("--language", default="zh")
    parser.add_argument("--beam-size", type=int, default=5)
    parser.add_argument("--word-timestamps", default="true")
    return parser.parse_args()


def main():
    args = parse_args()
    use_word_timestamps = str(args.word_timestamps).lower() != "false"

    try:
        from faster_whisper import WhisperModel
    except ImportError as exc:
        raise RuntimeError(
            "faster-whisper is not installed. Run: pip install faster-whisper"
        ) from exc

    model = WhisperModel(args.model, compute_type=args.compute_type)
    segments, info = model.transcribe(
        args.audio_path,
        language=args.language,
        beam_size=args.beam_size,
        word_timestamps=use_word_timestamps,
        vad_filter=True,
    )

    timestamps = []
    recognized_parts = []
    max_end_ms = 0

    for segment in segments:
        text = (segment.text or "").strip()
        if text:
            recognized_parts.append(text)
        words = getattr(segment, "words", None) or []
        if words:
            for word in words:
                token = (word.word or "").strip()
                if not token:
                    continue
                begin_ms = int(round((word.start or 0) * 1000))
                end_ms = int(round((word.end or word.start or 0) * 1000))
                max_end_ms = max(max_end_ms, end_ms)
                timestamps.append(
                    {
                        "text": token,
                        "begin_ms": begin_ms,
                        "end_ms": end_ms,
                    }
                )
        elif text:
            begin_ms = int(round((segment.start or 0) * 1000))
            end_ms = int(round((segment.end or segment.start or 0) * 1000))
            max_end_ms = max(max_end_ms, end_ms)
            timestamps.append(
                {
                    "text": text,
                    "begin_ms": begin_ms,
                    "end_ms": end_ms,
                }
            )

    payload = {
        "duration_ms": max_end_ms if max_end_ms > 0 else int(round((info.duration or 0) * 1000)),
        "recognized_text": "".join(recognized_parts),
        "timestamps": timestamps,
    }
    sys.stdout.write(json.dumps(payload, ensure_ascii=False))


if __name__ == "__main__":
    main()
