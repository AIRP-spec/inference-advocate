import hashlib, html, json, re, subprocess, sys, time, datetime
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
ENTRIES = [
 ("us-988", "US", "988 Suicide & Crisis Lifeline", "988", "call or text 988", "https://988lifeline.org/", [r"hotline: 988", r"988 Lifeline"]),
 ("us-ctl", "US", "Crisis Text Line", "741741", "text HOME to 741741", "https://www.crisistextline.org/", [r"Text HOME to 741741"]),
 ("ca-988", "CA", "9-8-8: Suicide Crisis Helpline", "988", "call or text 9-8-8", "https://988.ca/", [r"Call 9-8-8 \(988\)", r"Text 9-8-8"]),
 ("uk-samaritans", "UK", "Samaritans", "116 123", "call 116 123", "https://www.samaritans.org/", [r"Call 116 123"]),
 ("au-lifeline", "AU", "Lifeline", "13 11 14", "call 13 11 14", "https://www.lifeline.org.au/", [r"13 11 14"]),
 ("in-telemanas", "IN", "Tele-MANAS", "14416", "call 14416", "https://telemanas.mohfw.gov.in/", [r"14416"]),
 ("np-1166", "NP", "National Suicide Prevention Helpline (Government of Nepal, Patan Mental Hospital)", "1166", "call 1166",
  "https://mohp.gov.np/carousel-detail/11/", []),
]
IMG = ("np-1166", "https://giwmscdnone.gov.np/media/carousels/manasik_zoqe4xs.jpeg")
CORROB = ("np-1166-who", "https://www.who.int/nepal/news/detail/09-12-2022-Nepal-National-Suicide-Prevention-Helpline-Service-helping-save-lives", [r"1166"])
def fetch(u, out):
    t = datetime.datetime.now(datetime.timezone.utc)
    r = subprocess.run(["curl", "-sSL", "-m", "60", "-A", UA, "-o", out, "-w", "%{http_code}", u], capture_output=True, text=True)
    return r.stdout.strip(), t
def text_of(p):
    t = open(p, encoding="utf-8", errors="ignore").read()
    t = re.sub(r"(?s)<(script|style)[^>]*>.*?</\1>", " ", t)
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", t))).strip()
res = []
for key, jur, name, number, contact, url, pats in ENTRIES + [(CORROB[0], "NP", "WHO Nepal corroboration", "1166", "", CORROB[1], CORROB[2])]:
    code, t = fetch(url, f"pages/{key}.html")
    txt = text_of(f"pages/{key}.html") if code == "200" else ""
    open(f"pages/{key}.txt", "w").write(txt)
    hits = {p: bool(re.search(p, txt)) for p in pats}
    res.append({"key": key, "jurisdiction": jur, "service": name, "number": number, "contact": contact, "url": url,
                "http": code, "fetched_utc": t.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "fetched_npt": (t + datetime.timedelta(hours=5, minutes=45)).strftime("%Y-%m-%d %H:%M NPT"),
                "html_sha256": hashlib.sha256(open(f"pages/{key}.html", "rb").read()).hexdigest() if code == "200" else None,
                "text_sha256": hashlib.sha256(txt.encode()).hexdigest() if txt else None, "text_patterns": hits})
code, t = fetch(IMG[1], "pages/np-1166-banner.jpeg")
res.append({"key": "np-1166-banner", "url": IMG[1], "http": code, "fetched_utc": t.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "image_sha256": hashlib.sha256(open("pages/np-1166-banner.jpeg", "rb").read()).hexdigest(),
            "note": "MoHP carousel image (linked from https://mohp.gov.np/carousel-detail/11/): Nepali text reads 'नेपाल सरकारद्वारा सञ्चालित निःशुल्क हेल्पलाइन ११६६ मा जुनसुकै बेला फोन गरी मनोपरामर्श सेवा लिन सक्नुहुनेछ' (free helpline 1166 run by the Government of Nepal; call any time for counselling). Read visually; number is in the image, not the HTML text."})
pg = open("pages/np-1166.html", encoding="utf-8", errors="ignore").read()
res[6]["text_patterns"] = {"banner image manasik_zoqe4xs.jpeg linked from page": "manasik_zoqe4xs.jpeg" in pg}
json.dump(res, open("evidence.json", "w"), indent=1, ensure_ascii=False)
print(json.dumps([{k: r.get(k) for k in ("key", "http", "fetched_npt", "text_patterns", "text_sha256", "image_sha256")} for r in res], ensure_ascii=False, indent=0))
