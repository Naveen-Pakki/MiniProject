from flask import Flask, render_template, request, send_from_directory, send_file
from encode import encode_image
from decode import decode_image
import os
import re

app = Flask(__name__)

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


# Show images
@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory('uploads', filename)


# Download image
@app.route('/download/<filename>')
def download_file(filename):
    file_path = os.path.join('uploads', filename)

    return send_file(
        file_path,
        as_attachment=True,
        download_name=filename,
        mimetype='image/png'
    )


@app.route('/', methods=['GET', 'POST'])
def index():
    result = ""
    original = None
    encoded = None
    warning = ""

    if request.method == 'POST':
        file = request.files['image']

        if file and allowed_file(file.filename):
            filepath = os.path.join(UPLOAD_FOLDER, file.filename)
            file.save(filepath)

            original = file.filename

            # ENCODE
            if 'encode' in request.form:
                message = request.form['message']
                encoded = encode_image(filepath, message)
                result = "✅ Message encoded successfully"

            # DECODE + WARNING
            elif 'decode' in request.form:
                message = decode_image(filepath)
                result = f"Hidden Message: {message}"

                if not message:
                    warning = "NO_MESSAGE"
                elif re.search(r'[^a-zA-Z0-9 ]', message):
                    warning = "SUSPICIOUS"
                else:
                    warning = ""

        else:
            result = "❌ Only PNG/JPG/JPEG allowed"

    return render_template(
        'index.html',
        result=result,
        original=original,
        encoded=encoded,
        warning=warning
    )


if __name__ == '__main__':
    app.run(debug=True)