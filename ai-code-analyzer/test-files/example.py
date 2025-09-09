from flask import Flask, request, jsonify
import sqlite3
import os

app = Flask(__name__)

@app.route('/api/users', methods=['POST'])
def create_user():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    
    # SECURITY ISSUE: SQL Injection vulnerability
    conn = sqlite3.connect('users.db')
    cursor = conn.cursor()
    cursor.execute(f"INSERT INTO users (username, password) VALUES ('{username}', '{password}')")
    
    # CRASH RISK: No error handling
    conn.commit()
    
    # MEMORY LEAK: Connection not closed
    return jsonify({"status": "success"})

@app.route('/api/files/<path:filepath>', methods=['GET'])
def get_file(filepath):
    # SECURITY ISSUE: Path traversal vulnerability
    with open(filepath, 'r') as f:
        content = f.read()
    return content

if __name__ == '__main__':
    # SECURITY ISSUE: Debug mode in production
    app.run(debug=True)
