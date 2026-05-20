const fs = require('fs');
const path = require('path');
const os = require('os');

// --- CONFIGURATION ---
const outputFile = path.join(os.homedir(), 'project-codebase.txt');
const ignoreDirs = ['node_modules', '.git', '.github', 'dist', 'build', '.next', '.idea', '.vscode']; 
const ignoreExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.pdf', '.zip', '.mp4', '.mov'];
// ---------------------

let fileStructureLog = [];
let textFilesQueue = [];

function scanAndQueueFiles(dir) {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        const relativePath = path.relative(process.cwd(), filePath);

        if (stat.isDirectory()) {
            if (!ignoreDirs.includes(file)) {
                scanAndQueueFiles(filePath); 
            }
        } else {
            const ext = path.extname(file).toLowerCase();
            
            if (filePath !== outputFile && file !== 'bundle.js') {
                if (ignoreExtensions.includes(ext)) {
                    // Log the location of the skipped file for Claude's map
                    fileStructureLog.push(`[Skipped Binary File] ${relativePath}`);
                } else {
                    // Log the text file and queue it for full content bundling
                    fileStructureLog.push(`[Included Text File]   ${relativePath}`);
                    textFilesQueue.push({ filePath, relativePath, ext });
                }
            }
        }
    });
}

// Clear old file if it exists
if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);

console.log('Scanning project directories...');
scanAndQueueFiles('.');

// 1. Write the Directory Structure Map first so it sits at the top of the file
fs.writeFileSync(outputFile, `=== PROJECT DIRECTORY MAP ===\n`);
fs.appendFileSync(outputFile, `The following is a complete map of all files found in the project directory.\n`);
fs.appendFileSync(outputFile, `Note: Non-text binary files (like PDFs or images) are mapped but their raw content was stripped to save context space.\n\n`);
fs.appendFileSync(outputFile, fileStructureLog.join('\n') + `\n\n=========================================\n\n`);

console.log(`Mapped ${fileStructureLog.length} total files. Bundling text content...`);

// 2. Append the actual contents of the text files below the map
textFilesQueue.forEach(({ filePath, relativePath, ext }) => {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        
        let lang = 'text';
        if (['.js', '.jsx', '.ts', '.tsx'].includes(ext)) lang = 'javascript';
        else if (['.json', '.rc'].includes(ext)) lang = 'json';
        else if (['.html', '.htm'].includes(ext)) lang = 'html';
        else if (['.css', '.scss'].includes(ext)) lang = 'css';
        else if (['.md'].includes(ext)) lang = 'markdown';

        fs.appendFileSync(outputFile, `\n--- START FILE: ${relativePath} ---\n\`\`\`${lang}\n${content}\n\`\`\`\n--- END FILE: ${relativePath} ---\n`);
    } catch (err) {
        // Fallback catch for any rogue binaries
    }
});

console.log(`\nSuccess! Codebase bundled with an accurate directory map:\n--> ${outputFile}\n`);
