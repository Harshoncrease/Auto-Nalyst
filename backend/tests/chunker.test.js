import { chunkCode, getChunkingStats, validateChunks, reconstructLineNumbers } from '../utils/chunker.js';

describe('Code Chunker', () => {
    const sampleJavaScript = `function hello() {
    console.log("Hello World");
}

function add(a, b) {
    return a + b;
}

class Calculator {
    constructor() {
        this.value = 0;
    }

    add(n) {
        this.value += n;
        return this;
    }

    subtract(n) {
        this.value -= n;
        return this;
    }

    getValue() {
        return this.value;
    }
}

const calc = new Calculator();
console.log(calc.add(5).subtract(2).getValue());`;

    const samplePython = `def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    def greet(self):
        return f"Hello, I'm {self.name}"

    def birthday(self):
        self.age += 1

# Usage example
person = Person("Alice", 25)
print(person.greet())`;

    describe('chunkCode', () => {
        test('should return single chunk for small files', () => {
            const smallCode = 'console.log("Hello");';
            const chunks = chunkCode(smallCode, 'test.js');

            expect(chunks).toHaveLength(1);
            expect(chunks[0].content).toBe(smallCode);
            expect(chunks[0].startLine).toBe(0);
            expect(chunks[0].chunkIndex).toBe(0);
        });

        test('should handle empty or invalid input', () => {
            expect(chunkCode('')).toEqual([]);
            expect(chunkCode(null)).toEqual([]);
            expect(chunkCode(undefined)).toEqual([]);
        });

        test('should split large JavaScript files appropriately', () => {
            const chunks = chunkCode(sampleJavaScript, 'test.js');

            expect(chunks.length).toBeGreaterThan(1);
            chunks.forEach((chunk, index) => {
                expect(chunk).toHaveProperty('content');
                expect(chunk).toHaveProperty('startLine');
                expect(chunk).toHaveProperty('endLine');
                expect(chunk).toHaveProperty('chunkIndex', index);
                expect(chunk).toHaveProperty('filename', 'test.js');
                expect(chunk.content.trim()).not.toBe('');
            });
        });

        test('should split Python files with correct configuration', () => {
            const chunks = chunkCode(samplePython, 'test.py');

            expect(chunks.length).toBeGreaterThan(0);
            chunks.forEach(chunk => {
                expect(chunk.filename).toBe('test.py');
                expect(chunk.lineCount).toBeGreaterThan(0);
            });
        });

        test('should respect file type configurations', () => {
            const htmlCode = '<html>\n'.repeat(100) + '</html>';

            const jsChunks = chunkCode(htmlCode, 'test.js');
            const htmlChunks = chunkCode(htmlCode, 'test.html');

            // HTML should have larger chunks than JS
            expect(htmlChunks.length).toBeLessThanOrEqual(jsChunks.length);
        });

        test('should maintain chunk continuity', () => {
            const chunks = chunkCode(sampleJavaScript, 'test.js');

            if (chunks.length > 1) {
                for (let i = 1; i < chunks.length; i++) {
                    // Each chunk should start before or at the previous chunk's end
                    expect(chunks[i].startLine).toBeLessThanOrEqual(chunks[i-1].endLine + 1);
                }
            }
        });
    });

    describe('getChunkingStats', () => {
        test('should return correct statistics', () => {
            const stats = getChunkingStats(sampleJavaScript, 'test.js');

            expect(stats).toHaveProperty('totalLines');
            expect(stats).toHaveProperty('totalChunks');
            expect(stats).toHaveProperty('averageChunkSize');
            expect(stats).toHaveProperty('config');

            expect(stats.totalLines).toBeGreaterThan(0);
            expect(stats.totalChunks).toBeGreaterThan(0);
            expect(stats.averageChunkSize).toBeGreaterThan(0);
        });

        test('should handle different file types', () => {
            const jsStats = getChunkingStats(sampleJavaScript, 'test.js');
            const pyStats = getChunkingStats(samplePython, 'test.py');

            expect(jsStats.config.maxLines).toBe(40); // JS configuration
            expect(pyStats.config.maxLines).toBe(45); // Python configuration
        });
    });

    describe('validateChunks', () => {
        test('should validate correct chunks', () => {
            const chunks = chunkCode(sampleJavaScript, 'test.js');
            const issues = validateChunks(chunks);

            expect(Array.isArray(issues)).toBe(true);
            expect(issues.length).toBe(0); // No validation issues
        });

        test('should detect invalid chunks', () => {
            const invalidChunks = [
                { startLine: 10, endLine: 5, content: 'test' }, // End before start
                { startLine: 0, endLine: 0, content: '' }, // Empty content
            ];

            const issues = validateChunks(invalidChunks);
            expect(issues.length).toBeGreaterThan(0);
        });

        test('should handle empty chunk array', () => {
            const issues = validateChunks([]);
            expect(issues).toContain('No chunks generated');
        });
    });

    describe('reconstructLineNumbers', () => {
        test('should correctly map chunk results to global line numbers', () => {
            const chunks = chunkCode(sampleJavaScript, 'test.js');
            const mockResults = chunks.map(() => [
                { severity: 'LOW', line: 1, issue: 'Test issue', recommendation: 'Fix it' }
            ]);

            const reconstructed = reconstructLineNumbers(chunks, mockResults);

            expect(Array.isArray(reconstructed)).toBe(true);
            reconstructed.forEach(result => {
                expect(result).toHaveProperty('line');
                expect(result).toHaveProperty('chunkIndex');
                expect(result).toHaveProperty('originalChunkLine');
                expect(result.line).toBeGreaterThan(0);
            });
        });

        test('should remove duplicate issues', () => {
            const chunks = [
                { startLine: 0, endLine: 10 },
                { startLine: 5, endLine: 15 } // Overlap
            ];

            const duplicateResults = [
                [{ severity: 'HIGH', line: 8, issue: 'Same issue', recommendation: 'Same fix' }],
                [{ severity: 'HIGH', line: 3, issue: 'Same issue', recommendation: 'Same fix' }] // Same global line 8
            ];

            const reconstructed = reconstructLineNumbers(chunks, duplicateResults);

            // Should deduplicate based on line + severity + issue
            const uniqueIssues = reconstructed.filter(r => r.issue === 'Same issue');
            expect(uniqueIssues.length).toBe(1);
        });
    });

    describe('Edge Cases', () => {
        test('should handle files with very long lines', () => {
            const longLineCode = 'const x = ' + 'a'.repeat(10000) + ';\n'.repeat(10);
            const chunks = chunkCode(longLineCode, 'test.js');

            expect(chunks.length).toBeGreaterThan(0);
            chunks.forEach(chunk => {
                expect(chunk.content).toBeTruthy();
            });
        });

        test('should handle files with mixed line endings', () => {
            const mixedCode = 'line1\nline2\r\nline3\rline4';
            const chunks = chunkCode(mixedCode, 'test.js');

            expect(chunks.length).toBe(1); // Should be small enough for single chunk
            expect(chunks[0].content).toContain('line1');
            expect(chunks[0].content).toContain('line4');
        });

        test('should handle special characters and unicode', () => {
            const unicodeCode = 'const emoji = "🚀";\nconst chinese = "你好";\nconst math = "∑∆√";';
            const chunks = chunkCode(unicodeCode, 'test.js');

            expect(chunks.length).toBe(1);
            expect(chunks[0].content).toContain('🚀');
            expect(chunks[0].content).toContain('你好');
            expect(chunks[0].content).toContain('∑∆√');
        });
    });
});
