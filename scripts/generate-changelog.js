#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Get git remote URL to construct links
let gitRemoteUrl = '';
try {
  const remoteUrl = execSync('git config --get remote.origin.url', { encoding: 'utf-8' }).trim();
  // Convert SSH to HTTPS if needed
  if (remoteUrl.startsWith('git@')) {
    gitRemoteUrl = remoteUrl
      .replace('git@github.com:', 'https://github.com/')
      .replace('git@gitlab.com:', 'https://gitlab.com/')
      .replace('.git', '');
  } else {
    gitRemoteUrl = remoteUrl.replace('.git', '');
  }
} catch (error) {
  console.warn('Could not get git remote URL, links will not be generated');
}

// Get git log
let gitLog = '';
try {
  gitLog = execSync('git log --pretty=format:"%H|%an|%ae|%ad|%s|%b" --date=iso', { encoding: 'utf-8' });
} catch (error) {
  console.warn('Warning: Could not get git log. Creating empty changelog.');
  console.warn('Error:', error.message);
  gitLog = '';
}

// Parse commits
const commits = gitLog
  .split('\n')
  .filter(line => line.trim())
  .map(line => {
    const [hash, author, email, date, subject, ...bodyParts] = line.split('|');
    const body = bodyParts.join('|').trim();
    return {
      hash: hash.trim(),
      author: author.trim(),
      email: email.trim(),
      date: new Date(date.trim()),
      subject: subject.trim(),
      body: body,
    };
  })
  .filter(commit => commit.hash && commit.subject);

// Group commits by date
const groupedByDate = commits.reduce((acc, commit) => {
  const dateKey = commit.date.toISOString().split('T')[0];
  if (!acc[dateKey]) {
    acc[dateKey] = [];
  }
  acc[dateKey].push(commit);
  return acc;
}, {});

// Sort dates descending
const sortedDates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));

// Helper function to extract links from commit message
function extractLinks(text) {
  // GitHub issue/PR patterns: #123, closes #123, fixes #123
  const issuePattern = /(?:closes?|fixes?|resolves?|refs?)\s+#(\d+)/gi;
  // URLs
  const urlPattern = /(https?:\/\/[^\s]+)/gi;
  // Commit hash references
  const commitPattern = /\b([a-f0-9]{7,40})\b/gi;
  
  const links = [];
  let match;
  
  // Extract issue references
  while ((match = issuePattern.exec(text)) !== null) {
    links.push({
      type: 'issue',
      number: match[1],
      text: match[0],
      url: gitRemoteUrl ? `${gitRemoteUrl}/issues/${match[1]}` : null,
    });
  }
  
  // Extract URLs
  while ((match = urlPattern.exec(text)) !== null) {
    links.push({
      type: 'url',
      text: match[0],
      url: match[0],
    });
  }
  
  return links;
}

// Helper function to format commit message with links
function formatCommitMessage(subject, body, hash) {
  const fullText = body ? `${subject}\n${body}` : subject;
  const links = extractLinks(fullText);
  
  let formatted = subject;
  
  // Replace issue references with links
  links.forEach(link => {
    if (link.type === 'issue' && link.url) {
      formatted = formatted.replace(
        new RegExp(link.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
        `<a href="${link.url}" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">${link.text}</a>`
      );
    }
  });
  
  // Replace URLs with links
  links.forEach(link => {
    if (link.type === 'url') {
      formatted = formatted.replace(
        link.text,
        `<a href="${link.url}" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">${link.text}</a>`
      );
    }
  });
  
  return formatted;
}

// Generate HTML
const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Changelog - Cloudflare Dashboard</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
      line-height: 1.6;
      color: #333;
      background: #fff;
      padding: 2rem;
      max-width: 1200px;
      margin: 0 auto;
    }
    @media (prefers-color-scheme: dark) {
      body {
        background: #0a0a0a;
        color: #e5e5e5;
      }
      .commit-card {
        background: #1a1a1a;
        border-color: #333;
      }
      .commit-date {
        color: #888;
      }
      .commit-author {
        color: #aaa;
      }
      .commit-hash {
        color: #666;
      }
      a {
        color: #60a5fa;
      }
      a:hover {
        color: #93c5fd;
      }
    }
    h1 {
      font-size: 2.5rem;
      margin-bottom: 0.5rem;
      font-weight: 700;
    }
    .subtitle {
      color: #666;
      margin-bottom: 3rem;
      font-size: 1rem;
    }
    @media (prefers-color-scheme: dark) {
      .subtitle {
        color: #888;
      }
    }
    .date-section {
      margin-bottom: 3rem;
    }
    .date-header {
      font-size: 1.5rem;
      font-weight: 600;
      margin-bottom: 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 2px solid #e5e5e5;
    }
    @media (prefers-color-scheme: dark) {
      .date-header {
        border-bottom-color: #333;
      }
    }
    .commits-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .commit-card {
      background: #f9f9f9;
      border: 1px solid #e5e5e5;
      border-radius: 8px;
      padding: 1.25rem;
      transition: all 0.2s;
    }
    .commit-card:hover {
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      transform: translateY(-1px);
    }
    @media (prefers-color-scheme: dark) {
      .commit-card:hover {
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      }
    }
    .commit-subject {
      font-size: 1.1rem;
      font-weight: 500;
      margin-bottom: 0.75rem;
      line-height: 1.5;
    }
    .commit-body {
      color: #666;
      margin-bottom: 0.75rem;
      white-space: pre-wrap;
      font-size: 0.95rem;
    }
    @media (prefers-color-scheme: dark) {
      .commit-body {
        color: #aaa;
      }
    }
    .commit-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      font-size: 0.875rem;
      align-items: center;
    }
    .commit-author {
      color: #666;
    }
    .commit-hash {
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      color: #999;
      font-size: 0.8rem;
    }
    .commit-hash a {
      color: inherit;
      text-decoration: none;
    }
    .commit-hash a:hover {
      text-decoration: underline;
    }
    a {
      color: #2563eb;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    .empty-state {
      text-align: center;
      padding: 3rem;
      color: #666;
    }
    @media (prefers-color-scheme: dark) {
      .empty-state {
        color: #888;
      }
    }
  </style>
</head>
<body>
  <h1>Changelog</h1>
  <p class="subtitle">History of changes and improvements</p>
  
  ${sortedDates.length === 0 
    ? '<div class="empty-state">No commits found</div>'
    : sortedDates.map(date => {
        const dateCommits = groupedByDate[date];
        const formattedDate = new Date(date).toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
        
        return `
          <div class="date-section">
            <h2 class="date-header">${formattedDate}</h2>
            <div class="commits-list">
              ${dateCommits.map(commit => {
                const commitUrl = gitRemoteUrl ? `${gitRemoteUrl}/commit/${commit.hash}` : null;
                const shortHash = commit.hash.substring(0, 7);
                const formattedMessage = formatCommitMessage(commit.subject, commit.body, commit.hash);
                const formattedTime = commit.date.toLocaleTimeString('en-US', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                });
                
                return `
                  <div class="commit-card">
                    <div class="commit-subject">${formattedMessage}</div>
                    ${commit.body ? `<div class="commit-body">${commit.body}</div>` : ''}
                    <div class="commit-meta">
                      <span class="commit-author">${commit.author}</span>
                      <span class="commit-date">${formattedTime}</span>
                      ${commitUrl 
                        ? `<span class="commit-hash"><a href="${commitUrl}" target="_blank" rel="noopener noreferrer">${shortHash}</a></span>`
                        : `<span class="commit-hash">${shortHash}</span>`
                      }
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;
      }).join('')
  }
</body>
</html>`;

// Ensure public directory exists
const publicDir = path.join(process.cwd(), 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Write HTML file
const outputPath = path.join(publicDir, 'changelog.html');
fs.writeFileSync(outputPath, html, 'utf-8');

console.log(`✓ Changelog generated: ${outputPath}`);
if (commits.length > 0) {
  console.log(`  ${commits.length} commits from ${sortedDates.length} dates`);
} else {
  console.log(`  No commits found - empty changelog generated`);
}

