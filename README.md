# Thrive Backend Documentation

This repository contains the backend code for Thrive, a platform that utilizes audio analysis to empower individuals to proactively manage their mental well-being.

### Project Structure

- **auth:** 
    - `authService.js`: Handles user authentication, signup, login, password reset, and other user management functionalities.
- **server:** 
    - `firebase.js`: Initializes Firebase Admin SDK for database interaction.
- **services:** 
    - `audioHandler.js`: Processes audio files, performs analysis using a machine learning model, and stores results in Firestore.
    - `historyUser.js`:  Fetches analysis history for a user.
- **routes:** 
    - `routes.js`: Defines API routes for authentication, user management, and audio analysis.
- **app.py:** 
    - `app.py`:  Flask API endpoint for audio analysis (ML model deployment).

### Technologies Used

- **Hapi.js:** Web framework for building the API server.
- **Firebase:** Provides a NoSQL database (Firestore) and authentication services.
- **Nodemailer:** Enables sending emails for password reset.
- **Flask:**  Used to create the API endpoint for the ML model.
- **Librosa:** Python library for audio analysis and feature extraction.
- **TensorFlow Lite:** Machine learning model for depression detection.

### Key Features

- **User Authentication:** Secure signup, login, password reset, and logout functionalities.
- **Audio Analysis:**  Uses a machine learning model to analyze audio recordings and predict potential depression.
- **Personalized Suggestions:** Provides tailored suggestions for self-care and potential resources based on the analysis.
- **History Tracking:**  Allows users to track their past analysis results and progress.

### Installation and Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Thrive-Depression-Speech-Analytics/thrive-backend.git
   ```
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Set up environment variables:** Create a `.env` file and set the following environment variables:
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PRIVATE_KEY`
   - `JWT_SECRET`
4. **Configure Firebase:** 
   - Create a Firebase project.
   - Enable Firestore and Authentication in your Firebase project.
   - Download a service account key file and place it in the `server` directory.
5. **Configure Google Cloud Storage:**
   - Create a Google Cloud Storage bucket for storing audio files.
   - Ensure your service account has permissions to access this bucket.
6. **Start the server:**
   ```bash
   npm start
   ```

### Running the App.py for ML Model

1. Make sure you have `TensorFlow Lite` and `librosa` installed:
   ```bash
   pip install tensorflow-lite
   pip install librosa
   ```

2. Run the application:
   ```bash
   flask run 
   ```

### API Endpoint Documentation

#### Authentication

**POST /auth/register**

* **Description:** Registers a new user.
* **Request Body:**
   ```json
   {
       "username": "yourusername",
       "password": "yourpassword",
       "email": "your_email@example.com"
   }
   ```
* **Response:**
   ```json
   {
       "message": "Signup successful",
       "userId": "user_id"
   }
   ```
* **Status Codes:**
    * **201:** Successful signup.
    * **400:** Invalid request body.
    * **409:** Email already exists.
    * **500:** Internal server error.

**POST /auth/login**

* **Description:** Logs in an existing user.
* **Request Body:**
   ```json
   {
       "email": "your_email@example.com",
       "password": "yourpassword"
   }
   ```
* **Response:**
   ```json
   {
       "message": "Login successful",
       "token": "jwt_token",
       "userId": "user_id"
   }
   ```
* **Status Codes:**
    * **200:** Successful login.
    * **400:** Invalid request body.
    * **401:** Invalid password.
    * **404:** Email not found.
    * **500:** Internal server error.

**POST /auth/forgot-password**

* **Description:** Sends an OTP for password reset.
* **Request Body:**
   ```json
   {
       "email": "your_email@example.com"
   }
   ```
* **Response:**
   ```json
   {
       "message": "OTP sent successfully"
   }
   ```
* **Status Codes:**
    * **200:** OTP sent successfully.
    * **400:** Invalid request body.
    * **404:** Email not found.
    * **500:** Internal server error.

**POST /auth/reset-password**

* **Description:** Resets the user's password using an OTP.
* **Request Body:**
   ```json
   {
       "email": "your_email@example.com",
       "otp": "your_otp",
       "newPassword": "your_new_password"
   }
   ```
* **Response:**
   ```json
   {
       "message": "Password successfully reset"
   }
   ```
* **Status Codes:**
    * **200:** Password reset successfully.
    * **400:** Invalid request body.
    * **401:** Invalid OTP.
    * **404:** User not found.
    * **500:** Internal server error.

**POST /auth/logout**

* **Description:** Logs out the current user.
* **Request Body:** None.
* **Response:**
   ```json
   {
       "message": "Logged out successfully"
   }
   ```
* **Status Codes:**
    * **200:** Successful logout.
    * **500:** Internal server error.

#### User Management

**PUT /users/{userId}/username**

* **Description:** Updates the user's username.
* **Request Body:**
   ```json
   {
       "newUsername": "your_new_username"
   }
   ```
* **Response:**
   ```json
   {
       "message": "Username successfully changed"
   }
   ```
* **Status Codes:**
    * **200:** Username updated successfully.
    * **400:** Invalid request body.
    * **401:** Unauthorized.
    * **404:** User not found.
    * **500:** Internal server error.

**PUT /users/{userId}/password**

* **Description:** Updates the user's password.
* **Request Body:**
   ```json
   {
       "oldPassword": "your_old_password",
       "newPassword": "your_new_password"
   }
   ```
* **Response:**
   ```json
   {
       "message": "Password successfully changed"
   }
   ```
* **Status Codes:**
    * **200:** Password updated successfully.
    * **400:** Invalid request body.
    * **401:** Unauthorized.
    * **404:** User not found.
    * **500:** Internal server error.

**GET /users/history**

* **Description:** Retrieves the user's analysis history.
* **Request Body:** None.
* **Response:**
   ```json
   [
       {
           "id": "analysis_id",
           "timestamp": "timestamp_in_firestore_format",
           "depressionStatus": "Potentially Depressed" | "Normal",
           "suggestions": "suggestion_text",
           "audioFileName": "audio_file_name.wav",
           "gcsUrl": "gcs_url"
       },
       // ... other history items
   ]
   ```
* **Status Codes:**
    * **200:** History retrieved successfully.
    * **401:** Unauthorized.
    * **500:** Internal server error.

#### Audio Analysis

**POST /audio/analyze**

* **Description:** Analyzes an audio file to predict depression status.
* **Request Body:**
   ```
   {
       "audio": {
           "filename": "audio_file.wav",
           "_data": {
               // Stream data
           }
       }
   }
   ```
* **Response:**
   ```json
   {
       "isDepressed": "depresi" | "normal",
       "confidence": "prediction_value",
       "analysisId": "analysis_id",
       "gcsUrl": "gcs_url",
       "suggestion": "random_suggestion_text"
   }
   ```
* **Status Codes:**
    * **200:** Analysis successful.
    * **400:** Invalid request body.
    * **401:** Unauthorized.
    * **500:** Internal server error.


### Contributors

