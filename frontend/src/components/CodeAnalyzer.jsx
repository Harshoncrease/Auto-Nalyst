import React, { useState, useRef, useCallback } from 'react'

function CodeAnalyzer({ onAnalyze, results, isLoading }) {
  const [selectedFiles, setSelectedFiles] = useState([])
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef(null)

  // Handle file selection
  const handleFileSelect = useCallback((files) => {
    const fileArray = Array.from(files).filter(file => {
      // Filter allowed file types
      const allowedTypes = /\.(js|jsx|ts|tsx|py|java|cpp|c|h|cs|php|rb|go|rs|swift|kt|scala|r|m|sh|sql|html|css|scss|sass|less|json|xml|yml|yaml|md|txt)$/i
      return allowedTypes.test(file.name) && file.size <= 5 * 1024 * 1024 // 5MB limit
    })

    if (fileArray.length !== files.length) {
      alert('Some files were filtered out. Only code files under 5MB are accepted.')
    }

    setSelectedFiles(prev => [...prev, ...fileArray].slice(0, 10)) // Max 10 files
  }, [])

  // Handle drag and drop
  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    const files = e.dataTransfer.files
    handleFileSelect(files)
  }, [handleFileSelect])

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
  }, [])

  // Handle file input change
  const handleInputChange = useCallback((e) => {
    const files = e.target.files
    if (files) {
      handleFileSelect(files)
    }
  }, [handleFileSelect])

  // Remove selected file
  const removeFile = useCallback((index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }, [])

  // Clear all files
  const clearFiles = useCallback(() => {
    setSelectedFiles([])
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  // Start analysis
  const startAnalysis = useCallback(() => {
    if (selectedFiles.length > 0) {
      onAnalyze(selectedFiles)
    }
  }, [selectedFiles, onAnalyze])

  // Format file size
  const formatFileSize = useCallback((bytes) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }, [])

  // Get severity color
  const getSeverityColor = useCallback((severity) => {
    switch (severity) {
      case 'CRITICAL': return 'text-red-600 bg-red-100'
      case 'HIGH': return 'text-orange-600 bg-orange-100'
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-100'
      case 'LOW': return 'text-green-600 bg-green-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }, [])

  return (
    <div className="space-y-6">
      {/* File Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragOver
            ? 'border-blue-400 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <div className="space-y-4">
          <div className="text-4xl">
            {dragOver ? '📁' : '📄'}
          </div>
          <div>
            <p className="text-lg font-medium text-gray-900">
              {dragOver ? 'Drop files here' : 'Upload code files'}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Drag and drop or click to select files
            </p>
            <p className="text-xs text-gray-400 mt-2">
              Supports: JS, TS, Python, Java, C++, Go, PHP, and more (max 5MB each)
            </p>
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleInputChange}
              className="hidden"
              accept=".js,.jsx,.ts,.tsx,.py,.java,.cpp,.c,.h,.cs,.php,.rb,.go,.rs,.swift,.kt,.scala,.r,.m,.sh,.sql,.html,.css,.scss,.sass,.less,.json,.xml,.yml,.yaml,.md,.txt"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Choose Files
            </button>
          </div>
        </div>
      </div>

      {/* Selected Files */}
      {selectedFiles.length > 0 && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-medium text-gray-900">
              Selected Files ({selectedFiles.length}/10)
            </h3>
            <button
              onClick={clearFiles}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Clear All
            </button>
          </div>

          <div className="space-y-2">
            {selectedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
              >
                <div className="flex items-center space-x-3">
                  <span className="text-sm">📄</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{file.name}</p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(file.size)} • {file.type || 'text/plain'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => removeFile(index)}
                  className="text-gray-400 hover:text-red-600 transition-colors"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={startAnalysis}
            disabled={isLoading || selectedFiles.length === 0}
            className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Analyzing...
              </>
            ) : (
              <>
                <span className="mr-2">🔍</span>
                Analyze Code
              </>
            )}
          </button>
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900">Analysis Results</h3>
            <div className="text-sm text-gray-500">
              {results.summary?.totalFiles || 0} files • {results.summary?.totalIssues || 0} issues
            </div>
          </div>

          {/* Summary Stats */}
          {results.summary && (
            <div className="grid grid-cols-4 gap-4 mb-4">
              {Object.entries(results.summary.counts).map(([severity, count]) => (
                <div key={severity} className="text-center">
                  <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(severity)}`}>
                    {severity}
                  </div>
                  <div className="text-lg font-semibold text-gray-900 mt-1">{count}</div>
                </div>
              ))}
            </div>
          )}

          {/* Issues Table */}
          <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
            <table className="min-w-full divide-y divide-gray-300">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    File
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Line
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Severity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Issue
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Recommendation
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {Object.entries(results.files || {}).map(([filename, fileIssues]) =>
                  fileIssues.map((issue, index) => (
                    <tr key={`${filename}-${index}`} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {filename}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {issue.line}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSeverityColor(issue.severity)}`}>
                          {issue.severity}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {issue.issue}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {issue.recommendation}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {Object.keys(results.files || {}).length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <span className="text-4xl mb-4 block">✅</span>
              <p className="text-lg font-medium">No issues found!</p>
              <p className="text-sm">Your code looks clean.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default CodeAnalyzer
