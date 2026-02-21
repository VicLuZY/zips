const form = document.getElementById('submission-form');
const restaurantList = document.getElementById('restaurants');
const statusMessage = document.getElementById('status-message');
const latInput = document.getElementById('lat');
const lngInput = document.getElementById('lng');
const mapEl = document.getElementById('map');
const pinEl = document.getElementById('pin');

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
      <div>Accepts tips: <strong>${restaurant.acceptsTips ? 'Yes' : 'No'}</strong></div>
      <div>Verification status: ${restaurant.verification_status}</div>
    `;

    restaurantList.appendChild(item);
  });
};

const loadRestaurants = async () => {
  const response = await fetch('/api/restaurants');
  const restaurants = await response.json();
  renderRestaurants(restaurants);
};

const placePin = (x, y) => {
  pinEl.hidden = false;
  pinEl.style.left = `${x}px`;
  pinEl.style.top = `${y}px`;
};

mapEl.addEventListener('click', (event) => {
  const rect = mapEl.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  placePin(x, y);

  const lat = 90 - (y / rect.height) * 180;
  const lng = (x / rect.width) * 360 - 180;

  latInput.value = lat.toFixed(6);
  lngInput.value = lng.toFixed(6);
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

  statusMessage.textContent = 'Submission sent for community verification.';
  form.reset();
  pinEl.hidden = true;
  await loadRestaurants();
});

loadRestaurants();
