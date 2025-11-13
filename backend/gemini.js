import { GoogleGenerativeAI } from '@google/generative-ai';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Use gemini-2.0-flash (the latest model)
const model = genAI.getGenerativeModel({ 
    model: 'gemini-2.0-flash-exp',
    generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1000,
    }
});

// Cache directory path
const CACHE_DIR = path.join(__dirname, '..', 'cache');

async function ensureCacheDir() {
    try {
        await fs.access(CACHE_DIR);
    } catch {
        await fs.mkdir(CACHE_DIR, { recursive: true });
    }
}

function generateCacheKey(code) {
    return crypto.createHash('sha256').update(code).digest('hex');
}

async function loadFromCache(cacheKey) {
    try {
        const cacheFile = path.join(CACHE_DIR, `${cacheKey}.json`);
        const cached = await fs.readFile(cacheFile, 'utf-8');
        const data = JSON.parse(cached);
        
        const cacheAge = Date.now() - data.timestamp;
        const MAX_CACHE_AGE = 24 * 60 * 60 * 1000;
        
        if (cacheAge < MAX_CACHE_AGE) {
            console.log(`💾 Using cached analysis for chunk ${cacheKey.substring(0, 8)}...`);
            return data.result;
        } else {
            console.log(`🗑️ Cache expired for chunk ${cacheKey.substring(0, 8)}`);
            await fs.unlink(cacheFile).catch(() => {});
            return null;
        }
    } catch {
        return null;
    }
}

async function saveToCache(cacheKey, result) {
    try {
        await ensureCacheDir();
        const cacheFile = path.join(CACHE_DIR, `${cacheKey}.json`);
        const cacheData = {
            timestamp: Date.now(),
            cacheKey,
            result
        };
        await fs.writeFile(cacheFile, JSON.stringify(cacheData, null, 2));
        console.log(`💾 Cached analysis result for chunk ${cacheKey.substring(0, 8)}...`);
    } catch (error) {
        console.error('Failed to save cache:', error);
    }
}

export async function analyzeChunk(chunk) {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY environment variable is required');
    }

    const code = chunk.content || chunk;
    const cacheKey = generateCacheKey(code);
    
    const cached = await loadFromCache(cacheKey);
    if (cached) {
        return cached;
    }

    const prompt = `You are Autonalyst's backend analyzer. Analyze the following code snippet.
Return STRICT JSON array only. No explanation, no markdown.

Format:
[
  {"severity":"CRITICAL|HIGH|MEDIUM|LOW", "line": <number>, "issue":"<short title max 8 words>", "recommendation":"<short fix max 8 words>"}
]

Code:
${code}`;

    try {
        console.log(`🤖 Analyzing code chunk with Gemini (${code.length} chars)...`);
        
        let result;
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries) {
            try {
                result = await model.generateContent(prompt);
                break;
            } catch (error) {
                retryCount++;
                if (error.message?.includes('RATE_LIMIT') && retryCount < maxRetries) {
                    console.log(`⏳ Rate limit hit, retrying in ${retryCount * 2} seconds...`);
                    await new Promise(resolve => setTimeout(resolve, retryCount * 2000));
                    continue;
                }
                throw error;
            }
        }
        
        if (!result) {
            throw new Error('Failed to get response after retries');
        }

        const response = await result.response;
        const text = response.text().trim();
        
        let analysis;
        try {
            const cleanText = text.replace(/``````\n?/g, '').trim();
            analysis = JSON.parse(cleanText);
        } catch (parseError) {
            console.error('Failed to parse Gemini response:', text);
            analysis = [{
                severity: 'MEDIUM',
                line: 1,
                issue: 'Analysis parsing failed',
                recommendation: 'Manual code review required'
            }];
        }

        if (!Array.isArray(analysis)) {
            console.warn('Gemini returned non-array response, wrapping in array');
            analysis = [analysis];
        }

        const sanitizedAnalysis = analysis.map(issue => {
            if (!issue || typeof issue !== 'object') {
                return {
                    severity: 'LOW',
                    line: 1,
                    issue: 'Invalid analysis format',
                    recommendation: 'Review required'
                };
            }

            return {
                severity: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(issue.severity) 
                    ? issue.severity : 'MEDIUM',
                line: Math.max(1, parseInt(issue.line) || 1),
                issue: (issue.issue || 'Unknown issue').substring(0, 80),
                recommendation: (issue.recommendation || 'Review code').substring(0, 80)
            };
        });

        await saveToCache(cacheKey, sanitizedAnalysis);

        console.log(`✅ Gemini analysis complete: ${sanitizedAnalysis.length} issues found`);
        return sanitizedAnalysis;

    } catch (error) {
        console.error('Gemini API error:', error);
        
        const errorAnalysis = [{
            severity: 'HIGH',
            line: 1,
            issue: 'AI analysis failed',
            recommendation: 'Manual security review needed'
        }];

        await saveToCache(cacheKey, errorAnalysis);
        
        return errorAnalysis;
    }
}

export async function getCacheStats() {
    try {
        await ensureCacheDir();
        const files = await fs.readdir(CACHE_DIR);
        const jsonFiles = files.filter(f => f.endsWith('.json'));
        
        let totalSize = 0;
        for (const file of jsonFiles) {
            try {
                const stat = await fs.stat(path.join(CACHE_DIR, file));
                totalSize += stat.size;
            } catch {}
        }
        
        return {
            entries: jsonFiles.length,
            totalSizeBytes: totalSize,
            totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2)
        };
    } catch {
        return { entries: 0, totalSizeBytes: 0, totalSizeMB: '0.00' };
    }
}

export async function cleanCache() {
    try {
        await ensureCacheDir();
        const files = await fs.readdir(CACHE_DIR);
        const jsonFiles = files.filter(f => f.endsWith('.json'));
        
        let cleaned = 0;
        const MAX_CACHE_AGE = 24 * 60 * 60 * 1000;
        
        for (const file of jsonFiles) {
            try {
                const filePath = path.join(CACHE_DIR, file);
                const content = await fs.readFile(filePath, 'utf-8');
                const data = JSON.parse(content);
                
                const age = Date.now() - data.timestamp;
                if (age > MAX_CACHE_AGE) {
                    await fs.unlink(filePath);
                    cleaned++;
                }
            } catch {}
        }
        
        console.log(`🧹 Cleaned ${cleaned} expired cache entries`);
        return cleaned;
    } catch (error) {
        console.error('Cache cleanup failed:', error);
        return 0;
    }
}
