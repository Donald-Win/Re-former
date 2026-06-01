const fs = require('fs');
const path = require('path');
const os = require('os');

// --- CONFIGURATION ---
const outputFile = path.join(os.homedir(), 'project-codebase.txt');
const ignoreDirs = ['node_modules', '.git', '.github', 'dist', 'build', '.next', '.idea', '.vscode', 'public/icons']; 
const ignoreFiles = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bundle.cjs', '.DS_Store'];
const ignoreExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.pdf', '.zip', '.mp4', '.mov', '.bak', '.log'];
// ---------------------

// Parse command line arguments for multi-target support
const targets = process.argv.slice(2);
if (targets.length === 0) targets.push('.');

let fileStructureLog = [];
let textFilesQueue = [];
let skippedFilesCount = 0;

function scanAndQueue(targetPath) {
    if (!fs.existsSync(targetPath)) {
        console.error(`Error: Path "${targetPath}" does not exist. Skipping.`);
        return;
    }

    const stat = fs.statSync(targetPath);
    // Get relative path, defaulting to basename if run directly from the same dir
    const relativePath = path.relative(process.cwd(), targetPath) || path.basename(targetPath);

    // If the target is a specific file, process it directly
    if (stat.isFile()) {
        const ext = path.extname(targetPath).toLowerCase();
        const fileName = path.basename(targetPath);
        
        // Prevent infinite loops by excluding the output file
        if (path.resolve(targetPath) !== path.resolve(outputFile)) {
            if (ignoreExtensions.includes(ext) || ignoreFiles.includes(fileName)) {
                skippedFilesCount++;
            } else {
                fileStructureLog.push(`[Included] ${relativePath}`);
                textFilesQueue.push({ filePath: targetPath, relativePath });
            }
        }
        return;
    }

    // If the target is a directory, read its contents recursively
    if (stat.isDirectory()) {
        const files = fs.readdirSync(targetPath);
        files.forEach(file => {
            const filePath = path.join(targetPath, file);
            const fileStat = fs.statSync(filePath);
            
            if (fileStat.isDirectory()) {
                if (!ignoreDirs.includes(file)) {
                    scanAndQueue(filePath); 
                }
            } else {
                // Route back through the file processor
                scanAndQueue(filePath);
            }
        });
    }
}

// Clear old file if it exists
if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);

console.log(`Scanning targets: ${targets.join(', ')}...`);
targets.forEach(target => scanAndQueue(target));

// 1. Write the Directory Structure Map
fs.writeFileSync(outputFile, `=== PROJECT DIRECTORY MAP ===\n`);
fs.appendFileSync(outputFile, `Targets: ${targets.join(', ')}\n`);
fs.appendFileSync(outputFile, `Total parsed files: ${fileStructureLog.length}\n`);
fs.appendFileSync(outputFile, `Ignored binaries/locks: ${skippedFilesCount}\n\n`);
fs.appendFileSync(outputFile, fileStructureLog.join('\n') + `\n\n=========================================\n\n`);

console.log(`Mapped ${fileStructureLog.length} files. Optimizing and bundling text content...`);

// 2. Append the contents using highly recognizable XML tags
let totalChars = 0;
textFilesQueue.forEach(({ filePath, relativePath }) => {
    try {
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Token Optimization: Compress 3+ consecutive empty lines down to a single blank line
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
