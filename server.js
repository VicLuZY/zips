const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const VALID_VERIFICATION_STATUS = new Set(['pending', 'verified', 'rejected']);

let nextId = 1;
const restaurants = [];

const sendJson = (res, statusCode, payload) => {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
};

const readRequestBody = (req) => new Promise((resolve, reject) => {
  let raw = '';
  req.on('data', (chunk) => {
    raw += chunk;
    if (raw.length > 1e6) {
      reject(new Error('Payload too large'));
      req.destroy();
    }
  });
  req.on('end', () => {
    if (!raw) {
      resolve({});
      return;
    }

    try {
      resolve(JSON.parse(raw));
    } catch (_err) {
      reject(new Error('Invalid JSON'));
    }
  });
  req.on('error', reject);
});

const validateRestaurantPayload = ({ name, address, lat, lng, acceptsTips }) => {
  if (typeof name !== 'string' || !name.trim()) {
    return 'Restaurant name is required.';
  }
  if (typeof address !== 'string' || !address.trim()) {
    return 'Restaurant address is required.';
  }

  const latNum = Number(lat);
  const lngNum = Number(lng);

  if (!Number.isFinite(latNum) || latNum < -90 || latNum > 90) {
    return 'Latitude must be between -90 and 90.';
  }
  if (!Number.isFinite(lngNum) || lngNum < -180 || lngNum > 180) {
    return 'Longitude must be between -180 and 180.';
  }
  if (typeof acceptsTips !== 'boolean') {
    return 'Please specify whether this place accepts tips.';
  }

  return null;
};

const contentTypeFor = (filePath) => {
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  return 'text/plain; charset=utf-8';
};

const serveStatic = (res, requestPath) => {
  const normalized = requestPath === '/' ? '/index.html' : requestPath;
  const filePath = path.normalize(path.join(PUBLIC_DIR, normalized));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }

    res.writeHead(200, { 'Content-Type': contentTypeFor(filePath) });
    res.end(data);
  });
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && url.pathname === '/api/restaurants') {
    const acceptsTipsFilter = url.searchParams.get('acceptsTips');
    if (acceptsTipsFilter === null) {
      sendJson(res, 200, restaurants);
      return;
    }

    if (acceptsTipsFilter !== 'true' && acceptsTipsFilter !== 'false') {
      sendJson(res, 400, { error: 'acceptsTips query must be true or false.' });
      return;
    }

    const filtered = restaurants.filter((restaurant) => restaurant.acceptsTips === (acceptsTipsFilter === 'true'));
    sendJson(res, 200, filtered);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/restaurants') {
    try {
      const body = await readRequestBody(req);
      const validationError = validateRestaurantPayload(body);
      if (validationError) {
        sendJson(res, 400, { error: validationError });
        return;
      }

      const restaurant = {
        id: nextId++,
        name: body.name.trim(),
        address: body.address.trim(),
        lat: Number(body.lat),
        lng: Number(body.lng),
        acceptsTips: body.acceptsTips,
        verification_status: 'pending',
        createdAt: new Date().toISOString()
      };

      restaurants.unshift(restaurant);
      sendJson(res, 201, restaurant);
    } catch (err) {
      sendJson(res, 400, { error: err.message || 'Invalid request.' });
    }
    return;
  }

  const verificationMatch = url.pathname.match(/^\/api\/restaurants\/(\d+)\/verification-status$/);
  if (req.method === 'PATCH' && verificationMatch) {
    try {
      const restaurantId = Number(verificationMatch[1]);
      const body = await readRequestBody(req);
      if (!VALID_VERIFICATION_STATUS.has(body.verification_status)) {
        sendJson(res, 400, { error: 'verification_status must be pending, verified, or rejected.' });
        return;
      }

      const restaurant = restaurants.find((item) => item.id === restaurantId);
      if (!restaurant) {
        sendJson(res, 404, { error: 'Restaurant not found.' });
        return;
      }

      restaurant.verification_status = body.verification_status;
      sendJson(res, 200, restaurant);
    } catch (err) {
      sendJson(res, 400, { error: err.message || 'Invalid request.' });
    }
    return;
  }

  if (req.method === 'GET') {
    serveStatic(res, url.pathname);
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server running at http://localhost:${PORT}`);
});
