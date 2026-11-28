"""Builds the labelled Vietnamese job-post corpus used by train_text.py, with Gemini.

The system has about ten real posts, so the corpus is synthetic and says so. About half of the skills
in each post are only implied ("API bằng framework phổ biến của Java" for Spring Boot), so plain keyword
matching cannot find everything: that is what the text models are compared on. Each post also gets a
search sentence a student might type, used to evaluate semantic search.

Usage: python ml/generate_jobs.py --env-file .env   (about 20 calls, writes ml/datasets/jobs_synthetic_vi.jsonl)
"""
import argparse
import json
import os
import random
import sys

sys.path.insert(0, os.path.dirname(__file__))
import gemini  # noqa: E402

SKILLS = ["Java", "Spring Boot", "Python", "Django", "JavaScript", "TypeScript", "React", "Vue.js", "Node.js", "HTML/CSS",
          "SQL", "PostgreSQL", "MongoDB", "Redis", "Docker", "Kubernetes", "AWS", "Linux", "Git", "CI/CD", "Kiểm thử tự động",
          "Selenium", "Flutter", "Kotlin", "Swift", "Machine Learning", "Pandas", "Power BI", "Excel", "Figma"]
CATEGORIES = ["Kỹ thuật phần mềm", "Khoa học dữ liệu", "Hệ thống thông tin", "An toàn thông tin", "Mạng máy tính",
              "Thiết kế giao diện", "Kiểm thử phần mềm", "Phát triển di động"]
OUT = os.path.join(os.path.dirname(__file__), "datasets", "jobs_synthetic_vi.jsonl")

SYSTEM = """Bạn tạo dữ liệu huấn luyện: tin tuyển dụng IT bằng tiếng Việt cho sinh viên Trường ĐH Công nghệ Thông tin (UIT).
Yêu cầu cho mỗi tin:
- title: tên vị trí thực tế (Thực tập sinh, Fresher, Junior...), đa dạng.
- description: 2-4 câu về công việc. requirements: 2-4 câu yêu cầu.
- skills: 2-5 kỹ năng, CHỈ lấy đúng tên trong danh sách cho trước.
- Với khoảng một nửa số kỹ năng trong "skills", KHÔNG viết đúng tên kỹ năng trong description/requirements mà mô tả gián tiếp
  (ví dụ Spring Boot -> "framework phổ biến để viết API bằng Java"; Docker -> "đóng gói ứng dụng vào container").
- category: đúng 1 nhóm ngành trong danh sách cho trước.
- query: câu một sinh viên có thể gõ để tìm tin này (6-15 từ, văn nói tự nhiên), KHÔNG chép tên vị trí và hạn chế nêu tên kỹ năng.
Không dùng tên công ty thật, không có thông tin cá nhân. Các tin trong một lần trả lời phải khác nhau rõ rệt."""

SCHEMA = {"type": "OBJECT", "properties": {"jobs": {"type": "ARRAY", "items": {"type": "OBJECT", "properties": {
    "title": {"type": "STRING"}, "description": {"type": "STRING"}, "requirements": {"type": "STRING"},
    "skills": {"type": "ARRAY", "items": {"type": "STRING", "format": "enum", "enum": SKILLS}},
    "category": {"type": "STRING", "format": "enum", "enum": CATEGORIES},
    "query": {"type": "STRING"}}, "required": ["title", "description", "requirements", "skills", "category", "query"]}}},
    "required": ["jobs"]}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--env-file")
    parser.add_argument("--batches", type=int, default=20)
    parser.add_argument("--per-batch", type=int, default=15)
    args = parser.parse_args()
    key = gemini.load_key(args.env_file)
    rng = random.Random(20261128)
    seen, rows = set(), []
    if os.path.exists(OUT):
        rows = [json.loads(line) for line in open(OUT, encoding="utf-8")]
        seen = {row["title"] + row["description"][:40] for row in rows}
    for batch in range(args.batches):
        focus = rng.sample(CATEGORIES, 3)
        user = (f"Danh sách kỹ năng: {', '.join(SKILLS)}\nDanh sách nhóm ngành: {', '.join(CATEGORIES)}\n"
                f"Tạo {args.per_batch} tin, ưu tiên các nhóm: {', '.join(focus)}. Lần {batch + 1}.")
        for job in gemini.generate_json(key, SYSTEM, user, SCHEMA)["jobs"]:
            skills = sorted({s for s in job["skills"] if s in SKILLS})
            fingerprint = job["title"] + job["description"][:40]
            if len(skills) < 2 or job["category"] not in CATEGORIES or fingerprint in seen:
                continue
            seen.add(fingerprint)
            rows.append({**job, "skills": skills})
        print(f"lần {batch + 1}: {len(rows)} tin", flush=True)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as file:
        for row in rows:
            file.write(json.dumps(row, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    main()
