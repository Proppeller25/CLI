const { getAuth, setAuth, getApiUrl } = require('./storage');

async function refreshAccessToken() {
  const auth = getAuth();
  if (!auth || !auth.refreshToken) return null;

  const apiUrl = getApiUrl();
  try {
    const response = await fetch(`${apiUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: auth.refreshToken })
    });
    if (!response.ok) throw new Error('Refresh failed');
    const data = await response.json();
    const newAuth = {
      ...auth,
      accessToken: data.access_token,
      refreshToken: data.refresh_token
    };
    setAuth(newAuth);
    console.log('Access token refreshed')
    return data.access_token;
  } catch (err) {
    return null;
  }
}

async function apiRequest(endpoint, options = {}) {
  const auth = getAuth();
  if (!auth) {
    throw new Error('Not logged in. Run `insighta login` first.');
  }

  const apiUrl = getApiUrl();
  const url = `${apiUrl}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    'X-API-Version': '1',
    ...options.headers
  };
  if (auth.accessToken) {
    headers['Authorization'] = `Bearer ${auth.accessToken}`;
  }

  const makeRequest = async (token) => {
    const finalHeaders = { ...headers };
    if (token) finalHeaders['Authorization'] = `Bearer ${token}`;
    return fetch(url, { ...options, headers: finalHeaders });
  };

  let response = await makeRequest(auth.accessToken);
  if (response.status === 401) {
    // Access token expired – try to refresh
    const newToken = await refreshAccessToken();
    if (newToken) {
      response = await makeRequest(newToken);
    } else {
      throw new Error('Session expired. Please log in again.');
    }
  }
  return response;
}

module.exports = { apiRequest, refreshAccessToken };