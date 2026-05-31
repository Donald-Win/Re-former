const fs = require('fs');
const path = require('path');
const os = require('os');

// --- CONFIGURATION ---
const outputFile = path.join(os.homedir(), 'project-codebase.txt');
const ignoreDirs = ['node_modules', '.git', '.github', 'dist', 'build', '.next', '.idea', '.vscode', 'public/icons']; 
const ignoreFiles = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bundle.cjs', '.DS_Store'];
const ignoreExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.pdf', '.zip', '.mp4', '.mov', '.bak', '.log'];
// ---------------------

// Support targeted bundling: "node bundle.cjs src/shared"
const scanRoot = process.argv[2] || '.'; 
let fileStructureLog = [];
let textFilesQueue = [];
let skippedFilesCount = 0;

function scanAndQueueFiles(dir) {
    if (!fs.existsSync(dir)) {
        console.error(`Error: Path "${dir}" does not exist.`);
        process.exit(1);
    }
    
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
            
            if (filePath !== outputFile) {
                if (ignoreExtensions.includes(ext) || ignoreFiles.includes(file)) {
                    skippedFilesCount++;
                } else {
                    fileStructureLog.push(`[Included] ${relativePath}`);
                    textFilesQueue.push({ filePath, relativePath });
                }
            }
        }
    });
}

if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);

console.log(`Scanning target: ${scanRoot}...`);
scanAndQueueFiles(scanRoot);

// 1. Write the Directory Structure Map
fs.writeFileSync(outputFile, `=== PROJECT DIRECTORY MAP ===\n`);
fs.appendFileSync(outputFile, `Target Target: ${scanRoot}\n`);
fs.appendFileSync(outputFile, `Total parsed files: ${fileStructureLog.length}\n`);
fs.appendFileSync(outputFile, `Ignored binaries/locks: ${skippedFilesCount}\n\n`);
fs.appendFileSync(outputFile, fileStructureLog.join('\n') + `\n\n=========================================\n\n`);

console.log(`Mapped ${fileStructureLog.length} files. Optimizing and bundling text content...`);

// 2. Append the contents using highly recognizable XML tags
let totalChars = 0;
textFilesQueue.forEach(({ filePath, relativePath }) => {
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Token Optimization: Remove blocks of 3+ consecutive empty lines down to single breaks
        content = content.replace(/\n\s*\n\s*\n/g, '\n\n');
        
        totalChars += content.length;

        fs.appendFileSync(outputFile, `<file path="${relativePath}">\n${content}\n</file>\n\n`);
    } catch (err) {
        console.error(`Failed to read ${relativePath}`);
    }
});

// Calculate a rough estimate of tokens (approx 4 characters per token for standard code)
const estTokens = Math.round(totalChars / 4);

console.log(`\nSuccess! Codebase file created.`);
console.log(`--> ${outputFile}`);
console.log(`--> Size: ~${(totalChars / 1024).toFixed(1)} KB`);
console.log(`--> Estimated context used: ~${estTokens.toLocaleString()} tokens.\n`);
