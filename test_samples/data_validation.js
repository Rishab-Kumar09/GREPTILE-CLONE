const express = require('express');
const app = express();
const fs = require('fs');
const yaml = require('js-yaml');
const xml2js = require('xml2js');

app.use(express.json());

// Missing input validation (BAD!)
app.post('/api/users', (req, res) => {
    const user = req.body;
    // Direct object usage without validation
    db.users.insert(user);
});

// Unsafe data parsing (BAD!)
app.post('/api/config', (req, res) => {
    const config = req.body.config;
    // Unsafe eval of JSON (BAD!)
    const parsedConfig = eval('(' + config + ')');
    saveConfig(parsedConfig);
});

// XML parsing vulnerability (BAD!)
app.post('/api/import', (req, res) => {
    const xml = req.body.xml;
    // XXE vulnerability
    const parser = new xml2js.Parser();
    parser.parseString(xml);
});

// YAML deserialization (BAD!)
app.post('/api/yaml', (req, res) => {
    const data = req.body.data;
    // Unsafe YAML parsing
    const doc = yaml.load(data);
});

// No input sanitization (BAD!)
app.get('/api/search', (req, res) => {
    const query = req.query.q;
    // XSS vulnerability
    res.send(`<div>Search results for: ${query}</div>`);
});

// Unsafe file operations (BAD!)
app.post('/api/upload', (req, res) => {
    const fileName = req.body.fileName;
    const content = req.body.content;
    
    // Path traversal vulnerability
    fs.writeFileSync(fileName, content);
});

// Unsafe regex (BAD!)
app.get('/api/validate/:input', (req, res) => {
    const input = req.params.input;
    // ReDoS vulnerability
    const regex = new RegExp('^(a+)+$');
    res.json({ valid: regex.test(input) });
});

// Type coercion issues (BAD!)
app.get('/api/user/:id', (req, res) => {
    const id = req.params.id;
    // Loose equality
    if (id == 123) {
        return res.json({ isAdmin: true });
    }
});

// Prototype pollution (BAD!)
function merge(target, source) {
    for (let key in source) {
        if (typeof source[key] === 'object') {
            target[key] = merge(target[key], source[key]);
        } else {
            target[key] = source[key];
        }
    }
    return target;
}

// Unsafe data exposure (BAD!)
app.get('/api/user/export', (req, res) => {
    const user = getUser(req.query.id);
    // Sensitive data exposure
    res.json(user); // Includes password hash, SSN, etc.
});

// Race condition in data validation (BAD!)
let lastUpdate = Date.now();
app.post('/api/update', async (req, res) => {
    // Time of check to time of use vulnerability
    if (Date.now() - lastUpdate < 1000) {
        return res.status(429).send('Too many requests');
    }
    lastUpdate = Date.now();
    
    // Async operation without validation lock
    await processUpdate(req.body);
});

// Unsafe data storage (BAD!)
app.post('/api/store', (req, res) => {
    // Storing sensitive data in localStorage
    localStorage.setItem('user_token', req.body.token);
    localStorage.setItem('credentials', JSON.stringify(req.body.credentials));
});

// Missing output encoding (BAD!)
app.get('/api/profile', (req, res) => {
    const userInput = req.query.data;
    // XSS in HTML template
    const template = `
        <div class="profile">
            <script>
                const userData = ${userInput};
                displayProfile(userData);
            </script>
        </div>
    `;
    res.send(template);
});

app.listen(3000);
