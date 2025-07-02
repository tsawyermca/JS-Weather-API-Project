const locationInput = document.getElementById('locationInput');
const searchButton = document.getElementById('searchButton');
const errorMessage = document.getElementById('errorMessage');
const currentWeather = document.getElementById('currentWeather');
const locationName = document.getElementById('locationName');
const currentDate = document.getElementById('currentDate');
const currentIcon = document.getElementById('currentIcon');
const currentTemp = document.getElementById('currentTemp');
const currentDescription = document.getElementById('currentDescription');
const forecastContainer = document.getElementById('forecastContainer');
const unitToggle = document.getElementById('unitToggle');

let weatherData = null;
let isCelsius = false; // Starts at Fahrenheit

searchButton.addEventListener('click', () => {
    const location = locationInput.value.trim();
    if (location) {
        fetchWeather(location);
    } else {
        showError('Please enter a city name.');
    }
});

locationInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        const location = locationInput.value.trim();
        if (location) {
            fetchWeather(location);
        } else {
            showError('Please enter a city name.');
        }
    }
});

//Changes to Celsius when checked
unitToggle.addEventListener('change', () => {
    isCelsius = unitToggle.checked;
    if (weatherData) {
        displayWeather(weatherData);
    }
});

// Fetch Weather Data
async function fetchWeather(location) {
    try {
        // Use Geocode to get lat+long
        const geocodeUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&format=json&limit=1`;
        const geocodeResponse = await fetch(geocodeUrl, {
            headers: { 'User-Agent': 'WeatherApp/1.0 (tyler.sawyer@mscoding.org)' }
        });
        const geocodeData = await geocodeResponse.json();

        if (!geocodeData.length) {
            showError('Location not found. Please try again.');
            return;
        }

        const { lat, lon, display_name: displayName } = geocodeData[0];

        // Get NWS weather
        const pointsUrl = `https://api.weather.gov/points/${lat},${lon}`;
        const pointsResponse = await fetch(pointsUrl, {
            headers: { 'User-Agent': 'WeatherApp/1.0 (tyler.sawyer@mscoding.org)' }
        });
        if (!pointsResponse.ok) {
            throw new Error('Failed to fetch NWS points data.');
        }
        const pointsData = await pointsResponse.json();
        const timeZone = pointsData.properties.timeZone;
        const forecastUrl = pointsData.properties.forecast;

        // Get 7-day forecast
        const forecastResponse = await fetch(forecastUrl, {
            headers: { 'User-Agent': 'WeatherApp/1.0 (tyler.sawyer@mscoding.org)' }
        });
        if (!forecastResponse.ok) {
            throw new Error('Failed to fetch forecast data.');
        }
        weatherData = await forecastResponse.json();

        // Use nearest observation station
        const observationStationsUrl = pointsData.properties.observationStations;
        const stationsResponse = await fetch(observationStationsUrl, {
            headers: { 'User-Agent': 'WeatherApp/1.0 (tyler.sawyer@mscoding.org)' }
        });
        const stationsData = await stationsResponse.json();
        const nearestStation = stationsData.features[0].properties.stationIdentifier;
        const observationUrl = `https://api.weather.gov/stations/${nearestStation}/observations/latest`;
        const observationResponse = await fetch(observationUrl, {
            headers: { 'User-Agent': 'WeatherApp/1.0 (tyler.sawyer@mscoding.org)' }
        });
        if (!observationResponse.ok) {
            throw new Error('Failed to fetch current weather data.');
        }
        const observationData = await observationResponse.json();

        weatherData.current = observationData.properties;
        weatherData.location = displayName;
        weatherData.timeZone = timeZone;

        // Display weather data
        displayWeather(weatherData);
        hideError();
    } catch (error) {
        showError('Error fetching weather data. Please try again.');
        console.error('Error:', error);
    }
}

// Display Weather
function displayWeather(data) {
    // Clear previous interval
    if (window.timeInterval) clearInterval(window.timeInterval);
    window.timeInterval = updateLocalTime(data.timeZone, currentDate);
    // Current Weather
    locationName.textContent = data.location;
    const localTime = new Date().toLocaleTimeString('en-US', {
        timeZone: data.timeZone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    });
    currentDate.textContent = `${new Date().toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    })} ${localTime}`;
    const currentTempValue = data.current.temperature.value; // Celsius
    currentTemp.textContent = `Temperature: ${formatTemperature(currentTempValue, true)}`;
    currentDescription.textContent = data.current.textDescription || 'N/A';
    currentIcon.src = data.current.icon || 'https://api.weather.gov/icons/land/day/skc?size=medium';
    currentWeather.classList.remove('hidden');

    // 7-Day Forecast
    forecastContainer.innerHTML = '';
    const periods = data.properties.periods.slice(0, 14);
    periods.forEach((period, index) => {
        if (index % 2 === 0) {
            const highTemp = period.temperature; // Fahrenheit
            const lowTemp = periods[index + 1]?.temperature || highTemp; // Fahrenheit
            const forecastDate = new Date(period.startTime).toLocaleDateString('en-US', {
                month: '2-digit',
                day: '2-digit',
                year: '2-digit'
            });
            const card = `
                <div class="forecastCard">
                    <h5>${new Date(period.startTime).toLocaleDateString('en-US', { weekday: 'long' })}</h5>
                    <p>${forecastDate}</p>
                    <img src="${period.icon}" alt="Weather Icon" class="weatherIcon">
                    <p>High: ${formatTemperature(highTemp, false)}</p>
                    <p>Low: ${formatTemperature(lowTemp, false)}</p>
                    <p>${period.shortForecast}</p>
                </div>
            `;
            forecastContainer.innerHTML += card;
        }
    });
}

// Temperature Conversion
function formatTemperature(temp, isCelsiusInput) {
    let celsius;
    if (isCelsiusInput) {
        celsius = temp;
    } else {
        // Convert Fahrenheit to Celsius
        celsius = (temp - 32) * 5 / 9;
    }
    if (isCelsius) {
        return `${Math.round(celsius)}°C`;
    }
    const fahrenheit = (celsius * 9 / 5) + 32;
    return `${Math.round(fahrenheit)}°F`;
}

// Error Handling
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
    currentWeather.classList.add('hidden');
    forecastContainer.innerHTML = '';
}

function hideError() {
    errorMessage.classList.add('hidden');
}

// Update Local Time Every Second
function updateLocalTime(timeZone, element) {
    const interval = setInterval(() => {
        const localTime = new Date().toLocaleTimeString('en-US', {
            timeZone: timeZone,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
        element.textContent = `${new Date().toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        })} ${localTime}`;
    }, 1000);
    return interval;
}

// Initial Fetch
fetchWeather('Biloxi, MS');