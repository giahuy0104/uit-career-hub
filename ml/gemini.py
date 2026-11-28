"""Minimal Gemini REST client for the offline ML scripts (standard library only).

The key is read from GEMINI_API_KEY or from a .env file given with --env-file; it is never printed or stored.
"""
import json
import os
import time
import urllib.error
import urllib.request

BASE = "https://generativelanguage.googleapis.com/v1beta"
EMBEDDING_MODEL = os.environ.get("GEMINI_EMBEDDING_MODEL", "gemini-embedding-2")
TEXT_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.5-flash-lite")
DIMENSIONS = 768


def load_key(env_file=None):
    if os.environ.get("GEMINI_API_KEY"):
        return os.environ["GEMINI_API_KEY"]
    if env_file:
        with open(env_file, encoding="utf-8") as file:
            for line in file:
                if line.strip().startswith("GEMINI_API_KEY="):
                    return line.split("=", 1)[1].strip().strip('"')
    raise SystemExit("Thiếu GEMINI_API_KEY (đặt biến môi trường hoặc dùng --env-file).")


def post(key, path, body, retries=5):
    data = json.dumps(body).encode("utf-8")
    for attempt in range(retries):
        request = urllib.request.Request(f"{BASE}/{path}", data=data, method="POST",
                                         headers={"Content-Type": "application/json", "x-goog-api-key": key})
        try:
            with urllib.request.urlopen(request, timeout=90) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as error:
            if error.code in (429, 500, 503) and attempt < retries - 1:
                time.sleep(65 if error.code == 429 else 2 ** attempt * 3)
                continue
            raise SystemExit(f"Gemini trả về HTTP {error.code}: {error.read()[:300]!r}")


# Same text formats the Java client uses (gemini-embedding-2 takes the task in the text, not in task_type).
def as_document(title, text):
    return f"title: {title or 'none'} | text: {text}"


def as_query(text):
    return f"task: search result | query: {text}"


def as_similarity(text):
    return f"task: sentence similarity | query: {text}"


def embed(key, texts, batch=20, pause=13, on_batch=None):
    """The free tier counts every text in a batch as one request per minute, so batches stay small and slow."""
    vectors = []
    for start in range(0, len(texts), batch):
        chunk = texts[start:start + batch]
        body = {"requests": [{"model": f"models/{EMBEDDING_MODEL}", "content": {"parts": [{"text": t}]},
                              "output_dimensionality": DIMENSIONS} for t in chunk]}
        result = post(key, f"models/{EMBEDDING_MODEL}:batchEmbedContents", body)
        chunk_vectors = [item["values"] for item in result["embeddings"]]
        vectors.extend(chunk_vectors)
        if on_batch:
            on_batch(chunk, chunk_vectors)
        print(f"  embedding {min(start + batch, len(texts))}/{len(texts)}", flush=True)
        time.sleep(pause)
    return vectors


def generate_json(key, system, user, schema):
    body = {"systemInstruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user", "parts": [{"text": user}]}],
            "generationConfig": {"temperature": 0.9, "responseMimeType": "application/json", "responseSchema": schema}}
    result = post(key, f"models/{TEXT_MODEL}:generateContent", body)
    return json.loads(result["candidates"][0]["content"]["parts"][0]["text"])
