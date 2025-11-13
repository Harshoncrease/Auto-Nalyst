import tls from 'tls';
import https from 'https';
import { URL } from 'url';

/**
 * Default configuration for SSL/link checks
 */
const DEFAULT_CONFIG = {
    timeout: 10000,      // 10 second timeout
    maxRedirects: 5,     // Maximum redirects to follow
    userAgent: 'Autonalyst-LinkChecker/1.0'
};

/**
 * Parse URL and extract host information
 */
function parseURL(url) {
    try {
        const parsed = new URL(url);
        return {
            protocol: parsed.protocol,
            hostname: parsed.hostname,
            port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
            pathname: parsed.pathname,
            isHttps: parsed.protocol === 'https:'
        };
    } catch (error) {
        throw new Error(`Invalid URL: ${url}`);
    }
}

/**
 * Check SSL certificate using TLS connection
 */
function checkSSLCertificate(hostname, port) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            socket.destroy();
            reject(new Error('SSL check timeout'));
        }, DEFAULT_CONFIG.timeout);

        const socket = tls.connect({
            host: hostname,
            port: port,
            servername: hostname, // For SNI support
            rejectUnauthorized: false // We'll validate manually
        }, () => {
            clearTimeout(timeout);

            try {
                const cert = socket.getPeerCertificate(true);
                const now = new Date();
                const validFrom = new Date(cert.valid_from);
                const validTo = new Date(cert.valid_to);

                // Check certificate validity
                const isValid = now >= validFrom && now <= validTo;

                // Check hostname match
                const hostnameValid = checkHostnameMatch(hostname, cert);

                const result = {
                    valid: isValid && hostnameValid,
                    validFrom: cert.valid_from,
                    validTo: cert.valid_to,
                    daysUntilExpiry: Math.floor((validTo - now) / (24 * 60 * 60 * 1000)),
                    issuer: cert.issuer.CN || cert.issuer.O || 'Unknown',
                    subject: cert.subject.CN || hostname,
                    fingerprint: cert.fingerprint,
                    serialNumber: cert.serialNumber,
                    hostnameValid: hostnameValid,
                    selfSigned: cert.issuer.CN === cert.subject.CN,
                    algorithm: cert.sigalg
                };

                socket.end();
                resolve(result);

            } catch (error) {
                socket.end();
                reject(new Error(`Certificate parsing failed: ${error.message}`));
            }
        });

        socket.on('error', (error) => {
            clearTimeout(timeout);
            reject(new Error(`SSL connection failed: ${error.message}`));
        });
    });
}

/**
 * Check if certificate hostname matches the requested hostname
 */
function checkHostnameMatch(hostname, cert) {
    const certHostnames = [];

    // Add subject CN
    if (cert.subject && cert.subject.CN) {
        certHostnames.push(cert.subject.CN.toLowerCase());
    }

    // Add SAN (Subject Alternative Names)
    if (cert.subjectaltname) {
        const sans = cert.subjectaltname.split(', ');
        sans.forEach(san => {
            if (san.startsWith('DNS:')) {
                certHostnames.push(san.substring(4).toLowerCase());
            }
        });
    }

    const targetHostname = hostname.toLowerCase();

    // Check exact match
    if (certHostnames.includes(targetHostname)) {
        return true;
    }

    // Check wildcard match
    return certHostnames.some(certHost => {
        if (certHost.startsWith('*.')) {
            const domain = certHost.substring(2);
            return targetHostname.endsWith(domain) && 
                   targetHostname.indexOf('.') === targetHostname.lastIndexOf('.') - domain.length + 1;
        }
        return false;
    });
}

/**
 * Perform HTTP/HTTPS HEAD request to check connectivity and status
 */
function performHeadRequest(url, redirectCount = 0) {
    return new Promise((resolve, reject) => {
        if (redirectCount > DEFAULT_CONFIG.maxRedirects) {
            reject(new Error('Too many redirects'));
            return;
        }

        const urlInfo = parseURL(url);

        const options = {
            method: 'HEAD',
            hostname: urlInfo.hostname,
            port: urlInfo.port,
            path: urlInfo.pathname,
            timeout: DEFAULT_CONFIG.timeout,
            headers: {
                'User-Agent': DEFAULT_CONFIG.userAgent
            },
            // For HTTPS requests, don't reject unauthorized (we check SSL separately)
            rejectUnauthorized: false
        };

        const client = urlInfo.isHttps ? https : require('http');

        const req = client.request(options, (res) => {
            // Handle redirects
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                const redirectUrl = new URL(res.headers.location, url).toString();
                performHeadRequest(redirectUrl, redirectCount + 1)
                    .then(result => resolve({
                        ...result,
                        redirected: true,
                        originalUrl: redirectCount === 0 ? url : result.originalUrl,
                        finalUrl: result.finalUrl || redirectUrl
                    }))
                    .catch(reject);
                return;
            }

            resolve({
                status: res.statusCode,
                statusText: getStatusText(res.statusCode),
                headers: res.headers,
                redirected: false,
                finalUrl: url,
                responseTime: Date.now() - startTime
            });
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
        });

        req.on('error', (error) => {
            reject(new Error(`Request failed: ${error.message}`));
        });

        const startTime = Date.now();
        req.end();
    });
}

/**
 * Get HTTP status text for status codes
 */
function getStatusText(statusCode) {
    const statusTexts = {
        200: 'OK',
        301: 'Moved Permanently',
        302: 'Found',
        304: 'Not Modified',
        400: 'Bad Request',
        401: 'Unauthorized',
        403: 'Forbidden',
        404: 'Not Found',
        500: 'Internal Server Error',
        502: 'Bad Gateway',
        503: 'Service Unavailable',
        504: 'Gateway Timeout'
    };

    return statusTexts[statusCode] || 'Unknown';
}

/**
 * Main SSL and connectivity check function
 */
export async function checkSSL(url) {
    const startTime = Date.now();

    try {
        const urlInfo = parseURL(url);

        const result = {
            url: url,
            reachable: false,
            status: null,
            statusText: null,
            responseTime: null,
            ssl: null,
            sslValid: false,
            expires: null,
            daysUntilExpiry: null,
            redirect: null,
            error: null,
            timestamp: new Date().toISOString()
        };

        try {
            // Perform HTTP/HTTPS connectivity check
            const httpResult = await performHeadRequest(url);

            result.reachable = true;
            result.status = httpResult.status;
            result.statusText = httpResult.statusText;
            result.responseTime = httpResult.responseTime;

            if (httpResult.redirected) {
                result.redirect = {
                    originalUrl: httpResult.originalUrl || url,
                    finalUrl: httpResult.finalUrl
                };
            }

        } catch (httpError) {
            result.error = httpError.message;
            // Continue to SSL check even if HTTP fails (might be SSL-only)
        }

        // If HTTPS, check SSL certificate
        if (urlInfo.isHttps) {
            try {
                const sslResult = await checkSSLCertificate(urlInfo.hostname, urlInfo.port);

                result.ssl = {
                    valid: sslResult.valid,
                    validFrom: sslResult.validFrom,
                    validTo: sslResult.validTo,
                    issuer: sslResult.issuer,
                    subject: sslResult.subject,
                    fingerprint: sslResult.fingerprint,
                    hostnameValid: sslResult.hostnameValid,
                    selfSigned: sslResult.selfSigned,
                    algorithm: sslResult.algorithm
                };

                result.sslValid = sslResult.valid;
                result.expires = sslResult.validTo;
                result.daysUntilExpiry = sslResult.daysUntilExpiry;

            } catch (sslError) {
                result.ssl = {
                    valid: false,
                    error: sslError.message
                };
                result.sslValid = false;
            }
        }

        result.totalTime = Date.now() - startTime;
        return result;

    } catch (error) {
        return {
            url: url,
            reachable: false,
            status: null,
            ssl: null,
            sslValid: false,
            expires: null,
            redirect: null,
            error: error.message,
            timestamp: new Date().toISOString(),
            totalTime: Date.now() - startTime
        };
    }
}

/**
 * Batch check multiple URLs
 */
export async function checkMultipleURLs(urls, options = {}) {
    const concurrency = options.concurrency || 5;
    const results = {};

    // Process URLs in batches to avoid overwhelming the system
    for (let i = 0; i < urls.length; i += concurrency) {
        const batch = urls.slice(i, i + concurrency);
        const promises = batch.map(url => 
            checkSSL(url).catch(error => ({
                url: url,
                error: error.message,
                reachable: false,
                sslValid: false
            }))
        );

        const batchResults = await Promise.all(promises);
        batchResults.forEach(result => {
            results[result.url] = result;
        });

        // Small delay between batches
        if (i + concurrency < urls.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    return results;
}

/**
 * Get SSL check statistics
 */
export function getSSLStats(results) {
    const stats = {
        total: Object.keys(results).length,
        reachable: 0,
        unreachable: 0,
        sslValid: 0,
        sslInvalid: 0,
        expiringSoon: 0, // Within 30 days
        redirects: 0
    };

    Object.values(results).forEach(result => {
        if (result.reachable) {
            stats.reachable++;
        } else {
            stats.unreachable++;
        }

        if (result.sslValid) {
            stats.sslValid++;
        } else if (result.ssl) {
            stats.sslInvalid++;
        }

        if (result.daysUntilExpiry !== null && result.daysUntilExpiry <= 30 && result.daysUntilExpiry >= 0) {
            stats.expiringSoon++;
        }

        if (result.redirect) {
            stats.redirects++;
        }
    });

    return stats;
}
