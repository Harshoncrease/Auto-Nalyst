/**
 * Code chunking utility for analyzing large files
 * Splits code into overlapping chunks for comprehensive analysis
 */

/**
 * Default chunking configuration
 */
const DEFAULT_CONFIG = {
    maxLines: 50,        // Maximum lines per chunk
    overlapLines: 5,     // Lines to overlap between chunks
    minChunkLines: 10    // Minimum lines to create a chunk
};

/**
 * Determine appropriate chunk size based on file type and size
 */
function getChunkConfig(filename, totalLines) {
    const config = { ...DEFAULT_CONFIG };

    // Adjust for different file types
    const ext = filename.split('.').pop()?.toLowerCase();

    switch (ext) {
        case 'js':
        case 'jsx':
        case 'ts':
        case 'tsx':
            // JavaScript/TypeScript - smaller chunks for better analysis
            config.maxLines = 40;
            config.overlapLines = 8;
            break;

        case 'py':
            // Python - medium chunks
            config.maxLines = 45;
            config.overlapLines = 6;
            break;

        case 'java':
        case 'cpp':
        case 'c':
        case 'cs':
            // Compiled languages - larger chunks
            config.maxLines = 60;
            config.overlapLines = 10;
            break;

        case 'html':
        case 'xml':
            // Markup - larger chunks
            config.maxLines = 80;
            config.overlapLines = 5;
            break;

        case 'css':
        case 'scss':
        case 'sass':
            // Stylesheets - medium chunks
            config.maxLines = 50;
            config.overlapLines = 5;
            break;

        case 'sql':
            // SQL - smaller chunks for query analysis
            config.maxLines = 30;
            config.overlapLines = 5;
            break;
    }

    // Adjust based on file size
    if (totalLines < 30) {
        // Small files - don't chunk
        config.maxLines = totalLines;
        config.overlapLines = 0;
    } else if (totalLines < 100) {
        // Medium files - reduce chunk size
        config.maxLines = Math.min(config.maxLines, Math.ceil(totalLines / 2));
    }

    return config;
}

/**
 * Find logical break points in code (end of functions, classes, etc.)
 */
function findBreakPoint(lines, startIndex, maxLines) {
    const endIndex = Math.min(startIndex + maxLines, lines.length);
    let bestBreak = endIndex;

    // Look for natural break points in the last 10 lines of the chunk
    const searchStart = Math.max(startIndex + maxLines - 10, startIndex + 1);

    for (let i = endIndex - 1; i >= searchStart; i--) {
        const line = lines[i].trim();

        // Good break points (in order of preference)
        if (line === '}' || line === '};') {
            bestBreak = i + 1;
            break;
        }

        if (line.startsWith('function ') || 
            line.startsWith('class ') ||
            line.startsWith('def ') ||
            line.includes('public static') ||
            line.includes('private static')) {
            bestBreak = i;
            break;
        }

        if (line === '' && i > startIndex + 20) {
            bestBreak = i;
            // Don't break here, keep looking for better breaks
        }
    }

    return bestBreak;
}

/**
 * Split code content into overlapping chunks for analysis
 */
export function chunkCode(content, filename = 'unknown.txt') {
    if (!content || typeof content !== 'string') {
        return [];
    }

    const lines = content.split('\n');
    const totalLines = lines.length;
    const config = getChunkConfig(filename, totalLines);

    // If file is small enough, return as single chunk
    if (totalLines <= config.maxLines) {
        return [{
            content: content,
            startLine: 0,
            endLine: totalLines - 1,
            chunkIndex: 0,
            totalChunks: 1,
            filename: filename
        }];
    }

    console.log(`📄 Chunking ${filename}: ${totalLines} lines into ~${config.maxLines} line chunks`);

    const chunks = [];
    let currentLine = 0;
    let chunkIndex = 0;

    while (currentLine < totalLines) {
        // Find the end point for this chunk
        const idealEnd = currentLine + config.maxLines;
        const actualEnd = findBreakPoint(lines, currentLine, config.maxLines);

        // Ensure we make progress even if no good break point is found
        const chunkEnd = Math.max(actualEnd, currentLine + config.minChunkLines);
        const finalEnd = Math.min(chunkEnd, totalLines);

        // Extract chunk content
        const chunkLines = lines.slice(currentLine, finalEnd);
        const chunkContent = chunkLines.join('\n');

        // Skip empty chunks
        if (chunkContent.trim()) {
            chunks.push({
                content: chunkContent,
                startLine: currentLine,
                endLine: finalEnd - 1,
                chunkIndex: chunkIndex,
                totalChunks: -1, // Will be set after all chunks are created
                filename: filename,
                lineCount: chunkLines.length
            });
            chunkIndex++;
        }

        // Move to next chunk with overlap
        currentLine = Math.max(finalEnd - config.overlapLines, currentLine + 1);

        // Safety check to prevent infinite loops
        if (currentLine >= totalLines || (finalEnd === totalLines && currentLine === finalEnd - config.overlapLines)) {
            break;
        }
    }

    // Update total chunks count
    chunks.forEach(chunk => {
        chunk.totalChunks = chunks.length;
    });

    console.log(`✂️ Split ${filename} into ${chunks.length} chunks (${config.overlapLines} line overlap)`);

    return chunks;
}

/**
 * Reconstruct line numbers from chunked analysis results
 */
export function reconstructLineNumbers(chunks, results) {
    const globalResults = [];

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const chunkResults = results[i] || [];

        chunkResults.forEach(issue => {
            // Convert chunk-relative line number to global line number
            const globalLine = chunk.startLine + issue.line;

            globalResults.push({
                ...issue,
                line: globalLine,
                chunkIndex: i,
                originalChunkLine: issue.line
            });
        });
    }

    // Remove duplicate issues that might occur in overlapping regions
    const deduplicatedResults = removeDuplicateIssues(globalResults);

    return deduplicatedResults;
}

/**
 * Remove duplicate issues that appear in overlapping chunks
 */
function removeDuplicateIssues(issues) {
    const seen = new Set();
    const unique = [];

    issues.forEach(issue => {
        // Create a signature for the issue
        const signature = `${issue.line}:${issue.severity}:${issue.issue}`;

        if (!seen.has(signature)) {
            seen.add(signature);
            unique.push(issue);
        }
    });

    return unique.sort((a, b) => a.line - b.line);
}

/**
 * Get chunking statistics for debugging
 */
export function getChunkingStats(content, filename) {
    const chunks = chunkCode(content, filename);
    const lines = content.split('\n');

    return {
        totalLines: lines.length,
        totalChunks: chunks.length,
        averageChunkSize: chunks.length ? Math.round(chunks.reduce((sum, c) => sum + c.lineCount, 0) / chunks.length) : 0,
        overlapEstimate: chunks.length > 1 ? chunks[1].startLine - chunks[0].endLine : 0,
        config: getChunkConfig(filename, lines.length)
    };
}

/**
 * Validate chunking results
 */
export function validateChunks(chunks) {
    const issues = [];

    if (!chunks || chunks.length === 0) {
        issues.push('No chunks generated');
        return issues;
    }

    // Check chunk continuity
    for (let i = 1; i < chunks.length; i++) {
        const prevChunk = chunks[i - 1];
        const currentChunk = chunks[i];

        if (currentChunk.startLine <= prevChunk.startLine) {
            issues.push(`Chunk ${i} start line (${currentChunk.startLine}) <= previous chunk start (${prevChunk.startLine})`);
        }

        if (currentChunk.endLine <= currentChunk.startLine) {
            issues.push(`Chunk ${i} end line (${currentChunk.endLine}) <= start line (${currentChunk.startLine})`);
        }
    }

    // Check for empty chunks
    chunks.forEach((chunk, index) => {
        if (!chunk.content || chunk.content.trim() === '') {
            issues.push(`Chunk ${index} is empty`);
        }
    });

    return issues;
}
