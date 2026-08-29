const sharp = require("sharp");
const { resolve } = require("node:path");

const logoPath = resolve("public/logo/Logo_-_MJT-removebg-preview.png");
const iconsDir = resolve("public/icons");
const loginBackground = { r: 247, g: 248, b: 247, alpha: 1 }; // --color-surface-bg #f7f8f7

async function makeIcon(size, fileName, paddingRatio) {
  const padding = Math.round(size * paddingRatio);
  const maxLogo = size - padding * 2;

  const logoResized = await sharp(logoPath)
    .ensureAlpha()
    .resize({
      width: maxLogo,
      height: maxLogo,
      fit: "inside",
      withoutEnlargement: false,
    })
    .png()
    .toBuffer({ resolveWithObject: true });

  const left = Math.round((size - logoResized.info.width) / 2);
  const top = Math.round((size - logoResized.info.height) / 2);

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: loginBackground,
    },
  })
    .composite([{ input: logoResized.data, left, top }])
    .png()
    .toFile(resolve(iconsDir, fileName));

  console.log(`wrote ${fileName} (${size}x${size}, logo ${logoResized.info.width}x${logoResized.info.height})`);
}

async function main() {
  await makeIcon(192, "icon-192.png", 0.12);
  await makeIcon(512, "icon-512.png", 0.12);
  await makeIcon(512, "maskable-512.png", 0.2);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
