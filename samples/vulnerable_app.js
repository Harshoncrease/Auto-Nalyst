// Sample JavaScript file with security vulnerabilities for testing
const express = require('express');
const mysql = require('mysql');
const app = express();

// CRITICAL: Hardcoded database credentials
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'admin123',  // Hardcoded password
    database: 'myapp'
});

app.use(express.json());

// HIGH: SQL injection vulnerability
app.get('/users/:id', (req, res) => {
    const userId = req.params.id;
    const query = `SELECT * FROM users WHERE id = ${userId}`;  // Direct concatenation

    db.query(query, (err, results) => {
        if (err) {
            console.log(err);  // MEDIUM: Sensitive error logging
            return res.status(500).send('Error occurred');
        }
        res.json(results);
    });
});

// MEDIUM: Missing input validation
app.post('/users', (req, res) => {
    const { name, email } = req.body;
    // No validation of input parameters

    const query = 'INSERT INTO users (name, email) VALUES (?, ?)';
    db.query(query, [name, email], (err, results) => {
        if (err) {
            return res.status(500).send('Error creating user');
        }
        res.json({ id: results.insertId });
    });
});

// LOW: Unused variable
const unusedVariable = 'This is never used';

// CRITICAL: Eval usage with user input
app.post('/calculate', (req, res) => {
    const expression = req.body.expression;
    try {
        const result = eval(expression);  // Dangerous eval with user input
        res.json({ result });
    } catch (error) {
        res.status(400).send('Invalid expression');
    }
});

app.listen(3000, () => {
    console.log('Server running on port 3000');
});
