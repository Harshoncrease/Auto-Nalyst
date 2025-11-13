# Sample Python file with security and code quality issues
import os
import sqlite3
import hashlib

# CRITICAL: Hardcoded secret key
SECRET_KEY = "my_super_secret_key_123"

class UserManager:
    def __init__(self):
        # HIGH: Database connection without proper error handling
        self.conn = sqlite3.connect('users.db')
        self.conn.execute('''CREATE TABLE IF NOT EXISTS users 
                            (id INTEGER PRIMARY KEY, username TEXT, password TEXT, email TEXT)''')

    def create_user(self, username, password, email):
        # MEDIUM: Weak password hashing
        password_hash = hashlib.md5(password.encode()).hexdigest()

        # HIGH: SQL injection vulnerability
        query = f"INSERT INTO users (username, password, email) VALUES ('{username}', '{password_hash}', '{email}')"

        try:
            self.conn.execute(query)
            self.conn.commit()
            return True
        except Exception as e:
            print(f"Database error: {e}")  # MEDIUM: Sensitive error information
            return False

    def authenticate(self, username, password):
        # MEDIUM: Timing attack vulnerability
        password_hash = hashlib.md5(password.encode()).hexdigest()

        cursor = self.conn.execute(f"SELECT * FROM users WHERE username = '{username}' AND password = '{password_hash}'")
        user = cursor.fetchone()

        if user:
            return True
        else:
            return False

    def get_user_data(self, user_id):
        # HIGH: No input validation
        query = f"SELECT * FROM users WHERE id = {user_id}"
        cursor = self.conn.execute(query)
        return cursor.fetchone()

# LOW: Function never called
def unused_function():
    pass

# CRITICAL: Command injection vulnerability  
def execute_system_command(user_input):
    command = f"echo {user_input}"
    os.system(command)  # Dangerous: direct execution of user input

# MEDIUM: Global variable usage
global_counter = 0

def increment_counter():
    global global_counter
    global_counter += 1
    return global_counter

# Example usage
if __name__ == "__main__":
    manager = UserManager()

    # This would be vulnerable to various attacks
    username = input("Enter username: ")
    password = input("Enter password: ")

    manager.create_user(username, password, "user@example.com")

    if manager.authenticate(username, password):
        print("Authentication successful!")
    else:
        print("Authentication failed!")
