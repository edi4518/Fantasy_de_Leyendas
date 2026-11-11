import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class SPARequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        # Si la ruta no tiene extensión y no es un archivo existente en disco, servir index.html
        path_without_query = self.path.split('?')[0]
        local_path = os.path.normpath(os.path.join(DIRECTORY, path_without_query.lstrip('/')))
        if not os.path.exists(local_path) and '.' not in os.path.basename(path_without_query):
            self.path = '/index.html'
        return super().do_GET()

if __name__ == '__main__':
    port = 5500
    server = ThreadingHTTPServer(('0.0.0.0', port), SPARequestHandler)
    print(f"Servidor SPA corriendo en http://localhost:{port} (http://127.0.0.1:{port})")
    server.serve_forever()

