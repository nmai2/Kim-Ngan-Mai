from http.server import BaseHTTPRequestHandler, HTTPServer
import os
import mimetypes
import logging
from restutil import RestUtil

# Define the path to the public folder (one level up from 'backend')
PUBLIC_DIR = os.path.join(os.path.dirname(__file__), '..', 'frontend')
log_file_path = os.path.join(os.path.dirname(__file__), 'error.log')

logging.basicConfig(
    filename=log_file_path,
    level=logging.ERROR,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

class RequestHandler(BaseHTTPRequestHandler):
    rest_util = RestUtil()

    def do_GET(self):
        if self.path.startswith('/api'):
            # Handle API requests
            if self.path.startswith('/api/geocode'):
                self.rest_util.getGeocode(self)
            elif self.path.startswith('/api/timezone'):
                self.rest_util.getTimeZone(self)
            elif self.path.startswith('/api/sunrise-sunset'):
                self.rest_util.getSunriseSunset(self)
            elif self.path.startswith('/api/language'):
                self.rest_util.getLanguageTranslation(self)
            elif self.path.startswith('/api/supportedlanguage'):
                self.rest_util.getSupportedLanguage(self)
            else:
                self._send_404()
        else:
            # Serve static files if the path doesn't start with '/api'
            self.serve_static()

    def serve_static(self):
        # Remove leading `/` from path and normalize it
        file_path = os.path.normpath(self.path.lstrip('/'))

        # If no specific file is requested, serve `index.html`
        if file_path == '' or file_path == '.' or file_path == '/':
            file_path = 'index.html'

        # Full file path in the public directory
        full_path = os.path.join(PUBLIC_DIR, file_path)

        if os.path.exists(full_path) and os.path.isfile(full_path):
            # Determine the mime type based on the file extension
            mime_type, _ = mimetypes.guess_type(full_path)
            self.send_response(200)
            self.send_header('Content-type', mime_type if mime_type else 'application/octet-stream')
            self.end_headers()

            # Read and send the file content
            with open(full_path, 'rb') as f:
                self.wfile.write(f.read())
        else:
            self._send_404()

    def _send_404(self):
        self.send_response(404)
        self.send_header('Content-type', 'text/html')
        self.end_headers()
        self.wfile.write(b'404 Not Found')

    def log_message(self, format, *args):
        return  # Disable logging to console

    def log_error(self, val):
        logging.error(f"An error occurred {val}\n", exc_info=True)

    def log_info(self, val):
        logging.info(f"Information {val}\n", exc_info=True)

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

if __name__ == "__main__":
    port = int(os.environ.get('PORT', 8000)) #Use PORT from environment or default to 8000
    server_address = ('', port)
    httpd = HTTPServer(server_address, RequestHandler)
    print(f"Server running on port {port}...")
    #httpd.serve_forever()
    httpd.serve_forever(poll_interval=None)
