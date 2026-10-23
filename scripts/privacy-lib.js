import { readdir, readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { gunzip } from 'node:zlib';
import { loadBuildEnv } from '../apps/web/build-env.js';

const gunzipAsync = promisify(gunzip);
const ignoredDirectories = new Set(['node_modules', '.git', '.turbo', '.firebase', 'dist']);
const base64Run = /[0-9A-Za-z+/_-]{80,}={0,2}/gu;
const firebaseApiKey = /AIza[0-9A-Za-z_-]{35}/gu;

class PrivacyViolation extends Error {}

function outputName(value) {
  return value.split(path.sep).join('/');
}

function reject(file, rule) {
  throw new PrivacyViolation(`Privacy gate rejected build output: ${outputName(file)} (rule: ${rule})`);
}

async function outputFilesUnder(directory, outputRoot) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    reject('<build>', 'missing-output');
  }

  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    const relative = path.relative(outputRoot, fullPath);
    if (entry.isSymbolicLink()) reject(relative, 'symbolic-link');
    if (entry.isDirectory()) files.push(...await outputFilesUnder(fullPath, outputRoot));
    else if (entry.isFile()) files.push(fullPath);
  }
  return files;
}

// Private material is often kept elsewhere and linked in, so private trees follow links, unlike the build output.
// A dangling link holds nothing to leak; any other failure fails the scan.
async function linkTarget(fullPath, entry) {
  if (!entry.isSymbolicLink()) return entry;
  try {
    return await stat(fullPath);
  } catch (error) {
    if (error?.code === 'ENOENT') return undefined;
    throw error;
  }
}

async function privateFilesUnder(directory, visited) {
  const real = await realpath(directory);
  if (visited.has(real)) return [];
  visited.add(real);

  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    const target = await linkTarget(fullPath, entry);
    if (target?.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) files.push(...await privateFilesUnder(fullPath, visited));
    } else if (target?.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

async function findPrivateFiles(root) {
  const privateFiles = [];
  const visited = new Set();

  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (ignoredDirectories.has(entry.name)) continue;
      const fullPath = path.join(directory, entry.name);
      if (entry.name.toLowerCase() === 'private') {
        const target = await linkTarget(fullPath, entry);
        if (target?.isDirectory()) privateFiles.push(...await privateFilesUnder(fullPath, visited));
      } else if (entry.isDirectory()) {
        await visit(fullPath);
      }
    }
  }

  await visit(root);
  return privateFiles;
}

function markerRule(text, configuredApiKey) {
  if (/(?:^|[\\/])private(?:[\\/]|$)/iu.test(text)) return 'private-path';
  if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/u.test(text)) return 'private-key-header';
  if (/iam\.gserviceaccount\.com/iu.test(text)) return 'service-account-domain';
  if (/\bprivate_key_id\b/iu.test(text)) return 'private-key-id';
  if (/(?:["']private_key["']|\bprivate_key\b)\s*:/iu.test(text)) return 'private-key-field';
  if (/(?:["']service_account["']|\bservice_account\b)\s*:/iu.test(text) ||
    /(?:["']type["']|\btype\b)\s*:\s*["']service_account["']/iu.test(text)) {
    return 'service-account-field';
  }
  if (/(?:ghp_|gho_|ghu_|ghs_|ghr_|github_pat_)/u.test(text)) return 'github-token';
  if (/GOCSPX-/u.test(text)) return 'google-oauth-token';

  for (const match of text.matchAll(firebaseApiKey)) {
    if (!configuredApiKey || match[0] !== configuredApiKey) return 'firebase-api-key';
  }
  return undefined;
}

function decodedBase64Rule(text, configuredApiKey) {
  for (const match of text.matchAll(base64Run)) {
    const normalized = match[0].replaceAll('-', '+').replaceAll('_', '/');
    const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
    const decoded = Buffer.from(normalized + padding, 'base64').toString('utf8');
    const rule = markerRule(decoded, configuredApiKey);
    if (rule) return `base64-${rule}`;
  }
  return undefined;
}

function scanBytes(bytes, configuredApiKey, privateContents) {
  const text = bytes.toString('utf8');
  const directRule = markerRule(text, configuredApiKey);
  if (directRule) return directRule;

  const encodedRule = decodedBase64Rule(text, configuredApiKey);
  if (encodedRule) return encodedRule;

  if (privateContents.some((content) => bytes.includes(content))) return 'private-file-copy';
  return undefined;
}

export async function checkPrivacy(root, env) {
  const output = path.join(root, 'apps/web/dist');

  try {
    const outputFiles = await outputFilesUnder(output, output);
    if (!outputFiles.length) reject('<build>', 'empty-output');

    const privateFiles = await findPrivateFiles(root);
    const privateContents = (await Promise.all(privateFiles.map((file) => readFile(file))))
      .filter((content) => content.length >= 32);
    const configuredApiKey = (env ?? loadBuildEnv(path.join(root, 'apps/web'))).VITE_FIREBASE_API_KEY;

    for (const file of outputFiles) {
      const relative = path.relative(output, file);
      if (/(?:^|[\\/])private(?:[\\/]|$)/iu.test(relative)) reject(relative, 'private-path');

      let bytes;
      try {
        bytes = await readFile(file);
      } catch {
        reject(relative, 'read-error');
      }

      const rule = scanBytes(bytes, configuredApiKey, privateContents);
      if (rule) reject(relative, rule);

      if (file.toLowerCase().endsWith('.gz')) {
        let expanded;
        try {
          expanded = await gunzipAsync(bytes);
        } catch {
          reject(relative, 'invalid-gzip');
        }
        const expandedRule = scanBytes(expanded, configuredApiKey, privateContents);
        if (expandedRule) reject(relative, `gzip-${expandedRule}`);
      }
    }
    return outputFiles.length;
  } catch (error) {
    if (error instanceof PrivacyViolation) throw error;
    reject('<build>', 'scan-error');
  }
}
