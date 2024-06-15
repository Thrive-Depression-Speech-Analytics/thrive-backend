# Thrive Backend Documentation

This documentation provides an overview of the Thrive backend service, which analyzes audio for depression detection and stores results in Firestore. 

### 1. `server.js` - Main Server Setup

- **Framework:** Hapi.js 
- **Authentication:** JWT (JSON Web Tokens) 
- **Database:** Firestore (Firebase)
- **Environment Variables:** Uses a `.env` file for configuration (JWT secret, Firebase credentials, etc.).

**Key Functionality:**

- Sets up the Hapi server.
- Registers the JWT plugin for authentication.
- Defines a JWT authentication strategy that verifies tokens and checks if the user exists in Firestore. 
- Sets JWT as the default authentication strategy.
- Routes incoming requests to the appropriate handlers defined in `routes.js`.

### 2. `routes.js` - Route Definitions

- Defines the API endpoints and their corresponding handlers. 
- Uses Joi for request payload validation. 

**Routes:**

- **Authentication Routes:**
    - `/auth/register`:  Registers a new user (no authentication required).
    - `/auth/login`: Logs in a user (no authentication required).
    - `/auth/forgot-password`: Sends an OTP for password reset (no authentication required).
    - `/auth/reset-password`:  Resets a user's password (no authentication required).
    - `/auth/logout`: Logs out a user (JWT authentication required).
- **User Routes:**
    - `/users/{userId}/username`: Updates a user's username (JWT authentication required).
    - `/users/{userId}/password`:  Changes a user's password (JWT authentication required).
    - `/users/{userId}/history`: Fetches a user's analysis history (JWT authentication required).
- **Audio Analysis Route:**
    - `/audio/analyze`:  Handles audio file uploads for analysis (JWT authentication required).

### 3. `audioHandler.js` - Audio Processing and Analysis

- **Core Functionality:**
    - Receives audio files via multipart form data.
    - Sends the audio data to a separate machine learning service (Cloud Run in this case) for prediction.
    - Stores the analysis results (prediction, suggestions) in Firestore.

**Key Functions:**

- `analyzeHandler`:  The main handler for the `/audio/analyze` route. 
- `analyzeAudio`:  Sends the audio data to the Cloud Run prediction service and receives the results.
- `storeAnalysisResults`: Stores the analysis results and other relevant data in Firestore.
- `generateSuggestions`:  Provides suggestions to the user based on the analysis result.

### 4. `authService.js` - Authentication Logic

- **Functionality:**
    - Handles user registration, login, password reset, and other authentication-related tasks.
    - Interacts with Firestore to store and retrieve user data.

**Key Functions:**

- `signupHandler`:  Handles user registration.
- `loginHandler`:  Handles user login and generates JWTs.
- `forgotPasswordHandler`:  Sends OTPs for password reset.
- `resetPasswordHandler`: Resets the user's password. 
- `editUsernameHandler`: Allows users to update their usernames.
- `changePasswordHandler`:  Allows users to change their passwords.
- `logoutHandler`: Handles logout (primarily for frontend purposes). 

### 5. `historyUser.js` - User History Retrieval

- **Functionality:**
    - Fetches the analysis history for a specific user from Firestore. 

**Key Function:**

- `fetchUserHistory`: Retrieves the analysis history for a given `userId`, ordered by timestamp. 

### 6. `firebase.js` - Firebase Initialization

- Initializes the Firebase Admin SDK.
- Loads Firebase credentials from environment variables.

**Key Points:**

- **Replace Placeholders:** Ensure you replace all placeholder values (URLs, secret keys, credentials, etc.) in the code with your actual values.
- **Install Dependencies:** Install the necessary Node.js packages for each file.
- **Authentication:**  The backend relies on JWT for authentication. Make sure to implement proper token generation and validation on the client-side (e.g., your Android app).
- **Security:** Consider additional security measures like input validation, rate limiting, and protection against malicious uploads. 

This documentation provides a high-level overview of the Thrive backend. For detailed implementation, refer to the code comments and use this documentation as a guide! 
