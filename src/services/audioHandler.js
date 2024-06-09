const fs = require("fs");
const fetch = require("node-fetch");
const formidable = require("formidable");
const firebase = require("../server/firebase");
const { Storage } = require("@google-cloud/storage");
const axios = require("axios");

const storage = new Storage();
const bucketName = "your-bucket-name";

const cachedSuggestions = {
	depressed: [],
	notDepressed: [],
};

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
				await deleteAudioFile(audioFile.filepath);
				throw new Error("Format audio yang diupload tidak didukung.");
			}

			const isDepressed = await analyzeAudio(audioFile.filepath);
			const depressionStatus = labelDepressionStatus(isDepressed);

			const userRef = firebase.firestore().collection("users").doc(userId);
			const analysisRef = userRef.collection("analysisResults").doc();
			await analysisRef.set({
				timestamp: firebase.firestore.FieldValue.serverTimestamp(),
				depressionStatus,
				suggestions: generateSuggestions(isDepressed),
				audioFileName: audioFile.originalFilename,
			});

			return h
				.response({
					message: "Analisis selesai!",
					isDepressed,
					suggestions: generateSuggestions(isDepressed),
					analysisId: analysisRef.id,
				})
				.code(200);
		} catch (error) {
			console.error("Kesalahan analisis:", error);

			if (audioFile && audioFile.filepath) {
				try {
					await deleteAudioFile(audioFile.filepath);
				} catch (unlinkError) {
					console.error("Gagal menghapus file audio:", unlinkError);
				}
			}

			return h
				.response({ message: "Ada kesalahan internal. Coba lagi nanti." })
				.code(500);
		}
	},
};
module.exports = audioControllers;

async function processAudioUpload(request) {
	return new Promise((resolve, reject) => {
		const form = formidable({ multiples: false });
		form.parse(request.payload, async (err, fields, files) => {
			if (err) {
				reject(new Error("Gagal mengunggah audio. Coba lagi nanti."));
			}
			if (!files.file) {
				reject(new Error("Tidak ada file audio yang diunggah."));
			}
			resolve(files.file);
		});
	});
}

async function deleteAudioFile(filePath) {
	try {
		fs.unlinkSync(filePath);
	} catch (error) {
		console.error("Error deleting audio file:", error);
	}
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
			headers: { "Content-Type": "audio/wav" },
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
			throw new Error("Hasil analisis tidak valid.");
		}

		await deleteAudioFile(audioFilePath);

		return isDepressed;
	} catch (error) {
		console.error("Kesalahan menganalisis audio:", error);
		throw error;
	}
}

async function generateSuggestions(isDepressed) {
	let suggestions = [];
	if (isDepressed) {
		if (cachedSuggestions.depressed.length === 0) {
			cachedSuggestions.depressed = [
				"Yuk, kamu luangkan waktu buat hal-hal yang bikin kamu bahagia. Nonton film bareng orang yang sayang sama kamu, main game, atau ngobrol bareng temen, gimana?",
				"Olahraga dan makan sehat bisa bikin mood kamu lebih baik. Jangan lupa istirahat yang cukup juga, ya.",
				"Ada banyak aplikasi meditasi dan terapi online yang bisa bantu kamu. Coba cari yang cocok buat kamu. Aku bisa bantu cari video yang bisa kamu ikuti.",
				"Kalo kamu merasa gak kuat ngatasin perasaanmu, jangan ragu untuk cari bantuan profesional dari psikolog atau terapis.",
				"Gabung komunitas online atau grup support untuk depresi. Sharing pengalaman bisa bikin kamu merasa lebih tenang.",
				"Coba bikin daftar hal-hal yang kamu suka, dan mulai lakukan! Ngejar hobi bisa bikin kamu lebih bahagia.",
				"Kalo kamu lagi minum obat, jangan lupa ikuti petunjuk dokter dan jangan berhenti minum obat tanpa konsultasi dulu.",
				"Coba latihan relaksasi seperti pernapasan dalam atau meditasi untuk mengurangi stres.",
			];
		}
		suggestions = cachedSuggestions.depressed;
	} else {
		if (cachedSuggestions.notDepressed.length === 0) {
			cachedSuggestions.notDepressed = [
				"Senang banget dengar kamu sehat-sehat aja! Tetap jaga kesehatan mentalmu ya. Perhatikan pola tidur, makan, dan aktivitasmu.",
				"Kalo ada perubahan yang signifikan, jangan ragu untuk konsultasi sama dokter atau perawat.",
				"Yuk, kita luangkan waktu untuk ngejar hobi atau kegiatan yang bikin kamu senang. Biar mood kamu selalu ceria.",
				"Habiskan waktu bareng orang-orang yang sayang sama kamu. Jaga hubungan sosial yang sehat. Aku yakin kamu punya banyak temen yang sayang sama kamu.",
				"Hindari alkohol dan narkoba. Itu bisa bikin kondisi mental kamu makin buruk. Hampirilah orang yang kamu sayang kalau kamu butuh ngobrol atau curhat.",
				"Luangkan waktu untuk menikmati alam terbuka. Sinar matahari bisa bikin suasana hati lebih baik. Kita bisa jalan-jalan bareng ke taman, gimana?",
				"Kalo kamu merasa cemas atau stres, coba teknik manajemen stres seperti yoga atau meditasi.",
			];
		}
		suggestions = cachedSuggestions.notDepressed;
	}
}

function labelDepressionStatus(isDepressed) {
	if (isDepressed) {
		return "Terindikasi Depresi";
	} else {
		return "Normal";
	}
}
