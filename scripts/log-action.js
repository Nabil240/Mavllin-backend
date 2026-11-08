#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const planFiles = [
  path.join(projectRoot, 'Plan.md'),
  path.join(projectRoot, 'plan.md')
];

const args = process.argv.slice(2);
const actor = args[0] || 'worker_m1_iter1_1';
const command = args[1] || 'manual-action';
const files = args[2] || 'N/A';
const rationale = args[3] || 'Milestone 1 Implementation';
const timestamp = new Date().toISOString();

const header = '\n\n## Project Action & Command Execution Log\n\n| Timestamp (UTC) | Agent / Actor | Action / Command | Scope / Files Modified | Rationale / Outcome |\n|---|---|---|---|---|';
const row = `\n| ${timestamp} | ${actor} | \`${command.replace(/`/g, "'")}\` | \`${files.replace(/`/g, "'")}\` | ${rationale.replace(/\|/g, '-')} |`;

// Ensure both files exist and are synced
const [planUpper, planLower] = planFiles;
if (fs.existsSync(planLower) && !fs.existsSync(planUpper)) {
  fs.copyFileSync(planLower, planUpper);
} else if (fs.existsSync(planUpper) && !fs.existsSync(planLower)) {
  fs.copyFileSync(planUpper, planLower);
}

for (const filePath of planFiles) {
  let content = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
  if (!content.includes('## Project Action & Command Execution Log')) {
    content += header;
  }
  content += row;
  fs.writeFileSync(filePath, content, 'utf8');
}

console.log(`[Plan.md / plan.md Synced] ${row.trim()}`);
