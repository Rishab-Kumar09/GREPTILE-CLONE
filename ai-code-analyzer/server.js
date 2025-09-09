const express = require('express');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');
const SingleFileAnalyzer = require('./analyzer');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialize analyzer
const analyzer = new SingleFileAnalyzer();

// 🎯 API: Analyze a single file
app.post('/api/analyze-file', async (req, res) => {
  try {
    const { filePath } = req.body;
    
    if (!filePath) {
      return res.status(400).json({ error: 'filePath is required' });
    }

    console.log(`🔍 API Request: Analyze ${filePath}`);
    
    // Don't check file existence for URLs
    if (!filePath.startsWith('http') && !await fs.pathExists(filePath)) {
      return res.status(404).json({ error: 'Local file not found' });
    }
    
    // Analyze the file
    const result = await analyzer.analyzeSingleFile(filePath);
    const formattedResult = analyzer.formatResults(result);
    
    res.json(formattedResult);
    
  } catch (error) {
    console.error('❌ API Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 🎯 API: Get sample files from a directory
app.post('/api/list-files', async (req, res) => {
  try {
    const { directoryPath } = req.body;
    
    if (!directoryPath) {
      return res.status(400).json({ error: 'directoryPath is required' });
    }

    if (!await fs.pathExists(directoryPath)) {
      return res.status(404).json({ error: 'Directory not found' });
    }

    // Get code files from directory
    const files = await getCodeFiles(directoryPath);
    const sampleFiles = files.slice(0, 20); // First 20 files for testing
    
    res.json({ files: sampleFiles });
    
  } catch (error) {
    console.error('❌ API Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper: Get code files from directory
async function getCodeFiles(dirPath) {
  const codeExtensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.go', '.rs', '.cpp', '.c', '.php'];
  const skipDirs = ['node_modules', '.git', 'dist', 'build', 'coverage'];
  
  const files = [];
  
  async function scanDir(currentPath) {
    try {
      const items = await fs.readdir(currentPath);
      
      for (const item of items) {
        const fullPath = path.join(currentPath, item);
        const stat = await fs.stat(fullPath);
        
        if (stat.isDirectory()) {
          // Skip certain directories
          if (!skipDirs.includes(item)) {
            await scanDir(fullPath);
          }
        } else if (stat.isFile()) {
          const ext = path.extname(item).toLowerCase();
          if (codeExtensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      console.log(`⏭️ Skipping directory ${currentPath}: ${error.message}`);
    }
  }
  
  await scanDir(dirPath);
  return files;
}

// Start server
app.listen(PORT, () => {
  console.log(`🚀 AI Code Analyzer Server running at http://localhost:${PORT}`);
  console.log(`📁 Ready to analyze files!`);
  console.log(`\n🎯 Usage:`);
  console.log(`1. Open http://localhost:${PORT} in your browser`);
  console.log(`2. Enter a file path to analyze`);
  console.log(`3. See the critical bugs found by ChatGPT`);
  console.log(`\n💡 Example file paths to test:`);
  console.log(`- C:\\Users\\Rishi\\Downloads\\Greptile Clone\\lambda-function-enhanced.js`);
  console.log(`- Any .js, .ts, .py file on your system`);
});

module.exports = app;
