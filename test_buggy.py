import sqlite3
import os
import subprocess
import mysql.connector

# Hardcoded credentials (BAD!)
DB_PASSWORD = "super_secret_123"
API_KEY = "sk-1234567890abcdef"
MYSQL_PASS = "root123"

class DatabaseManager:
    def __init__(self):
        # Unsafe database connection (no password escaping)
        self.conn = mysql.connector.connect(
            host="localhost",
            user="root",
            password=MYSQL_PASS  # Hardcoded password
        )
        
    def execute_query(self, user_input):
        # SQL Injection vulnerability
        query = f"SELECT * FROM users WHERE name = '{user_input}'"
        cursor = self.conn.cursor()
        cursor.execute(query)  # Direct user input in query!
        return cursor.fetchall()
    
    def backup_database(self, filename):
        # Command injection vulnerability
        cmd = f"mysqldump -u root -p{MYSQL_PASS} > {filename}"
        os.system(cmd)  # Unsafe command execution

class UserManager:
    def __init__(self):
        self.users = {}
        self.temp_files = []
    
    def add_user(self, username, password):
        # Storing plain text passwords (BAD!)
        self.users[username] = password
    
    def authenticate(self, username, password):
        # Timing attack vulnerability
        stored = self.users.get(username)
        if stored == password:  # Direct string comparison
            return True
        return False
    
    def process_file(self, filename):
        # Resource leak - file never closed
        f = open(filename, 'r')
        content = f.read()
        # No f.close()!
        return content
    
    def cleanup(self):
        # Potential null pointer exception
        for file in self.temp_files:
            os.remove(file)  # No existence check!

def calculate_average(numbers):
    # Division by zero risk
    return sum(numbers) / len(numbers)  # No zero check!

def process_user_input():
    # Infinite loop risk
    while True:
        data = input("Enter data (or 'quit'): ")
        if data == 'quit':
            break
        # No other exit condition!
        process_data(data)

def process_data(data):
    # Memory leak - large list keeps growing
    global all_data
    all_data.append(data)  # List grows indefinitely

def execute_command(cmd):
    # Shell injection vulnerability
    result = subprocess.run(cmd, shell=True, capture_output=True)
    return result.stdout

def main():
    # Multiple issues in one function
    db = DatabaseManager()
    user_input = input("Enter username: ")
    
    # SQL Injection risk
    users = db.execute_query(user_input)
    
    # Command injection risk
    os.system(f"echo {user_input} >> log.txt")
    
    # Resource leak
    f = open("temp.txt", "w")
    f.write("some data")
    # No f.close()!
    
    # Infinite loop risk
    while True:
        print("Working...")
        # No exit condition!

if __name__ == "__main__":
    all_data = []  # Global variable (BAD!)
    main()
