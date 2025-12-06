const net = require('net');
const client = new net.Socket();
const HOST = '192.168.2.51';
const PORT = 554;

console.log(`Connecting to ${HOST}:${PORT}...`);
client.connect(PORT, HOST, () => {
    console.log('TCP Connection Successful!');
    client.destroy();
});

client.on('error', (err) => {
    console.log('TCP Connection Failed:', err.message);
});

client.setTimeout(5000);
client.on('timeout', () => {
    console.log('TCP Connection Timed Out');
    client.destroy();
});
