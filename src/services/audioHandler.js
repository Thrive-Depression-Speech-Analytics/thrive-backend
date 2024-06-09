/**
 *  @fileOverview  Penanganan Audio -  API endpoint untuk menganalisis file audio 
 *  untuk mendeteksi potensi depresi, menyimpan hasil ke Firestore, 
 *  dan memberikan saran yang dipersonalisasi.
 */
const fs = require("fs");
const fetch = require("node-fetch");
const formidable = require("formidable");
const firebase = require("../server/firebase");
const { Storage } = require("@google-cloud/storage");
const axios = require("axios");

// Constants
const storage = new Storage();
const bucketName = "your-bucket-name"; // Ganti dengan nama bucket GCS kamu
const allowedFormats = ["audio/mpeg", "audio/wav", "audio/ogg", "audio/aac"];
const mlModelEndpoint = "https://your-ml-model-api-endpoint"; // Ganti dengan endpoint API model ML kamu

/**
 *  @constant {Object} cachedSuggestions - Objek yang menyimpan saran yang di-cache
 *  untuk diakses dengan cepat.
 */
const cachedSuggestions = {
  depressedSuggestions: [
    "Tenang, semua orang pernah merasa sedih. Yuk, luangkan waktu untuk hal-hal yang bikin kamu senang! Nonton film bareng orang tersayang, main game, atau ngobrol sama temen.",
    "Coba deh olahraga dan makan sehat, bisa bantu mood kamu lebih baik. Jangan lupa istirahat yang cukup juga, ya!",
    "Banyak aplikasi meditasi dan terapi online yang bisa bantu kamu. Aku bisa bantu cari video yang bisa kamu ikuti.",
    "Kalo kamu merasa gak kuat ngatasin perasaanmu, jangan ragu untuk cari bantuan profesional dari psikolog atau terapis.",
    "Gabung komunitas online atau grup support untuk depresi. Sharing pengalaman bisa bikin kamu merasa lebih tenang.",
    "Coba bikin daftar hal-hal yang kamu suka, dan mulai lakukan! Ngejar hobi bisa bikin kamu lebih bahagia.",
    "Kalo kamu lagi minum obat, jangan lupa ikuti petunjuk dokter dan jangan berhenti minum obat tanpa konsultasi dulu.",
    "Coba latihan relaksasi seperti pernapasan dalam atau meditasi untuk mengurangi stres."
  ],
  notDepressedSuggestions: [
    "Senang banget dengar kamu sehat-sehat aja! Tetap jaga kesehatan mentalmu ya. Perhatikan pola tidur, makan, dan aktivitasmu.",
    "Kalo ada perubahan yang signifikan, jangan ragu untuk konsultasi sama dokter atau perawat.",
    "Yuk, kita luangkan waktu untuk ngejar hobi atau kegiatan yang bikin kamu senang. Biar mood kamu selalu ceria.",
    "Habiskan waktu bareng orang-orang yang sayang sama kamu. Jaga hubungan sosial yang sehat. Aku yakin kamu punya banyak temen yang sayang sama kamu.",
    "Hindari alkohol dan narkoba. Itu bisa bikin kondisi mental kamu makin buruk. Hampirilah orang yang kamu sayang kalau kamu butuh ngobrol atau curhat.",
    "Luangkan waktu untuk menikmati alam terbuka. Sinar matahari bisa bikin suasana hati lebih baik. Kita bisa jalan-jalan bareng ke taman, gimana?",
    "Kalo kamu merasa cemas atau stres, coba teknik manajemen stres seperti yoga atau meditasi."
  ],
};

// Utility Functions
/**
 *  @function  deleteAudioFile
 *  @description  Menghapus file audio dari sistem lokal.
 *  @param  {string} filePath - Path ke file audio.
 */
const deleteAudioFile = async (filePath) => {
  try {
    fs.unlinkSync(filePath);
  } catch (error) {
    console.error("Error deleting audio file:", error);
  }
};

/**
 *  @function  isAllowedAudioFormat
 *  @description  Mengecek apakah format file audio yang diunggah diperbolehkan.
 *  @param  {string} mimetype - MIME type file audio.
 *  @returns {boolean} True jika formatnya diperbolehkan, false jika tidak.
 */
const isAllowedAudioFormat = (mimetype) => {
  return allowedFormats.includes(mimetype);
};

//  Upload audio to GCS
/**
 *  @function  uploadAudioToGCS
 *  @description  Mengunggah file audio ke Google Cloud Storage (GCS).
 *  @param  {string} audioFilePath - Path ke file audio di sistem lokal.
 *  @param  {string} fileName - Nama file audio.
 *  @returns  {string} URL file audio di GCS.
 */
const uploadAudioToGCS = async (audioFilePath, fileName) => {
  try {
    const file = storage.bucket(bucketName).file(fileName);
    await file.save(audioFilePath);
    console.log(`Audio file uploaded to GCS: gs://${bucketName}/${fileName}`);
    return `gs://${bucketName}/${fileName}`; // Return the GCS URL
  } catch (error) {
    console.error("Error uploading audio to GCS:", error);
    throw error;
  }
};

//  Delete audio from GCS
/**
 *  @function  deleteAudioFromGCS
 *  @description  Menghapus file audio dari Google Cloud Storage (GCS).
 *  @param  {string} fileName - Nama file audio di GCS.
 */
const deleteAudioFromGCS = async (fileName) => {
  try {
    await storage.bucket(bucketName).file(fileName).delete();
    console.log(`Audio file deleted from GCS: gs://${bucketName}/${fileName}`);
  } catch (error) {
    console.error("Error deleting audio from GCS:", error);
  }
};

/**
 *  @function  processAudioUpload
 *  @description  Memproses file audio yang diunggah oleh pengguna.
 *  @param  {object} request - Objek request dari server.
 *  @returns {Promise<object>} Promise yang menyelesaikan dengan objek file audio.
 */
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

//  ML Model API Interaction
/**
 *  @function  analyzeAudio
 *  @description  Menganalisis file audio menggunakan model ML.
 *  @param  {string} audioFilePath - Path ke file audio di sistem lokal.
 *  @param  {string} fileName - Nama file audio.
 *  @returns {Promise<boolean>} Promise yang menyelesaikan dengan hasil analisis 
 *  (true jika terindikasi depresi, false jika tidak).
 */
const analyzeAudio = async (audioFilePath, fileName) => {
  try {
    // Upload audio to GCS before analysis
    const gcsUrl = await uploadAudioToGCS(audioFilePath, fileName);

    const response = await fetch(mlModelEndpoint, {
      method: "POST",
      body: fs.readFileSync(audioFilePath), //  Retrieve audio data from GCS using gcsUrl
      headers: { "Content-Type": "audio/wav" },
    });

    if (!response.ok) {
      throw new Error(`Gagal menganalisis audio. Status: ${response.status}`);
    }

    const analysisResult = await response.json();

    // Handle different response formats from ML API (e.g., using a switch statement)
    let isDepressed;
    if (analysisResult === 1) {
      isDepressed = true;
    } else if (analysisResult === 0) {
      isDepressed = false;
    } else {
      throw new Error("Hasil analisis tidak valid.");
    }

    // Delete audio from GCS after analysis
    await deleteAudioFromGCS(fileName);

    return isDepressed;
  } catch (error) {
    console.error("Kesalahan menganalisis audio:", error);
    throw error;
  }
};

//  Database Interaction
/**
 *  @function  storeAnalysisResults
 *  @description  Menyimpan hasil analisis ke Firestore database.
 *  @param  {string} userId - ID pengguna.
 *  @param  {boolean} analysisResult - Hasil analisis (true jika terindikasi 
 *  depresi, false jika tidak).
 *  @param  {string} audioFileName - Nama file audio.
 *  @returns {Promise<string>} Promise yang menyelesaikan dengan ID dokumen 
 *  hasil analisis di Firestore.
 */
const storeAnalysisResults = async (userId, analysisResult, audioFileName) => {
  try {
    const userRef = firebase.firestore().collection("users").doc(userId);
    const analysisRef = userRef.collection("analysisResults").doc(); // Generate new document ID

    await analysisRef.set({
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      depressionStatus: analysisResult ? "Terindikasi Depresi" : "Normal",
      suggestions: generateSuggestions(analysisResult),
      audioFileName,
    });

    return analysisRef.id; // Return the generated ID
  } catch (error) {
    console.error("Error storing analysis results:", error);
    throw error;
  }
};

// Generate suggestions based on analysis result
/**
 *  @function  generateSuggestions
 *  @description  Memilih saran yang sesuai berdasarkan hasil analisis.
 *  @param  {boolean} isDepressed - Hasil analisis (true jika terindikasi 
 *  depresi, false jika tidak).
 *  @returns {string}  Saran acak yang sesuai.
 */
async function generateSuggestions(isDepressed) {
  const suggestions = isDepressed 
    ? cachedSuggestions.depressedSuggestions
    : cachedSuggestions.notDepressedSuggestions;
  
  const randomIndex = Math.floor(Math.random() * suggestions.length);
  return suggestions[randomIndex]; 
}

//  Controller Function
/**
 *  @constant {object} audioControllers - Objek yang berisi controller untuk 
 *  menangani permintaan analisis audio.
 */
const audioControllers = {
  analyzeHandler: async (request, h) => {
    try {
      const userId = request.auth.credentials.userId;
      const audioFile = await processAudioUpload(request);
      
      //  Validation and Error Handling
      if (!isAllowedAudioFormat(audioFile.mimetype)) {
        await deleteAudioFile(audioFile.filepath);
        throw new Error("Format audio yang diupload tidak didukung.");
      }

      //  Analyze audio and handle response
      const isDepressed = await analyzeAudio(audioFile.filepath, audioFile.originalFilename);

      //  Store results in database
      const analysisId = await storeAnalysisResults(
        userId,
        isDepressed,
        audioFile.originalFilename,
      );

      return h
        .response({
          message: "Analisis selesai!",
          isDepressed,
          suggestions: generateSuggestions(isDepressed),
          analysisId,
        })
        .code(200);
    } catch (error) {
      console.error("Kesalahan analisis:", error);

      if (audioFile && audioFile.filepath) {
        await deleteAudioFile(audioFile.filepath);
        await deleteAudioFromGCS(audioFile.originalFilename);
      }

      return h
        .response({ message: "Ada kesalahan internal. Coba lagi nanti." })
        .code(500);
    }
  },
};

module.exports = audioControllers;
