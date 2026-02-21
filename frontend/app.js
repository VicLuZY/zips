const map = L.map('map').setView([40.73061, -73.935242], 12);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors',
}).addTo(map);

const noTipsToggle = document.getElementById('noTipsToggle');
const restaurantList = document.getElementById('restaurantList');
const detailCard = document.getElementById('detailCard');

let noTipsOnly = true;
const markerLayer = L.layerGroup().addTo(map);
const markersById = new Map();
let currentRestaurants = [];

function debounce(fn, delay = 350) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}

function getId(restaurant) {
  return restaurant.id ?? `${restaurant.name}-${restaurant.latitude}-${restaurant.longitude}`;
}

function parseCoordinate(restaurant, keys) {
  for (const key of keys) {
    if (restaurant[key] !== undefined && restaurant[key] !== null) {
      return Number(restaurant[key]);
    }
  }
  return NaN;
}

function normalizeRestaurant(restaurant) {
  const latitude = parseCoordinate(restaurant, ['latitude', 'lat']);
  const longitude = parseCoordinate(restaurant, ['longitude', 'lng', 'lon']);

  return {
    ...restaurant,
    id: getId(restaurant),
    latitude,
    longitude,
    name: restaurant.name ?? 'Unknown restaurant',
    address: restaurant.address ?? 'Address unavailable',
    cuisine: restaurant.cuisine ?? 'Unknown cuisine',
    tipsAccepted: Boolean(restaurant.tipsAccepted ?? restaurant.tips_accepted ?? false),
  };
}

function renderDetailCard(restaurant) {
  detailCard.innerHTML = `
    <h3>${restaurant.name}</h3>
    <p class="muted">${restaurant.address}</p>
    <p><strong>Cuisine:</strong> ${restaurant.cuisine}</p>
    <p><strong>Tips accepted:</strong> No</p>
  `;
  detailCard.classList.remove('hidden');
}

function selectRestaurant(restaurantId) {
  const marker = markersById.get(restaurantId);
  const restaurant = currentRestaurants.find((item) => item.id === restaurantId);

  if (!restaurant) return;

  if (marker) {
    marker.openPopup();
    map.panTo(marker.getLatLng());
  }

  renderDetailCard(restaurant);
}

function renderList(restaurants) {
  if (restaurants.length === 0) {
    restaurantList.innerHTML = '<li class="empty">No restaurants in this viewport.</li>';
    return;
  }

  restaurantList.innerHTML = restaurants
    .map(
      (restaurant) => `
      <li>
        <button type="button" data-id="${restaurant.id}">
          <strong>${restaurant.name}</strong><br />
          <small>${restaurant.address}</small>
        </button>
      </li>
    `,
    )
    .join('');
}

function renderMarkers(restaurants) {
  markerLayer.clearLayers();
  markersById.clear();

  restaurants.forEach((restaurant) => {
    if (!Number.isFinite(restaurant.latitude) || !Number.isFinite(restaurant.longitude)) {
      return;
    }

    const marker = L.marker([restaurant.latitude, restaurant.longitude]);
    marker.bindPopup(`<strong>${restaurant.name}</strong>`);
    marker.on('click', () => renderDetailCard(restaurant));

    marker.addTo(markerLayer);
    markersById.set(restaurant.id, marker);
  });
}

function buildBBox(bounds) {
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  return `${sw.lng},${sw.lat},${ne.lng},${ne.lat}`;
}

async function fetchRestaurantsForViewport() {
  const bbox = buildBBox(map.getBounds());
  const response = await fetch(`/restaurants?bbox=${encodeURIComponent(bbox)}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch restaurants (${response.status})`);
  }

  const payload = await response.json();
  const rows = Array.isArray(payload) ? payload : payload.restaurants ?? [];

  currentRestaurants = rows
    .map(normalizeRestaurant)
    .filter((restaurant) => (noTipsOnly ? !restaurant.tipsAccepted : true));

  renderMarkers(currentRestaurants);
  renderList(currentRestaurants);
}

const debouncedViewportFetch = debounce(() => {
  fetchRestaurantsForViewport().catch((error) => {
    console.error(error);
    restaurantList.innerHTML = `<li class="empty">${error.message}</li>`;
  });
}, 350);

map.on('moveend', debouncedViewportFetch);
map.on('zoomend', debouncedViewportFetch);

restaurantList.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-id]');
  if (!button) return;
  selectRestaurant(button.dataset.id);
});

noTipsToggle.addEventListener('click', () => {
  noTipsOnly = !noTipsOnly;
  noTipsToggle.classList.toggle('active', noTipsOnly);
  noTipsToggle.setAttribute('aria-pressed', String(noTipsOnly));
  debouncedViewportFetch();
});

debouncedViewportFetch();
