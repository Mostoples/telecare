"""Server statis sementara dengan MIME type yang benar.

`python -m http.server` di Windows mengambil pemetaan MIME dari registry, dan
di sana `.js` sering terdaftar sebagai text/plain — peramban lalu menolak
mendaftarkan service worker. Server ini memaksa pemetaan yang benar supaya
perilakunya menyerupai Firebase Hosting.
"""
import functools
import http.server
import socketserver
import sys


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        '.js': 'text/javascript',
        '.mjs': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.webmanifest': 'application/manifest+json',
        '.html': 'text/html',
        '.svg': 'image/svg+xml',
        '.png': 'image/png',
        '.webp': 'image/webp',
        '.glb': 'model/gltf-binary',
        '.mp4': 'video/mp4',
    }

    def end_headers(self):
        # sw.js tidak boleh ter-cache, sama seperti pengaturan di firebase.json
        if self.path.endswith('sw.js'):
            self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
            self.send_header('Service-Worker-Allowed', '/app/')
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write('%s - %s\n' % (self.address_string(), fmt % args))


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8903
    with Server(('127.0.0.1', port), functools.partial(Handler)) as httpd:
        print(f'menyajikan pada http://127.0.0.1:{port}/', flush=True)
        httpd.serve_forever()
