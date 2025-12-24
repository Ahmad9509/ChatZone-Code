// Custom server.js for Azure App Service
// This file is required for Azure to properly start the Next.js application

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

// Get port from environment or default to 8080
const port = parseInt(process.env.PORT || '8080', 10);
const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';

// Create Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

console.log(`Starting Next.js server in ${dev ? 'development' : 'production'} mode...`);
console.log(`Port: ${port}`);
console.log(`Hostname: ${hostname}`);

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('Internal server error');
    }
  })
    .once('error', (err) => {
      console.error('Server error:', err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(
        `> Server listening at http://${hostname}:${port} as ${
          dev ? 'development' : process.env.NODE_ENV
        }`
      );
      console.log(`> Ready on http://${hostname}:${port}`);
    });
});

