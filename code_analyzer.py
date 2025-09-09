import re
import ast
from typing import List, Dict, Any
from pathlib import Path

class CodeAnalyzer:
    def __init__(self):
        # Load patterns from methodology
        self.security_patterns = {
            'hardcoded_secrets': {
                'pattern': r'(?:password|api_key|secret|token|JWT_SECRET)\s*=\s*["\'][^"\']+["\']',
                'safe_pattern': r'(?:os\.getenv|process\.env|config\.get)\(',
                'severity': 'Critical',
                'description': 'Hardcoded credentials in code',
                'fix': 'Use environment variables or secure vault'
            },
            'sql_injection': {
                'pattern': r'(?:SELECT|INSERT|UPDATE|DELETE).*?[\'"`]\s*\{.*?\}|(?:SELECT|INSERT|UPDATE|DELETE).*?[\'"`].*?\$\{.*?\}',
                'safe_pattern': r'(?:parameterize|prepare|execute|cursor\.execute\([^,]+,\s*\()',
                'severity': 'Critical',
                'description': 'SQL injection vulnerability',
                'fix': 'Use parameterized queries'
            },
            'command_injection': {
                'pattern': r'(?:os\.system|subprocess\.run|exec|eval)\(["\'].*?(?:\{.*?\}|\$\{.*?\}).*?["\']',
                'safe_pattern': None,
                'severity': 'Critical',
                'description': 'Command injection vulnerability',
                'fix': 'Use subprocess.run with args list'
            },
            'xss': {
                'pattern': r'(?:innerHTML|outerHTML)\s*=|dangerouslySetInnerHTML|render_template_string',
                'safe_pattern': r'textContent|innerText',
                'severity': 'Critical',
                'description': 'Cross-site scripting vulnerability',
                'fix': 'Use safe content handling methods'
            },
            'insecure_deserialization': {
                'pattern': r'(?:pickle\.loads|yaml\.load|eval\(["\'])|new\s+Function\(',
                'safe_pattern': None,
                'severity': 'Critical',
                'description': 'Insecure deserialization',
                'fix': 'Use safe deserialization methods'
            },
            'path_traversal': {
                'pattern': r'(?:open|readFile|writeFile)\s*\([^)]*?(?:req\.(?:params|query|body)|user).*?\)',
                'safe_pattern': None,
                'severity': 'Critical',
                'description': 'Path traversal vulnerability',
                'fix': 'Validate and sanitize file paths'
            },
            'weak_crypto': {
                'pattern': r'(?:md5|sha1)\(',
                'safe_pattern': None,
                'severity': 'Critical',
                'description': 'Weak cryptographic algorithm',
                'fix': 'Use strong cryptographic algorithms'
            }
        }
        
        self.resource_patterns = {
            'file_leaks': {
                'pattern': r'open\([^)]+\)(?!.*?with)',
                'severity': 'High',
                'description': 'File resource leak',
                'fix': 'Use with statement'
            },
            'memory_leaks': {
                'pattern': r'(?:append|extend|add)\([^)]*\)(?!.*?limit|.*?max)',
                'severity': 'High',
                'description': 'Unbounded collection growth',
                'fix': 'Add size limit'
            }
        }
        
        self.framework_patterns = {
            'react': {
                'hook_rules': {
                    'pattern': r'(?:if|for|while).*?use[A-Z]|(?:if|for|while).*?\{.*?use[A-Z]',
                    'severity': 'Critical',
                    'description': 'Hook rules violation',
                    'fix': 'Move hook to component top level'
                },
                'effect_deps': {
                    'pattern': r'useEffect\([^,]+,\s*\[\s*\]\s*\)|useEffect\([^,]+,[^]]+\].*?(?!props|state)',
                    'severity': 'High',
                    'description': 'Missing effect dependencies',
                    'fix': 'Add required dependencies'
                },
                'memory_leak': {
                    'pattern': r'useEffect\([^{]*\{[^}]*(?:addEventListener|subscribe)[^}]*\}[^,]*\)',
                    'severity': 'High',
                    'description': 'Effect missing cleanup',
                    'fix': 'Return cleanup function from effect'
                },
                'unsafe_html': {
                    'pattern': r'dangerouslySetInnerHTML\s*=\s*\{',
                    'severity': 'Critical',
                    'description': 'Unsafe HTML injection',
                    'fix': 'Use safe content rendering methods'
                },
                'state_update': {
                    'pattern': r'set\w+\([^(]*\w+\s*[+\-*/]\s*\w+\)',
                    'severity': 'Medium',
                    'description': 'State update using stale value',
                    'fix': 'Use functional update form'
                }
            },
            'express': {
                'error_handling': {
                    'pattern': r'catch\s*\([^)]*\)\s*{\s*console\.|catch\s*\([^)]*\)\s*{\s*res\.',
                    'severity': 'High',
                    'description': 'Error only logged, not handled',
                    'fix': 'Properly handle or propagate error'
                },
                'no_validation': {
                    'pattern': r'req\.(?:body|params|query)\.[^\s]+(?!.*validate)',
                    'severity': 'High',
                    'description': 'Missing input validation',
                    'fix': 'Add input validation'
                },
                'sync_code': {
                    'pattern': r'app\.(get|post|put|delete)\([^,]+,\s*function\s*\([^)]*\)\s*{[^}]*await',
                    'severity': 'High',
                    'description': 'Sync function with async code',
                    'fix': 'Add async keyword to function'
                }
            }
        }

    def analyze_file(self, file_path: str) -> List[Dict[str, Any]]:
        """Analyze a single file for issues"""
        issues = []
        
        # Read file content
        with open(file_path, 'r') as f:
            content = f.read()
        
        # Determine file type and framework
        file_type = self._get_file_type(file_path)
        framework = self._detect_framework(content)
        
        # Check security patterns
        for name, pattern in self.security_patterns.items():
            matches = re.finditer(pattern['pattern'], content)
            for match in matches:
                if pattern.get('safe_pattern') and re.search(pattern['safe_pattern'], content):
                    continue
                    
                issues.append({
                    'type': name,
                    'severity': pattern['severity'],
                    'description': pattern['description'],
                    'line': content.count('\n', 0, match.start()) + 1,
                    'proof': match.group(0),
                    'fix': pattern['fix'],
                    'confidence': self._calculate_confidence({
                        'type': name,
                        'severity': pattern['severity'],
                        'proof': match.group(0),
                        'file': file_path
                    })
                })
        
        # Check resource patterns
        for name, pattern in self.resource_patterns.items():
            matches = re.finditer(pattern['pattern'], content)
            for match in matches:
                issues.append({
                    'type': name,
                    'severity': pattern['severity'],
                    'description': pattern['description'],
                    'line': content.count('\n', 0, match.start()) + 1,
                    'proof': match.group(0),
                    'fix': pattern['fix'],
                    'confidence': self._calculate_confidence({
                        'type': name,
                        'severity': pattern['severity'],
                        'proof': match.group(0),
                        'file': file_path
                    })
                })
        
        # Check framework-specific patterns
        if framework and framework in self.framework_patterns:
            for name, pattern in self.framework_patterns[framework].items():
                matches = re.finditer(pattern['pattern'], content)
                for match in matches:
                    issues.append({
                        'type': name,
                        'severity': pattern['severity'],
                        'description': pattern['description'],
                        'line': content.count('\n', 0, match.start()) + 1,
                        'proof': match.group(0),
                        'fix': pattern['fix'],
                        'confidence': self._calculate_confidence({
                            'type': name,
                            'severity': pattern['severity'],
                            'proof': match.group(0),
                            'file': file_path
                        })
                    })
        
        return sorted(issues, key=lambda x: (
            {'Critical': 0, 'High': 1, 'Medium': 2, 'Low': 3}.get(x['severity'], 4),
            -x['confidence']
        ))

    def _get_file_type(self, file_path: str) -> str:
        """Determine file type from extension"""
        ext = Path(file_path).suffix.lower()
        return {
            '.py': 'python',
            '.js': 'javascript',
            '.jsx': 'javascript',
            '.ts': 'typescript',
            '.tsx': 'typescript'
        }.get(ext, 'unknown')

    def _detect_framework(self, content: str) -> str:
        """Detect framework from imports and patterns"""
        frameworks = {
            'react': r'(?:import.*?react|from\s+["\']react["\'])',
            'express': r'(?:import.*?express|require\(["\']express["\'])',
            'django': r'(?:from\s+django|import\s+django)',
            'flask': r'(?:from\s+flask\s+import|import\s+flask)'
        }
        
        for framework, pattern in frameworks.items():
            if re.search(pattern, content):
                return framework
        return None

    def _calculate_confidence(self, issue: Dict) -> float:
        """Calculate confidence score for an issue"""
        confidence = 1.0
        
        # Base confidence by severity
        confidence *= {
            'Critical': 0.95,
            'High': 0.85,
            'Medium': 0.75,
            'Low': 0.65
        }.get(issue['severity'], 0.5)
        
        # Reduce confidence for test files
        if 'test' in issue['file'].lower():
            confidence *= 0.5
        
        # Check for safe patterns
        if self._has_safe_pattern(issue):
            confidence *= 0.3
        
        return confidence

    def _has_safe_pattern(self, issue: Dict) -> bool:
        """Check if issue matches known safe patterns"""
        safe_patterns = {
            'hardcoded_secrets': [
                r'os\.getenv',
                r'process\.env',
                r'config\.get'
            ],
            'sql_injection': [
                r'parameterize\(',
                r'cursor\.execute\([^,]+,\s*\('
            ]
        }
        
        patterns = safe_patterns.get(issue['type'], [])
        return any(re.search(p, issue['proof']) for p in patterns)

def main():
    analyzer = CodeAnalyzer()
    
    # Get all files in test_samples directory
    import os
    test_files = [f for f in os.listdir('test_samples') if os.path.isfile(os.path.join('test_samples', f))]
    
    # Analyze each file
    for file in test_files:
        print(f"\n{'='*50}")
        print(f"Analyzing {file}:")
        print(f"{'='*50}")
        
        try:
            issues = analyzer.analyze_file(os.path.join('test_samples', file))
            if not issues:
                print("No issues found.")
                continue
                
            for issue in issues:
                print(f"\n{issue['severity']} ({issue['confidence']:.2f} confidence): {issue['type']}")
                print(f"Line {issue['line']}: {issue['description']}")
                print(f"Proof: {issue['proof']}")
                print(f"Fix: {issue['fix']}")
        except Exception as e:
            print(f"Error analyzing file: {str(e)}")

if __name__ == '__main__':
    main()
