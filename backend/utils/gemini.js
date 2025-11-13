import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
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
        const cacheData = { timestamp: Date.now(), cacheKey, result };
        await fs.writeFile(cacheFile, JSON.stringify(cacheData, null, 2));
        console.log(`💾 Cached analysis result for chunk ${cacheKey.substring(0, 8)}...`);
    } catch (error) {
        console.error('Failed to save cache:', error);
    }
}

function callGeminiAPI(prompt, apiKey) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
        });

        const options = {
            hostname: 'generativelanguage.googleapis.com',
            port: 443,
            path: '/v1beta/models/gemini-2.0-flash-exp:generateContent',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey,
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode === 200) {
                    resolve(JSON.parse(data));
                } else {
                    reject(new Error(`API Error ${res.statusCode}: ${data}`));
                }
            });
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

export async function analyzeChunk(chunk) {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY required');
    }

    const code = chunk.content || chunk;
    const cacheKey = generateCacheKey(code);
    
    const cached = await loadFromCache(cacheKey);
    if (cached) return cached;

    const prompt = `You are a code analyzer. Analyze this code and return ONLY a JSON array, no other text.

Each issue must have this exact format:
{"severity":"CRITICAL|HIGH|MEDIUM|LOW", "line": number, "issue":"description", "recommendation":"fix"}

Return ONLY the JSON array, nothing else. No markdown, no explanations, just the array.

Code to analyze:
${code}`;

    try {
        console.log(`🤖 Analyzing code chunk with Gemini (${code.length} chars)...`);
        
        const response = await callGeminiAPI(prompt, process.env.GEMINI_API_KEY);
        let text = response.candidates[0].content.parts[0].text.trim();
        
        console.log('📝 Gemini raw response:', text.substring(0, 200) + '...');
        
        // Remove markdown code blocks
        text = text.replace(/``````\s*/g, '');
        
        // Extract JSON array if it's embedded in text
        const jsonMatch = text.match(/\[\s*\{[\s\S]*\}\s*\]/);
        if (jsonMatch) {
            text = jsonMatch[0];
        }
        
        let analysis;
        try {
            analysis = JSON.parse(text);
            console.log('✅ Successfully parsed JSON with', analysis.length, 'issues');
        } catch (parseError) {
            console.error('❌ Failed to parse Gemini response as JSON');
            console.error('Response was:', text);
            
            // Return a default analysis
            analysis = [{
                severity: 'LOW',
                line: 1,
                issue: 'Could not parse AI response',
                recommendation: 'Manual code review recommended'
            }];
        }

        if (!Array.isArray(analysis)) {
            console.warn('⚠️  Response was not an array, wrapping it');
            analysis = [analysis];
        }

        const sanitizedAnalysis = analysis.map(issue => ({
            severity: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(issue?.severity) 
                ? issue.severity : 'LOW',
            line: Math.max(1, parseInt(issue?.line) || 1),
            issue: (issue?.issue || 'Unknown issue').substring(0, 80),
            recommendation: (issue?.recommendation || 'Review code').substring(0, 80)
        }));

        await saveToCache(cacheKey, sanitizedAnalysis);
        console.log(`✅ Analysis complete: ${sanitizedAnalysis.length} issues found`);
        return sanitizedAnalysis;

    } catch (error) {
        console.error('Gemini API error:', error.message);
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
                if (Date.now() - data.timestamp > MAX_CACHE_AGE) {
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
