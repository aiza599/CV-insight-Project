from flask import Flask, render_template, request, jsonify
import json, urllib.request
from io import BytesIO

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 5 * 1024 * 1024  # 5MB

GEMINI_API_KEY = "AIzaSyBa_becEfNNCV6zEPHengDC_bWwRTP8Ngs"  # Gemini API 
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent"

def extract_text_from_pdf(file):
    try:
        import pypdf
        reader = pypdf.PdfReader(BytesIO(file.read()))
        text = ""
        for page in reader.pages:
            t = page.extract_text()
            if t:
                text += t + "\n"
        return text.strip() if len(text.strip()) > 20 else None
    except Exception as e:
        print("PDF Error:", e)
        return None


def call_gemini(prompt):
    payload = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}]
    }).encode("utf-8")

    req = urllib.request.Request(
        f"{GEMINI_URL}?key={GEMINI_API_KEY}",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            result = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8")
        print("GEMINI ERROR:", e.code, error_body)
        raise Exception(f"Gemini API Error {e.code}: {error_body}")
    
    raw = result["candidates"][0]["content"]["parts"][0]["text"]
    return raw.replace("```json", "").replace("```", "").strip()


def analyze_resume(resume_text, job_description=""):
    job_part = f"\nJOB DESCRIPTION:\n{job_description}" if job_description else ""
    prompt = f"""You are an expert resume analyst and career coach. Analyze the resume carefully.

RESUME:
{resume_text}
{job_part}

Respond ONLY with valid JSON — no markdown, no extra text:
{{
  "score": <integer 0-100>,
  "grade": "<A/B/C/D/F>",
  "summary": "<2-3 sentence professional summary of the resume>",
  "strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
  "improvements": [
    {{"issue": "<short title>", "description": "<what is wrong>", "fix": "<how to fix it>"}},
    {{"issue": "<short title>", "description": "<what is wrong>", "fix": "<how to fix it>"}},
    {{"issue": "<short title>", "description": "<what is wrong>", "fix": "<how to fix it>"}}
  ],
  "keywords_missing": ["<keyword 1>", "<keyword 2>", "<keyword 3>", "<keyword 4>"],
  "ats_tips": ["<ATS tip 1>", "<ATS tip 2>", "<ATS tip 3>"],
  "overall_verdict": "<one strong, motivating closing statement>"
}}"""
    raw = call_gemini(prompt)
    return json.loads(raw)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/extract-pdf", methods=["POST"])
def extract_pdf():
    if 'pdf' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    file = request.files['pdf']
    if not file.filename.lower().endswith('.pdf'):
        return jsonify({"error": "Only PDF files are supported"}), 400
    text = extract_text_from_pdf(file)
    if not text:
        return jsonify({"error": "Could not extract text from this PDF. Please paste your resume text manually."}), 400
    return jsonify({"text": text})


@app.route("/analyze", methods=["POST"])
def analyze():
    data = request.get_json()
    resume_text = data.get("resume", "").strip()
    job_desc = data.get("job_description", "").strip()

    if not resume_text:
        return jsonify({"error": "Resume text is required."}), 400
    if len(resume_text) < 50:
        return jsonify({"error": "Resume is too short. Please add more content."}), 400

    result = analyze_resume(resume_text, job_desc)
    return jsonify(result)


if __name__ == "__main__":
    app.run(debug=False)
