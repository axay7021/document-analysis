const $ = (id) => document.getElementById(id)
const API_ORIGIN = window.DOCUMENT_API_ORIGIN || ''
const samples = []
let docs = [...samples],
  selected = 0,
  token = '',
  origin = '',
  agentId = '',
  sessionId = '',
  busy = false
function say(text, user = false) {
  const el = document.createElement('div')
  el.className = 'message' + (user ? ' user' : '')
  const label = document.createElement('strong')
  label.textContent = user
    ? 'You'
    : token
      ? 'Document assistant'
      : 'Document assistant'
  el.append(label, document.createTextNode(text))
  $('messages').append(el)
  $('messages').scrollTop = $('messages').scrollHeight
  return el
}
function status(text, error = false) {
  $('status').textContent = text
  $('status').classList.toggle('error', error)
}
function renderMarkdown(target, value) {
  const escape = (text) => text.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char])
  const lines = escape(value || '').split('\n')
  const html = []
  let list = false
  const inline = (text) => text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
  for (const line of lines) {
    const heading = line.match(/^(#{1,6})\s+(.+)$/)
    const bullet = line.match(/^\s*[-*]\s+(.+)$/)
    if (bullet) {
      if (!list) { html.push('<ul>'); list = true }
      html.push(`<li>${inline(bullet[1])}</li>`)
    } else {
      if (list) { html.push('</ul>'); list = false }
      if (heading) html.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`)
      else if (line.trim()) html.push(`<p>${inline(line)}</p>`)
    }
  }
  if (list) html.push('</ul>')
  target.innerHTML = html.join('')
}
function render() {
  const list = $('documents')
  list.replaceChildren()
  docs.forEach((doc, i) => {
    const b = document.createElement('button')
    b.className = 'doc' + (i === selected ? ' active' : '')
    b.textContent = doc.name
    b.setAttribute('aria-pressed', String(i === selected))
    const small = document.createElement('small')
    small.textContent = token
      ? 'Uploaded to your backend'
      : `${doc.text.length.toLocaleString()} characters · local`
    b.append(small)
    b.disabled = busy
    b.onclick = () => {
      selected = i
      agentId = doc.agentId || ''
      sessionId = ''
      $('evidence').textContent = doc.text
      $('source-label').textContent = doc.name
      render()
    }
    list.append(b)
  })
  $('evidence').textContent =
    docs[selected]?.text || 'Your source passages will appear here. Add a document and ask a question to start connecting the dots.'
  $('source-label').textContent = docs[selected]?.name || 'No document'
}
function setBusy(value) {
  busy = value
  for (const id of [
    'send',
    'upload',
    'connect',
    'disconnect',
    'clear',
    'question',
  ])
    $(id).disabled = value
  document
    .querySelectorAll('.doc,[data-question]')
    .forEach((b) => (b.disabled = value))
}
async function api(path, options = {}) {
  const response = await fetch(origin + '/api/v1' + path, {
    ...options,
    credentials: 'include',
    headers: {
      ...options.headers,
    },
    signal: AbortSignal.timeout(120000),
  })
  if (!response.ok) {
    let message = `Request failed (${response.status})`, bodyCode = ''
    try {
      const body = await response.json()
      message = body.message || body.error || message
      bodyCode = body.code || ''
    } catch {}
    const error = new Error(message)
    error.code = bodyCode
    error.status = response.status
    throw error
  }
  return response
}
function reset() {
  token = ''
  origin = ''
  agentId = ''
  sessionId = ''
  docs = [...samples]
  selected = 0
  $('mode').textContent = 'Document Analysis'
  $('disconnect').hidden = true
  $('connect').hidden = false
  $('messages').replaceChildren()
  say(
    'Sign in or create an account, then upload a document to ask questions.'
  )
  status(API_ORIGIN ? 'Sign in to upload documents.' : 'Backend deployment is not configured yet.')
  render()
}
$('question-form').onsubmit = async (event) => {
  event.preventDefault()
  const question = $('question').value.trim()
  if (!question || busy) return
  if (!token) { status('Sign in before asking a question.', true); return }
  if (!docs.length) {
    status('Upload a document before asking a question.', true)
    return
  }
  say(question, true)
  $('question').value = ''
  setBusy(true)
  status(token ? 'Retrieving and generating…' : 'Searching this document…')
  try {
    if (!token) {
      const terms = question.toLowerCase().match(/[a-z0-9]+/g) || []
      const stop = new Set([
        'what',
        'is',
        'the',
        'a',
        'an',
        'are',
        'how',
        'do',
        'does',
        'of',
        'to',
        'and',
        'in',
        'it',
        'can',
        'you',
        'me',
      ])
      const words = terms.filter((t) => !stop.has(t))
      const passages = docs[selected].text
        .split(/\n\s*\n/)
        .map((text) => ({
          text,
          score: words.reduce(
            (n, w) => n + (text.toLowerCase().includes(w) ? 1 : 0),
            0
          ),
        }))
        .sort((a, b) => b.score - a.score)
      const best = passages[0]
      if (!best || !best.score) {
        say(
          'No matching passage found in the selected document. Try a more specific question or choose another document.'
        )
        status('No source match')
      } else {
        say(best.text)
        $('evidence').textContent = best.text
        status('Exact passage retrieved · ' + docs[selected].name)
      }
      return
    }
    if (!agentId) throw new Error('Upload a document before asking a question.')
    if (!sessionId) {
      const data = await (
        await api('/chat/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agentId, title: question.slice(0, 100) }),
        })
      ).json()
      sessionId = data.data.session.id
    }
    const response = await api(
      '/chat/sessions/' + encodeURIComponent(sessionId) + '/messages',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: question, promptId: agentId }),
      }
    )
    const output = say('')
    const text = document.createElement('div')
    text.className = 'markdown-response'
    output.append(text)
    let buffer = '',
      responseText = '',
      ended = false,
      completed = false,
      streamError = ''
    const reader = response.body.getReader(),
      decoder = new TextDecoder()
    function handle(frame) {
      const payload = frame
        .split('\n')
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).trim())
        .join('\n')
      if (!payload) return
      const data = JSON.parse(payload)
      if (data.type === 'error') {
        streamError = data.content || 'Generation failed'
        return
      }
      if (data.type === 'chunk' || data.type === 'message') {
        responseText += data.content || ''
        renderMarkdown(text, responseText)
      }
      if (data.sources?.length) {
        $('evidence').textContent = data.sources
          .map((s) => `${s.documentName}\nReference: ${s.chunkId}`)
          .join('\n\n')
      }
      if (data.type === 'complete') completed = true
      if (data.type === 'end') ended = true
      $('messages').scrollTop = $('messages').scrollHeight
    }
    while (true) {
      const { value, done } = await reader.read()
      buffer += (
        done ? decoder.decode() : decoder.decode(value, { stream: true })
      ).replace(/\r\n/g, '\n')
      let i
      while ((i = buffer.indexOf('\n\n')) >= 0) {
        const frame = buffer.slice(0, i)
        buffer = buffer.slice(i + 2)
        handle(frame)
      }
      if (done) break
    }
    if (buffer.trim()) handle(buffer)
    if (streamError) throw new Error(streamError)
    if (!ended && !completed)
      throw new Error('The response stream ended early. Please retry.')
    status('Response complete · connected backend')
  } catch (error) {
    const message = error.status === 401 || /invalid or expired token/i.test(error.message)
      ? 'Your session has expired. Please sign in again to continue.'
      : error.message || 'Something went wrong. Please try again.'
    say(message)
    status(message, true)
  } finally {
    setBusy(false)
  }
}
document.querySelectorAll('[data-question]').forEach(
  (b) =>
    (b.onclick = () => {
      $('question').value = b.dataset.question
      $('question-form').requestSubmit()
    })
)
$('clear').onclick = () => {
  $('messages').replaceChildren()
  sessionId = ''
  say('Conversation cleared. Ask a new question about your selected document.')
  status('Ready')
}
$('upload').onchange = async () => {
  const file = $('upload').files[0]
  if (!file) return
  if (!token) { status('Sign in before uploading a document.', true); $('upload').value = ''; return }
  setBusy(true)
  try {
    const limit = token ? 10 * 1024 * 1024 : 1024 * 1024
    if (file.size > limit)
      throw new Error(
        token
          ? 'Files must be 10 MB or smaller.'
          : 'Demo files must be 1 MB or smaller.'
      )
    if (!token && !/\.(txt|md)$/i.test(file.name))
      throw new Error(
        'Connect the backend to process PDFs. The browser demo supports TXT and Markdown.'
      )
    if (!/\.(pdf|txt|md)$/i.test(file.name))
      throw new Error('Use PDF, TXT or Markdown.')
    let doc = { name: file.name, text: '' }
    if (token) {
      status('Uploading and indexing…')
      const form = new FormData()
      form.append('name', file.name.slice(0, 100))
      form.append(
        'systemPrompt',
        'Answer questions from the uploaded document and cite source evidence.'
      )
      form.append('config', JSON.stringify({ enableRAG: true }))
      form.append('documents', file)
      const result = await (
        await api('/prompts/create', { method: 'POST', body: form })
      ).json()
      if (result.data.summary?.failedUploads > 0)
        throw new Error('Document ingestion failed. Check the backend logs.')
      doc.agentId = result.data.agent.id
      doc.text =
        'Document indexed by your backend. Ask a question to retrieve evidence.'
    } else {
      doc.text = await file.text()
      if (!doc.text.trim()) throw new Error('This document is empty.')
    }
    docs.push(doc)
    selected = docs.length - 1
    agentId = doc.agentId || ''
    sessionId = ''
    render()
    status(
      token
        ? 'Document indexed · ready for questions'
        : 'Document added locally · ready for questions'
    )
  } catch (error) {
    status(error.message, true)
  } finally {
    $('upload').value = ''
    setBusy(false)
  }
}
$('connect').onclick = () => $('settings').showModal()
$('close').onclick = () => $('settings').close()
$('disconnect').onclick = async () => {
  try { await api('/auth/logout', { method: 'POST' }) } finally { reset() }
}
let verifyingEmail = false
function verificationMode(enabled) {
  verifyingEmail = enabled
  $('login-form').classList.toggle('verifying-email', enabled)
  $('verification-step').hidden = !enabled
  $('password').required = !enabled
  $('verification-code').required = enabled
  $('email').readOnly = enabled
  $('login').textContent = enabled ? 'Verify email and continue' : 'Continue'
  if (enabled) $('verification-code').focus()
}
function acceptSession(result) {
  token = 'cookie-session'
  docs = []; selected = 0; agentId = ''; sessionId = ''
  $('password').value = ''; $('verification-code').value = ''
  verificationMode(false)
  $('settings').close()
  $('mode').textContent = 'Connected to your backend'
  $('connect').hidden = true; $('disconnect').hidden = false
  $('messages').replaceChildren()
  say('Connected. Upload a PDF, TXT or Markdown document to begin.')
  status('Authenticated · session persists securely across refreshes')
  render()
}
function useConfiguredOrigin() {
  if (!API_ORIGIN) throw new Error('Backend deployment is not configured yet.')
  const url = new URL(API_ORIGIN)
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost','127.0.0.1','[::1]'].includes(url.hostname))) throw new Error('Use HTTPS for a remote backend.')
  origin = url.origin
}
$('verification-back').onclick = () => { verificationMode(false); $('login-status').textContent = ''; }
$('resend-verification').onclick = async () => {
  $('resend-verification').disabled = true
  try {
    useConfiguredOrigin()
    const result = await (await api('/auth/resend-verification', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({email:$('email').value}) })).json()
    $('login-status').textContent = result.message
  } catch (error) { $('login-status').textContent = error.message }
  finally { $('resend-verification').disabled = false }
}
$('login-form').onsubmit = async (event) => {
  event.preventDefault()
  $('login').disabled = true
  $('login-status').textContent = verifyingEmail ? 'Verifying…' : 'Connecting…'
  try {
    useConfiguredOrigin()
    if (verifyingEmail) {
      const result = await (await api('/auth/verify-email', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:$('email').value,code:$('verification-code').value})})).json()
      acceptSession(result)
      return
    }
    const registering = $('register-mode').checked
    const response = await api(registering ? '/auth/register' : '/auth/login', {
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:$('email').value,password:$('password').value,
        ...(registering ? {firstName:$('first-name').value,lastName:$('last-name').value} : {})})
    })
    const result = await response.json()
    if (result.data?.requiresEmailVerification) {
      $('password').value = ''
      verificationMode(true)
      $('login-status').textContent = 'Check your email for your verification code.'
      return
    }
    acceptSession(result)
  } catch (error) {
    token = ''
    if (error.code === 'EMAIL_NOT_VERIFIED') { verificationMode(true); $('password').value = '' }
    $('login-status').textContent = error.message
  } finally { $('login').disabled = false }
}
function base64url(bytes) { return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'') }
$('google-login').onclick = async () => {
  try {
    useConfiguredOrigin()
    const proof = base64url(crypto.getRandomValues(new Uint8Array(32)))
    sessionStorage.setItem('document-google-proof', proof)
    const challenge = base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(proof))))
    location.assign(origin + '/api/v1/auth/google?challenge=' + encodeURIComponent(challenge))
  } catch { $('login-status').textContent = 'Google sign-in could not start. Please enable browser storage and try again.' }
}
async function authOptions() {
  if (!API_ORIGIN) { $('auth-setup').textContent = 'Backend setup is pending.'; return }
  try {
    const response = await fetch(API_ORIGIN + '/api/v1/auth/config')
    if (!response.ok) throw new Error('Unavailable')
    const options = await response.json()
    if (options.aiConfigured) { const note = document.querySelector('.provider-note'); if (note) note.textContent = 'Gemini connected · ready to index documents and answer questions.' }
    $('google-login').disabled = !options.googleConfigured
    $('auth-setup').textContent = !options.emailConfigured ? 'Email verification delivery is awaiting setup. Google sign-in also needs setup unless enabled above.' : !options.googleConfigured ? 'Email/password accounts require email verification. Google sign-in is awaiting setup.' : 'Use Google or verify your email to create an account.'
  } catch { $('auth-setup').textContent = 'Sign-in options are temporarily unavailable. Please try again shortly.' }
}
async function restoreSession() {
  if (!API_ORIGIN) return
  try {
    useConfiguredOrigin()
    const response = await api('/auth/profile')
    if (!response.ok) return
    const result = await response.json()
    if (result.success) {
      token = 'cookie-session'
      $('mode').textContent = 'Connected to your backend'
      $('connect').hidden = true; $('disconnect').hidden = false
      status('Authenticated · session restored securely')
      render()
    }
  } catch {
    token = ''
  }
}
async function completeGoogle() {
  const fragment = new URLSearchParams(location.hash.slice(1))
  const code = fragment.get('auth_code'), errorCode = fragment.get('auth_error')
  if (!code && !errorCode) return
  history.replaceState(null, '', location.pathname + location.search)
  $('settings').showModal()
  try {
    const proof = sessionStorage.getItem('document-google-proof') || ''
    sessionStorage.removeItem('document-google-proof')
    if (errorCode) {
      const errors = {USE_PASSWORD:'An account with this email already exists. Use your password to sign in.',EMAIL_PROOF_REQUIRED:'Please use email/password to verify this email directly.',GOOGLE_CANCELLED:'Google sign-in was cancelled.'}
      throw new Error(errors[errorCode] || 'Google sign-in could not complete. Please try again.')
    }
    if (!proof) throw new Error('Start Google sign-in from this browser tab.')
    useConfiguredOrigin()
    const result = await (await api('/auth/google/exchange', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,verifier:proof})})).json()
    acceptSession(result)
  } catch (error) { $('login-status').textContent = error.message }
}
reset()
void authOptions()
void completeGoogle()
void restoreSession()
