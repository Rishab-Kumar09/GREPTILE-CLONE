import jwt
from flask import Flask, request, session
import hashlib
import pickle
from base64 import b64decode

app = Flask(__name__)

# Weak secret key (BAD!)
app.secret_key = "1234567890"

# Hardcoded JWT secret (BAD!)
JWT_SECRET = "my_super_secret_jwt_key"

# Weak password hashing (BAD!)
def hash_password(password):
    return hashlib.md5(password.encode()).hexdigest()

@app.route('/login', methods=['POST'])
def login():
    username = request.form['username']
    password = request.form['password']
    
    # SQL Injection in auth context (VERY BAD!)
    query = f"SELECT * FROM users WHERE username='{username}' AND password='{hash_password(password)}'"
    user = db.execute(query).fetchone()
    
    if user:
        # Insecure session handling (BAD!)
        session['user_id'] = user['id']
        session['is_admin'] = user['is_admin']
        
        # Insecure JWT (BAD!)
        token = jwt.encode({'user_id': user['id']}, JWT_SECRET, algorithm='HS256')
        return {'token': token}
    
    return 'Invalid credentials', 401

@app.route('/verify_token')
def verify_token():
    token = request.headers.get('Authorization')
    
    # No exception handling (BAD!)
    decoded = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
    return {'user_id': decoded['user_id']}

@app.route('/admin')
def admin_panel():
    # Missing authentication check (BAD!)
    return render_template('admin.html')

@app.route('/user_data')
def get_user_data():
    # Insecure deserialization (VERY BAD!)
    user_data = request.args.get('data')
    if user_data:
        return pickle.loads(b64decode(user_data))
    
    # IDOR vulnerability (BAD!)
    user_id = request.args.get('id')
    return db.query(f"SELECT * FROM users WHERE id = {user_id}")

@app.route('/reset_password', methods=['POST'])
def reset_password():
    # No rate limiting (BAD!)
    email = request.form['email']
    token = generate_reset_token()
    
    # Timing attack vulnerability (BAD!)
    if token == request.form['token']:
        reset_user_password()
        
    return 'Password reset email sent'

@app.route('/download_file')
def download_file():
    # Path traversal (BAD!)
    filename = request.args.get('file')
    with open(filename, 'rb') as f:
        return f.read()

def verify_password(stored_hash, password):
    # Timing attack in password verification (BAD!)
    return stored_hash == hash_password(password)

if __name__ == '__main__':
    # Debug mode in production (BAD!)
    app.run(debug=True)
