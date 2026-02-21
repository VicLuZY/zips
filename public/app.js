const form = document.getElementById('submission-form');
const restaurantList = document.getElementById('restaurants');
const statusMessage = document.getElementById('status-message');
const latInput = document.getElementById('lat');
const lngInput = document.getElementById('lng');
const pickerMapEl = document.getElementById('picker-map');
const directoryMapEl = document.getElementById('directory-map');
const pinEl = document.getElementById('pin');

const toXY = (lat, lng, width, height) => {
  const x = ((lng + 180) / 360) * width;
  const y = ((90 - lat) / 180) * height;
  return { x, y };
};

const renderDirectoryMap = (restaurants) => {
  directoryMapEl.innerHTML = '';

  if (restaurants.length === 0) {
    directoryMapEl.innerHTML = '<p class="empty-map">No zero-tip restaurants have been submitted yet.</p>';
    return;
  }

  const width = directoryMapEl.clientWidth;
  const height = directoryMapEl.clientHeight;

  restaurants.forEach((restaurant) => {
    const marker = document.createElement('button');
    marker.className = 'marker';
    marker.type = 'button';
    marker.title = `${restaurant.name} · ${restaurant.address}`;
    marker.setAttribute('aria-label', marker.title);

    const { x, y } = toXY(restaurant.lat, restaurant.lng, width, height);
    marker.style.left = `${x}px`;
    marker.style.top = `${y}px`;

    directoryMapEl.appendChild(marker);
  });
};

const renderRestaurants = (restaurants) => {
  restaurantList.innerHTML = '';

  restaurants.forEach((restaurant) => {
    const item = document.createElement('li');
    item.className = 'list-item';

    const verificationBadge = restaurant.verification_status !== 'verified'
      ? '<span class="badge">Pending community verification</span>'
      : '';

    item.innerHTML = `
      <strong>${restaurant.name}</strong>${verificationBadge}
      <div>${restaurant.address}</div>
      <div>Map pin: ${restaurant.lat.toFixed(5)}, ${restaurant.lng.toFixed(5)}</div>
      <div>Verification status: ${restaurant.verification_status}</div>
    `;

    restaurantList.appendChild(item);
  });

  renderDirectoryMap(restaurants);
};

const loadZeroTipRestaurants = async () => {
  const response = await fetch('/api/restaurants?acceptsTips=false');
  const restaurants = await response.json();
  renderRestaurants(restaurants);
};

const placePin = (x, y) => {
  pinEl.hidden = false;
  pinEl.style.left = `${x}px`;
  pinEl.style.top = `${y}px`;
};

pickerMapEl.addEventListener('click', (event) => {
  const rect = pickerMapEl.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  placePin(x, y);

  const lat = 90 - (y / rect.height) * 180;
  const lng = (x / rect.width) * 360 - 180;

  latInput.value = lat.toFixed(6);
  lngInput.value = lng.toFixed(6);
});

window.addEventListener('resize', () => {
  loadZeroTipRestaurants();
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const tipChoice = form.querySelector('input[name="acceptsTips"]:checked');

  const payload = {
    name: document.getElementById('name').value,
    address: document.getElementById('address').value,
    lat: Number(latInput.value),
    lng: Number(lngInput.value),
    acceptsTips: tipChoice ? tipChoice.value === 'yes' : null
  };

  const response = await fetch('/api/restaurants', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await response.json();

  if (!response.ok) {
    statusMessage.textContent = data.error || 'Unable to submit.';
    return;
  }

  statusMessage.textContent = payload.acceptsTips
    ? 'Submitted. This location accepts tips, so it is not shown in the zero-tip directory.'
    : 'Submitted to Zips. This zero-tip location is now shown in the directory.';

  form.reset();
  pinEl.hidden = true;
  await loadZeroTipRestaurants();
});

loadZeroTipRestaurants();
