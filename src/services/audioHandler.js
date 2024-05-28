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
        return audioFile;
      }

      if (!isAllowedAudioFormat(audioFile.mimetype)) {
        fs.unlinkSync(audioFile.filepath); // Hapus file jika format tidak didukung
        return h.response({ message: "Unsupported audio format" }).code(400);
      }

      // Analisis audio
      const analysisResult = await analyzeAudio(audioFile.filepath);

      // Simpan hasil analisis ke subcollection di bawah dokumen pengguna
      const userRef = firebase.firestore().collection("users").doc(userId);
      const analysisRef = userRef.collection("analysisResults").doc();
      await analysisRef.set({
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        depressionLevel: analysisResult.depressionLevel,
        suggestions: generateSuggestions(analysisResult.depressionLevel),
        audioFileName: audioFile.originalFilename, // Opsional
      });

      return h
        .response({
          message: "Analysis complete",
          depressionLevel: analysisResult.depressionLevel,
          suggestions: generateSuggestions(analysisResult.depressionLevel),
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
        return reject(h.response({ message: "Error processing audio upload" }).code(400));
      }
      if (!files.file) {
        return reject(h.response({ message: "No audio file uploaded" }).code(400));
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
    // Baca isi file audio
    const audioData = fs.readFileSync(audioFilePath);

    // Kirim data audio ke model ML (gunakan node-fetch)
    const response = await fetch("https://your-ml-model-api-endpoint", {
      method: "POST",
      body: audioData,
      headers: { "Content-Type": "audio/wav" }, // Sesuaikan dengan format audio Anda
    });

    if (!response.ok) {
      throw new Error(`Gagal menganalisis audio. Status: ${response.status}`);
    }

    const analysisResult = await response.json();
    return analysisResult;
  } catch (error) {
    console.error("Kesalahan menganalisis audio:", error);
    throw error; // Melempar error agar ditangani oleh blok catch di tingkat atas
  }
}

function generateSuggestions(depressionLevel) {
  const suggestions = {
    high: [
      "Cari bantuan profesional segera. Hasil Anda menunjukkan risiko depresi yang tinggi. Sangat penting untuk berkonsultasi dengan ahli kesehatan mental secepat mungkin.",
      "Bicarakan dengan teman atau anggota keluarga yang dipercaya. Berbagi perasaan Anda dapat memberikan bantuan dan dukungan yang berharga.",
      "Pertimbangkan untuk bergabung dengan kelompok dukungan. Terhubung dengan orang lain yang mengalami tantangan serupa dapat sangat membantu.",
      "Utamakan self-care. Luangkan waktu untuk melakukan kegiatan yang Anda nikmati dan yang membawa kebahagiaan. Ini bisa mencakup olahraga, menghabiskan waktu di alam, atau mengikuti hobi.",
      "Hindari isolasi. Usahakan untuk menghabiskan waktu bersama orang yang Anda cintai atau ikut dalam kegiatan sosial.",
    ],
    medium: [
      "Pantau suasana hati Anda secara teratur. Perhatikan setiap perubahan dalam suasana hati atau tingkat energi Anda.",
      "Praktikkan teknik relaksasi. Lakukan kegiatan seperti pernapasan dalam, meditasi, atau yoga untuk mengurangi stres dan kecemasan.",
      "Jaga gaya hidup sehat. Makan makanan seimbang, cukup tidur, dan berolahraga secara teratur.",
      "Pertimbangkan untuk berbicara dengan seorang terapis. Meskipun Anda tidak mengalami depresi yang parah, terapi dapat menjadi alat berharga untuk mengelola stres dan meningkatkan kesejahteraan secara keseluruhan.",
      "Jelajahi sumber daya online dan komunitas dukungan. Ada banyak sumber daya online yang dapat memberikan informasi dan dukungan untuk mengelola depresi.",
    ],
    low: [
      "Terus utamakan self-care. Fokuslah pada menjaga kebiasaan sehat dan melakukan kegiatan yang membawa kebahagiaan.",
      "Tetap terhubung dengan orang yang Anda cintai. Usahakan untuk merawat hubungan Anda dan menjaga sistem dukungan yang kuat.",
      "Pantau suasana hati Anda dan cari bantuan jika diperlukan. Jika Anda melihat perubahan dalam suasana hati atau tingkat energi Anda, jangan ragu untuk mencari bantuan dari profesional kesehatan.",
      "Pertimbangkan untuk menggabungkan praktik kesadaran. Latihan kesadaran dapat membantu Anda tetap berada dalam momen sekarang dan mengurangi stres.",
      "Pelajari tentang keterampilan mengatasi. Kembangkan cara yang sehat untuk mengatasi tantangan dan kemunduran dalam hidup.",
    ],
  };

  return suggestions[depressionLevel] || ["Kami tidak dapat memberikan saran khusus saat ini. Silakan berkonsultasi dengan ahli kesehatan mental untuk panduan yang personal."];
}
