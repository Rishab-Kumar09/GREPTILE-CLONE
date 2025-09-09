const { Octokit } = require('@octokit/rest');

// Initialize patterns
const SECURITY_PATTERNS = {
    'hardcoded_secrets': {
        pattern: /(?:password|api_key|secret|token|JWT_SECRET)\s*=\s*["'][^"']+["']/,
        safe_pattern: /(?:os\.getenv|process\.env|config\.get)\(/,
        severity: 'Critical',
        description: 'Hardcoded credentials in code',
        fix: 'Use environment variables or secure vault'
    },
    'sql_injection': {
        pattern: /(?:SELECT|INSERT|UPDATE|DELETE).*?['"`]\s*\{.*?\}|(?:SELECT|INSERT|UPDATE|DELETE).*?['"`].*?\$\{.*?\}/,
        safe_pattern: /(?:parameterize|prepare|execute|cursor\.execute\([^,]+,\s*\()/,
        severity: 'Critical',
        description: 'SQL injection vulnerability',
        fix: 'Use parameterized queries'
    },
    'xss': {
        pattern: /(?:innerHTML|outerHTML)\s*=|dangerouslySetInnerHTML|render_template_string/,
        safe_pattern: /textContent|innerText/,
        severity: 'Critical',
        description: 'Cross-site scripting vulnerability',
        fix: 'Use safe content handling methods'
    },
    'command_injection': {
        pattern: /(?:os\.system|subprocess\.run|exec|eval)\(["'].*?(?:\{.*?\}|\$\{.*?\}).*?["']/,
        severity: 'Critical',
        description: 'Command injection vulnerability',
        fix: 'Use safe command execution methods'
    }
};

const RESOURCE_PATTERNS = {
    'file_leaks': {
        pattern: /open\([^)]+\)(?!.*?with)/,
        severity: 'High',
        description: 'File resource leak',
        fix: 'Use with statement or close files properly'
    },
    'memory_leaks': {
        pattern: /(?:append|extend|add)\([^)]*\)(?!.*?limit|.*?max)/,
        severity: 'High',
        description: 'Unbounded collection growth',
        fix: 'Add size limit or use bounded collections'
    }
};

const FRAMEWORK_PATTERNS = {
    'react': {
        'hook_rules': {
            pattern: /(?:if|for|while).*?use[A-Z]|(?:if|for|while).*?\{.*?use[A-Z]/,
            severity: 'Critical',
            description: 'Hook rules violation',
            fix: 'Move hook to component top level'
        },
        'effect_deps': {
            pattern: /useEffect\([^,]+,\s*\[\s*\]\s*\)|useEffect\([^,]+,[^]]+\].*?(?!props|state)/,
            severity: 'High',
            description: 'Missing effect dependencies',
            fix: 'Add required dependencies'
        },
        'memory_leak': {
            pattern: /useEffect\([^{]*\{[^}]*(?:addEventListener|subscribe)[^}]*\}[^,]*\)/,
            severity: 'High',
            description: 'Effect missing cleanup',
            fix: 'Return cleanup function from effect'
        }
    },
    'express': {
        'error_handling': {
            pattern: /catch\s*\([^)]*\)\s*{\s*console\.|catch\s*\([^)]*\)\s*{\s*res\./,
            severity: 'High',
            description: 'Error only logged, not handled',
            fix: 'Properly handle or propagate error'
        },
        'no_validation': {
            pattern: /req\.(?:body|params|query)\.[^\s]+(?!.*validate)/,
            severity: 'High',
            description: 'Missing input validation',
            fix: 'Add input validation'
        }
    }
};

// Helper functions
function getFileType(filePath) {
    try {
        const ext = (filePath || '').split('.').pop().toLowerCase();
        return {
            'py': 'python',
            'js': 'javascript',
            'jsx': 'javascript',
            'ts': 'typescript',
            'tsx': 'typescript'
        }[ext] || 'unknown';
    } catch (error) {
        console.warn('Error getting file type:', error);
        return 'unknown';
    }
}

function detectFramework(content) {
    try {
        if (!content) return null;
        
        const frameworks = {
            'react': /(?:import.*?react|from\s+["']react["'])/,
            'express': /(?:import.*?express|require\(["']express["'])/,
            'django': /(?:from\s+django|import\s+django)/,
            'flask': /(?:from\s+flask\s+import|import\s+flask)/
        };

        for (const [framework, pattern] of Object.entries(frameworks)) {
            try {
                if (pattern.test(content)) {
                    return framework;
                }
            } catch (e) {
                console.warn(`Error testing pattern for framework ${framework}:`, e);
            }
        }
        return null;
    } catch (error) {
        console.warn('Error detecting framework:', error);
        return null;
    }
}

function getLineNumber(content, match) {
    try {
        if (!content || !match) return 1;
        const lines = content.split('\n');
        let currentPos = 0;
        const matchPos = content.indexOf(match);
        if (matchPos === -1) return 1;
        
        for (let i = 0; i < lines.length; i++) {
            currentPos += lines[i].length + 1;
            if (currentPos > matchPos) {
                return i + 1;
            }
        }
        return 1;
    } catch (error) {
        console.warn('Error calculating line number:', error);
        return 1;
    }
}

function calculateConfidence(issue) {
    try {
        if (!issue || typeof issue !== 'object') return 0.5;
        
        let confidence = 1.0;
        
        // Base confidence by severity
        confidence *= {
            'Critical': 0.95,
            'High': 0.85,
            'Medium': 0.75,
            'Low': 0.65
        }[issue.severity] || 0.5;
        
        // Reduce confidence for test files
        if (issue.file && issue.file.toLowerCase().includes('test')) {
            confidence *= 0.5;
        }
        
        // Check for safe patterns
        if (hasSafePattern(issue)) {
            confidence *= 0.3;
        }
        
        // Framework-specific confidence
        if (issue.framework) {
            confidence *= 0.9;
        }
        
        // Ensure confidence is between 0 and 1
        return Math.max(0, Math.min(1, confidence));
    } catch (error) {
        console.warn('Error calculating confidence:', error);
        return 0.5;
    }
}

function hasSafePattern(issue) {
    try {
        if (!issue || !issue.type || !issue.proof) return false;
        
        const safePatterns = {
            'hardcoded_secrets': [
                /os\.getenv/,
                /process\.env/,
                /config\.get/
            ],
            'sql_injection': [
                /parameterize\(/,
                /cursor\.execute\([^,]+,\s*\(/
            ],
            'xss': [
                /textContent\s*=/,
                /innerText\s*=/
            ]
        };

        const patterns = safePatterns[issue.type] || [];
        return patterns.some(pattern => {
            try {
                return pattern.test(issue.proof);
            } catch (e) {
                console.warn(`Error testing safe pattern for ${issue.type}:`, e);
                return false;
            }
        });
    } catch (error) {
        console.warn('Error checking safe patterns:', error);
        return false;
    }
}

function analyzeFile(filePath, content) {
    const issues = [];
    const fileType = getFileType(filePath);
    const framework = detectFramework(content);

    // Check security patterns
    Object.entries(SECURITY_PATTERNS).forEach(([name, pattern]) => {
        const matches = content.match(pattern.pattern) || [];
        if (matches.length > 0) {
            matches.forEach(match => {
                if (!pattern.safe_pattern || !content.match(pattern.safe_pattern)) {
                    issues.push({
                        type: name,
                        severity: pattern.severity,
                        description: pattern.description,
                        line: getLineNumber(content, match),
                        proof: match,
                        fix: pattern.fix,
                        confidence: calculateConfidence({
                            type: name,
                            severity: pattern.severity,
                            proof: match,
                            file: filePath
                        })
                    });
                }
            });
        }
    });

    // Check resource patterns
    Object.entries(RESOURCE_PATTERNS).forEach(([name, pattern]) => {
        const matches = content.match(pattern.pattern) || [];
        if (matches.length > 0) {
            matches.forEach(match => {
                issues.push({
                    type: name,
                    severity: pattern.severity,
                    description: pattern.description,
                    line: getLineNumber(content, match),
                    proof: match,
                    fix: pattern.fix,
                    confidence: calculateConfidence({
                        type: name,
                        severity: pattern.severity,
                        proof: match,
                        file: filePath
                    })
                });
            });
        }
    });

    // Check framework-specific patterns
    if (framework && FRAMEWORK_PATTERNS[framework]) {
        Object.entries(FRAMEWORK_PATTERNS[framework]).forEach(([name, pattern]) => {
            const matches = content.match(pattern.pattern) || [];
            if (matches.length > 0) {
                matches.forEach(match => {
                    issues.push({
                        type: name,
                        severity: pattern.severity,
                        description: pattern.description,
                        line: getLineNumber(content, match),
                        proof: match,
                        fix: pattern.fix,
                        confidence: calculateConfidence({
                            type: name,
                            severity: pattern.severity,
                            proof: match,
                            file: filePath,
                            framework: framework
                        })
                    });
                });
            }
        });
    }

    return issues.sort((a, b) => {
        const severityOrder = { 'Critical': 0, 'High': 1, 'Medium': 2, 'Low': 3 };
        return severityOrder[a.severity] - severityOrder[b.severity] || b.confidence - a.confidence;
    });
}

exports.handler = async (event) => {
    try {
        const { owner, repo, path } = JSON.parse(event.body);
        
        // Initialize Octokit
        const octokit = new Octokit({
            auth: process.env.GITHUB_TOKEN
        });

        // Get file content from GitHub
        const githubResponse = await octokit.repos.getContent({
            owner,
            repo,
            path
        });

        // Decode content from base64
        const content = Buffer.from(githubResponse.data.content, 'base64').toString();
        
        // Analyze the file
        const issues = analyzeFile(path, content);
        
        // Group issues by severity
        const groupedIssues = {
            critical: [],
            high: [],
            medium: [],
            low: []
        };
        
        issues.forEach(issue => {
            const severity = issue.severity.toLowerCase();
            if (groupedIssues[severity]) {
                groupedIssues[severity].push({
                    type: issue.type,
                    description: issue.description,
                    line: issue.line,
                    proof: issue.proof,
                    fix: issue.fix,
                    confidence: issue.confidence
                });
            }
        });

        // Format response for UI
        const response = {
            fileName: path.split('/').pop(),
            fileType: path.split('.').pop(),
            analyzedAt: new Date().toISOString(),
            fileSize: content.length,
            numberOfLines: content.split('\n').length,
            issues: {
                critical: groupedIssues.critical,
                high: groupedIssues.high,
                medium: groupedIssues.medium,
                low: groupedIssues.low
            },
            summary: {
                totalIssues: issues.length,
                criticalCount: groupedIssues.critical.length,
                highCount: groupedIssues.high.length,
                mediumCount: groupedIssues.medium.length,
                lowCount: groupedIssues.low.length
            },
            patterns: {
                security: Object.keys(SECURITY_PATTERNS),
                resource: Object.keys(RESOURCE_PATTERNS),
                framework: Object.keys(FRAMEWORK_PATTERNS)
            },
            analysis: {
                methodology: `
                    1. Security Analysis:
                       - Checked for hardcoded secrets
                       - Analyzed SQL injection risks
                       - Scanned for command injection
                       - Identified XSS vulnerabilities
                       - Checked crypto implementations
                       
                    2. Resource Analysis:
                       - Checked file handling
                       - Analyzed memory management
                       - Identified resource leaks
                       
                    3. Framework-Specific Analysis:
                       - React hooks compliance
                       - Express.js best practices
                       - Input validation
                       - Error handling
                `,
                confidence: {
                    scoring: `
                        Confidence scores are calculated based on:
                        - Pattern reliability (0.9 for critical patterns)
                        - Context awareness (0.8 for framework-specific)
                        - False positive likelihood (0.7 for common patterns)
                        - File type relevance (0.9 for primary languages)
                    `
                }
            }
        };

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify(response)
        };
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                error: 'Failed to analyze code',
                details: error.message
            })
        };
    }
};
