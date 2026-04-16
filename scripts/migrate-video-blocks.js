#!/usr/bin/env node
/**
 * migrate-video-blocks.js
 *
 * Converts `![video](url)` blocks in note bodies into `attachedVideo:` frontmatter.
 * No app dependencies — runs standalone against a notes directory.
 *
 * Usage: node scripts/migrate-video-blocks.js /path/to/notes-repo
 */

const fs = require("node:fs");
const path = require("node:path");

const notesDir = process.argv[2];
if (!notesDir) {
  console.error("Usage: node migrate-video-blocks.js <notes-directory>");
  process.exit(1);
}

let changed = 0;
let skipped = 0;
let errors = 0;

function walkDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(full);
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      processFile(full);
    }
  }
}

function parseFrontmatter(content) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(content);
  if (!match) return { frontmatter: null, body: content, raw: "" };
  return {
    frontmatter: match[1],
    body: content.slice(match[0].length),
    raw: match[0],
  };
}

function extractVideoBlockUrl(line) {
  const m = /^!\[.*?\]\((https?:\/\/\S+?)\)\s*$/.exec(line.trim());
  return m ? m[1] : null;
}

function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    const { frontmatter, body } = parseFrontmatter(content);

    if (frontmatter && /^attachedVideo\s*:/m.test(frontmatter)) {
      skipped++;
      return;
    }

    const bodyLines = body.split(/\r?\n/);
    const videoUrls = [];
    const filteredLines = [];

    for (const line of bodyLines) {
      const url = extractVideoBlockUrl(line);
      if (url && (url.includes("youtube.com") || url.includes("youtu.be"))) {
        videoUrls.push(url);
      } else {
        filteredLines.push(line);
      }
    }

    if (videoUrls.length === 0) {
      skipped++;
      return;
    }

    const firstUrl = videoUrls[0];

    let newFrontmatter;
    if (frontmatter !== null) {
      newFrontmatter = `---\n${frontmatter}\nattachedVideo: ${JSON.stringify(firstUrl)}\n---\n`;
    } else {
      newFrontmatter = `---\nattachedVideo: ${JSON.stringify(firstUrl)}\n---\n`;
    }

    const newContent = newFrontmatter + filteredLines.join("\n");
    fs.writeFileSync(filePath, newContent, "utf8");
    console.log(`  ✓ ${path.relative(notesDir, filePath)} — attached ${firstUrl}`);
    changed++;
  } catch (err) {
    console.error(`  ✗ ${filePath}: ${err.message}`);
    errors++;
  }
}

console.log(`Scanning ${notesDir}...`);
walkDir(notesDir);
console.log(`\nDone. Changed: ${changed}, Skipped: ${skipped}, Errors: ${errors}`);
