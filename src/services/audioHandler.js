const fs = require("fs");
const path = require("path");
const firebase = require("../server/firebase");
const { Storage } = require("@google-cloud/storage");
const axios = require("axios");
const { pipeline } = require("stream/promises");
const { Readable } = require("stream");

/**
 * @fileOverview Audio Handling - API endpoint to analyze audio files
 * to detect potential depression, store results in Firestore,
 * and provide personalized suggestions.
 */

// Constants
const storage = new Storage();
const bucketName = "thrive-audio-storage";
const mlModelEndpoint =
	"https://thrive-audio-model-5pilppfsoq-et.a.run.app/predict";

/**
 * Object storing cached suggestions for quick access.
 * @typedef {Object} CachedSuggestions
 * @property {string[]} depressedSuggestions - Suggestions for depressed users.
 * @property {string[]} notDepressedSuggestions - Suggestions for non-depressed users.
 */

/**
 * @type {CachedSuggestions}
 * @description Object storing cached suggestions for quick access.
 */
const cachedSuggestions = {
	depressedSuggestions: [
		"Tenang, wajar kok kalo lagi sedih. Coba deh luangin waktu buat hal-hal yang kamu suka! Nonton film bareng orang tersayang, main game, atau ngobrol sama temen.",
		"Coba deh olahraga dan makan sehat, bisa bantu mood-mu lebih baik. Jangan lupa tidur yang cukup juga!",
		"Banyak aplikasi meditasi dan layanan terapi online lho! Aku bisa bantu cari video yang cocok buat kamu.",
		"Kalo ngerasa kewalahan, jangan ragu buat cari bantuan profesional dari psikolog atau terapis.",
		"Gabung komunitas online atau grup support untuk depresi. Bagikan pengalamanmu, bisa bikin kamu lebih tenang.",
		"Buat list hal-hal yang kamu suka dan mulai lakukan! Ngejar hobi bisa bikin kamu lebih bahagia.",
		"Kalo kamu lagi minum obat, inget buat ikuti petunjuk dokter dan jangan berhenti minum obat tanpa konsultasi dulu.",
		"Coba latihan relaksasi kayak napas dalam atau meditasi buat ngurangin stres.",
	],
	notDepressedSuggestions: [
		"Seru banget denger kamu lagi baik-baik aja! Tetep jaga kesehatan mentalmu. Perhatikan pola tidur, diet, dan aktivitasmu.",
		"Kalo kamu ngerasa ada perubahan yang signifikan, jangan ragu buat konsultasi ke dokter atau perawat.",
		"Yuk kita luangin waktu buat ngejar hobi atau aktivitas yang bikin kamu bahagia. Tetep jaga mood-mu!",
		"Habisin waktu sama orang-orang yang sayang sama kamu. Jaga hubungan sosial yang sehat. Aku yakin banyak temen yang peduli sama kamu.",
		"Senang kamu baik baik aja! jangan lupa hindari alkohol dan narkoba. Bisa memperburuk kondisi mentalmu. Hubungi orang terdekat kalo kamu butuh ngobrol atau ngeluarin uneg-uneg ya.",
		"Habisin waktu di luar ruangan. Sinar matahari bisa ningkatin mood-mu. Kita bisa jalan-jalan bareng ke taman, gimana?",
		"Sepertinya kamu baik-baik aja! Kalo kamu ngerasa cemas atau stres, coba teknik manajemen stres kayak yoga atau meditasi.",
	],
};

/**
 * Deletes the audio file from the local system.
 * @param {string} filePath - Path to the audio file.
 * @returns {void}
 */
const deleteAudioFile = async filePath => {
	try {
		fs.unlinkSync(filePath);
		console.log(`Local audio file deleted: ${filePath}`);
	} catch (error) {
		console.error("Error deleting local audio file:", error);
	}
};

/**
 * Uploads the audio file to Google Cloud Storage (GCS).
 * @param {Buffer} audioBuffer - Buffer containing the audio data.
 * @param {string} fileName - Name of the audio file.
 * @returns {Promise<string>} GCS URL of the audio file.
 */
const uploadAudioToGCS = async (audioBuffer, fileName) => {
	try {
		const file = storage.bucket(bucketName).file(fileName);

		// Create a write stream to upload the buffer
		const writeStream = file.createWriteStream();

		// Use pipeline for efficient streaming
		await pipeline(Readable.from(audioBuffer), writeStream);

		console.log(`Audio file uploaded to GCS: gs://${bucketName}/${fileName}`);
		return `gs://${bucketName}/${fileName}`; // Return the GCS URL
	} catch (error) {
		console.error("Error uploading audio to GCS:", error);
		throw error;
	}
};

/**
 * Stores the analysis results in the Firestore database.
 * @param {string} userId - User ID.
 * @param {boolean} analysisResult - Analysis result (true if potentially depressed, false if not).
 * @param {string} audioFileName - Name of the audio file.
 * @param {string} gcsUrl - GCS URL of the uploaded audio.
 * @param {string} suggestion - The suggestion to store.
 * @returns {Promise<string>} Promise resolving with the document ID of the analysis results in Firestore.
 */
const storeAnalysisResults = async (
	userId,
	predictionResult,
	audioFileName,
	gcsUrl,
	suggestion
) => {
	try {
		const userRef = firebase.firestore().collection("users").doc(userId);
		const analysisRef = userRef.collection("analysisResults").doc(); // Generate new document ID

		await analysisRef.set({
			timestamp: firebase.firestore.FieldValue.serverTimestamp(),
			depressionStatus:
				predictionResult == "depresi" ? "Potentially Depressed" : "Normal",
			suggestions: suggestion,
			audioFileName,
			gcsUrl,
		});

		return analysisRef.id; 
	} catch (error) {
		console.error("Error storing analysis results:", error);
		throw error;
	}
};

/**
 * Gets a random suggestion based on the analysis result.
 * @param {boolean} isDepressed - Indicates if the user is depressed.
 * @returns {string} Random suggestion.
 */
const getRandomSuggestion = isDepressed => {
	const suggestions =
		isDepressed == "depresi"
			? cachedSuggestions.depressedSuggestions
			: cachedSuggestions.notDepressedSuggestions;

	const randomIndex = Math.floor(Math.random() * suggestions.length);
	return suggestions[randomIndex];
};

/**
 * Controllers for handling audio analysis requests.
 * @namespace
 */
const audioControllers = {
	/**
	 * Handles the analyze request.
	 * @param {object} request - Hapi request object.
	 * @param {object} h - Hapi response toolkit.
	 * @returns {Promise<object>} Response object.
	 */
	analyzeHandler: async (request, h) => {
		try {
			const userId = request.auth.credentials.userId;
			const audioFile = request.payload.audio;

			if (!audioFile) {
				return h.response({ error: "No audio file provided" }).code(400);
			}

			// 1. Construct the full file path
			const publicFolderPath = path.join(__dirname, "..", "public");
			const filePath = path.join(publicFolderPath, audioFile.hapi.filename);
			console.log("Filepath:", filePath);

			// 2. Ensure 'public' folder exists
			if (!fs.existsSync(publicFolderPath)) {
				fs.mkdirSync(publicFolderPath);
			}

			// 3. Handle audioFile._data based on its type
			let audioBuffer;

			if (audioFile._data.pipe) {
				// If it's a stream
				// 3.1. Pipe the stream to the file
				const fileStream = fs.createWriteStream(filePath);

				// 4. Handle potential errors during file writing
				fileStream.on("error", err => {
					console.error("Error saving audio file:", err);
				});

				audioFile._data.pipe(fileStream);

				await new Promise((resolve, reject) => {
					fileStream.on("finish", resolve);
					fileStream.on("error", err => {
						console.error("Error saving audio file:", err);
						reject(err);
					});
				});
				// 3.2. Read the file content into a buffer
				audioBuffer = fs.readFileSync(filePath);
			} else {
				// If it's a buffer
				// 3.1. Save the buffer to a file
				fs.writeFileSync(filePath, audioFile._data);
				// 3.2. The audioBuffer is already available
				audioBuffer = audioFile._data;
			}

			// Upload to GCS
			const gcsUrl = await uploadAudioToGCS(
				audioBuffer,
				audioFile.hapi.filename
			);

			// Prepare data for the ML model 
			const formData = new FormData();
			const firstChunk = audioBuffer.slice(0, 4100);

			
			const fileType = await import("file-type");
			const fileTypeInfo = await fileType.fileTypeFromBuffer(firstChunk);
			const contentType = fileTypeInfo
				? fileTypeInfo.mime
				: "application/octet-stream";
			const blob = new Blob([audioBuffer], { type: contentType });
			formData.append("audio", blob, audioFile.hapi.filename);

			// Send the request to the ML model
			const response = await axios.post(mlModelEndpoint, formData, {
				headers: {
					"Content-Type": `multipart/form-data; boundary=${formData._boundary}`,
				},
			});

			const prediction = response.data;
			// Get a random suggestion before saving to Firestore
			const randomSuggestion = getRandomSuggestion(prediction.result);

			// Store results
			const analysisResultId = await storeAnalysisResults(
				userId,
				prediction.result,
				audioFile.hapi.filename,
				gcsUrl,
				randomSuggestion
			);

			// Delete the local audio file AFTER successful processing
			await deleteAudioFile(filePath);

			// Send the response
			return h.response({
				isDepressed: prediction.result,
				confidence: prediction.prediction,
				analysisId: analysisResultId,
				gcsUrl,
				suggestion: randomSuggestion,
			});
		} catch (error) {
			console.error("Error processing audio:", error);
			return h.response({ error: "Internal Server Error" }).code(500);
		}
	},
};

module.exports = audioControllers;
