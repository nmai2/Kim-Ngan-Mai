import os
import json
from urllib.parse import urlparse, parse_qs
import urllib.request
import urllib.parse
from datetime import datetime


LOCATIONIQ_APIKEY="pk.646cbc0456eb6173a89bb3b3f95ed8ad"
TIMEZONE_USER="nmai2"

class RestUtil:
    def parse_query_params(self, request_handler):
        """Parses query parameters from the URL."""
        parsed_url = urlparse(request_handler.path)
        queries = parsed_url.query
        return parse_qs(queries)

    def parse_json_body(self, request_handler):
        """Parses the JSON body from the request, if available."""
        content_length = int(request_handler.headers.get('Content-Length', 0))
        if content_length > 0:
            body = request_handler.rfile.read(content_length).decode('utf-8')
            return json.loads(body) if body else {}
        return {}

    def getGeocode(self, request_handler):
        query_params = self.parse_query_params(request_handler)
        #json_body = self.parse_json_body(request_handler)
        geocode_url = "https://us1.locationiq.com/v1/search"
        address = query_params.get("address", [""])[0]
        if not address:
            return self._send_response(request_handler, 400, {"message": "address is required field."})
        params = {
            "q": address,
            "key": LOCATIONIQ_APIKEY,
            "format": "json"
        }
        try:
            encoded_params = urllib.parse.urlencode(params)
            # Make a GET request to the URL
            with urllib.request.urlopen(f"{geocode_url}?{encoded_params}") as response:
                # Read the response as bytes and decode it into a string
                json_string = response.read().decode()

                # Parse the JSON string into a Python object (dict)
                data = json.loads(json_string)
                if not data:
                    return self._send_response(request_handler, 200, {"results": [], "status": "OK"})
                # Rename "lon" to "lng"
                for item in data:
                    if "lon" in item:
                        item["lng"] = item.pop("lon")

                return self._send_response(request_handler, 200, {"results": data, "status": "OK"})
        except urllib.error.HTTPError as http_err:
            print(f"HTTP error occurred: {http_err}")  # For HTTP errors (e.g., 404, 500)
            request_handler.log_error(str(http_err))
            if http_err.code == 404:
                return self._send_response(request_handler, 200, {"results": [], "status": "OK"})
        except urllib.error.URLError as url_err:
            print(f"URL error occurred: {url_err}")  # For other errors (e.g., network issues)
            request_handler.log_error(str(url_err))
        except Exception as err:
            print(f"Other error occurred: {err}")  # For any other errors
            request_handler.log_error(str(err))

    def getTimeZone(self, request_handler):
        query_params = self.parse_query_params(request_handler)
        timezone_url = "http://api.geonames.org/timezoneJSON"
        lat = query_params.get("lat", [""])[0]
        lng = query_params.get("lng", [""])[0]

        if not lat:
            return self._send_response(request_handler, 400, {"message": "latitude is required field."})
        if not lng:
            return self._send_response(request_handler, 400, {"message": "longitude is required field."})
        params = {
            "lat": lat,
            "lng": lng,
            "username": TIMEZONE_USER
        }

        try:
            encoded_params = urllib.parse.urlencode(params)
            # Make a GET request to the URL
            with urllib.request.urlopen(f"{timezone_url}?{encoded_params}") as response:
                # Read the response as bytes and decode it into a string
                json_string = response.read().decode()

                # Parse the JSON string into a Python object (dict)
                data = json.loads(json_string)

                return self._send_response(request_handler, 200, {"status": "OK", "results": data})
        except urllib.error.HTTPError as http_err:
            print(f"HTTP error occurred: {http_err}")  # For HTTP errors (e.g., 404, 500)
            request_handler.log_error(str(http_err))
        except urllib.error.URLError as url_err:
            print(f"URL error occurred: {url_err}")  # For other errors (e.g., network issues)
            request_handler.log_error(str(url_err))
        except Exception as err:
            print(f"Other error occurred: {err}")  # For any other errors
            request_handler.log_error(str(err))

    def getSunriseSunset(self, request_handler):
        query_params = self.parse_query_params(request_handler)
        sunrise_url = "https://api.sunrise-sunset.org/json"
        lat = query_params.get("lat", [""])[0]
        lng = query_params.get("lng", [""])[0]
        date = query_params.get("date", [""])[0]
        # TODO: check valid date: YYYY-MM-DD
        if not lat:
            return self._send_response(request_handler, 400, {"message": "latitude is required field."})
        if not lng:
            return self._send_response(request_handler, 400, {"message": "longitude is required field."})
        params = {
            "lat": lat,
            "lng": lng,
            "formatted": 0
        }
        if date: 
            if not self.validate_date(date):
                return self._send_response(request_handler, 400, {"message": "date is invalid."})
            params["date"] = date
        try:
            encoded_params = urllib.parse.urlencode(params)
            # Make a GET request to the URL
            with urllib.request.urlopen(f"{sunrise_url}?{encoded_params}") as response:
                # Read the response as bytes and decode it into a string
                json_string = response.read().decode()

                # Parse the JSON string into a Python object (dict)
                data = json.loads(json_string)

                return self._send_response(request_handler, 200, data)
        except urllib.error.HTTPError as http_err:
            print(f"HTTP error occurred: {http_err}")  # For HTTP errors (e.g., 404, 500)
            request_handler.log_error(str(http_err))
        except urllib.error.URLError as url_err:
            print(f"URL error occurred: {url_err}")  # For other errors (e.g., network issues)
            request_handler.log_error(str(url_err))
        except Exception as err:
            print(f"Other error occurred: {err}")  # For any other errors
            request_handler.log_error(str(err))

    def getLanguageTranslation(self, request_handler):
        query_params = self.parse_query_params(request_handler)
        if not ("lang" in query_params):
            return self._send_response(request_handler, 400, {"message": "Language is missing."})
        lang = query_params.get("lang", [""])[0]
        if lang == 'language':
            return self._send_response(request_handler, 400, {"message": "Language is invalid."})

        current_folder = os.path.dirname(os.path.abspath(__file__))
        full_path = os.path.join(current_folder, "i18n", lang + ".json")
        if not (os.path.exists(full_path) and os.path.isfile(full_path)):
            return self._send_response(request_handler, 400, {"message": "Language is not supported."})
        with open(full_path, 'r', encoding='utf-8') as f:
            #request_handler.wfile.write(f.read())
            data = json.loads(f.read())
            minimized_json = json.dumps(data, separators=(',', ':'))
            return self._send_response(request_handler, 200, minimized_json)
        
    def getSupportedLanguage(self, request_handler):
        current_folder = os.path.dirname(os.path.abspath(__file__))
        full_path = os.path.join(current_folder, "i18n", "language.json")
        with open(full_path, 'r', encoding='utf-8') as f:
            #request_handler.wfile.write(f.read())
            data = json.loads(f.read())
            minimized_json = json.dumps(data, separators=(',', ':'))
        return self._send_response(request_handler, 200, minimized_json)
    


    def validate_date(self, date_string):
        try:
            # Try to parse the string in the format "YYYY-MM-DD"
            datetime.strptime(date_string, "%Y-%m-%d")
            return True
        except ValueError:
            # If parsing fails, it means the format is incorrect
            return False

    def _send_response(self, request_handler, status_code, response_body):
        response_body = response_body.encode('utf-8') if isinstance(response_body, str) else json.dumps(response_body).encode('utf-8')
        request_handler.send_response(status_code)
        request_handler.send_header('Content-type', 'application/json; charset=UTF-8')
        request_handler.send_header('Content-length', str(len(response_body)))
        request_handler.end_headers()
        request_handler.wfile.write(response_body)
