import express from 'express';
import { body, validationResult } from 'express-validator';
import { checkSSL } from '../utils/sslCheck.js';

const router = express.Router();

/**
 * POST /analyze/link  
 * Analyzes URLs for SSL certificate status and connectivity
 */
router.post('/', [
    body('urls')
        .isArray({ min: 1, max: 50 })
        .withMessage('URLs must be an array with 1-50 items'),
    body('urls.*')
        .isURL({ protocols: ['http', 'https'] })
        .withMessage('Each URL must be a valid HTTP/HTTPS URL')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { urls } = req.body;
        console.log(`🔗 Analyzing ${urls.length} URLs`);

        const results = {};
        const summary = {
            totalUrls: urls.length,
            sslValid: 0,
            sslInvalid: 0,
            unreachable: 0,
            redirects: 0
        };

        // Process each URL
        const promises = urls.map(async (url) => {
            try {
                console.log(`🔍 Checking ${url}...`);
                const result = await checkSSL(url);

                // Update summary counts
                if (result.reachable) {
                    if (result.sslValid) {
                        summary.sslValid++;
                    } else if (result.ssl !== null) {
                        summary.sslInvalid++;
                    }
                    if (result.redirect) {
                        summary.redirects++;
                    }
                } else {
                    summary.unreachable++;
                }

                results[url] = result;
                console.log(`✅ ${url}: ${result.reachable ? 'reachable' : 'unreachable'}, SSL: ${result.sslValid ? 'valid' : 'invalid'}`);

            } catch (error) {
                console.error(`❌ Error checking ${url}:`, error.message);
                results[url] = {
                    reachable: false,
                    status: null,
                    ssl: null,
                    sslValid: false,
                    expires: null,
                    redirect: null,
                    error: error.message,
                    timestamp: new Date().toISOString()
                };
                summary.unreachable++;
            }
        });

        // Wait for all URL checks to complete
        await Promise.all(promises);

        console.log(`🎯 Link analysis complete: ${summary.sslValid} valid SSL, ${summary.sslInvalid} invalid SSL, ${summary.unreachable} unreachable`);

        res.json({
            results,
            summary,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Link analysis error:', error);
        res.status(500).json({ 
            error: 'Link analysis failed', 
            message: error.message 
        });
    }
});

/**
 * GET /analyze/link/health
 * Health check for link analysis service
 */
router.get('/health', (req, res) => {
    res.json({
        service: 'link-analysis',
        status: 'ready',
        capabilities: ['ssl-check', 'http-status', 'redirect-detection'],
        timestamp: new Date().toISOString()
    });
});

export default router;
