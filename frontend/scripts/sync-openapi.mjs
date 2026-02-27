import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const frontendDir = process.cwd();
const backendDir = path.resolve(frontendDir, '../backend');
const openapiDir = path.resolve(frontendDir, 'openapi');
const openapiPath = path.resolve(openapiDir, 'openapi.json');

if (!existsSync(openapiDir)) {
  mkdirSync(openapiDir, { recursive: true });
}

const pythonCandidates = process.platform === 'win32'
  ? [
      path.resolve(backendDir, '.venv/Scripts/python.exe'),
      path.resolve(backendDir, '.venv/Scripts/python'),
      'python',
    ]
  : [
      path.resolve(backendDir, '.venv/bin/python'),
      'python3',
      'python',
    ];

const code = [
  'import json',
  'from app.main import app',
  'print("Generating OpenAPI schema...")',
  `open(r"${openapiPath.replace(/\\/g, '\\\\')}", "w", encoding="utf-8").write(json.dumps(app.openapi(), ensure_ascii=False, indent=2))`,
].join('; ');

let lastError = null;
let generated = false;

for (const pythonBin of pythonCandidates) {
  const result = spawnSync(pythonBin, ['-c', code], {
    cwd: backendDir,
    stdio: 'inherit',
    shell: false,
  });

  if (result.status === 0) {
    generated = true;
    break;
  }

  lastError = new Error(`Failed using ${pythonBin} (exit ${result.status ?? 'unknown'})`);
}

if (!generated) {
  if (!existsSync(openapiPath)) {
    writeFileSync(openapiPath, '{}', 'utf-8');
  }
  throw lastError ?? new Error('OpenAPI schema generation failed.');
}

console.log(`OpenAPI schema written: ${openapiPath}`);
