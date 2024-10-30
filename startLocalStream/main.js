const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { spawn } = require('child_process');

const app = express();
const server = createServer(app);
const io = new Server(server);

// Serve your HTML file
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// HTTP stream endpoint
// Function to clean the device name
function cleanDeviceName(deviceName) {
    return deviceName.replace(/[\[\]"]/g, '').trim(); // Remove brackets and quotes
}

// HTTP stream endpoint
app.get('/stream', (req, res) => {
    const rawDeviceName = '["CABLE Output (VB-Audio Virtual Cable)"]'; // Raw input (example)
    const audioDevice = cleanDeviceName(rawDeviceName); // Clean the device name

    const ffmpeg = spawn('ffmpeg', [
        '-f', 'gdigrab',
        '-framerate', '30',
        '-video_size', '1536x1024',
        '-probesize', '1000000', // Increase probesize
        '-i', 'desktop',
        '-f', 'dshow',
        '-i', `audio=${audioDevice}`,
        '-ac', '2',
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-b:v', '3000k',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-shortest',
        '-f', 'mpegts',
        'pipe:1'
    ]);

    res.writeHead(200, {
        'Content-Type': 'video/mpegts'
    });

    ffmpeg.stdout.pipe(res);

    ffmpeg.stderr.on('data', (data) => {
        console.error(`stderr: ${data}`);
    });

    ffmpeg.on('close', (code) => {
        console.log(`ffmpeg exited with code ${code}`);
    });
});

// Start server
server.listen(9554, () => {
    console.log('Server is running on http://localhost:9554');
});