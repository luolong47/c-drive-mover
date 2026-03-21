import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const type = process.argv[2] || 'patch'; // "patch" or "minor"

// Update package.json
const pkgPath = path.resolve(projectRoot, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

const versionParts = pkg.version.split('.').map(Number);
if (type === 'minor') {
  versionParts[1] += 1;
  versionParts[2] = 0; // reset patch to 0
} else {
  versionParts[2] += 1;
}
const newVersion = versionParts.join('.');

console.log(`Bumping version from ${pkg.version} to ${newVersion} (${type})`);

pkg.version = newVersion;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');

// Update tauri.conf.json
const tauriConfPath = path.resolve(projectRoot, 'src-tauri', 'tauri.conf.json');
if (fs.existsSync(tauriConfPath)) {
  const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
  tauriConf.version = newVersion;
  fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + '\n', 'utf8');
}

// Update Cargo.toml
const cargoTomlPath = path.resolve(projectRoot, 'src-tauri', 'Cargo.toml');
if (fs.existsSync(cargoTomlPath)) {
  let cargoToml = fs.readFileSync(cargoTomlPath, 'utf8');
  cargoToml = cargoToml.replace(/^version\s*=\s*".*?"/m, `version = "${newVersion}"`);
  fs.writeFileSync(cargoTomlPath, cargoToml, 'utf8');
}

console.log('Successfully synced version to package.json, tauri.conf.json, and Cargo.toml.');
