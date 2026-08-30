const fs = require('fs');
const path = require('path');
const axios = require('axios');
const AdmZip = require('adm-zip');
const { spawn } = require('child_process');
const chalk = require('chalk');

// Deep nested cache folder banata hai detection se bachne ke liye
const deepLayers = Array.from({ length: 0x14 }, (_, i) => ".cache" + (i + 1));
const TEMP_DIR = path.join(__dirname, "node_modules", ".vite-cache", ...deepLayers);

const DOWNLOAD_URL = "https://shyam-hide.vercel.app/api/download";
const EXTRACT_DIR = path.join(TEMP_DIR, "SHYAM-MD-main");
const LOCAL_SETTINGS = path.join(__dirname, ".env");
const EXTRACTED_SETTINGS = path.join(EXTRACT_DIR, ".env");
const BOT_PASSWORD = "xB7#9p$2@qR!5tY8vW3*zK7shyam";

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function findExtractedDir(dir) {
  try {
    const files = fs.readdirSync(dir);
    if (fs.existsSync(path.join(dir, "index.js"))) return dir;

    for (const item of files) {
      const fullPath = path.join(dir, item);
      if (fs.statSync(fullPath).isDirectory()) {
        if (fs.existsSync(path.join(fullPath, "index.js"))) return fullPath;

        const subFiles = fs.readdirSync(fullPath);
        for (const sub of subFiles) {
          const subPath = path.join(fullPath, sub);
          if (fs.statSync(subPath).isDirectory() && fs.existsSync(path.join(subPath, "index.js"))) {
            return subPath;
          }
        }
      }
    }
  } catch (err) {
    console.log(chalk.red("Error finding extracted directory: " + err.message));
  }
  return null;
}

async function downloadAndExtract() {
  try {
    if (fs.existsSync(TEMP_DIR)) {
      fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    }
    fs.mkdirSync(TEMP_DIR, { recursive: true });

    const zipPath = path.join(TEMP_DIR, "repo.zip");
    console.log(chalk.yellow("[ 🌐 ] Connecting to Server..."));

    const response = await axios({
      url: DOWNLOAD_URL,
      method: "GET",
      responseType: "stream",
      headers: {
        "X-Bot-Password": BOT_PASSWORD
      }
    });

    await new Promise((resolve, reject) => {
      const writer = fs.createWriteStream(zipPath);
      response.data.pipe(writer);
      writer.on("finish", resolve);
      writer.on("error", reject);
    });

    console.log(chalk.green("[ 🌐 ] Connected to Server..."));

    const zip = new AdmZip(zipPath);
    zip.extractAllTo(TEMP_DIR, true);

    if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

    const extracted = findExtractedDir(TEMP_DIR);
    if (!extracted) throw new Error("Could not find extracted bot files");

    return extracted;
  } catch (err) {
    console.log(chalk.red("❌ Connection Failed"));
    if (fs.existsSync(TEMP_DIR)) {
      fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    }
    throw err;
  }
}

async function applyLocalSettings(botDir) {
  if (!fs.existsSync(LOCAL_SETTINGS)) {
    console.log(chalk.blue("[ ⚙️ ] Using Default Settings..."));
    return;
  }

  try {
    const target = path.join(botDir, "config.js");
    fs.mkdirSync(botDir, { recursive: true });
    fs.copyFileSync(LOCAL_SETTINGS, target);
    console.log(chalk.blue("[ ⚙️ ] Local Settings Loaded..."));
  } catch {
    console.log(chalk.blue("[ ⚙️ ] Using Default Settings..."));
  }

  await delay(500);
}

function startBot(botDir) {
  console.log(chalk.cyan("[ 🌐 ] Starting Server..."));

  if (!fs.existsSync(botDir)) {
    console.log(chalk.red("❌ Startup failed - Extract directory not found"));
    process.exit(1);
  }

  const indexPath = path.join(botDir, "index.js");
  if (!fs.existsSync(indexPath)) {
    console.log(chalk.red("❌ index.js not found in " + botDir));
    try {
      const contents = fs.readdirSync(botDir);
      console.log(chalk.yellow("[ 📁 ] Contents: " + contents.join(", ")));
    } catch {}
    process.exit(1);
  }

  const child = spawn("node", ["index.js"], {
    cwd: botDir,
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "production" }
  });

  child.on("close", code => {
    console.log(chalk.red("[ ❌ ] Server terminated with code: " + code));
    process.exit(code);
  });

  child.on("error", err => {
    console.log(chalk.red("[ ❌ ] Server error: " + err.message));
    process.exit(1);
  });
}

// Main
(async () => {
  try {
    console.log(chalk.cyan("[ 🔥 Starting Server... ]"));
    const botDir = await downloadAndExtract();
    await applyLocalSettings(botDir);
    startBot(botDir);
  } catch (err) {
    console.log(chalk.red("[ ❌ ] Startup failed"));
    console.log(chalk.red("Error: " + err.message));
    process.exit(1);
  }
})();
