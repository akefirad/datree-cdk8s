const axios = require('axios').default;
const fs = require('fs');
const { pipeline } = require('stream/promises');
const unzipper = require('unzipper');
const pjson = require('./package.json');
const spawn = require('child_process').spawn;

const BIN_PATH = './bin';
const TARGET_FILE_PATH = `${BIN_PATH}/datree.zip`;

async function getDatreeLatestRelease(datreeVersion) {
  const url = `https://api.github.com/repos/datreeio/datree/releases/tags/${datreeVersion}`;
  console.log(`🌳 Getting latest release from ${url}`);

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'nodejs',
        Accept: 'application/vnd.github.v3+json',
      },
    });
    console.log('1', response);
    if (response.status === 200) {
      console.log(`🌳 Latest release: ${response.data.tag_name}`);
      const platform = process.platform;
      const isWin = platform === 'win32';
      let arch = process.arch;

      if (isWin) {
        const child = spawn('powershell.exe', ['./windows/get_arch.ps1']);
        child.stdout.on('data', function (data) {
          arch = data;
        });
        child.stderr.on('data', function (data) {
          throw new Error(data);
        });
        child.stdin.end();
      }
      console.log('2', response);
      const assets = response.data.assets;
      console.log('3', assets);
      const matchUrl = assets.find((asset) => {
        const browser_download_url = asset.browser_download_url.toLowerCase();
        return (
          browser_download_url.includes(platform) &&
          browser_download_url.includes(arch)
        );
      });
      return matchUrl.browser_download_url;
    }
  } catch (error) {
    throw new Error(`🌳 Failed to get latest release: ${error}`);
  }
}

async function downloadFile(url, targetFile) {
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream',
  });

  const writeStream = fs.createWriteStream(targetFile);
  await pipeline(response.data, writeStream);

  return response.status;
}

async function unzipDatreeInDir(targetFile) {
  console.log('🌳 Unzipping datree...');

  try {
    const unzipResult = await fs
      .createReadStream(targetFile)
      .pipe(unzipper.Extract({ path: BIN_PATH }))
      .promise('close');

    const files = fs.readdirSync(BIN_PATH);
    files.forEach((file) => {
      if (file !== 'datree') {
        fs.unlinkSync(`${BIN_PATH}/${file}`);
      }
    });

    return unzipResult;
  } catch (error) {
    throw new Error(`🌳 Failed to get unzip datree in dir: ${error}`);
  }
}

async function downloadDatree() {
  const datreeVersion = pjson.datree_version || 'latest';
  fs.existsSync('bin') || fs.mkdirSync('bin');

  const downloadUrl = await getDatreeLatestRelease(datreeVersion);
  console.log(`🌳 Downloading datree from ${downloadUrl}`);

  const downloadResult = await downloadFile(downloadUrl, TARGET_FILE_PATH);
  console.log(`🌳 Download result: ${downloadResult}`);
  if (downloadResult === 200) {
    await unzipDatreeInDir(TARGET_FILE_PATH);
    console.log('🌳 datree downloaded successfully');
  } else {
    console.log('🌳 Failed to download datree');
  }
}

downloadDatree();
