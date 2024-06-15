import os
import io
import librosa
import numpy as np
import tensorflow as tf
from flask import Flask, request, jsonify, abort
import json

app = Flask(__name__)

# Menentukan path dan parameter-parameter
target_sr = 22050
segment_duration = 180  # Durasi segmen audio dalam detik (3 menit)
skip_duration = 30  # Durasi lompatan dari awal file audio (30 detik)
desired_length = 15504

# Memuat model TFLite
model_path = "thrive_model.tflite"
interpreter = tf.lite.Interpreter(model_path=model_path)
interpreter.allocate_tensors()

# Mendapatkan detail tensor input dan output
input_details = interpreter.get_input_details()
output_details = interpreter.get_output_details()

# Fungsi untuk mengekstrak fitur MFCC dari audio
def extract_mfcc_features(audio, sr, n_mfcc=13, desired_length=15504):
    mfccs = librosa.feature.mfcc(y=audio, sr=sr, n_mfcc=n_mfcc)
    current_length = mfccs.shape[1]
    if current_length < desired_length:
        mfccs = np.pad(
            mfccs, ((0, 0), (0, desired_length - current_length)), mode='constant')
    elif current_length > desired_length:
        mfccs = mfccs[:, :desired_length]
    return mfccs

# Fungsi untuk memproses segmen audio
def preprocess_audio_segments(audio_data, sample_rate):
    audio = librosa.load(io.BytesIO(audio_data), sr=target_sr,
                         duration=segment_duration, offset=skip_duration)[0]
    return audio

@app.route('/predict', methods=['POST'])
def predict():
    """Menangani permintaan prediksi depresi audio."""
    if 'audio' not in request.files:
        return jsonify({'error': 'Tidak ada file audio yang disediakan'}), 400

    audio_file = request.files['audio']
    if audio_file.filename == '':
        return jsonify({'error': 'Tidak ada file audio yang dipilih'}), 400

    try:
        # 1. Membaca data audio ke dalam memori
        audio_data = audio_file.read()

        # 2. Memproses audio dan mengekstrak fitur
        audio = preprocess_audio_segments(audio_data, target_sr)
        mfccs = extract_mfcc_features(
            audio, target_sr, desired_length=desired_length)

        # 3. Menetapkan tensor input (menggunakan bentuk input dinamis)
        input_shape = input_details[0]['shape']
        mfccs = mfccs.reshape(input_shape)
        interpreter.set_tensor(
            input_details[0]['index'], mfccs.astype(np.float32))

        # 4. Menjalankan inferensi
        interpreter.invoke()

        # 5. Mendapatkan output
        prediction = interpreter.get_tensor(output_details[0]['index'])[0]

        # 6. Interpretasi dan Penyiapan Hasil
        threshold = 0.5  # Sesuaikan ambang batas sesuai kebutuhan

        # Memastikan prediksi berada dalam rentang probabilitas yang valid
        prediction_value = max(0, min(1, prediction))

        # Memeriksa apakah prediksi menunjukkan depresi (kelas 1)
        result = "depresi" if prediction_value >= threshold else "normal"

        # Mengubah tipe NumPy dan memastikan semua nilai dapat diserialisasi JSON
        response_data = {
            'result': result,
            # Mengubah secara eksplisit ke float
            'prediction': float(prediction_value)
        }

        # Menggunakan json.dumps untuk serialisasi string JSON langsung
        return json.dumps(response_data)

    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=int(os.environ.get('PORT', 8080)))
