# Code Analysis Methodology
Based on analyzing multiple files and studying ChatGPT's responses, here's a comprehensive guide to replicate the analysis process without AI.

## 1. Analysis Process Overview

### 1.1 Initial Scan (First Pass)
1. File type detection
2. Basic syntax check
3. Import statement analysis
4. Global variable identification
5. Function/class structure analysis

### 1.2 Deep Analysis (Second Pass)
1. Function-by-function review
2. Variable scope analysis
3. Data flow tracking
4. Resource usage patterns
5. Error handling paths

### 1.3 Security Check (Third Pass)
1. Authentication mechanisms
2. Input validation
3. Command execution
4. Database queries
5. File operations

### 1.4 Logic Analysis (Fourth Pass)
1. Control flow
2. Error conditions
3. Resource cleanup
4. Memory management
5. Loop conditions

## 2. Pattern Categories

### 2.1 Security Patterns
```python
SECURITY_PATTERNS = {
    'hardcoded_secrets': {
        'pattern': r'(?:password|api_key|secret|token)\s*=\s*["\'][^"\']+["\']',
        'safe_pattern': r'(?:os\.getenv|process\.env|config\.get)\(',
        'severity': 'Critical',
        'description': 'Hardcoded credentials in code',
        'fix': 'Use environment variables or secure vault'
    },
    'sql_injection': {
        'pattern': r'(?:SELECT|INSERT|UPDATE|DELETE).*?\{.*?\}',
        'safe_pattern': r'(?:parameterize|prepare|execute)\(',
        'severity': 'Critical',
        'description': 'SQL injection vulnerability',
        'fix': 'Use parameterized queries'
    },
    'command_injection': {
        'pattern': r'(?:os\.system|subprocess\.run|exec)\(["\'].*?\{.*?\}.*?["\']',
        'safe_pattern': None,
        'severity': 'Critical',
        'description': 'Command injection vulnerability',
        'fix': 'Use subprocess.run with args list'
    },
    'shell_injection': {
        'pattern': r'shell\s*=\s*True',
        'severity': 'Critical',
        'description': 'Shell injection vulnerability',
        'fix': 'Avoid shell=True, use argument list'
    },
    'hook_misuse': {
        'pattern': r'(?:if|while|for).*?{.*?use[A-Z].*?}',
        'severity': 'Critical',
        'description': 'React hook called conditionally',
        'fix': 'Move hook to top level of component'
    },
    'stale_closure': {
        'pattern': r'useEffect\([^,]+\)',
        'severity': 'High',
        'description': 'useEffect missing dependencies',
        'fix': 'Add required dependencies to dependency array'
    }
}
```

### 2.2 Logic Patterns
```python
LOGIC_PATTERNS = {
    'infinite_loops': {
        'pattern': r'while\s+True:(?!.*?break)',
        'severity': 'High',
        'description': 'Infinite loop without break',
        'fix': 'Add proper exit condition'
    },
    'division_by_zero': {
        'pattern': r'(?:\/|\%)\s*(?:len|count|size)\(',
        'severity': 'High',
        'description': 'Potential division by zero',
        'fix': 'Add empty collection check'
    },
    'null_pointer': {
        'pattern': r'(?:\w+)\.(?:\w+)\s*(?!\?\.)',
        'severity': 'High',
        'description': 'Potential null pointer dereference',
        'fix': 'Add null check'
    },
    'race_condition': {
        'pattern': r'(?:async|Promise).*?(?:setState|setData)',
        'severity': 'High',
        'description': 'Potential race condition in async state update',
        'fix': 'Use proper state synchronization'
    },
    'memory_leak': {
        'pattern': r'(?:addEventListener|on)\([^)]+\)(?!.*removeEventListener)',
        'severity': 'High',
        'description': 'Event listener without cleanup',
        'fix': 'Remove event listener in cleanup function'
    },
    'stale_state': {
        'pattern': r'setState\([^,]+\)',
        'severity': 'Medium',
        'description': 'setState with stale closure',
        'fix': 'Use functional update form'
    }
}
```

### 2.3 Resource Patterns
```python
RESOURCE_PATTERNS = {
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
    },
    'unclosed_resources': {
        'pattern': r'(?:connect|open|acquire).*?(?!close|release)',
        'severity': 'High',
        'description': 'Unclosed resource',
        'fix': 'Ensure resource is closed'
    },
    'effect_cleanup': {
        'pattern': r'useEffect\([^{]*\{[^}]*(?:addEventListener|setInterval)[^}]*\}[^,]*\)',
        'severity': 'High',
        'description': 'useEffect missing cleanup',
        'fix': 'Return cleanup function'
    },
    'unmanaged_subscription': {
        'pattern': r'subscribe\([^)]+\)(?!.*unsubscribe)',
        'severity': 'High',
        'description': 'Unmanaged subscription',
        'fix': 'Clean up subscription'
    }
}

### 2.4 Framework-Specific Patterns

#### 2.4.1 React Patterns
```python
REACT_PATTERNS = {
    'hook_rules': {
        'pattern': r'(?:if|for|while).*?use[A-Z]',
        'severity': 'Critical',
        'description': 'Hook rules violation',
        'fix': 'Move hook to component top level'
    },
    'missing_deps': {
        'pattern': r'useEffect\([^,]+,\s*\[\s*\]\s*\)',
        'severity': 'High',
        'description': 'Missing effect dependencies',
        'fix': 'Add required dependencies'
    },
    'state_in_effect': {
        'pattern': r'useEffect\([^{]*\{[^}]*setState[^}]*\}[^,]*\)',
        'severity': 'Medium',
        'description': 'setState in effect without deps',
        'fix': 'Add dependencies or use functional update'
    },
    'ref_state_sync': {
        'pattern': r'useRef\([^)]*\).*?useState',
        'severity': 'Medium',
        'description': 'Potential ref/state sync issues',
        'fix': 'Consider using state only'
    }
}

#### 2.4.2 Node.js Patterns
```python
NODEJS_PATTERNS = {
    'callback_hell': {
        'pattern': r'}\s*\)\s*\.\s*then\s*\(\s*function\s*\([^)]*\)\s*{\s*.*?}\s*\)\s*\.\s*then',
        'severity': 'Medium',
        'description': 'Nested promise chains',
        'fix': 'Use async/await'
    },
    'unhandled_error': {
        'pattern': r'catch\s*\([^)]*\)\s*{\s*console\.',
        'severity': 'High',
        'description': 'Error only logged, not handled',
        'fix': 'Properly handle or propagate error'
    },
    'sync_in_async': {
        'pattern': r'async\s+function.*?(?:readFileSync|writeFileSync)',
        'severity': 'Medium',
        'description': 'Synchronous operation in async function',
        'fix': 'Use async alternatives'
    }
}

#### 2.4.3 Express.js Patterns
```python
EXPRESS_PATTERNS = {
    'no_error_next': {
        'pattern': r'catch\s*\([^)]*\)\s*{[^}]*res\.',
        'severity': 'High',
        'description': 'Error not passed to next()',
        'fix': 'Use next(error) in catch'
    },
    'sync_middleware': {
        'pattern': r'app\.(get|post|put|delete)\([^,]+,\s*function\s*\([^)]*\)\s*{[^}]*await',
        'severity': 'High',
        'description': 'Async operation without async middleware',
        'fix': 'Add async keyword to middleware'
    },
    'body_validation': {
        'pattern': r'req\.body\.[^\s]+(?!.*validate)',
        'severity': 'High',
        'description': 'Missing request body validation',
        'fix': 'Add input validation'
    }
}
```

## 3. Optimization Rules

### 2.5 Language-Specific Analysis

Different programming languages require different analysis approaches due to their unique features and common patterns.

#### 2.5.1 Python Analysis
```python
PYTHON_ANALYSIS = {
    'imports': {
        'dangerous_imports': ['os', 'subprocess', 'pickle', 'marshal'],
        'check': 'Look for unsafe imports that could lead to RCE'
    },
    'string_formatting': {
        'dangerous_patterns': [
            r'%s.*?(?:SELECT|INSERT|UPDATE|DELETE)',  # Old-style formatting
            r'\{.*?\}.*?(?:SELECT|INSERT|UPDATE|DELETE)',  # New-style formatting
            r'f["\'].*?\{.*?\}.*?(?:SELECT|INSERT|UPDATE|DELETE)'  # f-strings
        ],
        'safe_patterns': [
            r'cursor\.execute\([^,]+,\s*\(',  # Parameterized query
            r'\.format\([^)]*\%\([^)]+\)\)'   # Named parameters
        ]
    },
    'file_operations': {
        'check_patterns': [
            r'open\([^)]+\)',
            r'with\s+open\([^)]+\)\s+as'
        ],
        'validate': 'Ensure proper file handling with context managers'
    }
}

#### 2.5.2 JavaScript/TypeScript Analysis
```python
JS_TS_ANALYSIS = {
    'async_patterns': {
        'dangerous': [
            r'new\s+Promise\s*\(\s*function\s*\([^)]*\)\s*{',  # Promise constructor anti-pattern
            r'async\s+function.*?return\s+new\s+Promise',      # Unnecessary Promise wrapping
            r'setTimeout\s*\(\s*function\s*\(\)\s*{'           # Timeout without cleanup
        ],
        'check': 'Look for common async/Promise anti-patterns'
    },
    'dom_manipulation': {
        'dangerous': [
            r'innerHTML\s*=',           # innerHTML assignment
            r'outerHTML\s*=',           # outerHTML assignment
            r'document\.write\(',        # document.write
            r'eval\(',                  # eval
            r'new\s+Function\('         # new Function
        ],
        'safe': [
            r'textContent\s*=',         # textContent
            r'innerText\s*='            # innerText
        ]
    },
    'type_checking': {
        'patterns': [
            r'typeof\s+[^=]+\s*===?\s*["\']undefined["\']',  # typeof check
            r'instanceof\s+',                                 # instanceof
            r'Object\.prototype\.toString\.call'              # toString tag
        ],
        'check': 'Ensure proper type checking'
    }
}

#### 2.5.3 SQL Analysis
```python
SQL_ANALYSIS = {
    'injection_patterns': {
        'dangerous': [
            r'EXECUTE\s+IMMEDIATE',     # Dynamic SQL execution
            r'sp_executesql\s+@sql',    # SQL Server dynamic SQL
            r'EXEC\s*\(\s*@stmt\)',     # EXEC with variable
        ],
        'safe': [
            r'PREPARE\s+stmt',          # Prepared statement
            r'USING\s+\?',              # Parameter placeholder
            r'@\w+'                     # Named parameter
        ]
    },
    'performance_patterns': {
        'check': [
            r'SELECT\s+\*',             # SELECT *
            r'NOT\s+IN\s*\(',           # NOT IN
            r'OR\s+\w+\s*(?:=|LIKE)',   # Multiple OR conditions
            r'LIKE\s+["\']%'            # Leading wildcard
        ]
    }
}

### 2.6 AST-Based Analysis

Some patterns are better checked using Abstract Syntax Tree (AST) traversal rather than regex. Here are the key AST-based checks:

```python
AST_CHECKS = {
    'hook_placement': {
        'description': 'Check if hooks are called at component top level',
        'node_type': 'CallExpression',
        'check': '''
def check_hook_placement(node, parent_chain):
    # Check if function name starts with 'use'
    if node.callee.name.startswith('use'):
        # Check parent chain for conditionals/loops
        for parent in parent_chain:
            if parent.type in ['IfStatement', 'WhileStatement', 'ForStatement']:
                return {
                    'severity': 'Critical',
                    'type': 'Hook Rules Violation',
                    'description': 'Hook called inside conditional or loop',
                    'fix': 'Move hook to component top level'
                }
    return None
'''
    },
    'effect_deps': {
        'description': 'Check useEffect dependency array',
        'node_type': 'CallExpression',
        'check': '''
def check_effect_deps(node):
    if node.callee.name == 'useEffect':
        # Get function body and dependency array
        body = node.arguments[0].body
        deps = node.arguments[1] if len(node.arguments) > 1 else None
        
        # Find all referenced variables in body
        refs = find_references(body)
        
        # Check if all refs are in deps
        if deps and not all(ref in deps.elements for ref in refs):
            return {
                'severity': 'High',
                'type': 'Missing Dependencies',
                'description': 'useEffect missing dependencies',
                'fix': 'Add missing dependencies: ' + ', '.join(refs)
            }
    return None
'''
    },
    'state_updates': {
        'description': 'Check state update patterns',
        'node_type': 'CallExpression',
        'check': '''
def check_state_updates(node, scope):
    if node.callee.name.endswith('setState'):
        # Check if update uses previous state
        if node.arguments[0].type != 'FunctionExpression':
            # Check if state is used in computation
            state_var = node.callee.object.name
            if state_var in find_references(node.arguments[0]):
                return {
                    'severity': 'Medium',
                    'type': 'State Update',
                    'description': 'setState with value from current state',
                    'fix': 'Use functional update form'
                }
    return None
'''
    },
    'error_handling': {
        'description': 'Check error handling patterns',
        'node_type': 'CatchClause',
        'check': '''
def check_error_handling(node):
    # Check if error is only logged
    if has_only_console_statement(node.body):
        return {
            'severity': 'High',
            'type': 'Unhandled Error',
            'description': 'Error only logged, not handled',
            'fix': 'Add proper error handling'
        }
    return None
'''
    }
}
```

### 3.1 File Prioritization
```python
OPTIMIZATION_RULES = {
    'skip_patterns': [
        r'^\s*import\s+',     # Skip import statements
        r'^\s*#',             # Skip comments
        r'^\s*"""',           # Skip docstrings
        r'^\s*$',             # Skip empty lines
    ],
    
    'prioritize_files': [
        '**/auth/**',         # Authentication files
        '**/security/**',     # Security-related files
        '**/api/**',          # API endpoints
        '**/db/**',           # Database operations
        '**/payment/**',      # Payment processing
        '**/user/**'          # User data handling
    ],
    
    'skip_files': [
        '**/test/**',         # Test files
        '**/docs/**',         # Documentation
        '**/vendor/**',       # Third-party code
        '**/*.min.js',        # Minified files
        '**/node_modules/**', # Node modules
        '**/__pycache__/**'   # Python cache
    ],
    
    'confidence_thresholds': {
        'Critical': 0.9,      # Very high confidence needed
        'High': 0.7,          # High confidence needed
        'Medium': 0.5,        # Medium confidence acceptable
    }
}
```

### 3.2 False Positive Reduction
1. Safe Patterns to Ignore:
   - Environment variable usage (`os.getenv`, `process.env`)
   - Parameterized queries
   - Proper error handling
   - Standard library imports
   - Well-known secure practices

2. Context Awareness:
   - HTML/SQL strings in other language files
   - Template strings used safely
   - Framework-specific security measures
   - Language idioms and best practices
   - Common development patterns

## 4. Issue Reporting Format

### 4.1 Issue Structure
```python
ISSUE_TEMPLATE = {
    'severity': '',          # Critical, High, Medium
    'category': '',          # Security, Logic, Resource
    'type': '',             # Specific issue type
    'location': '',         # File and line number
    'description': '',      # Detailed description
    'proof': '',           # Code snippet
    'impact': '',          # Potential consequences
    'reproduction': '',    # Steps to reproduce
    'fix': '',            # How to fix
    'alternatives': '',    # Alternative solutions
    'prevention': '',      # How to prevent
    'confidence': 0.0     # Confidence score
}
```

### 4.2 Severity Levels
1. Critical:
   - Security vulnerabilities
   - Data loss risks
   - System crashes
   - Authentication bypass

2. High:
   - Resource leaks
   - Logic errors
   - Performance issues
   - Error handling problems

3. Medium:
   - Code quality issues
   - Minor logic flaws
   - Style violations
   - Documentation needs

## 5. Analysis Implementation

### 5.1 Main Analysis Function
```python
def analyze_code(file_content: str) -> Dict:
    """Main analysis function"""
    issues = []
    
    # 1. Initial Scan
    issues.extend(check_basic_structure(file_content))
    
    # 2. Security Scan
    issues.extend(check_security_issues(file_content))
    
    # 3. Logic Analysis
    issues.extend(check_logic_issues(file_content))
    
    # 4. Resource Management
    issues.extend(check_resource_issues(file_content))
    
    # 5. Filter and Format
    return format_issues(filter_issues(issues))
```

### 5.2 Confidence Scoring

The confidence scoring system helps reduce false positives by considering various factors that might affect the reliability of a finding.

```python
def calculate_confidence(issue: Dict) -> float:
    """Calculate confidence score for an issue"""
    confidence = 1.0
    
    # Base confidence by severity
    confidence *= {
        'Critical': 0.95,
        'High': 0.85,
        'Medium': 0.75,
        'Low': 0.65
    }.get(issue['severity'], 0.5)
    
    # File type factors
    if is_test_file(issue['file']):
        confidence *= 0.5
    if is_generated_file(issue['file']):
        confidence *= 0.3
    if is_third_party_file(issue['file']):
        confidence *= 0.4
        
    # Pattern factors
    if has_safe_pattern(issue['proof']):
        confidence *= 0.3
    if is_common_false_positive(issue):
        confidence *= 0.4
    if in_ignored_context(issue):
        confidence *= 0.2
        
    # Language-specific factors
    confidence *= get_language_confidence(issue)
    
    # Framework-specific factors
    confidence *= get_framework_confidence(issue)
    
    return confidence

def get_language_confidence(issue: Dict) -> float:
    """Calculate language-specific confidence modifiers"""
    modifiers = {
        'python': {
            'hardcoded_secrets': 0.9 if 'os.getenv' in issue['proof'] else 1.0,
            'sql_injection': 0.8 if 'cursor.execute' in issue['proof'] else 1.0,
            'file_operations': 0.7 if 'with open' in issue['proof'] else 1.0
        },
        'javascript': {
            'xss': 0.8 if 'dangerouslySetInnerHTML' in issue['proof'] else 1.0,
            'eval': 0.95 if 'eval(' in issue['proof'] else 1.0,
            'prototype_pollution': 0.9
        },
        'typescript': {
            'type_casting': 0.85,
            'null_checks': 0.9,
            'any_usage': 0.7
        }
    }
    
    lang = get_file_language(issue['file'])
    issue_type = issue['type'].lower()
    
    return modifiers.get(lang, {}).get(issue_type, 1.0)

def get_framework_confidence(issue: Dict) -> float:
    """Calculate framework-specific confidence modifiers"""
    modifiers = {
        'react': {
            'hook_rules': 0.95,
            'effect_deps': 0.85,
            'state_updates': 0.8,
            'ref_usage': 0.75
        },
        'express': {
            'middleware': 0.9,
            'route_handlers': 0.85,
            'error_handling': 0.8
        },
        'django': {
            'orm_queries': 0.9,
            'template_rendering': 0.85,
            'form_validation': 0.8
        }
    }
    
    framework = detect_framework(issue['file'])
    issue_type = issue['type'].lower()
    
    return modifiers.get(framework, {}).get(issue_type, 1.0)

def is_common_false_positive(issue: Dict) -> bool:
    """Check if issue matches known false positive patterns"""
    false_positive_patterns = {
        'hardcoded_secrets': [
            r'os\.getenv',
            r'process\.env',
            r'config\.get'
        ],
        'sql_injection': [
            r'parameterize\(',
            r'cursor\.execute\([^,]+,\s*\('
        ],
        'xss': [
            r'textContent\s*=',
            r'innerText\s*='
        ],
        'file_operations': [
            r'with\s+open\(',
            r'\.close\(\)'
        ]
    }
    
    pattern_type = issue['type'].lower()
    patterns = false_positive_patterns.get(pattern_type, [])
    
    return any(re.search(p, issue['proof']) for p in patterns)

def in_ignored_context(issue: Dict) -> bool:
    """Check if issue is in an ignored context"""
    ignored_contexts = {
        'test_files': r'(test|spec)\.(js|ts|py)$',
        'documentation': r'\.(md|rst|txt)$',
        'configuration': r'\.(config|conf|ini|json|yaml|yml)$',
        'generated_code': r'(generated|\.g\.)',
        'third_party': r'(node_modules|venv|vendor)',
        'examples': r'examples?/',
        'comments': r'^\s*[#/]',
        'debug_code': r'console\.(log|debug|info)'
    }
    
    file_path = issue['file']
    proof = issue['proof']
    
    for context, pattern in ignored_contexts.items():
        if re.search(pattern, file_path) or re.search(pattern, proof):
            return True
            
    return False
```

## 6. Testing Strategy

### 6.1 Test Files
1. Known vulnerable files
2. Clean, well-written files
3. Mixed files with both issues and good practices
4. Files with known false positives
5. Large, complex files
6. Files with multiple languages/contexts

### 6.2 Validation Process
1. Run analysis on test file
2. Compare with known issues
3. Check for false positives
4. Verify issue locations
5. Validate fix suggestions
6. Test edge cases

## 7. Continuous Improvement

### 7.1 Pattern Updates
1. Add new vulnerability patterns
2. Update safe patterns
3. Refine regex patterns
4. Add language-specific patterns
5. Update confidence scoring

### 7.2 False Positive Reduction
1. Track and analyze false positives
2. Update pattern exclusions
3. Improve context awareness
4. Refine confidence scoring
5. Add new safe patterns

### 7.3 Performance Optimization
1. Cache analysis results
2. Optimize regex patterns
3. Improve file filtering
4. Parallel processing
5. Incremental analysis
