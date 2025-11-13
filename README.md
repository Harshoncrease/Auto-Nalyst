# Autonalyst - Code & Link Analysis Tool

A comprehensive analysis tool that combines code quality assessment using Google Gemini AI with SSL/link verification capabilities.

## Features

- **Code Analysis**: Upload code files for AI-powered security and quality analysis
- **Link Analysis**: Check SSL certificates and connection status for URLs  
- **Dual Panel Interface**: Simultaneous code and link analysis
- **Severity Visualization**: Interactive radar charts showing issue distribution
- **Offline-First**: Only Gemini API calls require internet connection
- **Response Caching**: Intelligent caching to minimize API usage

## Prerequisites (macOS M1)

- Node.js 18+ (recommended: use nvm)
- npm 9+
- Google Gemini API key

### Install Node.js on macOS M1

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# Restart terminal or source your profile
source ~/.zshrc

# Install Node.js 20 (LTS)
nvm install 20
nvm use 20

# Verify installation
node --version  # Should show v20.x.x
npm --version   # Should show 9.x.x or higher
```

## Installation & Setup

1. **Clone/Download the project**
   ```bash
   cd autonalyst
   ```

2. **Install dependencies**
   ```bash
   # Install workspace dependencies
   npm install

   # Install backend dependencies  
   cd backend && npm install && cd ..

   # Install frontend dependencies
   cd frontend && npm install && cd ..
   ```

3. **Configure environment variables**
   ```bash
   # Copy the example file
   cp .env.example .env

   # Edit .env and add your Gemini API key
   GEMINI_API_KEY=your_api_key_here
   ```

4. **Get Gemini API Key**
   - Visit https://ai.google.dev/
   - Create account and generate API key
   - Add to `.env` file

## Running the Application

### Development Mode

```bash
# Start backend server (Terminal 1)
cd backend
npm run dev

# Start frontend development server (Terminal 2)  
cd frontend
npm run dev
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000

### Production Mode

```bash
# Build frontend
cd frontend && npm run build && cd ..

# Start production backend
cd backend && npm start
```

## API Endpoints

### Code Analysis
```bash
curl -X POST http://localhost:3000/analyze/code \
  -F "files=@sample.js" \
  -F "files=@another.py"
```

### Link Analysis  
```bash
curl -X POST http://localhost:3000/analyze/link \
  -H "Content-Type: application/json" \
  -d '{"urls": ["https://google.com", "https://github.com"]}'
```

### Combined Report
```bash
curl http://localhost:3000/report
```

## Sample Usage

1. **Upload Code Files**: Drag and drop or select code files in the left panel
2. **Add URLs**: Paste URLs to check in the right panel  
3. **Run Analysis**: Click analyze buttons to process
4. **View Results**: See tables with findings and severity chart
5. **Export Report**: Download complete analysis as JSON

## Project Structure

```
autonalyst/
├── backend/           # Express API server
│   ├── routes/        # API route handlers
│   ├── utils/         # Core utilities (Gemini, SSL, chunking)
│   ├── cache/         # Gemini response cache
│   └── tests/         # Unit tests
├── frontend/          # React + Vite application  
│   └── src/
│       ├── components/ # React components
│       └── styles/    # Tailwind CSS
└── README.md          # This file
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GEMINI_API_KEY` | Google Gemini API key | Yes |
| `PORT` | Backend server port (default: 3000) | No |
| `NODE_ENV` | Environment mode (development/production) | No |

## Testing

```bash
# Run backend tests
cd backend && npm test

# Run frontend tests  
cd frontend && npm test
```

## Troubleshooting

### Common Issues

1. **Node version compatibility**
   ```bash
   nvm use 20  # Ensure using Node 20+
   ```

2. **Port conflicts**
   ```bash
   # Check what's using port 3000
   lsof -ti:3000
   # Kill process if needed
   kill -9 $(lsof -ti:3000)
   ```

3. **Gemini API quota**
   - Check your API usage at Google AI Studio
   - Verify API key is correctly set in .env

4. **SSL certificate errors**
   - Some self-signed certificates may fail validation
   - This is expected behavior for security

## Technology Stack

- **Backend**: Node.js, Express, Multer, Google Generative AI
- **Frontend**: React, Vite, Tailwind CSS, Chart.js
- **Testing**: Jest (backend), Vitest (frontend)

## License

MIT License - See LICENSE file for details
