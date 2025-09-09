# 🧠 AI Code Analyzer - Single File Testing Tool

A standalone tool to test ChatGPT-powered code analysis on individual files before integrating into the main application.

## 🎯 Purpose

- **Test AI prompts** on single files first
- **See exactly what errors ChatGPT finds** 
- **Refine prompts** based on results
- **Validate approach** before scaling to thousands of files

## 🚀 Quick Start

### 1. Setup
```bash
cd ai-code-analyzer
npm install
```

### 2. Add your OpenAI API Key
Set your ChatGPT API key as an environment variable:

**Windows:**
```cmd
set OPENAI_API_KEY=sk-proj-your-key-here
```

**Mac/Linux:**
```bash
export OPENAI_API_KEY=sk-proj-your-key-here
```

### 3. Start the Server
```bash
npm start
```

### 4. Open Browser
Go to: http://localhost:3001

### 5. Test a File
Enter a file path like:
```
C:\Users\Rishi\Downloads\Greptile Clone\lambda-function-enhanced.js
```

## 🎯 What It Does

- **Analyzes ONE file at a time** with ChatGPT
- **Shows critical bugs only** (security, crashes, data loss)
- **Ignores style/lint issues** 
- **Displays results in beautiful web interface**
- **Shows AI response parsing errors** for debugging

## 🔧 Configuration

The tool is configured to find only **CRITICAL** issues:
- 🔴 Security vulnerabilities
- 🔴 Application crashes  
- 🔴 Data loss/corruption
- 🔴 Memory leaks
- 🔴 Logic errors

## 📊 Expected Results

For a typical JavaScript file, you should see:
- **0-3 critical issues** (if any real bugs exist)
- **Clear descriptions** of what's wrong
- **Specific line numbers** 
- **Impact explanation**
- **Fix suggestions**

## 🛠️ Next Steps

1. Test on various file types (.js, .ts, .py, etc.)
2. Refine prompts based on results
3. Scale to multiple files
4. Integrate into main application

## 🎯 Success Criteria

- ✅ Finds real security vulnerabilities
- ✅ Ignores style/lint issues  
- ✅ Fast analysis (10-30 seconds per file)
- ✅ Clear, actionable results
- ✅ No false positives on clean code
