# ml_service.py
from flask import Flask, request, jsonify
from werkzeug.utils import secure_filename
import hashlib
import random
import io
from PIL import Image

app = Flask(__name__)

def preprocess_image_stream(stream):
    img = Image.open(stream).convert('L').resize((128,128))
    return img

def fake_predict(img):
  
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    h = hashlib.sha256(buf.getvalue()).hexdigest()
    score = (int(h[:8], 16) % 1000) / 1000.0
    status = "legit" if score > 0.4 else "fraud"
    return {"status": status, "score": round(score, 3), "feature_hash": h[:16]}

@app.route('/infer', methods=['POST'])
def infer():
    if 'file' not in request.files:
        return jsonify({"error": "no file provided"}), 400
    f = request.files['file']
    filename = secure_filename(f.filename or "upload.png")
    try:
        img = preprocess_image_stream(f.stream)
    except Exception as e:
        return jsonify({"error": "invalid image", "msg": str(e)}), 400
    res = fake_predict(img)
    return jsonify(res)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)
