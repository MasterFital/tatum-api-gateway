import { getUncachableGitHubClient, getAuthenticatedUser } from '../server/lib/github';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const REPO_NAME = 'tatum-api-gateway';
const REPO_DESCRIPTION = 'Enterprise-grade blockchain API gateway supporting 130+ blockchains with multi-tenant architecture, tier-based billing, and Tatum API integration';

async function pushToGitHub() {
  console.log('Getting GitHub user info...');
  const user = await getAuthenticatedUser();
  console.log(`Authenticated as: ${user.login}`);

  const octokit = await getUncachableGitHubClient();
  
  let repoExists = false;
  let repoUrl = '';
  
  try {
    const { data: existingRepo } = await octokit.repos.get({
      owner: user.login,
      repo: REPO_NAME,
    });
    repoExists = true;
    repoUrl = existingRepo.html_url;
    console.log(`Repository already exists: ${repoUrl}`);
  } catch (error: any) {
    if (error.status === 404) {
      console.log('Creating new repository...');
      const { data: newRepo } = await octokit.repos.createForAuthenticatedUser({
        name: REPO_NAME,
        description: REPO_DESCRIPTION,
        private: false,
        auto_init: false,
      });
      repoUrl = newRepo.html_url;
      console.log(`Repository created: ${repoUrl}`);
    } else {
      throw error;
    }
  }

  const gitignoreContent = `# Dependencies
node_modules/
.pnpm-store/

# Build outputs
dist/
build/

# Environment files
.env
.env.local
.env.*.local

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*

# Replit specific
.replit
replit.nix
.upm/
.cache/
.config/
.local/

# Test files
*.zip

# Temporary files
/tmp/
`;

  fs.writeFileSync('.gitignore', gitignoreContent);
  console.log('Updated .gitignore');

  const accessToken = await getAccessTokenForGit();
  const remoteUrl = `https://${user.login}:${accessToken}@github.com/${user.login}/${REPO_NAME}.git`;

  try {
    execSync('git init', { stdio: 'inherit' });
    
    try {
      execSync('git remote remove origin', { stdio: 'pipe' });
    } catch {}
    
    execSync(`git remote add origin ${remoteUrl}`, { stdio: 'inherit' });
    
    execSync('git add -A', { stdio: 'inherit' });
    
    execSync('git commit -m "Initial commit: Tatum API Gateway with security hardening"', { stdio: 'inherit' });
    
    execSync('git branch -M main', { stdio: 'inherit' });
    
    console.log('Pushing to GitHub...');
    execSync('git push -u origin main --force', { stdio: 'inherit' });
    
    console.log('\n========================================');
    console.log('SUCCESS! Code pushed to GitHub');
    console.log(`Repository URL: ${repoUrl}`);
    console.log('========================================');
    console.log('\nNext steps:');
    console.log('1. Go to https://vercel.com');
    console.log('2. Click "Add New Project"');
    console.log('3. Import from GitHub: ' + REPO_NAME);
    console.log('4. Configure environment variables');
    console.log('5. Deploy!');
    
  } catch (error) {
    console.error('Git error:', error);
    throw error;
  }
}

async function getAccessTokenForGit(): Promise<string> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found');
  }

  const response = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  );
  
  const data = await response.json();
  const connectionSettings = data.items?.[0];
  
  return connectionSettings?.settings?.access_token || connectionSettings?.settings?.oauth?.credentials?.access_token;
}

pushToGitHub().catch(console.error);
