const express = require('express');
const mysql = require('mysql');
const { exec } = require('child_process');
const fs = require('fs');

const app = express();

// Hardcoded credentials (BAD!)
const DB_CONFIG = {
    host: 'localhost',
    user: 'admin',
    password: 'super_secret_123',
    database: 'app_db'
};

// API keys in code (BAD!)
const API_KEYS = {
    stripe: 'sk_test_1234567890abcdef',
    aws: 'AKIA1234567890ABCDEF'
};

// Unsafe database connection
const db = mysql.createConnection(DB_CONFIG);

app.get('/api/user/:id', (req, res) => {
    // SQL Injection vulnerability
    const query = `SELECT * FROM users WHERE id = ${req.params.id}`;
    db.query(query, (err, results) => {
        if (err) {
            // Error handling issue - only logging
            console.error('Database error:', err);
            return;
        }
        res.json(results);
    });
});

app.get('/api/search', (req, res) => {
    // XSS vulnerability
    const term = req.query.q;
    res.send(`
        <h1>Search Results for: ${term}</h1>
        <div id="results"></div>
    `);
});

app.post('/api/execute', (req, res) => {
    // Command injection vulnerability
    const cmd = req.body.command;
    exec(cmd, (error, stdout, stderr) => {
        res.send(stdout);
    });
});

app.get('/api/file/:name', (req, res) => {
    // Path traversal vulnerability
    const fileName = req.params.name;
    const content = fs.readFileSync(fileName);
    res.send(content);
});

// React component with issues
function UserProfile({ userId }) {
    // Hook rules violation
    if (userId) {
        const [user, setUser] = useState(null);
    }

    // Missing dependency
    useEffect(() => {
        fetchUserData(userId);
    }, []); // userId missing from deps

    // Memory leak - no cleanup
    useEffect(() => {
        const subscription = dataStream.subscribe(data => {
            console.log(data);
        });
    }, []);

    // State update in effect without deps
    useEffect(() => {
        setUser(fetchedData);
    });
}

// Event listener memory leak
document.addEventListener('scroll', function(e) {
    // No removeEventListener
    console.log('scrolled');
});

// Async issues
async function processData() {
    // Race condition
    const data = await fetchData();
    const processed = await processItem(data);
    await saveData(processed);
}

// Promise anti-pattern
function getData() {
    return new Promise((resolve, reject) => {
        // Wrapping promise unnecessarily
        fetch('/api/data')
            .then(res => res.json())
            .then(data => resolve(data))
            .catch(err => reject(err));
    });
}

// Error handling issues
app.get('/api/data', async (req, res) => {
    try {
        const data = await fetchData();
        res.json(data);
    } catch (error) {
        // Error only logged, not handled
        console.error('Error:', error);
    }
});

// Resource leak
const file = fs.openSync('data.txt', 'r');
// No close call

// Infinite loop risk
function processQueue() {
    while (true) {
        const item = queue.next();
        // No break condition
        processItem(item);
    }
}

app.listen(3000, () => {
    console.log('Server running on port 3000');
});
