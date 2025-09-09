import { NextRequest, NextResponse } from 'next/server';
import { CodeAnalyzer } from './code_analyzer';

// Initialize the analyzer
const analyzer = new CodeAnalyzer();

export async function POST(req: NextRequest) {
    try {
        const { content, fileName } = await req.json();
        
        // Analyze the file
        const issues = analyzer.analyze_file(fileName, content);
        
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
            fileName: fileName.split('/').pop(),
            fileType: fileName.split('.').pop(),
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
                security: Object.keys(analyzer.security_patterns),
                resource: Object.keys(analyzer.resource_patterns),
                framework: Object.keys(analyzer.framework_patterns)
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

        return NextResponse.json(response);
    } catch (error) {
        console.error('Error:', error);
        return NextResponse.json(
            { error: 'Failed to analyze code', details: error.message },
            { status: 500 }
        );
    }
}
