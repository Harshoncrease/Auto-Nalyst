# Cache Directory

This directory stores cached responses from the Gemini API to improve performance and reduce API usage.

## Cache Structure

Each cache entry is a JSON file named with the SHA-256 hash of the code chunk:
- `{hash}.json` - Contains the cached analysis result

## Cache Format

```json
{
  "timestamp": 1698765432000,
  "cacheKey": "a1b2c3d4e5f6...",
  "result": [
    {
      "severity": "HIGH",
      "line": 15,
      "issue": "SQL injection vulnerability",
      "recommendation": "Use parameterized queries"
    }
  ]
}
```

## Cache Management

- **TTL**: 24 hours (configurable)
- **Automatic cleanup**: Expired entries are removed automatically
- **Size limit**: No hard limit, but old entries are cleaned periodically

## Manual Cache Operations

```bash
# View cache statistics
curl http://localhost:3000/cache/stats

# Clear expired cache entries  
curl -X DELETE http://localhost:3000/cache/expired

# Clear all cache entries (development only)
rm -rf backend/cache/*.json
```

## Development Notes

- Cache files are ignored by git (see .gitignore)
- Cache keys are deterministic based on code content
- Identical code chunks will always use cached results
