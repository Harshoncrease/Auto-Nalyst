import React, { useState, useCallback } from 'react'

function LinkAnalyzer({ onAnalyze, results, isLoading }) {
  const [urls, setUrls] = useState([''])

  // Add new URL input
  const addUrlInput = useCallback(() => {
    if (urls.length < 20) { // Max 20 URLs
      setUrls(prev => [...prev, ''])
    }
  }, [urls.length])

  // Remove URL input
  const removeUrlInput = useCallback((index) => {
    if (urls.length > 1) {
      setUrls(prev => prev.filter((_, i) => i !== index))
    }
  }, [urls.length])

  // Update URL value
  const updateUrl = useCallback((index, value) => {
    setUrls(prev => prev.map((url, i) => i === index ? value : url))
  }, [])

  // Clear all URLs
  const clearUrls = useCallback(() => {
    setUrls([''])
  }, [])

  // Start analysis
  const startAnalysis = useCallback(() => {
    const validUrls = urls.filter(url => url.trim())
    if (validUrls.length > 0) {
      onAnalyze(validUrls)
    }
  }, [urls, onAnalyze])

  // Validate URL format
  const isValidUrl = useCallback((url) => {
    if (!url.trim()) return true // Empty is OK
    try {
      new URL(url.trim())
      return url.trim().startsWith('http')
    } catch {
      return false
    }
  }, [])

  // Format date
  const formatDate = useCallback((dateString) => {
    if (!dateString) return 'Unknown'
    try {
      return new Date(dateString).toLocaleDateString()
    } catch {
      return 'Invalid date'
    }
  }, [])

  // Get SSL status badge
  const getSSLBadge = useCallback((result) => {
    if (!result.ssl) {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-gray-600 bg-gray-100">No SSL</span>
    }

    if (result.sslValid) {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-green-600 bg-green-100">✓ Valid</span>
    } else {
      return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-red-600 bg-red-100">✗ Invalid</span>
    }
  }, [])

  // Get status badge
  const getStatusBadge = useCallback((status) => {
    if (!status) return <span className="text-gray-400">-</span>

    if (status >= 200 && status < 300) {
      return <span className="text-green-600 font-medium">{status}</span>
    } else if (status >= 300 && status < 400) {
      return <span className="text-blue-600 font-medium">{status}</span>
    } else if (status >= 400) {
      return <span className="text-red-600 font-medium">{status}</span>
    }

    return <span className="text-gray-600">{status}</span>
  }, [])

  // Get expiry warning
  const getExpiryWarning = useCallback((result) => {
    if (!result.daysUntilExpiry || result.daysUntilExpiry < 0) return null

    if (result.daysUntilExpiry <= 7) {
      return <span className="text-red-600 text-xs">⚠️ Expires in {result.daysUntilExpiry} days</span>
    } else if (result.daysUntilExpiry <= 30) {
      return <span className="text-yellow-600 text-xs">⚠️ Expires in {result.daysUntilExpiry} days</span>
    }

    return null
  }, [])

  const validUrlCount = urls.filter(url => url.trim()).length

  return (
    <div className="space-y-6">
      {/* URL Input Section */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-sm font-medium text-gray-900">URLs to Check</h3>
          <div className="flex space-x-2">
            <button
              onClick={addUrlInput}
              disabled={urls.length >= 20}
              className="text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              + Add URL
            </button>
            <button
              onClick={clearUrls}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Clear All
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {urls.map((url, index) => (
            <div key={index} className="flex items-center space-x-3">
              <div className="flex-1">
                <input
                  type="url"
                  value={url}
                  onChange={(e) => updateUrl(index, e.target.value)}
                  placeholder={`https://example${index > 0 ? index + 1 : ''}.com`}
                  className={`block w-full rounded-md shadow-sm text-sm ${
                    isValidUrl(url)
                      ? 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
                      : 'border-red-300 focus:border-red-500 focus:ring-red-500'
                  }`}
                  disabled={isLoading}
                />
                {!isValidUrl(url) && url.trim() && (
                  <p className="text-xs text-red-600 mt-1">Please enter a valid HTTP/HTTPS URL</p>
                )}
              </div>
              {urls.length > 1 && (
                <button
                  onClick={() => removeUrlInput(index)}
                  disabled={isLoading}
                  className="text-gray-400 hover:text-red-600 disabled:opacity-50"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={startAnalysis}
          disabled={isLoading || validUrlCount === 0 || !urls.every(isValidUrl)}
          className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Checking Links...
            </>
          ) : (
            <>
              <span className="mr-2">🔗</span>
              Check {validUrlCount} URL{validUrlCount !== 1 ? 's' : ''}
            </>
          )}
        </button>
      </div>

      {/* Results */}
      {results && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900">Link Analysis Results</h3>
            {results.summary && (
              <div className="text-sm text-gray-500">
                {results.summary.sslValid} valid • {results.summary.sslInvalid} invalid • {results.summary.unreachable} unreachable
              </div>
            )}
          </div>

          {/* Summary Stats */}
          {results.summary && (
            <div className="grid grid-cols-4 gap-4 mb-4">
              <div className="text-center">
                <div className="text-lg font-semibold text-green-600">{results.summary.sslValid}</div>
                <div className="text-xs text-gray-500">Valid SSL</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-red-600">{results.summary.sslInvalid}</div>
                <div className="text-xs text-gray-500">Invalid SSL</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-gray-600">{results.summary.unreachable}</div>
                <div className="text-xs text-gray-500">Unreachable</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-blue-600">{results.summary.redirects}</div>
                <div className="text-xs text-gray-500">Redirects</div>
              </div>
            </div>
          )}

          {/* Results Table */}
          <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
            <table className="min-w-full divide-y divide-gray-300">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    URL
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    SSL
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Expires
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Response Time
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {Object.entries(results.results || {}).map(([url, result]) => (
                  <tr key={url} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      <div className="flex flex-col">
                        <span className="truncate max-w-xs">{url}</span>
                        {result.redirect && (
                          <span className="text-xs text-blue-600 mt-1">
                            → {result.redirect.finalUrl}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center space-x-2">
                        {result.reachable ? (
                          <span className="text-green-600">●</span>
                        ) : (
                          <span className="text-red-600">●</span>
                        )}
                        {getStatusBadge(result.status)}
                      </div>
                      {result.error && (
                        <div className="text-xs text-red-600 mt-1">{result.error}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="space-y-1">
                        {getSSLBadge(result)}
                        {getExpiryWarning(result)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {result.expires ? (
                        <div>
                          <div>{formatDate(result.expires)}</div>
                          {result.ssl?.issuer && (
                            <div className="text-xs text-gray-400">{result.ssl.issuer}</div>
                          )}
                        </div>
                      ) : (
                        'N/A'
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {result.responseTime ? `${result.responseTime}ms` : 
                       result.totalTime ? `${result.totalTime}ms` : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {Object.keys(results.results || {}).length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <span className="text-4xl mb-4 block">🔗</span>
              <p className="text-lg font-medium">No results</p>
              <p className="text-sm">Add URLs above to check their SSL status.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default LinkAnalyzer
