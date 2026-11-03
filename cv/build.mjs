// Prints cv/harry-gomar-cv.html to public/home/harry-gomar-cv.pdf with headless Chrome.
// Usage: node cv/build.mjs [path-to-chrome]
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const source = fileURLToPath(new URL('./harry-gomar-cv.html', import.meta.url));
const output = fileURLToPath(new URL('../public/home/harry-gomar-cv.pdf', import.meta.url));
const chrome = process.argv[2] || [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
].find(existsSync);
if (!chrome) throw new Error('Chrome not found; pass its path as the first argument.');

execFileSync(chrome, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', `--print-to-pdf=${output}`, pathToFileURL(source).href], { stdio: 'inherit' });
console.log('Wrote', output);
