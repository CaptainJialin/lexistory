import sharp from "sharp";
import { mkdir, writeFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const directory = new URL("../public/icons/", import.meta.url);
await mkdir(directory, { recursive: true });
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#294c3b"/><path d="M256 164c-35-22-79-29-125-18v191c45-10 89-4 125 19 36-23 80-29 125-19V146c-46-11-90-4-125 18Z" fill="#f4f0da"/><path d="M256 174v161M155 178c26-3 50 0 73 10M155 215c26-3 50 0 73 10M155 252c26-3 50 0 73 10" fill="none" stroke="#294c3b" stroke-width="12" stroke-linecap="round"/><path d="M293 266c-5-66 24-91 59-102 11 58-12 94-59 102Z" fill="#b7c991"/><path d="m290 297 41-96" stroke="#294c3b" stroke-width="10" stroke-linecap="round"/></svg>`;
await writeFile(new URL("icon.svg", directory), svg);
for (const [name, size] of [["icon-192",192],["icon-512",512],["maskable-512",512],["apple-touch-icon",180]]) await sharp(Buffer.from(svg)).resize(size,size).png().toFile(fileURLToPath(new URL(`${name}.png`, directory)));
const iosIcon = new URL("../ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png", import.meta.url);
if (await access(iosIcon).then(() => true, () => false)) await sharp(Buffer.from(svg)).resize(1024,1024).png().toFile(fileURLToPath(iosIcon));
for (const [density, size] of [["mdpi",48],["hdpi",72],["xhdpi",96],["xxhdpi",144],["xxxhdpi",192]]) {
  const base = new URL(`../android/app/src/main/res/mipmap-${density}/`, import.meta.url);
  if (!await access(base).then(() => true, () => false)) continue;
  for (const name of ["ic_launcher", "ic_launcher_round", "ic_launcher_foreground"]) await sharp(Buffer.from(svg)).resize(name.endsWith("foreground") ? Math.round(size * 2.25) : size).png().toFile(fileURLToPath(new URL(`${name}.png`, base)));
}
