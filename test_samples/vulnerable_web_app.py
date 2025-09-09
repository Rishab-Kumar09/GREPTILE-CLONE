import sqlite3
import os
import subprocess
from flask import Flask, request, render_template_string

app = Flask(__name__)

# Hardcoded credentials (BAD!)
DB_USER = "admin"
DB_PASS = "super_secret_123"
API_KEY = "sk-1234567890abcdef"

def get_db():
    return sqlite3.connect('database.db')

@app.route('/user/<username>')
def user_profile(username):
    # SQL Injection vulnerability
    db = get_db()
    query = f"SELECT * FROM users WHERE username = '{username}'"
    result = db.execute(query).fetchone()
    
    # XSS vulnerability
    if result:
        template = f'''
        <h1>Welcome {username}!</h1>
        <div>{result['bio']}</div>
        '''
        return render_template_string(template)
    return 'User not found'

@app.route('/search')
def search():
    # Command injection vulnerability
    query = request.args.get('q', '')
    cmd = f"grep -r {query} /var/log/app/"
    output = subprocess.check_output(cmd, shell=True)
    return output

@app.route('/backup')
def backup_db():
    # Both command injection and hardcoded credentials
    filename = request.args.get('filename', 'backup.sql')
    cmd = f"mysqldump -u root -p{DB_PASS} > {filename}"
    os.system(cmd)
    return 'Backup completed'

@app.route('/process')
def process_data():
    # Resource leak
    f = open('data.txt', 'r')
    data = f.read()
    # File never closed
    
    # Memory leak - unbounded list growth
    global all_data
    all_data.append(data)
    return 'Processed'

@app.route('/calculate')
def calculate():
    # Division by zero risk
    numbers = request.args.getlist('nums', type=int)
    avg = sum(numbers) / len(numbers)  # No empty check
    return str(avg)

@app.route('/update_settings')
def update_settings():
    # Race condition in settings update
    settings = get_current_settings()
    # Long operation without locks
    process_settings(settings)
    save_settings(settings)
    return 'Updated'

def process_settings(settings):
    # Infinite loop risk
    while True:
        if settings.get('stop'):
            break
        # No other exit condition
        process_next(settings)

def execute_action(action):
    # Shell injection
    result = subprocess.run(action, shell=True, capture_output=True)
    return result.stdout

if __name__ == '__main__':
    all_data = []  # Global list that can grow indefinitely
    app.run(debug=True)
