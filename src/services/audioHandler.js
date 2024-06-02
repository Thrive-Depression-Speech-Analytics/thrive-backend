const fs = require("fs");
const fetch = require("node-fetch");
const formidable = require("formidable");
const firebase = require("../server/firebase");

const audioControllers = {
	analyzeHandler: async (request, h) => {
		const userId = request.auth.credentials.userId;
		let audioFile;

		try {
			audioFile = await processAudioUpload(request);
			if (audioFile instanceof Error) {
				throw audioFile;
			}

			if (!isAllowedAudioFormat(audioFile.mimetype)) {
				fs.unlinkSync(audioFile.filepath); // Hapus file jika format tidak didukung
				throw new Error("Unsupported audio format");
			}

			const isDepressed = await analyzeAudio(audioFile.filepath);
			const depressionStatus = labelDepressionStatus(isDepressed);

			const userRef = firebase.firestore().collection("users").doc(userId);
			const analysisRef = userRef.collection("analysisResults").doc();
			await analysisRef.set({
				timestamp: firebase.firestore.FieldValue.serverTimestamp(),
				depressionStatus,
				suggestions: generateSuggestions(isDepressed),
				audioFileName: audioFile.originalFilename, // Opsional
			});

			return h
				.response({
					message: "Analysis complete",
					isDepressed,
					suggestions: generateSuggestions(isDepressed),
					analysisId: analysisRef.id,
				})
				.code(200);
		} catch (error) {
			console.error("Analysis error:", error);

			// Hapus file audio jika terjadi error
			if (audioFile && audioFile.filepath) {
				try {
					fs.unlinkSync(audioFile.filepath);
				} catch (unlinkError) {
					console.error("Gagal menghapus file audio:", unlinkError);
				}
			}

			return h.response({ message: "Internal server error" }).code(500);
		}
	},
};
module.exports = audioControllers;

async function processAudioUpload(request) {
	return new Promise((resolve, reject) => {
		const form = formidable({ multiples: false });
		form.parse(request.payload, async (err, fields, files) => {
			if (err) {
				reject(new Error("Error processing audio upload"));
			}
			if (!files.file) {
				reject(new Error("No audio file uploaded"));
			}
			resolve(files.file);
		});
	});
}

function isAllowedAudioFormat(mimetype) {
	const allowedFormats = ["audio/mpeg", "audio/wav", "audio/ogg", "audio/aac"];
	return allowedFormats.includes(mimetype);
}

async function analyzeAudio(audioFilePath) {
	try {
		const audioData = fs.readFileSync(audioFilePath);

		const response = await fetch("https://your-ml-model-api-endpoint", {
			method: "POST",
			body: audioData,
			headers: { "Content-Type": "audio/wav" }, // Sesuaikan dengan format audio Anda
		});

		if (!response.ok) {
			throw new Error(`Gagal menganalisis audio. Status: ${response.status}`);
		}

		const analysisResult = await response.json();
		let isDepressed;

		if (analysisResult == 1) {
			isDepressed = true;
		} else if (analysisResult == 0) {
			isDepressed = false;
		} else {
			throw new Error("Invalid analysis result");
		}
	} catch (error) {
		console.error("Kesalahan menganalisis audio:", error);
		throw error; // Melempar error agar ditangani oleh blok catch di tingkat atas
	}
}

function generateSuggestions(isDepressed) {
	if (isDepressed) {
		const depressedResponses = [
			"Hasil analisis menunjukkan potensi depresi. Kami sangat menyarankan Anda untuk mencari bantuan profesional dari terapis atau psikolog.",
			"Berbicaralah dengan orang yang Anda percaya, seperti keluarga atau teman, dan berbagi perasaan Anda.",
			"Cobalah untuk menjaga rutinitas sehat, termasuk tidur yang cukup, makan makanan yang seimbang, dan berolahraga secara teratur.",
			"Cari sumber daya online yang dapat membantu, seperti aplikasi meditasi, kelompok dukungan online, atau platform yang menawarkan terapi online.",
			"Jangan ragu untuk mencari pertolongan segera jika Anda merasa sulit mengatasi perasaan Anda atau memiliki pikiran untuk menyakiti diri sendiri.",
		];
		const randomResponse =
			depressedResponses[Math.floor(Math.random() * depressedResponses.length)];
		return randomResponse;
	} else {
		const notDepressedResponses = [
			"Hasil analisis menunjukkan bahwa Anda mungkin tidak mengalami depresi. Namun, penting untuk memantau kesehatan mental Anda secara keseluruhan.",
			"Perhatikan pola tidur, pola makan, dan tingkat aktivitas Anda. Jika Anda merasa ada perubahan yang signifikan, konsultasikan dengan profesional kesehatan.",
			"Cari kegiatan yang membuat Anda bahagia dan rileks, seperti menghabiskan waktu dengan anggota keluarga, melakukan aktivitas yang menyenangkan, atau bermain game.",
			"Konsiderasikan untuk mengunjungi dokter atau perawat untuk mendiskusikan keluhan Anda jika Anda merasa sulit mengendalikan perasaan.",
		];
		const randomResponse =
			notDepressedResponses[
				Math.floor(Math.random() * notDepressedResponses.length)
			];
		return randomResponse;
	}
}

function labelDepressionStatus(isDepressed) {
	if (isDepressed) {
		return "Mungkin anda sedang depresi";
	} else {
		return "Normal";
	}
}
