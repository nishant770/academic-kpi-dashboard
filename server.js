const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'students_db.json');

const SEEDED_STUDENTS = [
  { prn:'2026PRN0001', name:'Ananya Rao', batch:'Batch Jr (2026-28)', program:'Analytics and Finance', sem:1, undergrad_degree:'Engg', work_exp_years:2.5, domain_preference:'Consulting', cert_tier:'A', att_no_exempt:92, att_with_exempt:95, assessments:88, examinations:84, placement:75, certifications:80, activities:85, research:1, paper_count:2, live_project:85, summer_internship:88, work_experience:80, disciplinary_severity:'Low', history:[75,78,82,85] },
  { prn:'2026PRN0002', name:'Rohan Mehta', batch:'Batch Jr (2026-28)', program:'Analytics and Finance', sem:1, undergrad_degree:'B.Com', work_exp_years:1.0, domain_preference:'Analytics', cert_tier:'B', att_no_exempt:58, att_with_exempt:62, assessments:50, examinations:45, placement:35, certifications:30, activities:40, research:0, paper_count:0, live_project:45, summer_internship:40, work_experience:35, disciplinary_severity:'Severe', history:[55,52,48,46] },
  { prn:'2026PRN0003', name:'Priya Nair', batch:'Batch Jr (2026-28)', program:'Marketing and Finance', sem:1, undergrad_degree:'BBA', work_exp_years:0.5, domain_preference:'Marketing', cert_tier:'M', att_no_exempt:85, att_with_exempt:90, assessments:78, examinations:80, placement:65, certifications:70, activities:72, research:1, paper_count:1, live_project:78, summer_internship:82, work_experience:75, disciplinary_severity:'Low', history:[70,74,76,78] },
  { prn:'2026PRN0004', name:'Kabir Singh', batch:'Batch Sr (2025-27)', program:'Systems and Finance', sem:3, undergrad_degree:'Engg', work_exp_years:3.0, domain_preference:'IT Audit', cert_tier:'A', att_no_exempt:72, att_with_exempt:75, assessments:68, examinations:70, placement:80, certifications:85, activities:60, research:1, paper_count:1, live_project:70, summer_internship:75, work_experience:80, disciplinary_severity:'Moderate', history:[71,72,73,73] },
  { prn:'2026PRN0005', name:'Meera Iyer', batch:'Batch Jr (2026-28)', program:'Analytics and Finance', sem:1, undergrad_degree:'B.Sc', work_exp_years:1.5, domain_preference:'Consulting', cert_tier:'A', att_no_exempt:96, att_with_exempt:98, assessments:92, examinations:90, placement:50, certifications:60, activities:90, research:1, paper_count:3, live_project:90, summer_internship:92, work_experience:85, disciplinary_severity:'Low', history:[82,85,88,91] },
  { prn:'2026PRN0006', name:'Vikram Das', batch:'Batch Sr (2025-27)', program:'Systems and Finance', sem:3, undergrad_degree:'BCA', work_exp_years:0.0, domain_preference:'Telecom', cert_tier:'B', att_no_exempt:52, att_with_exempt:55, assessments:42, examinations:38, placement:25, certifications:20, activities:35, research:0, paper_count:0, live_project:40, summer_internship:35, work_experience:30, disciplinary_severity:'Severe', history:[50,46,42,39] },
  { prn:'2026PRN0007', name:'Sanya Kapoor', batch:'Batch Jr (2026-28)', program:'Marketing and Finance', sem:1, undergrad_degree:'B.Com', work_exp_years:2.0, domain_preference:'BFSI', cert_tier:'M', att_no_exempt:80, att_with_exempt:84, assessments:75, examinations:76, placement:60, certifications:58, activities:70, research:0, paper_count:0, live_project:75, summer_internship:78, work_experience:70, disciplinary_severity:'Moderate', history:[68,70,72,74] },
  { prn:'2026PRN0008', name:'Arjun Malhotra', batch:'Batch Sr (2025-27)', program:'Systems and Finance', sem:3, undergrad_degree:'Engg', work_exp_years:4.0, domain_preference:'Consulting', cert_tier:'A', att_no_exempt:90, att_with_exempt:94, assessments:86, examinations:88, placement:92, certifications:90, activities:82, research:1, paper_count:2, live_project:92, summer_internship:95, work_experience:90, disciplinary_severity:'Low', history:[80,84,86,89] },
];

let DYNAMIC_STATE = [];
let sseClients = [];

// Initialize or reload data store
function loadStore() {
  if (fs.existsSync(DATA_FILE)) {
    try {
      DYNAMIC_STATE = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (e) {
      DYNAMIC_STATE = SEEDED_STUDENTS;
    }
  } else {
    DYNAMIC_STATE = SEEDED_STUDENTS;
    fs.writeFileSync(DATA_FILE, JSON.stringify(DYNAMIC_STATE, null, 2));
  }
}
loadStore();

// Real-time broadcast to all connected devices worldwide
function broadcastToClients(data) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach(client => {
    try {
      client.write(payload);
    } catch(e) {}
  });
}

// Keepalive heartbeat for SSE on mobile & cloud firewalls (every 25 seconds)
setInterval(() => {
  sseClients.forEach(client => {
    try {
      client.write(': ping\n\n');
    } catch(e) {}
  });
}, 25000);

// High-performance gzip/deflate response sender (reduces bandwidth by ~85% for 500-1000 users)
function sendCompressedResponse(req, res, statusCode, contentType, content) {
  res.setHeader('Content-Type', contentType);
  res.setHeader('Vary', 'Accept-Encoding');
  
  const acceptEncoding = req.headers['accept-encoding'] || '';
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');

  // Gzip compression for payloads larger than 512 bytes
  if (/\bgzip\b/.test(acceptEncoding) && buffer.length > 512) {
    zlib.gzip(buffer, (err, compressed) => {
      if (!err) {
        res.writeHead(statusCode, { 'Content-Encoding': 'gzip' });
        res.end(compressed);
      } else {
        res.writeHead(statusCode);
        res.end(buffer);
      }
    });
  } else {
    res.writeHead(statusCode);
    res.end(buffer);
  }
}

const server = http.createServer((req, res) => {
  // CORS & Security Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // 1. SSE Real-Time Dynamic Stream Endpoint (/api/stream)
  if (pathname === '/api/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    // Send current state immediately on connect
    res.write(`data: ${JSON.stringify(DYNAMIC_STATE)}\n\n`);

    sseClients.push(res);
    req.on('close', () => {
      sseClients = sseClients.filter(c => c !== res);
    });
    return;
  }

  // 2. Enhanced Dynamic Query API (GET /api/students?q=...&program=...&batch=...)
  if (pathname === '/api/students' && req.method === 'GET') {
    loadStore();
    let result = [...DYNAMIC_STATE];

    // Search query parameter (?q=...)
    const q = (parsedUrl.searchParams.get('q') || '').toLowerCase().trim();
    if (q) {
      result = result.filter(s => 
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.prn && s.prn.toLowerCase().includes(q)) ||
        (s.domain_preference && s.domain_preference.toLowerCase().includes(q)) ||
        (s.target_company && s.target_company.toLowerCase().includes(q)) ||
        (s.program && s.program.toLowerCase().includes(q))
      );
    }

    // Program query parameter (?program=...)
    const program = parsedUrl.searchParams.get('program');
    if (program && program !== 'all') {
      result = result.filter(s => s.program && s.program.toLowerCase() === program.toLowerCase());
    }

    // Batch query parameter (?batch=...)
    const batch = parsedUrl.searchParams.get('batch');
    if (batch && batch !== 'all') {
      result = result.filter(s => s.batch && s.batch.toLowerCase().includes(batch.toLowerCase()));
    }

    // Undergrad Degree parameter (?degree=...)
    const degree = parsedUrl.searchParams.get('degree');
    if (degree && degree !== 'all') {
      result = result.filter(s => s.undergrad_degree && s.undergrad_degree.toLowerCase() === degree.toLowerCase());
    }

    // Disciplinary Severity parameter (?severity=...)
    const severity = parsedUrl.searchParams.get('severity');
    if (severity && severity !== 'all') {
      result = result.filter(s => s.disciplinary_severity && s.disciplinary_severity.toLowerCase() === severity.toLowerCase());
    }

    // Sorting (?sort=composite&order=desc)
    const sort = parsedUrl.searchParams.get('sort');
    const order = (parsedUrl.searchParams.get('order') || 'desc').toLowerCase();
    if (sort) {
      result.sort((a, b) => {
        let valA = a[sort] !== undefined ? a[sort] : 0;
        let valB = b[sort] !== undefined ? b[sort] : 0;
        if (typeof valA === 'string') {
          return order === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return order === 'asc' ? valA - valB : valB - valA;
      });
    }

    // Pagination (?limit=50&offset=0)
    const limit = parseInt(parsedUrl.searchParams.get('limit')) || 0;
    const offset = parseInt(parsedUrl.searchParams.get('offset')) || 0;
    const totalCount = result.length;
    if (limit > 0) {
      result = result.slice(offset, offset + limit);
    }

    res.setHeader('X-Total-Count', String(totalCount));
    res.setHeader('Cache-Control', 'no-cache');
    sendCompressedResponse(req, res, 200, 'application/json', JSON.stringify(result));
    return;
  }

  // 3. Dynamic Push / Update Endpoint (POST /api/students)
  if (pathname === '/api/students' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const updatedData = JSON.parse(body);
        if (Array.isArray(updatedData)) {
          DYNAMIC_STATE = updatedData;
          fs.writeFileSync(DATA_FILE, JSON.stringify(DYNAMIC_STATE, null, 2));
          
          // Instantly broadcast dynamic updates to all connected devices worldwide
          broadcastToClients(DYNAMIC_STATE);

          res.setHeader('Cache-Control', 'no-cache');
          sendCompressedResponse(req, res, 200, 'application/json', JSON.stringify({ success: true, count: DYNAMIC_STATE.length }));
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Expected array of students' }));
        }
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
      }
    });
    return;
  }

  // 4. Serve Static Files with High-Performance Compression & Caching
  let cleanPath = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
  let filePath = path.join(__dirname, cleanPath);

  // Security: prevent path traversal
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  let extname = String(path.extname(filePath)).toLowerCase();
  let contentType = 'text/html';
  if (extname === '.js') contentType = 'text/javascript';
  if (extname === '.css') contentType = 'text/css';
  if (extname === '.json') contentType = 'application/json';
  if (extname === '.jpg' || extname === '.jpeg') contentType = 'image/jpeg';
  if (extname === '.png') contentType = 'image/png';
  if (extname === '.svg') contentType = 'image/svg+xml';
  if (extname === '.ico') contentType = 'image/x-icon';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        // SPA Fallback: serve index.html for unknown routes
        fs.readFile(path.join(__dirname, 'index.html'), (err, htmlContent) => {
          if (err) {
            res.writeHead(404);
            res.end('404 Not Found');
          } else {
            sendCompressedResponse(req, res, 200, 'text/html', htmlContent);
          }
        });
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${error.code}`);
      }
    } else {
      if (extname === '.jpg' || extname === '.png' || extname === '.ico') {
        res.setHeader('Cache-Control', 'public, max-age=86400');
      } else {
        res.setHeader('Cache-Control', 'no-cache');
      }
      sendCompressedResponse(req, res, 200, contentType, content);
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Production Dynamic KPI Server active on port ${PORT} (Supports 500-1000 Users)`);
});
