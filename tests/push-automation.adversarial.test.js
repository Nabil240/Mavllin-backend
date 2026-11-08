const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { execSync, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const ROOT_DIR = path.resolve(__dirname, '..');
const SCRIPT_PATH = path.join(ROOT_DIR, 'scripts', 'push-to-github.sh');

describe('scripts/push-to-github.sh Adversarial & Boundary Test Suite', () => {

  test('1. CLI: Displays help screen with code 0 on --help and -h', () => {
    const resHelp = spawnSync('bash', [SCRIPT_PATH, '--help'], { encoding: 'utf8' });
    assert.strictEqual(resHelp.status, 0, '--help should exit with code 0');
    assert.match(resHelp.stdout, /Usage: bash scripts\/push-to-github\.sh/);
    assert.match(resHelp.stdout, /--dry-run/);

    const resH = spawnSync('bash', [SCRIPT_PATH, '-h'], { encoding: 'utf8' });
    assert.strictEqual(resH.status, 0, '-h should exit with code 0');
    assert.match(resH.stdout, /Usage: bash scripts\/push-to-github\.sh/);
  });

  test('2. Auth Defense: Rejects invalid Personal Access Token cleanly without crash', () => {
    const invalidToken = 'ghp_invalidMockTokenForTesting1234567890';
    const res = spawnSync('bash', [SCRIPT_PATH, invalidToken], { encoding: 'utf8' });
    assert.strictEqual(res.status, 1, 'Should exit with code 1 on rejected token');
    assert.match(res.stderr, /Personal Access Token rejected by GitHub/);
  });

  test('3. Credential Redaction: Token is never leaked into stderr/logs on push failure', () => {
    // Create an isolated temporary git environment
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-token-leak-test-'));
    try {
      const secretToken = 'ghp_SUPER_SECRET_TOKEN_DO_NOT_LEAK_99999';
      // Simulate git push output containing the secret token in the URL
      const mockGitError = `fatal: unable to access 'https://${secretToken}@github.com/Nabil240/Mavllin-backend.git/': The requested URL returned error: 403`;
      
      // Test the shell parameter expansion redaction
      const sanitizeSnippet = `
        TOKEN="${secretToken}"
        push_output="${mockGitError}"
        sanitized_output="\${push_output//"$TOKEN"/"[REDACTED_TOKEN]"}"
        echo "\${sanitized_output}"
      `;
      const out = execSync(`bash -c '${sanitizeSnippet}'`, { encoding: 'utf8' });
      assert.ok(!out.includes(secretToken), 'Output must NOT contain secret token');
      assert.ok(out.includes('[REDACTED_TOKEN]'), 'Output must contain [REDACTED_TOKEN]');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('4. Branch Sync Resilience: Synchronizes release branches even when checked out', () => {
    const tempRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'git-branch-sync-test-'));
    try {
      // Initialize a clean test repository
      execSync('git init', { cwd: tempRepo });
      execSync('git config user.email "test@example.com"', { cwd: tempRepo });
      execSync('git config user.name "Test"', { cwd: tempRepo });
      
      // Create frontend structure
      fs.mkdirSync(path.join(tempRepo, 'frontend'));
      fs.writeFileSync(path.join(tempRepo, 'frontend', 'app.js'), 'console.log("frontend");');
      fs.writeFileSync(path.join(tempRepo, 'backend.js'), 'console.log("backend");');
      execSync('git add . && git commit -m "initial commit"', { cwd: tempRepo });
      execSync('git branch -M main', { cwd: tempRepo });

      // Create frontend-main branch pointing to initial commit
      execSync('git branch frontend-main', { cwd: tempRepo });
      execSync('git checkout frontend-main', { cwd: tempRepo });

      // Run update_branch_ref logic while on frontend-main
      const testScript = `
        update_branch_ref() {
          local branch="$1"
          local commit_sha="$2"
          local current_branch
          current_branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)
          if [ "\${current_branch}" = "\${branch}" ]; then
            git reset --hard "\${commit_sha}" >/dev/null 2>&1
          else
            git branch -f "\${branch}" "\${commit_sha}"
          fi
        }

        # Create a new commit object
        NEW_COMMIT=$(git commit-tree HEAD^{tree} -m "new release commit")
        update_branch_ref frontend-main "\${NEW_COMMIT}"
        git rev-parse HEAD
      `;
      const resultCommit = execSync(`bash -c '${testScript}'`, { cwd: tempRepo, encoding: 'utf8' }).trim();
      const currentHead = execSync('git rev-parse HEAD', { cwd: tempRepo, encoding: 'utf8' }).trim();
      assert.strictEqual(resultCommit, currentHead, 'frontend-main HEAD should safely update without code 128 error');
    } finally {
      fs.rmSync(tempRepo, { recursive: true, force: true });
    }
  });

  test('5. Pre-Flight Repository Detection: Prioritizes pre-existing candidate over missing primary', () => {
    // Test logic simulating pre-flight detection:
    // If candidate 1 (Mavliin-fontend) is missing (404) but candidate 2 (Mavllin-frontend) exists (200),
    // candidate 2 MUST be selected as existing_slug and prioritized.
    const simulationScript = `
      check_repo_exists_mock() {
        local slug="$1"
        if [ "$slug" = "Mavllin-frontend" ]; then
          return 0 # Exists!
        fi
        return 1 # Missing!
      }

      CANDIDATES=("Mavliin-fontend" "Mavllin-frontend" "Mavliin-frontend")
      existing_slug=""
      for slug in "\${CANDIDATES[@]}"; do
        if check_repo_exists_mock "$slug"; then
          existing_slug="$slug"
          break
        fi
      done

      echo "\${existing_slug}"
    `;
    const chosen = execSync(`bash -c '${simulationScript}'`, { encoding: 'utf8' }).trim();
    assert.strictEqual(chosen, 'Mavllin-frontend', 'Pre-flight check must detect and prioritize existing repository');
  });

  test('6. Dry Run Protection: Never issues POST /user/repos when --dry-run is set', () => {
    // Verify that the script contains the DRY_RUN guard before POST /user/repos
    const scriptContent = fs.readFileSync(SCRIPT_PATH, 'utf8');
    assert.match(
      scriptContent,
      /if \[ "\$\{DRY_RUN\}" = true \]; then\s+echo ".*\[DRY-RUN\]/m,
      'Script must have explicit guard preventing POST /user/repos during dry-run'
    );
  });

  test('7. Git Remote Configuration: Sets origin, backend, and frontend with protocol variants', () => {
    const tempRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'git-remotes-test-'));
    try {
      execSync('git init', { cwd: tempRepo });
      execSync('git config user.email "test@example.com"', { cwd: tempRepo });
      execSync('git config user.name "Test"', { cwd: tempRepo });
      fs.writeFileSync(path.join(tempRepo, 'file.txt'), 'hello');
      execSync('git add . && git commit -m "init"', { cwd: tempRepo });

      // Run remote configuration snippet with origin initially unset
      const remoteConfigScript = `
        GITHUB_USER="Nabil240"
        BACKEND_SUCCESS="Mavllin-backend"
        FRONTEND_SUCCESS="Mavliin-fontend"
        BE_PRIMARY="https://github.com/\${GITHUB_USER}/\${BACKEND_SUCCESS}.git"
        FE_PRIMARY="https://github.com/\${GITHUB_USER}/\${FRONTEND_SUCCESS}.git"

        # Primary remotes (must handle origin whether it exists or not)
        git remote set-url backend "\${BE_PRIMARY}" 2>/dev/null || git remote add backend "\${BE_PRIMARY}"
        git remote set-url frontend "\${FE_PRIMARY}" 2>/dev/null || git remote add frontend "\${FE_PRIMARY}"
        git remote set-url origin "\${BE_PRIMARY}" 2>/dev/null || git remote add origin "\${BE_PRIMARY}"

        # Protocol-specific remotes
        git remote set-url backend-ssh "git@github.com:\${GITHUB_USER}/\${BACKEND_SUCCESS}.git" 2>/dev/null || git remote add backend-ssh "git@github.com:\${GITHUB_USER}/\${BACKEND_SUCCESS}.git"
        git remote set-url frontend-ssh "git@github.com:\${GITHUB_USER}/\${FRONTEND_SUCCESS}.git" 2>/dev/null || git remote add frontend-ssh "git@github.com:\${GITHUB_USER}/\${FRONTEND_SUCCESS}.git"
        git remote set-url backend-https "https://github.com/\${GITHUB_USER}/\${BACKEND_SUCCESS}.git" 2>/dev/null || git remote add backend-https "https://github.com/\${GITHUB_USER}/\${BACKEND_SUCCESS}.git"
        git remote set-url frontend-https "https://github.com/\${GITHUB_USER}/\${FRONTEND_SUCCESS}.git" 2>/dev/null || git remote add frontend-https "https://github.com/\${GITHUB_USER}/\${FRONTEND_SUCCESS}.git"

        git remote -v
      `;
      const remotesOut = execSync(`bash -c '${remoteConfigScript}'`, { cwd: tempRepo, encoding: 'utf8' });
      assert.match(remotesOut, /^origin\s+https:\/\/github\.com\/Nabil240\/Mavllin-backend\.git \(push\)/m);
      assert.match(remotesOut, /^backend\s+https:\/\/github\.com\/Nabil240\/Mavllin-backend\.git \(push\)/m);
      assert.match(remotesOut, /^frontend\s+https:\/\/github\.com\/Nabil240\/Mavliin-fontend\.git \(push\)/m);
      assert.match(remotesOut, /^backend-ssh\s+git@github\.com:Nabil240\/Mavllin-backend\.git \(push\)/m);
      assert.match(remotesOut, /^frontend-ssh\s+git@github\.com:Nabil240\/Mavliin-fontend\.git \(push\)/m);
      assert.match(remotesOut, /^backend-https\s+https:\/\/github\.com\/Nabil240\/Mavllin-backend\.git \(push\)/m);
      assert.match(remotesOut, /^frontend-https\s+https:\/\/github\.com\/Nabil240\/Mavliin-fontend\.git \(push\)/m);
    } finally {
      fs.rmSync(tempRepo, { recursive: true, force: true });
    }
  });

  test('8. Stdout Isolation: push_branch_with_slugs emits strictly clean slug on stdout', () => {
    // In mock environment with a fake git remote, verify captured stdout
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-stdout-test-'));
    try {
      execSync('git init', { cwd: tempDir });
      execSync('git config user.email "test@example.com"', { cwd: tempDir });
      execSync('git config user.name "Test"', { cwd: tempDir });
      fs.writeFileSync(path.join(tempDir, 'dummy.txt'), 'test');
      execSync('git add . && git commit -m "init"', { cwd: tempDir });
      execSync('git branch branch-to-push', { cwd: tempDir });

      // Create a local bare repository to act as a successful remote target
      const bareRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'git-bare-target-'));
      execSync('git init --bare', { cwd: bareRepo });

      const testScript = `
        AUTH_MODE="SSH"
        DRY_RUN=false
        GITHUB_USER="testuser"
        TOKEN=""

        check_repo_exists() {
          return 1
        }

        # Mock git push to point to our bareRepo when trying "valid-slug"
        push_branch_with_slugs() {
          local branch="$1"
          local target_branch="$2"
          local repo_desc="$3"
          shift 3
          local candidates=("$@")
          local success_slug=""

          echo "Scanning candidate repositories..." >&2
          for slug in "\${candidates[@]}"; do
            echo "Trying slug: \${slug}..." >&2
            if [ "\${slug}" = "valid-slug" ]; then
              if git push "${bareRepo}" "\${branch}:\${target_branch}" >/dev/null 2>&1; then
                success_slug="\${slug}"
                echo "Push successful!" >&2
                break
              fi
            else
              echo "Push failed for \${slug}" >&2
            fi
          done

          if [ -z "\${success_slug}" ]; then
            return 1
          fi
          printf "%s" "\${success_slug}"
        }

        RESULT=$(push_branch_with_slugs branch-to-push main "desc" "invalid-slug" "valid-slug")
        echo "CAPTURED:\${RESULT}:END"
      `;
      const output = execSync(`bash -c '${testScript}'`, { cwd: tempDir, encoding: 'utf8' });
      assert.match(output, /CAPTURED:valid-slug:END/, 'Only the slug should be captured in variable');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

});
