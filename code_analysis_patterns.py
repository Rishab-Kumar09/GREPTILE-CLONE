import re
import ast
from typing import List, Dict, Any, Tuple

class SecurityPatternChecker:
    def __init__(self):
        # Patterns we learned from analysis
        self.credential_patterns = {
            'hardcoded_secrets': r'(?:password|api_key|secret|token|key)\s*=\s*["\'][^"\']+["\']',
            'safe_patterns': r'(?:os\.getenv|process\.env|config\.get|secrets\.get)\(["\'][^"\']+["\']\)',
        }
        
        self.injection_patterns = {
            'sql_injection': r'f["\'].*?\{.*?\}.*?(?:SELECT|INSERT|UPDATE|DELETE).*?["\']',
            'command_injection': r'(?:os\.system|subprocess\.run|subprocess\.Popen)\(["\'].*?\{.*?\}.*?["\'].*?\)',
            'shell_injection': r'shell\s*=\s*True',
        }
        
        self.resource_patterns = {
            'file_leaks': r'open\([^)]+\)(?!.*?with)',
            'infinite_loops': r'while\s+True:(?!.*?break)',
            'memory_leaks': r'(?:append|extend|add)\([^)]*\)(?!.*?limit|.*?max)',
        }

    def check_credentials(self, code: str) -> List[Dict[str, Any]]:
        """Check for credential-related issues"""
        issues = []
        
        # Check for hardcoded secrets
        for match in re.finditer(self.credential_patterns['hardcoded_secrets'], code):
            issues.append({
                'severity': 'Critical',
                'category': 'Security',
                'type': 'Hardcoded secrets',
                'location': f'Line {code.count(chr(10), 0, match.start()) + 1}',
                'description': 'Hardcoded credential found in code',
                'proof': match.group(0),
                'fix': 'Use environment variables or secure secret storage'
            })
            
        return issues

    def check_injections(self, code: str) -> List[Dict[str, Any]]:
        """Check for various injection vulnerabilities"""
        issues = []
        
        # Check for SQL injection
        for match in re.finditer(self.injection_patterns['sql_injection'], code):
            issues.append({
                'severity': 'Critical',
                'category': 'Security',
                'type': 'SQL Injection',
                'location': f'Line {code.count(chr(10), 0, match.start()) + 1}',
                'description': 'Potential SQL injection through string formatting',
                'proof': match.group(0),
                'fix': 'Use parameterized queries'
            })
            
        # Check for command injection
        for match in re.finditer(self.injection_patterns['command_injection'], code):
            issues.append({
                'severity': 'Critical',
                'category': 'Security',
                'type': 'Command Injection',
                'location': f'Line {code.count(chr(10), 0, match.start()) + 1}',
                'description': 'Potential command injection through string formatting',
                'proof': match.group(0),
                'fix': 'Use subprocess.run with a list of arguments'
            })
            
        return issues

    def check_resources(self, code: str) -> List[Dict[str, Any]]:
        """Check for resource management issues"""
        issues = []
        
        # Check for file leaks
        for match in re.finditer(self.resource_patterns['file_leaks'], code):
            issues.append({
                'severity': 'High',
                'category': 'Code Quality',
                'type': 'Resource leak',
                'location': f'Line {code.count(chr(10), 0, match.start()) + 1}',
                'description': 'File opened without using context manager',
                'proof': match.group(0),
                'fix': 'Use "with open(...) as f:" pattern'
            })
            
        # Check for infinite loops
        for match in re.finditer(self.resource_patterns['infinite_loops'], code):
            issues.append({
                'severity': 'High',
                'category': 'Logic',
                'type': 'Infinite loop',
                'location': f'Line {code.count(chr(10), 0, match.start()) + 1}',
                'description': 'Potential infinite loop without break condition',
                'proof': match.group(0),
                'fix': 'Add proper exit condition'
            })
            
        return issues

class LogicPatternChecker:
    def check_null_pointers(self, code: str) -> List[Dict[str, Any]]:
        """Check for potential null pointer issues"""
        tree = ast.parse(code)
        issues = []
        
        for node in ast.walk(tree):
            # Check for attribute access without existence check
            if isinstance(node, ast.Attribute):
                issues.append({
                    'severity': 'High',
                    'category': 'Logic',
                    'type': 'Null pointer',
                    'location': f'Line {node.lineno}',
                    'description': 'Potential null pointer dereference',
                    'fix': 'Add null check before accessing attribute'
                })
                
        return issues

    def check_error_handling(self, code: str) -> List[Dict[str, Any]]:
        """Check for error handling issues"""
        tree = ast.parse(code)
        issues = []
        
        for node in ast.walk(tree):
            # Check for bare except clauses
            if isinstance(node, ast.ExceptHandler) and node.type is None:
                issues.append({
                    'severity': 'Medium',
                    'category': 'Code Quality',
                    'type': 'Broad exception handling',
                    'location': f'Line {node.lineno}',
                    'description': 'Using bare except clause',
                    'fix': 'Catch specific exceptions'
                })
                
        return issues

def analyze_code(code: str) -> Dict[str, List[Dict[str, Any]]]:
    """Main function to analyze code for all patterns"""
    security_checker = SecurityPatternChecker()
    logic_checker = LogicPatternChecker()
    
    results = {
        'security_issues': (
            security_checker.check_credentials(code) +
            security_checker.check_injections(code)
        ),
        'resource_issues': security_checker.check_resources(code),
        'logic_issues': (
            logic_checker.check_null_pointers(code) +
            logic_checker.check_error_handling(code)
        )
    }
    
    return results

def generate_report(results: Dict[str, List[Dict[str, Any]]]) -> str:
    """Generate a formatted report from analysis results"""
    report = []
    
    for category, issues in results.items():
        if issues:
            report.append(f"\n=== {category.upper().replace('_', ' ')} ===")
            for i, issue in enumerate(issues, 1):
                report.append(f"\nISSUE {i}:")
                for key, value in issue.items():
                    report.append(f"- {key.upper()}: {value}")
                    
    return "\n".join(report)

# Example usage:
if __name__ == "__main__":
    test_code = """
    password = "secret123"  # Should flag this
    api_key = os.getenv("API_KEY")  # Should NOT flag this
    query = f"SELECT * FROM users WHERE id = {user_id}"  # Should flag this
    os.system(f"rm {filename}")  # Should flag this
    f = open("test.txt")  # Should flag this
    while True:  # Should flag this
        process_data()
    """
    
    results = analyze_code(test_code)
    print(generate_report(results))
