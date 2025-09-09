const fs = require('fs-extra');
const path = require('path');

class AnalysisLogger {
  constructor() {
    this.logsDir = path.join(__dirname, 'analysis-logs');
    this.ensureLogDirectory();
  }

  async ensureLogDirectory() {
    await fs.ensureDir(this.logsDir);
  }

  getFileType(filePath, content) {
    const ext = path.extname(filePath).toLowerCase();
    
    // Detect file type from content and extension
    const types = {
      '.js': this.detectJavaScriptType(content),
      '.ts': this.detectTypeScriptType(content),
      '.py': this.detectPythonType(content),
      '.java': this.detectJavaType(content),
      '.go': 'golang',
      '.rb': 'ruby',
      '.php': 'php',
      '.cs': 'csharp',
      '.cc': 'cpp',
      '.h': 'cpp',
      '.hpp': 'cpp'
    };
    
    return types[ext] || ext.substring(1) || 'unknown';
  }

  detectJavaScriptType(content) {
    if (content.includes('React')) return 'react';
    if (content.includes('Vue')) return 'vue';
    if (content.includes('express')) return 'node-backend';
    if (content.includes('test(') || content.includes('describe(')) return 'test';
    return 'javascript';
  }

  detectTypeScriptType(content) {
    if (content.includes('React')) return 'react-ts';
    if (content.includes('Angular')) return 'angular';
    if (content.includes('@nestjs')) return 'nest-backend';
    return 'typescript';
  }

  detectPythonType(content) {
    if (content.includes('django')) return 'django';
    if (content.includes('flask')) return 'flask';
    if (content.includes('fastapi')) return 'fastapi';
    if (content.includes('test_')) return 'python-test';
    return 'python';
  }

  detectJavaType(content) {
    if (content.includes('springframework')) return 'spring';
    if (content.includes('@RestController')) return 'spring-controller';
    if (content.includes('@Entity')) return 'spring-entity';
    if (content.includes('@Test')) return 'java-test';
    return 'java';
  }

  async logAnalysis(filePath, aiResponse, result) {
    try {
      // Get file info
      const fileName = filePath.startsWith('http') 
        ? filePath.split('/').pop() 
        : path.basename(filePath);
      const fileContent = result.fileContent || '';
      const fileType = this.getFileType(fileName, fileContent);
      
      const analysisLog = {
        metadata: {
          fileName,
          fileType,
          analyzedAt: new Date().toISOString(),
          fileSize: fileContent.length,
          numberOfLines: fileContent.split('\n').length
        },
        rawAiResponse: aiResponse,
        processedResult: result,
        analysisDetails: {
          patternsUsed: result.analysisDetails?.patternsUsed || [],
          functionsAnalyzed: result.analysisDetails?.functionsAnalyzed || [],
          testingSteps: result.analysisDetails?.testingSteps || []
        },
        issues: result.criticalBugs || []
      };

      // Create log file name
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const logFileName = `${fileType}_${fileName}_${timestamp}.json`;
      const logFilePath = path.join(this.logsDir, logFileName);

      // Save log
      await fs.writeJson(logFilePath, analysisLog, { spaces: 2 });
      console.log(`📝 Analysis logged to: ${logFilePath}`);

      // Update summary file
      await this.updateSummary(analysisLog);

    } catch (error) {
      console.error('❌ Failed to log analysis:', error);
    }
  }

  async updateSummary(analysisLog) {
    const summaryPath = path.join(this.logsDir, 'analysis_summary.json');
    
    try {
      // Read existing summary or create new
      let summary = { fileTypes: {}, patterns: {}, totalAnalyses: 0 };
      if (await fs.pathExists(summaryPath)) {
        summary = await fs.readJson(summaryPath);
      }

      // Update statistics
      const { fileType } = analysisLog.metadata;
      summary.fileTypes[fileType] = (summary.fileTypes[fileType] || 0) + 1;
      summary.totalAnalyses++;

      // Track patterns used
      analysisLog.analysisDetails.patternsUsed.forEach(pattern => {
        summary.patterns[pattern.type] = (summary.patterns[pattern.type] || 0) + 1;
      });

      // Save updated summary
      await fs.writeJson(summaryPath, summary, { spaces: 2 });

    } catch (error) {
      console.error('❌ Failed to update summary:', error);
    }
  }
}

module.exports = new AnalysisLogger();
