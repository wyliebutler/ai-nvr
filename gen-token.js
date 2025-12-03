const jwt = require('jsonwebtoken');
const secret = 'dev-secret-key-change-in-prod';
const token = jwt.sign({ id: 1, username: 'admin', role: 'admin' }, secret, { expiresIn: '1h' });
console.log(token);
