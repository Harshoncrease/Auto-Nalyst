import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import codeRouter from './routes/code.js';
import linkRouter from './routes/link.js';

// ES Module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? ['http://localhost:4173', 'http://localhost:5173'] 
        : true,
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
        error: 'Too many requests from this IP, please try again later.'
    }
});
app.use('/analyze', limiter);

// Stricter rate limiting for Gemini calls
const geminiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // limit each IP to 10 Gemini requests per minute
    message: {
        error: 'Too many analysis requests, please wait a moment.'
    }
});
app.use('/analyze/code', geminiLimiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, 'uploads'));
    },
    filename: (req, file, cb) => {
        // Sanitize filename
        const sanitized = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        const timestamp = Date.now();
        cb(null, `${timestamp}_${sanitized}`);
    }
});

const upload = multer({ 
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
        files: 10 // Maximum 10 files
    },
    fileFilter: (req, file, cb) => {
        // Allow common code file types
        const allowedTypes = /\.(js|jsx|ts|tsx|py|java|cpp|c|h|cs|php|rb|go|rs|swift|kt|scala|r|m|sh|sql|html|css|scss|sass|less|json|xml|yml|yaml|md|txt)$/i;
        if (allowedTypes.test(file.originalname)) {
            cb(null, true);
        } else {
            cb(new Error('File type not supported for analysis'));
        }
    }
});

// Ensure upload directory exists
import fs from 'fs/promises';
try {
    await fs.access(path.join(__dirname, 'uploads'));
} catch {
    await fs.mkdir(path.join(__dirname, 'uploads'), { recursive: true });
}

// Routes
app.use('/analyze/code', upload.array('files', 10), codeRouter);
app.use('/analyze/link', linkRouter);

// Combined report endpoint
let analysisResults = {
    code: null,
    links: null
};

app.get('/report', (req, res) => {
    try {
        if (!analysisResults.code && !analysisResults.links) {
            return res.status(404).json({
                error: 'No analysis results available. Run code or link analysis first.'
            });
        }

        // Calculate overall score
        let totalIssues = 0;
        let criticalCount = 0;
        let highCount = 0;
        let mediumCount = 0;
        let lowCount = 0;

        // Count code issues
        if (analysisResults.code && analysisResults.code.files) {
            Object.values(analysisResults.code.files).forEach(fileIssues => {
                fileIssues.forEach(issue => {
                    totalIssues++;
                    switch (issue.severity) {
                        case 'CRITICAL': criticalCount++; break;
                        case 'HIGH': highCount++; break;
                        case 'MEDIUM': mediumCount++; break;
                        case 'LOW': lowCount++; break;
                    }
                });
            });
        }

        // Calculate grade based on severity distribution
        let score = 'A';
        if (criticalCount > 0) score = 'D';
        else if (highCount > 2) score = 'C';
        else if (mediumCount > 5) score = 'B';

        const combinedReport = {
            timestamp: new Date().toISOString(),
            summary: {
                score,
                totalIssues,
                counts: {
                    CRITICAL: criticalCount,
                    HIGH: highCount,
                    MEDIUM: mediumCount,
                    LOW: lowCount
                }
            },
            files: analysisResults.code?.files || {},
            links: analysisResults.links?.results || {}
        };

        res.json(combinedReport);
    } catch (error) {
        console.error('Report generation error:', error);
        res.status(500).json({ error: 'Failed to generate report' });
    }
});

// Store analysis results for combined report
app.use((req, res, next) => {
    const originalSend = res.send;
    res.send = function(data) {
        if (req.path === '/analyze/code' && res.statusCode === 200) {
            try {
                analysisResults.code = JSON.parse(data);
            } catch (e) {
                console.error('Failed to parse code analysis results');
            }
        } else if (req.path === '/analyze/link' && res.statusCode === 200) {
            try {
                analysisResults.links = JSON.parse(data);
            } catch (e) {
                console.error('Failed to parse link analysis results');
            }
        }
        originalSend.call(this, data);
    };
    next();
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Server error:', error);

    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
        }
        if (error.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({ error: 'Too many files. Maximum is 10 files.' });
        }
    }

    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Autonalyst backend running on http://localhost:${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🔍 API docs: See README.md for endpoint usage`);

    if (!process.env.GEMINI_API_KEY) {
        console.warn('⚠️  GEMINI_API_KEY not set. Code analysis will fail.');
        console.warn('   Set your API key in .env file');
    }
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down gracefully...');
    process.exit(0);
});

export default app;
