interface Pattern {
    pattern: RegExp;
    safe_pattern?: RegExp;
    severity: 'Critical' | 'High' | 'Medium' | 'Low';
    description: string;
    fix: string;
}

interface Issue {
    type: string;
    severity: 'Critical' | 'High' | 'Medium' | 'Low';
    description: string;
    line: number;
    proof: string;
    fix: string;
    confidence: number;
    framework?: string;
}

export class CodeAnalyzer {
    private security_patterns: Record<string, Pattern>;
    private resource_patterns: Record<string, Pattern>;
    private framework_patterns: Record<string, Record<string, Pattern>>;

    constructor() {
        this.security_patterns = {
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

        this.resource_patterns = {
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

        this.framework_patterns = {
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
    }

    analyze_file(filePath: string, content: string): Issue[] {
        const issues: Issue[] = [];
        const fileType = this._getFileType(filePath);
        const framework = this._detectFramework(content);

        // Check security patterns
        Object.entries(this.security_patterns).forEach(([name, pattern]) => {
            const matches = content.match(pattern.pattern);
            if (matches) {
                matches.forEach(match => {
                    if (!pattern.safe_pattern || !content.match(pattern.safe_pattern)) {
                        issues.push({
                            type: name,
                            severity: pattern.severity,
                            description: pattern.description,
                            line: this._getLineNumber(content, match),
                            proof: match,
                            fix: pattern.fix,
                            confidence: this._calculateConfidence({
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
        Object.entries(this.resource_patterns).forEach(([name, pattern]) => {
            const matches = content.match(pattern.pattern);
            if (matches) {
                matches.forEach(match => {
                    issues.push({
                        type: name,
                        severity: pattern.severity,
                        description: pattern.description,
                        line: this._getLineNumber(content, match),
                        proof: match,
                        fix: pattern.fix,
                        confidence: this._calculateConfidence({
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
        if (framework && this.framework_patterns[framework]) {
            Object.entries(this.framework_patterns[framework]).forEach(([name, pattern]) => {
                const matches = content.match(pattern.pattern);
                if (matches) {
                    matches.forEach(match => {
                        issues.push({
                            type: name,
                            severity: pattern.severity,
                            description: pattern.description,
                            line: this._getLineNumber(content, match),
                            proof: match,
                            fix: pattern.fix,
                            confidence: this._calculateConfidence({
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

    private _getFileType(filePath: string): string {
        const ext = filePath.split('.').pop()?.toLowerCase() || '';
        return {
            'py': 'python',
            'js': 'javascript',
            'jsx': 'javascript',
            'ts': 'typescript',
            'tsx': 'typescript'
        }[ext] || 'unknown';
    }

    private _detectFramework(content: string): string | null {
        const frameworks = {
            'react': /(?:import.*?react|from\s+["']react["'])/,
            'express': /(?:import.*?express|require\(["']express["'])/,
            'django': /(?:from\s+django|import\s+django)/,
            'flask': /(?:from\s+flask\s+import|import\s+flask)/
        };

        for (const [framework, pattern] of Object.entries(frameworks)) {
            if (pattern.test(content)) {
                return framework;
            }
        }
        return null;
    }

    private _getLineNumber(content: string, match: string): number {
        const lines = content.split('\n');
        let currentPos = 0;
        for (let i = 0; i < lines.length; i++) {
            currentPos += lines[i].length + 1;
            if (currentPos > content.indexOf(match)) {
                return i + 1;
            }
        }
        return 1;
    }

    private _calculateConfidence(issue: { type: string; severity: string; proof: string; file: string; framework?: string }): number {
        let confidence = 1.0;
        
        // Base confidence by severity
        confidence *= {
            'Critical': 0.95,
            'High': 0.85,
            'Medium': 0.75,
            'Low': 0.65
        }[issue.severity] || 0.5;
        
        // Reduce confidence for test files
        if (issue.file.toLowerCase().includes('test')) {
            confidence *= 0.5;
        }
        
        // Check for safe patterns
        if (this._hasSafePattern(issue)) {
            confidence *= 0.3;
        }
        
        // Framework-specific confidence
        if (issue.framework) {
            confidence *= 0.9;
        }
        
        return confidence;
    }

    private _hasSafePattern(issue: { type: string; proof: string }): boolean {
        const safePatterns: Record<string, RegExp[]> = {
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
        return patterns.some(pattern => pattern.test(issue.proof));
    }
}
