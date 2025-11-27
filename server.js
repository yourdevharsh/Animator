const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");

const app = express();
const PORT = 3000;

app.use(bodyParser.json({ limit: "500mb" }));
app.use(cors());

app.use(express.static(__dirname));

const tempDir = path.join(__dirname, "temp");
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
}

app.post("/render-video", async (req, res) => {
  const { frames, fps } = req.body;
  const jobId = Date.now();
  const jobDir = path.join(tempDir, `job-${jobId}`);

  if (!frames || frames.length === 0) {
    return res.status(400).send("No frames provided");
  }

  try {
    // 1. Create a unique folder for this job
    fs.mkdirSync(jobDir);

    // 2. Save Base64 images as PNG files
    frames.forEach((base64Data, index) => {
      const data = base64Data.replace(/^data:image\/png;base64,/, "");
      const buffer = Buffer.from(data, "base64");
      const filename = `frame-${String(index).padStart(3, "0")}.png`;
      fs.writeFileSync(path.join(jobDir, filename), buffer);
    });

    const outputFilename = `animation-${jobId}.mp4`;
    const outputPath = path.join(jobDir, outputFilename);

    // 3. Use FFmpeg to stitch images
    ffmpeg()
      .input(path.join(jobDir, "frame-%03d.png"))
      .inputFPS(fps || 10)
      .output(outputPath)
      .videoCodec("libx264")
      .outputOptions([
        "-pix_fmt yuv420p",
        "-movflags +faststart",
      ])
      .on("end", () => {
        console.log("Video rendering complete:", outputPath);

        // 4. Send the file to the client
        res.download(outputPath, "my-animation.mp4", (err) => {
          // 5. Cleanup: Delete temporary folder after download or error
          try {
            fs.rmSync(jobDir, { recursive: true, force: true });
          } catch (e) {
            console.error("Error cleaning up:", e);
          }
        });
      })
      .on("error", (err) => {
        console.error("FFmpeg error:", err);
        res.status(500).send("Video generation failed");
        fs.rmSync(jobDir, { recursive: true, force: true });
      })
      .run();
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.use((req, res) => {
  if (req.method !== 'GET') return next();

  res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
