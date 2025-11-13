import React, { useState, useCallback } from 'react'
import CodeAnalyzer from './components/CodeAnalyzer'
import LinkAnalyzer from './components/LinkAnalyzer'
import SeverityChart from './components/SeverityChart'
import axios from 'axios'

function App() {
  const [codeResults, setCodeResults] = useState(null)
  const [linkResults, setLinkResults] = useState(null)
  const [isAnalyzing, setIsAnalyzing] = useState({ code: false, link: false })
  const [error, setError] = useState(null)

  // Handle code analysis
  const handleCodeAnalysis = useCallback(async (files) => {
    setIsAnalyzing(prev => ({ ...prev, code: true }))
    setError(null)

    try {
      const formData = new FormData()
      files.forEach(file => {
        formData.append('files', file)
      })

      const response = await axios.post('/analyze/code', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        timeout: 60000 // 60 second timeout for analysis
      })

      setCodeResults(response.data)
      console.log('Code analysis complete:', response.data)

    } catch (error) {
      console.error('Code analysis failed:', error)
      const errorMessage = error.response?.data?.error || error.message || 'Code analysis failed'
      setError(`Code analysis failed: ${errorMessage}`)
    } finally {
      setIsAnalyzing(prev => ({ ...prev, code: false }))
    }
  }, [])

  // Handle link analysis
  const handleLinkAnalysis = useCallback(async (urls) => {
    setIsAnalyzing(prev => ({ ...prev, link: true }))
    setError(null)

    try {
      const response = await axios.post('/analyze/link', {
        urls: urls.filter(url => url.trim()) // Remove empty URLs
      }, {
        timeout: 30000 // 30 second timeout
      })

      setLinkResults(response.data)
      console.log('Link analysis complete:', response.data)

    } catch (error) {
      console.error('Link analysis failed:', error)
      const errorMessage = error.response?.data?.error || error.message || 'Link analysis failed'
      setError(`Link analysis failed: ${errorMessage}`)
    } finally {
      setIsAnalyzing(prev => ({ ...prev, link: false }))
    }
  }, [])

  // Export combined report
  const exportReport = useCallback(async () => {
    try {
      const response = await axios.get('/report')
      const blob = new Blob([JSON.stringify(response.data, null, 2)], {
        type: 'application/json'
      })

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `autonalyst-report-${new Date().toISOString().slice(0, 19)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

    } catch (error) {
      console.error('Export failed:', error)
      setError('Failed to export report. Run analysis first.')
    }
  }, [])

  // Clear all results
  const clearResults = useCallback(() => {
    setCodeResults(null)
    setLinkResults(null)
    setError(null)
  }, [])

  // Prepare chart data
  const getChartData = useCallback(() => {
    const data = {
      code: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 },
      link: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 }
    }

    // Count code issues
    if (codeResults?.files) {
      Object.values(codeResults.files).forEach(fileIssues => {
        fileIssues.forEach(issue => {
          if (data.code[issue.severity] !== undefined) {
            data.code[issue.severity]++
          }
        })
      })
    }

    // Count link issues (convert to severity levels)
    if (linkResults?.results) {
      Object.values(linkResults.results).forEach(result => {
        if (!result.reachable) {
          data.link.HIGH++ // Unreachable is HIGH severity
        } else if (!result.sslValid && result.ssl) {
          data.link.MEDIUM++ // Invalid SSL is MEDIUM severity
        } else if (result.daysUntilExpiry !== null && result.daysUntilExpiry <= 30 && result.daysUntilExpiry >= 0) {
          data.link.LOW++ // Expiring soon is LOW severity
        }
      })
    }

    return data
  }, [codeResults, linkResults])

  const hasResults = codeResults || linkResults
  const isLoading = isAnalyzing.code || isAnalyzing.link

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">A</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Autonalyst</h1>
                <p className="text-sm text-gray-500">AI-Powered Code & Link Analysis</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              {hasResults && (
                <>
                  <button
                    onClick={exportReport}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
                  >
                    📊 Export Report
                  </button>
                  <button
                    onClick={clearResults}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                  >
                    🗑️ Clear
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Error Display */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="text-red-400 text-xl">⚠️</span>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Analysis Error</h3>
                <p className="mt-1 text-sm text-red-700">{error}</p>
                <button
                  onClick={() => setError(null)}
                  className="mt-2 text-sm text-red-600 hover:text-red-500 underline"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading Indicator */}
      {isLoading && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
              <p className="ml-3 text-sm text-blue-700">
                {isAnalyzing.code && 'Analyzing code files with AI...'}
                {isAnalyzing.link && 'Checking SSL certificates and connectivity...'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Two-panel layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Left Panel - Code Analysis */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <span className="mr-2">🔍</span>
                Code Analysis
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Upload code files for AI-powered security and quality analysis
              </p>
            </div>
            <div className="p-6">
              <CodeAnalyzer
                onAnalyze={handleCodeAnalysis}
                results={codeResults}
                isLoading={isAnalyzing.code}
              />
            </div>
          </div>

          {/* Right Panel - Link Analysis */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <span className="mr-2">🔗</span>
                Link Analysis
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Check SSL certificates and connectivity for URLs
              </p>
            </div>
            <div className="p-6">
              <LinkAnalyzer
                onAnalyze={handleLinkAnalysis}
                results={linkResults}
                isLoading={isAnalyzing.link}
              />
            </div>
          </div>
        </div>

        {/* Chart Section */}
        {hasResults && (
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <span className="mr-2">📊</span>
                Severity Overview
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Visual breakdown of issues by severity level
              </p>
            </div>
            <div className="p-6">
              <SeverityChart data={getChartData()} />
            </div>
          </div>
        )}

        {/* Getting Started */}
        {!hasResults && !isLoading && (
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="px-6 py-8 text-center">
              <div className="text-6xl mb-4">🚀</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Welcome to Autonalyst
              </h3>
              <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
                Upload your code files for AI-powered analysis or paste URLs to check SSL certificates. 
                Get comprehensive security insights and export detailed reports.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto text-left">
                <div className="flex items-start space-x-3">
                  <span className="text-2xl">📁</span>
                  <div>
                    <h4 className="font-medium text-gray-900">Upload Code Files</h4>
                    <p className="text-sm text-gray-600">Drag and drop or select files to analyze</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <span className="text-2xl">🔗</span>
                  <div>
                    <h4 className="font-medium text-gray-900">Check URLs</h4>
                    <p className="text-sm text-gray-600">Paste URLs to verify SSL and connectivity</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center text-sm text-gray-500">
            <p>© 2024 Autonalyst. Built with React + Express + Gemini AI.</p>
            <p>v1.0.0</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App
