# prediction_service.py
import os
import io
import numpy as np
import tensorflow as tf
from flask import Flask, request, jsonify, abort
from google.cloud import storage

app = Flask(__name__)

os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "thrive-dev-424108-154d2ee7527b.json"

# Google Cloud Storage Configuration
BUCKET_NAME = "thrive-audio-storage"  # Replace with your bucket name
gcs_client = storage.Client()
bucket = gcs_client.bucket(BUCKET_NAME)


# Load the TFLite model
model_path = "thrive_model.tflite"  # Update with your model's path
interpreter = tf.lite.Interpreter(model_path=model_path)
interpreter.allocate_tensors()

# Get input and output tensors
input_details = interpreter.get_input_details()
output_details = interpreter.get_output_details()

# Configuration (adjust as needed)
target_sr = 22050
segment_duration = 3 * 60
skip_duration = 5
threshold = 1


@app.route('/predict', methods=['POST'])
def predict():
    """Handles audio depression prediction requests (no custom preprocessing)."""
    if 'audio' not in request.files:
        abort(400, description="No audio file provided.")

    audio_file = request.files['audio']
    if audio_file.filename == '':
        abort(400, description="No selected file.")

    try:
        # 1. Read audio data into memory
        audio_data = audio_file.read()

        # 2. Convert bytes to NumPy array (assuming your model expects this)
        # Make sure the data type and shape match your model's input requirements!
        audio_np = np.frombuffer(audio_data, dtype=np.float32)
        audio_np = audio_np.reshape(
            input_details[0]['shape'])  # Very important!

        # 3. Make the prediction
        interpreter.set_tensor(input_details[0]['index'], audio_np)
        interpreter.invoke()
        prediction = interpreter.get_tensor(output_details[0]['index'])[0][0]

        # 5. Interpret the prediction (same as before)
        result = "depresi" if prediction >= threshold else "normal"
        confidence = prediction if result == "depresi" else 1 - prediction

        # 6. Construct the response
        response = {
            'result': result,
            'confidence': confidence,
            'gcs_audio_uri': f"gs://{BUCKET_NAME}/{audio_file.filename}"
        }
        return jsonify(response)

    except Exception as e:
        print(f"Error during prediction: {e}")
        abort(500, description="An error occurred during prediction.")


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=int(os.environ.get('PORT', 8080)))
