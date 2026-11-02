#!/usr/bin/env python3
"""Loads the Google Form results into the site's anonymous survey, so the admin
analytics shows the same numbers as the form.

    python3 scripts/import_survey.py [BASE_URL]      # default http://localhost:8080

Uses ADMIN_EMAIL / ADMIN_PASSWORD. Safe to repeat: the server replaces the previous
import and keeps answers given on the site.

Source: the form's public summary (viewanalytics), 24 responses as of 2026-11-02;
the presentation (MediaOsh_presentation.pptx) used the first 22 of them. The summary
has per-question totals only, so the totals are reproduced exactly, but which answers
belong to the same person cannot be recovered: don't analyse links between questions.
"""
import json
import os
import sys
import urllib.error
import urllib.request

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8080").rstrip("/") + "/api"
SURVEY_TITLE = "Опрос о медиаграмотности и восприятии информации"
N = 24

# question index -> list of (answer, how many respondents gave it); option indexes as in seed.py
FROM_GOOGLE_FORM = {
    # Q1, several answers allowed: fraud 17, fakes 6, hacking 0, none 6 (24 answered).
    # 17 + 6 = 23 picks among 18 people who chose something, so 5 of them chose both.
    0: [([0, 1], 5), ([0], 12), ([1], 1), ([3], 6)],
    # Q2, suspicious WhatsApp news: forward to warn 3, check search/official news 5, do nothing 11, don't know how 5.
    1: [([0], 3), ([1], 5), ([2], 11), ([3], 5)],
    # Q3, check a photo or news in 1 minute: yes 9, heard it can be done but can't 6, no 9.
    2: [([0], 9), ([1], 6), ([2], 9)],
    # Q4, enough practical advice: enough 3, exists but hard/boring 6, badly lacking 5, hard to say 10.
    3: [([0], 3), ([1], 6), ([2], 5), ([3], 10)],
    # Q5, watch short life-hack videos: regularly 16, sometimes 7, no 1.
    4: [([0], 16), ([1], 7), ([2], 1)],
    # Q6, would watch local short videos: yes 12, maybe 11, no 1.
    5: [([0], 12), ([1], 11), ([2], 1)],
    # Q7, language: Kyrgyz 10, Russian 4, no difference 10.
    6: [([0], 10), ([1], 4), ([2], 10)],
    # Q8, age (optional, 23 answered): under 18 10, 18–24 12, 25–34 1, 35+ 0.
    7: [([0], 10), ([1], 12), ([2], 1)],
}


def build(questions):
    responses = [[[] for _ in range(questions)] for _ in range(N)]
    for qi, groups in FROM_GOOGLE_FORM.items():
        row = 0
        for answer, count in groups:
            for _ in range(count):
                responses[row][qi] = answer
                row += 1
        assert row <= N, f"question {qi + 1}: {row} answers, more than {N} respondents"
    return responses


def call(method, path, body=None, token=None):
    headers = {"Content-Type": "application/json", "User-Agent": "mdn-seed/1.0"}
    if token:
        headers["Authorization"] = "Bearer " + token
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE + path, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = r.read()
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        sys.exit(f"{method} {path}: {e.code} {e.read().decode()}")


def main():
    token = call("POST", "/auth/login", {
        "email": os.environ.get("ADMIN_EMAIL", "admin@mdn.kg"),
        "password": os.environ.get("ADMIN_PASSWORD", "admin123"),
    })["token"]
    survey = next((t for t in call("GET", "/admin/tests", token=token)
                   if t.get("kind") == "survey" and t["title"] == SURVEY_TITLE), None)
    if not survey:
        sys.exit("Опрос не найден: сначала запустите scripts/seed.py")
    res = call("POST", f"/admin/tests/{survey['id']}/survey/import",
               {"responses": build(survey["question_count"]), "lang": "ky"}, token)
    print("imported:", res["imported"], "into survey", survey["id"])


if __name__ == "__main__":
    main()
