import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = join(__dirname, '../public/icon-original.jpg');
const iconsDir = join(__dirname, '../public/icons');
const publicDir = join(__dirname, '../public');

const sizes = [
  { file: join(iconsDir, 'icon-192.png'), size: 192 },
  { file: join(iconsDir, 'icon-512.png'), size: 512 },
  { file: join(publicDir, 'apple-touch-icon.png'), size: 180 },
];

for (const { file, size } of sizes) {
  await sharp(src).resize(size, size).png().toFile(file);
  console.log(`生成完了: ${file} (${size}x${size})`);
}
