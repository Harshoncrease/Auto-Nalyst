#!/bin/bash
# Autonalyst Sample Run - Demonstrating end-to-end functionality

echo "🚀 Autonalyst Sample Run"
echo "========================"
echo ""

# Check if backend is running
echo "1. Checking backend health..."
curl -s http://localhost:3000/health > /dev/null
if [ $? -eq 0 ]; then
    echo "✅ Backend is running"
else
    echo "❌ Backend is not running. Please start with: cd backend && npm run dev"
    exit 1
fi

echo ""

# Test code analysis
echo "2. Testing code analysis with sample files..."
curl -X POST http://localhost:3000/analyze/code \
    -F "files=@samples/vulnerable_app.js" \
    -F "files=@samples/user_auth.py" \
    -H "Content-Type: multipart/form-data" \
    | jq '.' > sample_code_results.json

if [ $? -eq 0 ]; then
    echo "✅ Code analysis completed - results saved to sample_code_results.json"

    # Show summary
    echo "📊 Code Analysis Summary:"
    jq '.summary' sample_code_results.json
else
    echo "❌ Code analysis failed"
fi

echo ""

# Test link analysis  
echo "3. Testing link analysis with sample URLs..."
curl -X POST http://localhost:3000/analyze/link \
    -H "Content-Type: application/json" \
    -d '{"urls": ["https://google.com", "https://github.com", "https://expired.badssl.com", "https://wrong.host.badssl.com"]}' \
    | jq '.' > sample_link_results.json

if [ $? -eq 0 ]; then
    echo "✅ Link analysis completed - results saved to sample_link_results.json" 

    # Show summary
    echo "📊 Link Analysis Summary:"
    jq '.summary' sample_link_results.json
else
    echo "❌ Link analysis failed"
fi

echo ""

# Get combined report
echo "4. Generating combined report..."
curl -s http://localhost:3000/report | jq '.' > sample_combined_report.json

if [ $? -eq 0 ]; then
    echo "✅ Combined report generated - saved to sample_combined_report.json"

    # Show overall summary
    echo "📈 Overall Summary:"
    jq '.summary' sample_combined_report.json
else
    echo "❌ Combined report generation failed"
fi

echo ""
echo "🎉 Sample run completed!"
echo ""
echo "Generated files:"
echo "  - sample_code_results.json (code analysis results)"
echo "  - sample_link_results.json (link analysis results)"  
echo "  - sample_combined_report.json (combined report)"
echo ""
echo "Open the frontend at http://localhost:5173 to see the UI!"
