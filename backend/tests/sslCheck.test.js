import { checkSSL, checkMultipleURLs, getSSLStats } from '../utils/sslCheck.js';

// Mock data for testing
const mockResults = {
    'https://google.com': {
        url: 'https://google.com',
        reachable: true,
        status: 200,
        sslValid: true,
        expires: '2024-12-31T23:59:59.000Z',
        daysUntilExpiry: 365
    },
    'https://expired.badssl.com': {
        url: 'https://expired.badssl.com',
        reachable: true,
        status: 200,
        sslValid: false,
        expires: '2015-04-12T23:59:59.000Z',
        daysUntilExpiry: -3000
    },
    'http://httpbin.org': {
        url: 'http://httpbin.org',
        reachable: true,
        status: 200,
        sslValid: false,
        ssl: null
    },
    'https://nonexistent-domain-12345.com': {
        url: 'https://nonexistent-domain-12345.com',
        reachable: false,
        sslValid: false,
        error: 'ENOTFOUND'
    }
};

describe('SSL Checker', () => {
    // Increase timeout for network operations
    jest.setTimeout(15000);

    describe('checkSSL', () => {
        test('should validate input URL format', async () => {
            const invalidUrls = [
                'not-a-url',
                'ftp://example.com',
                'javascript:alert(1)',
                ''
            ];

            for (const url of invalidUrls) {
                const result = await checkSSL(url);
                expect(result.error).toBeTruthy();
                expect(result.reachable).toBe(false);
                expect(result.sslValid).toBe(false);
            }
        });

        test('should handle valid HTTPS URLs', async () => {
            // Use a reliable HTTPS endpoint
            const result = await checkSSL('https://www.google.com');

            expect(result).toHaveProperty('url', 'https://www.google.com');
            expect(result).toHaveProperty('reachable');
            expect(result).toHaveProperty('status');
            expect(result).toHaveProperty('sslValid');
            expect(result).toHaveProperty('timestamp');

            // If reachable, should have SSL information
            if (result.reachable) {
                expect(result).toHaveProperty('ssl');
                expect(result.ssl).toBeTruthy();
                expect(typeof result.status).toBe('number');
            }
        });

        test('should handle HTTP URLs (no SSL)', async () => {
            const result = await checkSSL('http://httpbin.org/status/200');

            expect(result.url).toBe('http://httpbin.org/status/200');
            expect(result.ssl).toBe(null);
            expect(result.sslValid).toBe(false);

            // Should still check connectivity
            if (result.reachable) {
                expect(typeof result.status).toBe('number');
            }
        });

        test('should handle connection timeouts gracefully', async () => {
            // Use a non-routable IP to simulate timeout
            const result = await checkSSL('https://192.0.2.1');

            expect(result.reachable).toBe(false);
            expect(result.sslValid).toBe(false);
            expect(result.error).toBeTruthy();
        });

        test('should detect redirects', async () => {
            // Many sites redirect http to https
            const result = await checkSSL('http://google.com');

            // Should follow redirects or detect them
            expect(result).toHaveProperty('redirect');
        });

        test('should include timing information', async () => {
            const result = await checkSSL('https://www.google.com');

            expect(result).toHaveProperty('totalTime');
            expect(typeof result.totalTime).toBe('number');
            expect(result.totalTime).toBeGreaterThan(0);
        });

        test('should handle invalid SSL certificates', async () => {
            // badssl.com provides various SSL test cases
            const result = await checkSSL('https://wrong.host.badssl.com');

            expect(result.url).toBe('https://wrong.host.badssl.com');

            // Should attempt connection but SSL validation should fail
            if (result.ssl) {
                expect(result.sslValid).toBe(false);
                expect(result.ssl.hostnameValid).toBe(false);
            }
        });

        test('should parse SSL certificate information', async () => {
            const result = await checkSSL('https://www.google.com');

            if (result.ssl && result.sslValid) {
                expect(result.ssl).toHaveProperty('validFrom');
                expect(result.ssl).toHaveProperty('validTo');
                expect(result.ssl).toHaveProperty('issuer');
                expect(result.ssl).toHaveProperty('subject');
                expect(result.ssl).toHaveProperty('fingerprint');

                // Dates should be parseable
                expect(new Date(result.ssl.validFrom)).toBeInstanceOf(Date);
                expect(new Date(result.ssl.validTo)).toBeInstanceOf(Date);
            }
        });
    });

    describe('checkMultipleURLs', () => {
        test('should handle array of URLs', async () => {
            const urls = [
                'https://www.google.com',
                'http://httpbin.org/status/200',
                'https://nonexistent-domain-12345.com'
            ];

            const results = await checkMultipleURLs(urls, { concurrency: 2 });

            expect(Object.keys(results)).toHaveLength(urls.length);

            urls.forEach(url => {
                expect(results[url]).toBeTruthy();
                expect(results[url]).toHaveProperty('url', url);
                expect(results[url]).toHaveProperty('reachable');
                expect(results[url]).toHaveProperty('sslValid');
            });
        });

        test('should respect concurrency limits', async () => {
            const urls = new Array(5).fill(0).map((_, i) => `https://httpbin.org/delay/${i}`);
            const startTime = Date.now();

            const results = await checkMultipleURLs(urls, { concurrency: 2 });
            const endTime = Date.now();

            expect(Object.keys(results)).toHaveLength(urls.length);

            // With concurrency of 2, should take longer than parallel execution
            // This is a rough check - exact timing depends on network conditions
            expect(endTime - startTime).toBeGreaterThan(1000);
        });

        test('should handle errors in batch processing', async () => {
            const urls = [
                'https://www.google.com',
                'invalid-url',
                'https://nonexistent-domain-12345.com'
            ];

            const results = await checkMultipleURLs(urls);

            // Should have results for all URLs, even failed ones
            expect(Object.keys(results)).toHaveLength(urls.length);

            // Invalid URL should have error
            expect(results['invalid-url'].error).toBeTruthy();
            expect(results['invalid-url'].reachable).toBe(false);
        });
    });

    describe('getSSLStats', () => {
        test('should calculate correct statistics', () => {
            const stats = getSSLStats(mockResults);

            expect(stats).toHaveProperty('total', 4);
            expect(stats).toHaveProperty('reachable');
            expect(stats).toHaveProperty('unreachable');
            expect(stats).toHaveProperty('sslValid');
            expect(stats).toHaveProperty('sslInvalid');
            expect(stats).toHaveProperty('expiringSoon');
            expect(stats).toHaveProperty('redirects');

            expect(stats.reachable).toBe(3);
            expect(stats.unreachable).toBe(1);
            expect(stats.sslValid).toBe(1);
            expect(stats.sslInvalid).toBe(1);
        });

        test('should handle empty results', () => {
            const stats = getSSLStats({});

            expect(stats.total).toBe(0);
            expect(stats.reachable).toBe(0);
            expect(stats.unreachable).toBe(0);
            expect(stats.sslValid).toBe(0);
            expect(stats.sslInvalid).toBe(0);
        });

        test('should detect expiring certificates', () => {
            const soonExpiring = {
                'https://example.com': {
                    url: 'https://example.com',
                    reachable: true,
                    sslValid: true,
                    daysUntilExpiry: 15 // Expires in 15 days
                }
            };

            const stats = getSSLStats(soonExpiring);
            expect(stats.expiringSoon).toBe(1);
        });
    });

    describe('Error Handling', () => {
        test('should handle DNS resolution failures', async () => {
            const result = await checkSSL('https://this-domain-definitely-does-not-exist-12345.com');

            expect(result.reachable).toBe(false);
            expect(result.sslValid).toBe(false);
            expect(result.error).toMatch(/ENOTFOUND|getaddrinfo/i);
        });

        test('should handle connection refused', async () => {
            // Use localhost with uncommon port
            const result = await checkSSL('https://localhost:19999');

            expect(result.reachable).toBe(false);
            expect(result.sslValid).toBe(false);
            expect(result.error).toBeTruthy();
        });

        test('should handle malformed SSL certificates', async () => {
            // Use a test site with intentionally bad SSL
            const result = await checkSSL('https://self-signed.badssl.com');

            if (result.ssl) {
                expect(result.ssl.selfSigned).toBe(true);
                expect(result.sslValid).toBe(false);
            }
        });
    });

    describe('Performance', () => {
        test('should complete single check within reasonable time', async () => {
            const startTime = Date.now();
            const result = await checkSSL('https://www.google.com');
            const endTime = Date.now();

            expect(endTime - startTime).toBeLessThan(15000); // 15 seconds max
            expect(result.totalTime).toBeTruthy();
        });

        test('should handle batch requests efficiently', async () => {
            const urls = [
                'https://www.google.com',
                'https://www.github.com',
                'https://www.stackoverflow.com'
            ];

            const startTime = Date.now();
            const results = await checkMultipleURLs(urls, { concurrency: 3 });
            const endTime = Date.now();

            expect(Object.keys(results)).toHaveLength(urls.length);
            expect(endTime - startTime).toBeLessThan(20000); // 20 seconds max for 3 URLs
        });
    });
});
