import argparse
import asyncio
import json
import sys


async def synthesize(text: str, voice: str, output_path: str):
    try:
        import edge_tts
    except Exception as exc:
        print(json.dumps({"error": f"edge-tts import failed: {exc}"}), file=sys.stderr)
        raise

    communicate = edge_tts.Communicate(text=text, voice=voice)
    await communicate.save(output_path)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--text", required=True)
    parser.add_argument("--voice", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    asyncio.run(synthesize(args.text, args.voice, args.output))
    print(json.dumps({"format": "mp3", "sample_rate": 24000}))


if __name__ == "__main__":
    main()
