// APIFetcher: Handles interactions with external APIs for time and location data
class APIFetcher {
    constructor(geoApiKey, timeApiKey) {
        this.geoApiKey = geoApiKey;
        this.timeApiKey = timeApiKey;
        this.prefixURL = window.location.origin;
    }

    // Method to fetch coordinates from Google Geocoding API
    async fetchCoordinates(location) {
        const geoUrl = `${this.prefixURL}/api/geocode?address=${encodeURIComponent(location)}`;
        try {
            const response = await fetch(geoUrl);
            if (!response.ok) {
                throw new Error(`Geocoding API Error: ${response.status}`);
            }
            const data = await response.json();
            //return data.results.length > 0 ? data.results[0].geometry.location : null;
            return data.results.length > 0 ? data.results[0] : null;
        } catch (error) {
            console.error("Error fetching coordinates:", error);
            return null;
        }
    }

    // Method to fetch time zone data from Google Time Zone API
    async fetchTimeZone(lat, lon) {
        const timeUrl = `${this.prefixURL}/api/timezone?lat=${lat}&lng=${lon}`;
        try {
            const response = await fetch(timeUrl)
                .then(response => {
                    if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                    }
                    return response.json();
                })
                .catch(error => console.error('Error:', error));
            return response
        } catch (error) {
            console.error("Error fetching time zone data:", error);
            return null;
        }
    }
}

// Location class to represent a geographical location
class Location {
    constructor(latitude, longitude) {
        this.latitude = latitude;
        this.longitude = longitude;
    }

    getCoordinates() {
        return {
            latitude: this.latitude,
            longitude: this.longitude
        };
    }
}

// TimeZoneCalculator: Calculates local time based on latitude and longitude
class TimeZoneCalculator {
    constructor(fetcher) {
        this.fetcher = fetcher;
    }

    // Method to fetch and return local time based on location
    async calculateTime(location) {
        const timeResult = await this.fetcher.fetchTimeZone(location.latitude, location.longitude);
        if (timeResult && timeResult.status === "OK") {
            const timeData = timeResult.results;
            const timeZoneId = timeData.timezoneId ? timeData.timezoneId : this.getTimezoneByOffset(timeData.gmtOffset);
            const formatter = new Intl.DateTimeFormat('en-US', {
                timeZone: timeZoneId,
                year: "numeric",
                month: "numeric",
                day: "numeric",
                hour: 'numeric',
                minute: 'numeric',
                second: 'numeric',
                hour12: true // This ensures the time is displayed as AM/PM
            });
            const localTime =  formatter.format(new Date());
            return {
                localTime: localTime,
                timeZoneName: this.getTimeZoneName(timeZoneId),
                timeZoneId: timeZoneId,
                gmtOffset: timeData.gmtOffset
            };
        } else {
            console.error("Error calculating local time from time zone data.");
            return null;
        }
    }

    getTimeZoneName(timeZoneId) {
        if (!timeZoneId) {
            return '';
        }
        const now = new Date();

        // Create a DateTimeFormat object for the specific timezone
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: timeZoneId,
            timeZoneName: 'long'
        });

        // Get the formatted time parts including the timezone name
        const parts = formatter.formatToParts(now);

        // Extract the timezone name from the parts
        const timeZoneName = parts.find(part => part.type === 'timeZoneName');

        return timeZoneName ? timeZoneName.value : '';
    }

    getTimezoneByOffset(gmtOffset) {
        const timeZoneMap = {
            "-12": "Etc/GMT+12",
            "-11": "Pacific/Midway",
            "-10": "Pacific/Honolulu",
            "-9": "America/Anchorage",
            "-8": "America/Los_Angeles",
            "-7": "America/Denver",
            "-6": "America/Chicago",
            "-5": "America/New_York",
            "-4": "America/Caracas", // Non-DST zone
            "-3": "America/Argentina/Buenos_Aires",
            "-2": "Etc/GMT+2",
            "-1": "Etc/GMT+1",
            "0": "Etc/GMT", // or "UTC"
            "1": "Europe/London",
            "2": "Europe/Paris",
            "3": "Europe/Moscow",
            "4": "Asia/Dubai",
            "5": "Asia/Karachi",
            "6": "Asia/Dhaka",
            "7": "Asia/Bangkok",
            "8": "Asia/Shanghai",
            "9": "Asia/Tokyo",
            "10": "Australia/Sydney",
            "11": "Pacific/Noumea",
            "12": "Pacific/Fiji"
        };
        return timeZoneMap[gmtOffset] || null;
    }
}

// UserInterface: Handles the display and interaction of the globe and UI elements
class UserInterface {
    constructor(geoApiKey, timeApiKey) {
        this.apiFetcher = new APIFetcher(geoApiKey, timeApiKey);
        this.timeCalculator = new TimeZoneCalculator(this.apiFetcher);
        this.initGlobe();
    }

    // Initialize and display the 3D globe
    initGlobe() {
        this.worldContainer = document.getElementById('globe-container');
        this.world = Globe()(this.worldContainer)
            .globeImageUrl('./img/earth-blue-marble.jpg')
            .bumpImageUrl('./img/earth-topology.png')
            .backgroundImageUrl('./img/night-sky.png')
            .pointColor(() => 'red');

        this.world.pointOfView({ lat: 0, lng: 0, altitude: 2 });

        // Event listener for clicking on the globe
        this.world.onGlobeClick(({ lat, lng }) => {
            const location = new Location(lat, lng);
            this.processLocation(new Location(lat, lng));
        });
    }

    processSerch() {
        const locationQuery = document.getElementById('location').value;
        if (locationQuery) {
            this.searchLocation(locationQuery);
        } else {
            displayError("Please enter a valid location.");
        }
    }

    // Search for a location by city name and display time data
    async searchLocation(query) {
        clearPreviousResults();
        showLoading();

        const locationData = await this.apiFetcher.fetchCoordinates(query);
        hideLoading();

        if (locationData) {
            const location = new Location(locationData.lat, locationData.lng);
            await this.processLocation(location);
        } else {
            displayError(`Location not found for "${query}". Please try another city.`);
        }
    }

    async processLocation(location) {
        const timeData = await this.timeCalculator.calculateTime(location);

        if (timeData) {
            const timeZoneInfo = timeData.timeZoneName && timeData.timeZoneId ? `Time Zone: ${timeData.timeZoneName} (${timeData.timeZoneId})` : 'Unknow TimeZone';
            // Display the current local time and time zone information
            document.getElementById('current-time').innerText = `Current Time (Local): ${timeData.localTime}`;
            document.getElementById('timezone-info').innerText = timeZoneInfo;

            this.updateGlobeLocation(location);

            // Fetch and display sunrise and sunset times
            this.fetchSunriseSunset(location.latitude, location.longitude, timeData.timeZoneId);
        } else {
            displayError("Failed to fetch local time data.");
        }
    }

    // Fetch Sunrise and Sunset Times
    async fetchSunriseSunset(lat, lng, timezoneId) {
        //const url = `https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lng}&formatted=0`;
        const url = `${this.apiFetcher.prefixURL}/api/sunrise-sunset?lat=${lat}&lng=${lng}`;
        try {
            let response = await fetch(url);
            if (!response.ok) {
                throw new Error("Error fetching sunrise and sunset times.");
            }
            const data = await response.json();
            if (data.status === "OK") {
                const sunrise = this.formatTime(data.results.sunrise, timezoneId);
                const sunset = this.formatTime(data.results.sunset, timezoneId);

                // Display Sunrise and Sunset times
                document.getElementById('sunrise-time').innerText = `Sunrise: ${sunrise}`;
                document.getElementById('sunset-time').innerText = `Sunset: ${sunset}`;
            } else {
                displayError("Failed to fetch sunrise and sunset times.");
            }
        } catch (error) {
            console.error("Error fetching sunrise/sunset data:", error);
            displayError("Unable to retrieve sunrise and sunset times.");
        }
    }

    // Update the globe with the new location
    updateGlobeLocation(location) {
        this.world.pointsData([{ lat: location.latitude, lng: location.longitude, size: 1.5, color: 'red' }]);
        this.world.pointOfView({ lat: location.latitude, lng: location.longitude, altitude: 1.5 }, 2000);
        this.createIconMarker(location.latitude, location.longitude);
    }

    formatTime(date, timezoneId) {
        // Convert date to a Date object, then format to time
        const currentTime = new Date(date);
        return new Intl.DateTimeFormat('en-US', {
            timeZone: timezoneId,
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
            hour12: true,
          }).format(currentTime);
    }

    createIconMarker(lat, lng) {
        const svgMarker = `<svg viewBox="-4 0 36 36">
            <path fill="currentColor" d="M14,0 C21.732,0 28,5.641 28,12.6 C28,23.963 14,36 14,36 C14,36 0,24.064 0,12.6 C0,5.641 6.268,0 14,0 Z"></path>
            <circle fill="black" cx="14" cy="14" r="7"></circle>
        </svg>`;
        const markerElement = document.createElement('div');
        markerElement.classList.add('marker-container');

        const el = document.createElement('div');
        el.innerHTML = svgMarker;
        el.classList.add('marker');
        markerElement.appendChild(el);
        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                // Get the new width and height of the element
                const newWidth = entry.contentRect.width;
                const newHeight = entry.contentRect.height;
                el.style.right = `${3+(-3*newWidth/30)}px`;
                el.style.top = `${-20+(5*newWidth/30)}px`;
            }
        });

        // Start observing the div element
        resizeObserver.observe(markerElement);

        // Use htmlElementsData to bind the marker to a specific lat/lng
        this.world.htmlElementsData([{ lat, lng, element: markerElement }])
            .htmlElement(d => {
                d.element.style.color = 'red';
                return d.element;
            });
    }
}

// Utility functions
function displayError(message) {
    document.getElementById('error-message').innerText = message;
}

function clearError() {
    document.getElementById('error-message').innerText = '';
}

function clearPreviousResults() {
    document.getElementById('current-time').innerText = 'Current Time (Local): --:--';
    document.getElementById('sunrise-time').innerText = 'Sunrise: --:--';
    document.getElementById('sunset-time').innerText = 'Sunset: --:--';
    document.getElementById('timezone-info').innerText = 'Time Zone: --:--';
    clearError();
}

function showLoading() {
    document.getElementById('loading-message').style.display = 'block';
}

function hideLoading() {
    document.getElementById('loading-message').style.display = 'none';
}


// Handle the button click for resetting the input and results
document.getElementById('reset-btn').addEventListener('click', function () {
    document.getElementById('location').value = ''; // Clears the input field
    clearPreviousResults(); // Clears any displayed results or messages
    // Optionally reset the globe view to a default position
    if (ui && ui.world) {
        ui.world.pointOfView({ lat: 0, lng: 0, altitude: 2 });
    }
});

// Handle the button click for searching a location
document.getElementById('calculate-btn').addEventListener('click', function () {
    ui.processSerch();
});
document.getElementById('location').addEventListener('keydown', function(event) {
    if (event.key === 'Enter' || event.keyCode === 13) {
        // Call the method when 'Enter' is pressed
        ui.processSerch();
    }
});

// Initialize the User Interface and Globe with Google API keys
const geoApiKey = 'AIzaSyC0G2flMZzV5WGhWdu4iAXQTHZRRpk_DlU';  // Google API key
const timeApiKey = 'AIzaSyC0G2flMZzV5WGhWdukiAXQTHZRRpk_DlU';  // Same Google API key used for Time Zone API
//const ui = new UserInterface(geoApiKey, timeApiKey);
let ui;
// Auto-detect user's location using browser's Geolocation API
document.addEventListener('DOMContentLoaded', function () {
    ui = new UserInterface(geoApiKey, timeApiKey);
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition((position) => {
            const location = new Location(position.coords.latitude, position.coords.longitude);
            ui.processLocation(location);
        }, (error) => {
            console.log("Geolocation access denied or unavailable:", error);
        });
    }
});
if (typeof fetch !== 'function') {
    alert('No fetch function support');
}
