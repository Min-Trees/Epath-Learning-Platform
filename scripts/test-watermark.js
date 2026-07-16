// Test script để verify FFmpeg watermark
// Chạy: node scripts/test-watermark.js
const { spawn } = require("node:child_process");
const path = require("node:path");
const os = require("node:os");
const fs = require("node:fs/promises");

async function main() {
  // Tạo 1 file MP4 test ngắn (5s) bằng FFmpeg testsrc
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ffmpeg-test-"));
  const input = path.join(tmp, "src.mp4");
  const output = path.join(tmp, "out.mp4");

  console.log("[1] Tạo test video...");
  await new Promise((resolve, reject) => {
    const p = spawn("ffmpeg", [
      "-y",
      "-f", "lavfi",
      "-i", "testsrc=duration=5:size=640x360:rate=30",
      "-f", "lavfi",
      "-i", "sine=frequency=440:duration=5",
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-c:a", "aac",
      input,
    ]);
    p.on("close", (code) => code === 0 ? resolve() : reject(new Error("fail input")));
  });

  console.log("[2] Watermark...");
  const filterText =
    `drawtext=fontfile='C\\:/Windows/Fonts/arial.ttf':text='user@example.com - abc12345 - seg 1':` +
    `fontcolor=white@0.85:fontsize=22:` +
    `box=1:boxcolor=black@0.55:boxborderw=8:` +
    `x=20:y=H-th-30`;

  await new Promise((resolve, reject) => {
    const p = spawn("ffmpeg", [
      "-y",
      "-i", input,
      "-vf", filterText,
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-crf", "28",
      "-c:a", "copy",
      output,
    ]);
    let err = "";
    p.stderr.on("data", (d) => (err += d.toString()));
    p.on("close", (code) => {
      if (code !== 0) {
        console.error(err.slice(-1000));
        return reject(new Error("watermark fail"));
      }
      resolve();
    });
  });

  console.log(`[OK] Output: ${output}`);
  const stat = await fs.stat(output);
  console.log(`     Size: ${stat.size} bytes`);
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
