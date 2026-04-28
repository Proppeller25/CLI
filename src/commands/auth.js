const crypto = require('crypto')
const http = require('http')
const open = require('open')
const { getAuth, setAuth, clearAuth, getApiUrl, getGithubClientId } = require('../utils/storage')
const { refreshAccessToken } = require('../utils/api')
require('dotenv').config()

async function handleAuthCommand(command, args) {
  if (command === 'login') {
    await handleLogin(args)
    return
  }
  if (command === 'logout') {
    await handleLogout()
    return
  }
  if (command === 'whoami') {
    handleWhoami()
    return
  }
  if (command === 'refresh') {
    await refreshAccessToken()
    return
  }
}

// ------------------------------------------------------------
// LOGIN – with OAuth + PKCE + local callback server
// ------------------------------------------------------------
async function handleLogin(args) {
  // Check for --pat fallback
  const patIndex = args.indexOf('--pat')
  if (patIndex !== -1 && args[patIndex + 1]) {
    const token = args[patIndex + 1]
    await loginWithPat(token)
    return
  }

  // OAuth flow
  await loginWithOAuth()
}

async function loginWithPat(token) {
  const apiUrl = getApiUrl()
  console.log('Authenticating with GitHub PAT...')
  try {
    const response = await fetch(`${apiUrl}/auth/cli/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.message || 'Unknown error')
    setAuth({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      user: data.user,
      loggedInAt: new Date().toISOString()
    })
    console.log(`Logged in as: ${data.user.email}`)
    console.log('Login successful!')
  } catch (error) {
    console.error(`Login failed: ${error.message}`)
    process.exit(1)
  }
}

async function loginWithOAuth() {
  const PORT = 3002
  const redirectUri = `http://localhost:${PORT}/callback`

  // 1. Generate state and PKCE
  const state = crypto.randomBytes(16).toString('hex')
  const codeVerifier = crypto.randomBytes(32).toString('base64url')
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url')

  console.log(`[DEBUG] Generated state: ${state}`)
  console.log(`[DEBUG] Code verifier (first 10): ${codeVerifier.slice(0,10)}...`)

  // 2. Build GitHub OAuth URL
  const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || 'YOUR_CLIENT_ID_HERE'
  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: 'read:user user:email',
    state: state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256'
  })
  if (!state) throw new Error('State is empty')
  const authUrl = `https://github.com/login/oauth/authorize?${params.toString()}`
  console.log(`[DEBUG] Auth URL: ${authUrl}`)

  // 3. Ensure no previous server is left hanging
  let server = null
  try {
    // Try to close any existing server on the same port (optional, but safe)
    const tempServer = http.createServer()
    tempServer.listen(PORT, () => {
      tempServer.close()
    })
    tempServer.on('error', (err) => {
      if (err.code !== 'EADDRINUSE') console.error(err)
    })
    await new Promise(resolve => setTimeout(resolve, 100)) // small delay
  } catch (e) {}

  // 4. Start local server
  server = http.createServer()
  let callbackResolved = false

  const callbackPromise = new Promise((resolve, reject) => {
    server.on('request', (req, res) => {
      console.log(`[DEBUG] Received request: ${req.url}`)
      const url = new URL(req.url, redirectUri)
      const returnedState = url.searchParams.get('state')
      const code = url.searchParams.get('code')
      console.log(`[DEBUG] returnedState: ${returnedState}, expected: ${state}`)
      if (returnedState !== state) {
        console.error(`State mismatch! Expected "${state}", got "${returnedState}"`)
        res.writeHead(400, { 'Content-Type': 'text/html' })
        res.end('<h1>Invalid state parameter</h1>')
        reject(new Error('State mismatch – possible CSRF attack'))
        return
      }
      if (!code) {
        console.error('Missing code in callback')
        res.writeHead(400, { 'Content-Type': 'text/html' })
        res.end('<h1>Missing authorization code</h1>')
        reject(new Error('Missing code in callback'))
        return
      }
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end('<h1>Authentication successful! You can close this window.</h1>')
      resolve({ code, state: returnedState })
    })

    server.listen(PORT, async () => {
      console.log(`\n🔐 GitHub OAuth URL:\n${authUrl}\n`)
      console.log(`Attempting to open browser automatically...`)
      // Wait 1 second to ensure server is fully bound
      await new Promise(resolve => setTimeout(resolve, 1000))
      const opened = openBrowser(authUrl)
      if (!opened) {
        console.log(`\nPlease copy and paste the above URL into your browser manually.`)
      }
    })

    setTimeout(() => {
      if (!callbackResolved) {
        server.close()
        reject(new Error('Authentication timeout (no callback received)'))
      }
    }, 120000)
  })

  let callbackData
  try {
    callbackData = await callbackPromise
    server.close()
  } catch (err) {
    console.error(err.message)
    process.exit(1)
  }

  // 5. Exchange code with backend
  const apiUrl = getApiUrl()
  const exchangeRes = await fetch(`${apiUrl}/auth/cli/callback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: callbackData.code,
      code_verifier: codeVerifier,
      state: callbackData.state,
      redirect_uri: redirectUri
    })
  })
  const tokenData = await exchangeRes.json()
  if (!exchangeRes.ok) {
    console.error(`Token exchange failed: ${tokenData.message}`)
    process.exit(1)
  }

  setAuth({
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    user: tokenData.user,
    loggedInAt: new Date().toISOString()
  })
  console.log(`\n✅ Logged in as: ${tokenData.user.email}`)
}

async function openBrowser(url) {
  try {
    await open.default(url);
    return true;
  } catch (err) {
    console.log(`[DEBUG] Browser open failed: ${err.message}`);
    console.log(`\nPlease manually open this URL in your browser:\n${url}\n`);
    return false;
  }
}

// ------------------------------------------------------------
// LOGOUT & WHOAMI (same as before)
// ------------------------------------------------------------
async function handleLogout() {
  const auth = getAuth()
  if (!auth) {
    console.log('You are not logged in.')
    return
  }
  const apiUrl = getApiUrl()
  try {
    await fetch(`${apiUrl}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: auth.refreshToken })
    })
  } catch (error) {
    console.log('Note: Could not reach server for remote logout.')
  }
  clearAuth()
  console.log('Logged out successfully.')
}

function handleWhoami() {
  const auth = getAuth()
  if (!auth) {
    console.log('You are not logged in.')
    return
  }
  console.log(`Logged in as: ${auth.user?.email || 'unknown'}`)
  console.log(`User ID: ${auth.user?.id}`)
  console.log(`Logged in at: ${auth.loggedInAt}`)
  console.log(`Role: ${auth.user?.role || 'unknown'}`)
}

module.exports = { handleAuthCommand, refreshAccessToken }