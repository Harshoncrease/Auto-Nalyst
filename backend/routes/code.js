import express from 'express';
import { body, validationResult } from 'express-validator';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import { analyzeChunk } from '../utils/gemini.js';
import { chunkCode } from '../utils/chunker.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * POST /analyze/code
 * Analyzes uploaded code files using Gemini AI
 */
router.post('/', async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        console.log(`📁 Processing ${req.files.length} files for analysis`);

        const results = {
            files: {},
            summary: {
                totalFiles: req.files.length,
                totalIssues: 0,
                counts: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 }
            }
        };

        // Process each uploaded file
        for (const file of req.files) {
            try {
                console.log(`🔍 Analyzing ${file.originalname}...`);

                // Read file content
                const fileContent = await fs.readFile(file.path, 'utf-8');

                // Clean up uploaded file
                await fs.unlink(file.path).catch(console.error);

                // Skip empty files
                if (!fileContent.trim()) {
                    results.files[file.originalname] = [];
                    continue;
                }

                // Chunk the code for analysis
                const chunks = chunkCode(fileContent, file.originalname);
                console.log(`📄 Split ${file.originalname} into ${chunks.length} chunks`);

                const fileIssues = [];

                // Analyze each chunk
                for (let i = 0; i < chunks.length; i++) {
                    const chunk = chunks[i];
                    console.log(`🤖 Analyzing chunk ${i + 1}/${chunks.length} of ${file.originalname}`);

                    try {
                        const chunkIssues = await analyzeChunk(chunk);

                        // Adjust line numbers based on chunk offset
                        const adjustedIssues = chunkIssues.map(issue => ({
                            ...issue,
                            line: issue.line + chunk.startLine
                        }));

                        fileIssues.push(...adjustedIssues);

                        // Update summary counts
                        adjustedIssues.forEach(issue => {
                            results.summary.totalIssues++;
                            if (results.summary.counts[issue.severity] !== undefined) {
                                results.summary.counts[issue.severity]++;
                            }
                        });

                    } catch (chunkError) {
                        console.error(`Error analyzing chunk ${i + 1}:`, chunkError);
                        // Continue with other chunks even if one fails
                        fileIssues.push({
                            severity: 'HIGH',
                            line: chunk.startLine,
                            issue: 'Analysis failed for this section',
                            recommendation: 'Manual review recommended'
                        });
                    }
                }

                results.files[file.originalname] = fileIssues;
                console.log(`✅ Found ${fileIssues.length} issues in ${file.originalname}`);

            } catch (fileError) {
                console.error(`Error processing file ${file.originalname}:`, fileError);
                results.files[file.originalname] = [{
                    severity: 'HIGH',
                    line: 1,
                    issue: 'File processing failed',
                    recommendation: 'Check file format and encoding'
                }];
            }
        }

        console.log(`🎯 Analysis complete: ${results.summary.totalIssues} total issues found`);
        res.json(results);

    } catch (error) {
        console.error('Code analysis error:', error);
        res.status(500).json({ 
            error: 'Analysis failed', 
            message: error.message 
        });
    }
});

/**
 * GET /analyze/code/health
 * Health check for code analysis service
 */
router.get('/health', (req, res) => {
    const hasGeminiKey = !!process.env.GEMINI_API_KEY;

    res.json({
        service: 'code-analysis',
        status: hasGeminiKey ? 'ready' : 'not-configured',
        gemini_configured: hasGeminiKey,
        timestamp: new Date().toISOString()
    });
});

export default router;
