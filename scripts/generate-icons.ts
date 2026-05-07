import sharp from "sharp";
import path from "path";
import fs from "fs";

const SIZES = [192, 512] as const;
const BG_COLOR = "#0E1116";
const ACCENT_COLOR = "#00C896";
const OUTPUT_DIR = path.join(process.cwd(), "public", "icons");

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) throw new Error(`Invalid hex color: ${hex}`);
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

function buildSvg(size: number): string {
  const bg = hexToRgb(BG_COLOR);
  const accent = hexToRgb(ACCENT_COLOR);

  // Safe area for maskable icons is center 80%
  const safeAreaPct = 0.8;
  const fontSize = Math.round(size * safeAreaPct * 0.55);
  const center = size / 2;

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="rgb(${bg.r},${bg.g},${bg.b})"/>
  <text
    x="${center}"
    y="${center}"
    text-anchor="middle"
    dominant-baseline="central"
    font-family="serif"
    font-size="${fontSize}"
    font-weight="bold"
    fill="rgb(${accent.r},${accent.g},${accent.b})"
  >&#x20B9;</text>
</svg>`.trim();
}

async function generateIcon(size: number): Promise<void> {
  const svg = Buffer.from(buildSvg(size));
  const outputPath = path.join(OUTPUT_DIR, `icon-${size}x${size}.png`);

  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(outputPath);

  console.log(`Generated ${outputPath}`);
}

async function main(): Promise<void> {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  for (const size of SIZES) {
    await generateIcon(size);
  }

  console.log("All icons generated successfully.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
