# App.py Documentation
=====================

This Python script is a Flask application that uses a TensorFlow Lite model to predict depression from audio files. The application exposes a single endpoint `/predict` which accepts POST requests with an audio file. The audio file is processed and features are extracted to be used as input for the model.

## Dependencies
--------------

The script uses the following libraries:

* `os`
* `io`
* `librosa`
* `numpy`
* `tensorflow`
* `flask`
* `json`
* `Model`

The TensorFlow Lite model used is loaded from the file `thrive_model.tflite`. The model is expected to be in the same directory as the script.

### Audio Processing
-------------------

The audio file is processed using the `librosa` library. The audio is loaded with a target sample rate of 22050. The audio is segmented into 180 second segments, skipping the first 30 seconds of the audio file. The Mel-frequency cepstral coefficients (MFCCs) are then extracted from the audio as features for the model. The MFCCs are reshaped to match the input shape of the model.

### Endpoint
----------

The `/predict` endpoint accepts POST requests with an audio file. The audio file is expected to be in the request files with the key `'audio'`. If the audio file is not provided or no file is selected, an error message is returned.

The audio file is read into memory, processed, and the features are extracted. The features are then used as input for the model. The model's prediction is returned as a JSON response. If the prediction is greater than or equal to 0.5, the result is `'depression'`, otherwise it is `'normal'`.

### Running the Application
-------------------------

The application can be run with the command `python app.py`. By default, the application runs on `0.0.0.0` with port `8080`. The port can be changed by setting the `PORT` environment variable.

### Error Handling
----------------

If an error occurs during the processing of the audio file or the prediction, an error message is returned as a JSON response with a `500` status code.
