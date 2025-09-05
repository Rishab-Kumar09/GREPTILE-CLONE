# Static Analysis Tools Layer for AWS Lambda

## Required Tools Installation

### 1. Create Layer Directory Structure
```bash
mkdir -p static-analysis-layer/bin
mkdir -p static-analysis-layer/nodejs
cd static-analysis-layer
```

### 2. Install Node.js Tools
```bash
# Install ESLint and plugins
npm init -y
npm install eslint@latest \
  eslint-plugin-react@latest \
  eslint-plugin-react-hooks@latest \
  eslint-plugin-no-unsafe-innerhtml@latest

# Copy to layer structure
cp -r node_modules nodejs/
```

### 3. Install Python Tools
```bash
# Install Python linting tools
python3 -m pip install pylint bandit safety --target python/lib/python3.9/site-packages/
```

### 4. Install C/C++ Tools (Amazon Linux 2)
```bash
# Install cppcheck
yum install -y cppcheck
cp /usr/bin/cppcheck bin/

# Install clang-tidy (optional)
yum install -y clang
cp /usr/bin/clang-tidy bin/
```

### 5. Create Layer ZIP
```bash
zip -r static-analysis-layer.zip .
```

### 6. Deploy Layer
```bash
aws lambda publish-layer-version \
  --layer-name static-analysis-tools \
  --description "ESLint, Pylint, CppCheck for code analysis" \
  --zip-file fileb://static-analysis-layer.zip \
  --compatible-runtimes nodejs18.x nodejs20.x
```

### 7. Add to Lambda Function
In Lambda configuration:
- Add layer: `static-analysis-tools`
- Set environment variables:
```
NODE_PATH=/opt/nodejs/node_modules
PATH=/opt/bin:/usr/local/bin:/usr/bin:/bin
PYTHONPATH=/opt/python/lib/python3.9/site-packages
```

## Benefits of Real Static Analysis

### ✅ ESLint for JavaScript/TypeScript:
- **React Hook violations** (real useEffect issues)
- **Unused variables** and imports
- **Undefined variables** and typos
- **Security issues** (eval, innerHTML)
- **Modern JS patterns** enforcement

### ✅ Pylint for Python:
- **Unused imports** and variables
- **Undefined variables** 
- **Dangerous default values** (mutable defaults)
- **Import cycles**
- **Code complexity** warnings

### ✅ CppCheck for C/C++:
- **Memory leaks** and null pointer dereferences
- **Buffer overflows** and array bounds
- **Uninitialized variables**
- **Dead code** and unused functions
- **Thread safety** issues

## Expected Improvements

Instead of generic regex matches, you'll get:
- **Precise line-by-line analysis**
- **Language-specific expertise**
- **Framework-aware rules** (React, TensorFlow)
- **Industry-standard issue detection**
- **Actionable, specific error messages**

This transforms the Lambda from a basic pattern matcher into a **professional-grade static analysis engine**!
