import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

const WEATHER_TYPES = [
  { codes: [0], main: 'Clear', description: 'Ciel dégagé', icon: '01' },
  { codes: [1, 2], main: 'Clear', description: 'Éclaircies', icon: '02' },
  { codes: [3], main: 'Clouds', description: 'Couvert', icon: '04' },
  { codes: [45, 48], main: 'Mist', description: 'Brouillard', icon: '50' },
  { codes: [51, 53, 55, 56, 57], main: 'Drizzle', description: 'Bruine', icon: '09' },
  { codes: [61, 63, 65, 66, 67, 80, 81, 82], main: 'Rain', description: 'Pluie', icon: '10' },
  { codes: [71, 73, 75, 77, 85, 86], main: 'Snow', description: 'Neige', icon: '13' },
  { codes: [95, 96, 99], main: 'Thunderstorm', description: 'Orage', icon: '11' }
];

function describeWeather(code, isDay = true) {
  const condition = WEATHER_TYPES.find(type => type.codes.includes(code)) || {
    main: 'Clouds', description: 'Conditions variables', icon: '03'
  };
  return { ...condition, icon: `${condition.icon}${isDay ? 'd' : 'n'}` };
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Les données météo sont temporairement indisponibles.');
  const data = await response.json();
  if (data.error) throw new Error(data.reason || 'Réponse météo invalide.');
  return data;
}

async function findCity(city) {
  const params = new URLSearchParams({ name: city, count: '1', language: 'fr', format: 'json' });
  const data = await fetchJson(`https://geocoding-api.open-meteo.com/v1/search?${params}`);
  if (!data.results?.length) throw new Error('Ville introuvable. Vérifiez son orthographe.');
  return data.results[0];
}

async function fetchWeather(latitude, longitude, name) {
  const params = new URLSearchParams({
    latitude,
    longitude,
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m',
    hourly: 'temperature_2m,weather_code,is_day',
    daily: 'temperature_2m_max,temperature_2m_min,sunrise,weather_code',
    forecast_days: '6',
    timezone: 'auto'
  });
  const data = await fetchJson(`https://api.open-meteo.com/v1/forecast?${params}`);
  const current = data.current;
  const firstFutureHour = data.hourly.time.findIndex(time => time >= current.time);
  return {
    current: {
      name,
      temperature: current.temperature_2m,
      feelsLike: current.apparent_temperature,
      maximum: data.daily.temperature_2m_max[0],
      minimum: data.daily.temperature_2m_min[0],
      humidity: current.relative_humidity_2m,
      windKmh: current.wind_speed_10m,
      sunrise: data.daily.sunrise[0],
      weather: describeWeather(current.weather_code, current.is_day === 1)
    },
    hourly: data.hourly.time.slice(firstFutureHour, firstFutureHour + 8).map((time, index) => {
      const hourIndex = firstFutureHour + index;
      return {
        time,
        temperature: data.hourly.temperature_2m[hourIndex],
        weather: describeWeather(data.hourly.weather_code[hourIndex], data.hourly.is_day[hourIndex] === 1)
      };
    }),
    daily: data.daily.time.slice(1, 6).map((date, index) => {
      const day = index + 1;
      return {
        date,
        temperature: (data.daily.temperature_2m_max[day] + data.daily.temperature_2m_min[day]) / 2,
        weather: describeWeather(data.daily.weather_code[day])
      };
    })
  };
}

function formatDate(date) {
  return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

function WeatherIcon({ weather, large = false }) {
  const cloud = <path d="M15 42h34a11 11 0 0 0 0-22 16 16 0 0 0-30-3 12 12 0 0 0-4 25Z" fill="#f7f5ec" />;
  let symbol;

  if (weather.main === 'Clear') {
    symbol = <g fill="none" stroke="#f6c66b" strokeLinecap="round" strokeWidth="3"><circle cx="32" cy="29" r="10" fill="#f6c66b" stroke="none" /><path d="M32 6v7m0 32v7M9 29h7m32 0h7M16 13l5 5m22 22 5 5m0-32-5 5M21 40l-5 5" /></g>;
  } else if (weather.main === 'Rain' || weather.main === 'Drizzle') {
    symbol = <>{cloud}<path d="m21 49-3 6m15-6-3 6m15-6-3 6" fill="none" stroke="#9fd2e8" strokeLinecap="round" strokeWidth="3" /></>;
  } else if (weather.main === 'Snow') {
    symbol = <>{cloud}<g fill="none" stroke="#9fd2e8" strokeLinecap="round" strokeWidth="2"><path d="M22 49v8m-4-4h8m-3-3  -2 2 2 2m14-5v8m-4-4h8m-3-3-2 2 2 2" /></g></>;
  } else if (weather.main === 'Thunderstorm') {
    symbol = <>{cloud}<path d="m33 43-8 11h7l-3 8 12-14h-8l4-5" fill="#f6c66b" /></>;
  } else if (weather.main === 'Mist') {
    symbol = <g fill="none" stroke="#d8e1df" strokeLinecap="round" strokeWidth="3"><path d="M11 22h42M6 32h46M13 42h38" /></g>;
  } else {
    symbol = cloud;
  }

  return (
    <svg
      id={large ? 'weather-icon' : undefined}
      className={`weather-symbol${large ? ' weather-symbol-large' : ''}`}
      viewBox="0 0 64 64"
      role="img"
      aria-label={weather.description}
      xmlns="http://www.w3.org/2000/svg"
    >
      {symbol}
    </svg>
  );
}

function App() {
  const [city, setCity] = useState('');
  const [current, setCurrent] = useState(null);
  const [hourly, setHourly] = useState([]);
  const [daily, setDaily] = useState([]);
  const [status, setStatus] = useState('Chargement des conditions météo…');
  const [loading, setLoading] = useState(false);
  const [activePage, setActivePage] = useState(0);
  const requestId = useRef(0);
  const pageViewport = useRef(null);
  const canvas = useRef(null);
  const mainCondition = current?.weather.main;

  async function updateWeather(latitude, longitude, name, id) {
    const result = await fetchWeather(latitude, longitude, name);
    if (id !== requestId.current) return;
    setCurrent(result.current);
    setHourly(result.hourly);
    setDaily(result.daily);
    setStatus('Conditions en direct · Open-Meteo');
  }

  async function searchCity(value = city) {
    const query = value.trim();
    if (!query) {
      setStatus('Saisissez une ville pour lancer la recherche.');
      return;
    }
    const id = ++requestId.current;
    setCity(query);
    setLoading(true);
    setStatus('Recherche des conditions météo…');
    try {
      const place = await findCity(query);
      const name = [place.name, place.admin1, place.country].filter(Boolean).join(', ');
      await updateWeather(place.latitude, place.longitude, name, id);
      if (id === requestId.current) {
        try { localStorage.setItem('meteo-last-city', query); } catch {}
      }
    } catch (error) {
      if (id === requestId.current) setStatus(error.message || 'Impossible de récupérer la météo.');
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }

  async function getUserPosition() {
    if (Capacitor.isNativePlatform()) {
      const permission = await Geolocation.requestPermissions();
      if (permission.location !== 'granted') throw new Error('Accès à la position refusé.');
      return Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
    }
    if (!navigator.geolocation) throw new Error('La géolocalisation n’est pas prise en charge par cet appareil.');
    return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false, timeout: 10000, maximumAge: 300000
    }));
  }

  async function searchLocation() {
    const id = ++requestId.current;
    setLoading(true);
    setStatus('Recherche de votre position…');
    try {
      const position = await getUserPosition();
      await updateWeather(position.coords.latitude, position.coords.longitude, 'Ma position', id);
    } catch (error) {
      if (id === requestId.current) {
        setStatus(error.code === 1 ? 'Accès à la position refusé.' : error.message || 'Position indisponible.');
      }
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }

  function selectPage(index) {
    pageViewport.current?.scrollTo({
      left: index * pageViewport.current.clientWidth,
      behavior: 'smooth'
    });
    setActivePage(index);
  }

  useEffect(() => {
    let initialCity = 'Paris';
    try { initialCity = localStorage.getItem('meteo-last-city') || initialCity; } catch {}
    searchCity(initialCity);
  }, []);

  useEffect(() => {
    if (!current) return undefined;
    document.body.dataset.weather = mainCondition.toLowerCase();

    const element = canvas.current;
    const context = element.getContext('2d');
    const resize = () => {
      element.width = window.innerWidth;
      element.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    let frame;
    let drops = [];
    if (mainCondition === 'Rain' || mainCondition === 'Drizzle') {
      drops = Array.from({ length: 150 }, () => ({
        x: Math.random() * element.width,
        y: Math.random() * element.height,
        speed: 2 + Math.random() * 4,
        length: 8 + Math.random() * 12
      }));
      const draw = () => {
        context.clearRect(0, 0, element.width, element.height);
        context.strokeStyle = 'rgba(200, 200, 255, 0.6)';
        context.lineWidth = 1;
        drops.forEach(drop => {
          context.beginPath();
          context.moveTo(drop.x, drop.y);
          context.lineTo(drop.x, drop.y + drop.length);
          context.stroke();
          drop.y += drop.speed;
          if (drop.y > element.height) {
            drop.y = -drop.length;
            drop.x = Math.random() * element.width;
          }
        });
        frame = requestAnimationFrame(draw);
      };
      frame = requestAnimationFrame(draw);
    } else {
      context.clearRect(0, 0, element.width, element.height);
    }
    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(frame);
      context.clearRect(0, 0, element.width, element.height);
    };
  }, [current, mainCondition]);

  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator) || Capacitor.isNativePlatform()) return undefined;
    const register = () => navigator.serviceWorker.register('./sw.js').catch(() => {});
    window.addEventListener('load', register);
    return () => window.removeEventListener('load', register);
  }, []);

  const temperature = current ? `${Math.round(current.temperature)}°` : '--°';

  return (
    <>
      <div className="app">
        <header className="topbar">
          <a className="brand" href="#top" aria-label="Météo, accueil">
            <span className="brand-mark">météo</span>
            <span className="brand-caption">le temps en clair</span>
          </a>
          <form className="search" role="search" onSubmit={event => { event.preventDefault(); searchCity(); }}>
            <label className="sr-only" htmlFor="city-input">Rechercher une ville</label>
            <input id="city-input" type="search" placeholder="Rechercher une ville" autoComplete="off" value={city} onChange={event => setCity(event.target.value)} />
            <button id="search-btn" type="submit" aria-label="Rechercher" title="Rechercher" disabled={loading}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.5" /><path d="m16 16 4.2 4.2" /></svg>
            </button>
            <button id="geo-btn" className="geo-button" type="button" title="Utiliser ma position" onClick={searchLocation} disabled={loading}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z" /><circle cx="12" cy="9" r="2.2" /></svg>
              <span>Ma position</span>
            </button>
          </form>
        </header>

        <nav className="page-tabs" aria-label="Pages météo">
          {['Aujourd’hui', 'Heure par heure', '5 jours'].map((label, index) => (
            <button key={label} className={`page-tab${activePage === index ? ' is-active' : ''}`} type="button" aria-current={activePage === index ? 'page' : undefined} onClick={() => selectPage(index)}>{label}</button>
          ))}
        </nav>

        <main id="top">
          <div
            className="page-viewport"
            ref={pageViewport}
            aria-label="Pages des prévisions météo"
            tabIndex={0}
            onScroll={event => setActivePage(Math.round(event.currentTarget.scrollLeft / event.currentTarget.clientWidth))}
            onKeyDown={event => {
              if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
              event.preventDefault();
              selectPage(Math.max(0, Math.min(2, activePage + (event.key === 'ArrowRight' ? 1 : -1))));
            }}
          >
            <div className="page-track">
              <section className="weather-page today-page" aria-labelledby="location-name">
                <div id="weather-hero" className="weather-hero" data-temperature={temperature}>
                  <div className="current">
                    <p className="eyebrow" id="weather-date">{current ? `${formatDate(new Date())} · AUJOURD’HUI`.toUpperCase() : 'MÉTÉO LOCALE'}</p>
                    <h1 id="location-name">{current?.name || 'Paris'}</h1>
                    <div className="condition-line">
                      {current && <WeatherIcon weather={current.weather} large />}
                      <p id="description">{current?.weather.description || 'Chargement…'}</p>
                    </div>
                    <div className="temperature-row">
                      <p id="temperature">{temperature}</p>
                      <span className="temperature-unit">C</span>
                      <div className="high-low">
                        <span>Max. <strong id="temp-max">{current ? `${Math.round(current.maximum)}°` : '--°'}</strong></span>
                        <span>Min. <strong id="temp-min">{current ? `${Math.round(current.minimum)}°` : '--°'}</strong></span>
                      </div>
                    </div>
                    <p className="weather-status" role="status" aria-live="polite">{status}</p>
                  </div>
                  <aside className="weather-details" aria-label="Conditions actuelles">
                    <p className="details-heading">Conditions actuelles</p>
                    <dl>
                      <div><dt>Ressenti</dt><dd id="feels-like">{current ? `${Math.round(current.feelsLike)}°` : '--°'}</dd></div>
                      <div><dt>Humidité</dt><dd id="humidity">{current ? `${current.humidity} %` : '-- %'}</dd></div>
                      <div><dt>Vent</dt><dd id="wind">{current ? `${Math.round(current.windKmh)} km/h` : '-- km/h'}</dd></div>
                      <div><dt>Lever du soleil</dt><dd id="sunrise">{current ? new Date(current.sunrise).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</dd></div>
                    </dl>
                  </aside>
                </div>
              </section>

              <section className="weather-page forecast-page hourly-page" aria-labelledby="hourly-title">
                <div className="forecast-heading">
                  <div><p className="eyebrow">PROCHAINES HEURES</p><h2 id="hourly-title">La journée, heure par heure</h2></div>
                  <span className="forecast-note">Prévisions locales</span>
                </div>
                <div className="hourly-forecast" aria-live="polite">
                  {hourly.map(item => (
                    <div className="hourly-card" key={item.time}>
                      <span className="hourly-time">{item.time.slice(11, 16)}</span>
                      <WeatherIcon weather={item.weather} />
                      <strong>{Math.round(item.temperature)}°</strong>
                      <span className="hourly-condition">{item.weather.description}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="weather-page forecast-page daily-page" aria-labelledby="forecast-title">
                <div className="forecast-heading">
                  <div><p className="eyebrow">TENDANCE</p><h2 id="forecast-title">Les cinq prochains jours</h2></div>
                  <span className="forecast-note">Prévisions locales</span>
                </div>
                <div className="forecast" aria-live="polite">
                  {daily.map(item => (
                    <div className="forecast-card" key={item.date}>
                      <div>{new Date(`${item.date}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
                      <WeatherIcon weather={item.weather} />
                      <div>{Math.round(item.temperature)}°</div>
                      <div>{item.weather.description}</div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </main>

        <footer>
          <span>météo</span>
          <span>Données météo : <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo · CC BY 4.0</a></span>
          <a href="./privacy.html">Confidentialité</a>
        </footer>
      </div>
      <canvas id="particles" ref={canvas} aria-hidden="true" />
    </>
  );
}

createRoot(document.getElementById('app-root')).render(<App />);
