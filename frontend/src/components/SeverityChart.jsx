import React, { useMemo } from 'react'
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js'
import { Radar } from 'react-chartjs-2'

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
)

function SeverityChart({ data }) {
  const chartData = useMemo(() => {
    if (!data || (!data.code && !data.link)) {
      return null
    }

    const codeData = data.code || { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 }
    const linkData = data.link || { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 }

    return {
      labels: ['Critical', 'High', 'Medium', 'Low'],
      datasets: [
        {
          label: 'Code Issues',
          data: [
            codeData.CRITICAL,
            codeData.HIGH,
            codeData.MEDIUM,
            codeData.LOW
          ],
          backgroundColor: 'rgba(59, 130, 246, 0.2)', // blue-500 with opacity
          borderColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 2,
          pointBackgroundColor: 'rgba(59, 130, 246, 1)',
          pointBorderColor: '#ffffff',
          pointHoverBackgroundColor: '#ffffff',
          pointHoverBorderColor: 'rgba(59, 130, 246, 1)',
        },
        {
          label: 'Link Issues',
          data: [
            linkData.CRITICAL,
            linkData.HIGH,
            linkData.MEDIUM,
            linkData.LOW
          ],
          backgroundColor: 'rgba(16, 185, 129, 0.2)', // green-500 with opacity
          borderColor: 'rgba(16, 185, 129, 1)',
          borderWidth: 2,
          pointBackgroundColor: 'rgba(16, 185, 129, 1)',
          pointBorderColor: '#ffffff',
          pointHoverBackgroundColor: '#ffffff',
          pointHoverBorderColor: 'rgba(16, 185, 129, 1)',
        },
      ],
    }
  }, [data])

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          usePointStyle: true,
          padding: 20,
          font: {
            size: 12,
            family: 'system-ui, -apple-system, sans-serif'
          }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: 'white',
        bodyColor: 'white',
        borderColor: 'rgba(255, 255, 255, 0.2)',
        borderWidth: 1,
        cornerRadius: 6,
        displayColors: true,
        callbacks: {
          label: function(context) {
            const label = context.dataset.label || ''
            const value = context.parsed.r
            return `${label}: ${value} issue${value !== 1 ? 's' : ''}`
          }
        }
      }
    },
    scales: {
      r: {
        beginAtZero: true,
        min: 0,
        max: undefined, // Let Chart.js determine the max
        ticks: {
          stepSize: 1,
          font: {
            size: 10
          },
          color: 'rgba(107, 114, 128, 0.8)' // gray-500
        },
        grid: {
          color: 'rgba(229, 231, 235, 0.8)', // gray-200
        },
        angleLines: {
          color: 'rgba(229, 231, 235, 0.8)',
        },
        pointLabels: {
          font: {
            size: 12,
            weight: 'bold'
          },
          color: 'rgba(75, 85, 99, 1)', // gray-600
          callback: function(label, index) {
            // Add emoji icons to severity labels
            const icons = ['🚨', '⚠️', '⚡', 'ℹ️']
            return icons[index] + ' ' + label
          }
        }
      }
    },
    elements: {
      point: {
        radius: 4,
        hoverRadius: 6
      }
    }
  }

  // Calculate totals for summary
  const totals = useMemo(() => {
    if (!data) return { code: 0, link: 0, total: 0 }

    const codeTotal = Object.values(data.code || {}).reduce((sum, val) => sum + val, 0)
    const linkTotal = Object.values(data.link || {}).reduce((sum, val) => sum + val, 0)

    return {
      code: codeTotal,
      link: linkTotal,
      total: codeTotal + linkTotal
    }
  }, [data])

  if (!chartData) {
    return (
      <div className="flex items-center justify-center h-80 text-gray-500">
        <div className="text-center">
          <div className="text-4xl mb-4">📊</div>
          <p className="text-lg font-medium">No data to display</p>
          <p className="text-sm">Run code or link analysis to see the chart</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-blue-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{totals.code}</div>
          <div className="text-sm text-blue-600">Code Issues</div>
        </div>
        <div className="bg-green-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{totals.link}</div>
          <div className="text-sm text-green-600">Link Issues</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-gray-600">{totals.total}</div>
          <div className="text-sm text-gray-600">Total Issues</div>
        </div>
      </div>

      {/* Radar Chart */}
      <div className="relative h-80">
        <Radar data={chartData} options={options} />
      </div>

      {/* Severity Legend */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <span className="text-gray-600">Critical: Security vulnerabilities, data leaks</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-orange-500"></div>
          <span className="text-gray-600">High: Security risks, performance issues</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          <span className="text-gray-600">Medium: Code quality, maintainability</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <span className="text-gray-600">Low: Style, minor improvements</span>
        </div>
      </div>

      {/* Detailed Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
        {/* Code Issues Breakdown */}
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
            <span className="w-3 h-3 bg-blue-500 rounded-full mr-2"></span>
            Code Analysis Details
          </h4>
          <div className="space-y-2">
            {Object.entries(data.code || {}).map(([severity, count]) => (
              <div key={severity} className="flex justify-between items-center text-sm">
                <span className="text-gray-600">{severity}</span>
                <div className="flex items-center space-x-2">
                  <div className="w-16 bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${
                        severity === 'CRITICAL' ? 'bg-red-500' :
                        severity === 'HIGH' ? 'bg-orange-500' :
                        severity === 'MEDIUM' ? 'bg-yellow-500' :
                        'bg-green-500'
                      }`}
                      style={{ 
                        width: totals.code > 0 ? `${(count / totals.code) * 100}%` : '0%' 
                      }}
                    />
                  </div>
                  <span className="font-medium text-gray-900 w-8 text-right">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Link Issues Breakdown */}
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
            <span className="w-3 h-3 bg-green-500 rounded-full mr-2"></span>
            Link Analysis Details
          </h4>
          <div className="space-y-2">
            {Object.entries(data.link || {}).map(([severity, count]) => (
              <div key={severity} className="flex justify-between items-center text-sm">
                <span className="text-gray-600">{severity}</span>
                <div className="flex items-center space-x-2">
                  <div className="w-16 bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${
                        severity === 'CRITICAL' ? 'bg-red-500' :
                        severity === 'HIGH' ? 'bg-orange-500' :
                        severity === 'MEDIUM' ? 'bg-yellow-500' :
                        'bg-green-500'
                      }`}
                      style={{ 
                        width: totals.link > 0 ? `${(count / totals.link) * 100}%` : '0%' 
                      }}
                    />
                  </div>
                  <span className="font-medium text-gray-900 w-8 text-right">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default SeverityChart
