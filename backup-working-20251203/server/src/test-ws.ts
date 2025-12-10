import WebSocket from 'ws';

const rtspUrl = encodeURIComponent('rtsp://thingino:thingino@192.168.2.80:554/ch0');
const url = `ws://localhost:7000?url=${rtspUrl}`;
console.log(`Connecting to ${url}...`);

const ws = new WebSocket(url);

ws.on('open', () => {
    console.log('Connected!');
    // ws.close(); // Keep open to receive data
});

ws.on('message', (data: Buffer) => {
    console.log(`Received data: ${data.length} bytes`);
    if (data.length > 0) {
        console.log('Got data, closing...');
        ws.close();
    }
});

ws.on('error', (err) => {
    console.error('Connection error:', err);
});

ws.on('close', (code, reason) => {
    console.log(`Disconnected: ${code} ${reason}`);
});
