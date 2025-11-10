#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

function getCurrentVersion() {
  const pkg = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8'));
  return pkg.version;
}

function bumpVersion(currentVersion, type) {
  const [major, minor, patch] = currentVersion.split('.').map(Number);

  if (type === 'major') {
    return `${major + 1}.0.0`;
  }
  if (type === 'minor') {
    return `${major}.${minor + 1}.0`;
  }
  if (type === 'patch') {
    return `${major}.${minor}.${patch + 1}`;
  }

  // If it's a specific version string, validate it
  if (/^\d+\.\d+\.\d+$/.test(type)) {
    return type;
  }

  throw new Error(`Invalid version type: ${type}. Use 'major', 'minor', 'patch', or a specific version like '1.2.3'`);
}

function updatePackageJson(version) {
  const pkgPath = join(rootDir, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  pkg.version = version;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  return version;
}

function runCommand(command, description) {
  console.log(`\n📦 ${description}...`);
  try {
    execSync(command, { stdio: 'inherit', cwd: rootDir });
    console.log(`✅ ${description} completed`);
  } catch (error) {
    console.error(`❌ ${description} failed`);
    process.exit(1);
  }
}

function main() {
  const versionType = process.argv[2];

  if (!versionType) {
    console.error('Usage: pnpm run release [patch|minor|major|1.2.3]');
    console.error('\nExamples:');
    console.error('  pnpm run release patch    # 1.0.0 → 1.0.1');
    console.error('  pnpm run release minor    # 1.0.0 → 1.1.0');
    console.error('  pnpm run release major    # 1.0.0 → 2.0.0');
    console.error('  pnpm run release 1.2.3    # Set specific version');
    process.exit(1);
  }

  const currentVersion = getCurrentVersion();
  const newVersion = bumpVersion(currentVersion, versionType);
  const tag = `v${newVersion}`;

  console.log(`\n🚀 Releasing ${currentVersion} → ${newVersion}\n`);

  // Check for uncommitted changes
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf8', cwd: rootDir });
    if (status.trim()) {
      console.error('❌ You have uncommitted changes. Please commit or stash them first.');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Failed to check git status');
    process.exit(1);
  }

  // Check if tag already exists
  try {
    execSync(`git rev-parse -q --verify "refs/tags/${tag}"`, { stdio: 'ignore', cwd: rootDir });
    console.error(`❌ Tag ${tag} already exists`);
    process.exit(1);
  } catch (error) {
    // Tag doesn't exist, which is good
  }

  // Run quality checks before releasing
  console.log('\n🧪 Running pre-release quality checks...\n');
  runCommand('pnpm run typecheck', 'Type checking');
  runCommand('pnpm test', 'Running tests');
  runCommand('pnpm run build', 'Building package');
  console.log('\n✅ All quality checks passed!\n');

  // Update version in package.json
  updatePackageJson(newVersion);
  console.log(`✅ Updated package.json to version ${newVersion}`);

  // Commit the version bump
  runCommand(`git add package.json`, 'Staging package.json');
  runCommand(`git commit -m "chore: bump to v${newVersion}"`, 'Committing version bump');

  // Create tag
  runCommand(`git tag ${tag}`, `Creating tag ${tag}`);

  // Push commit and tag
  runCommand(`git push origin main`, 'Pushing commit to main');
  runCommand(`git push origin ${tag}`, `Pushing tag ${tag}`);

  console.log(`\n🎉 Release ${newVersion} initiated!`);
  console.log(`\n📊 Check the release workflow: https://github.com/wrannaman/redactpii-node/actions`);
  console.log(`\n📦 Package will be published as: @redactpii/node@${newVersion}`);
}

main();
