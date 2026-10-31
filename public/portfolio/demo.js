const $ = (id) => document.getElementById(id)
const LOCAL_PREVIEW = ['localhost', '127.0.0.1'].includes(location.hostname) && new URLSearchParams(location.search).get('preview') === '1'
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
  $('chat-main').classList.add('has-conversation')
  scrollChat(user)
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
  // Model streams can place punctuation on its own line. Join those breaks
  // before parsing Markdown so lists and sentences remain readable.
  const sourceName = docs[selected]?.name
  const normalized = String(value || '')
    .replace(/\bDocument\s+\d+\b/g, sourceName || 'selected document')
    .replace(/\s*\n\s*([,.;:!?])/g, '$1 ')
    .replace(/([,(])\s*\n\s*/g, '$1 ')
  const lines = escape(normalized).split('\n')
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
    small.textContent = LOCAL_PREVIEW ? 'Sample document · local preview' : token
      ? 'Uploaded to your backend'
      : `${doc.text.length.toLocaleString()} characters · local`
    b.append(small)
    b.disabled = busy
    b.onclick = () => {
      saveDocumentChat()
      selected = i
      agentId = doc.agentId || ''
      sessionId = doc.chatSession || ''
      restoreDocumentChat(doc)
      $('evidence').textContent = doc.evidence || doc.text
      $('source-label').textContent = doc.name
      render()
      closeLibraryOnMobile()
      status('Selected · ' + doc.name)
    }
    list.append(b)
  })
  $('evidence').textContent =
    docs[selected]?.evidence || docs[selected]?.text || 'Your source passages will appear here. Add a document and ask a question to start connecting the dots.'
  $('source-label').textContent = docs[selected]?.name || 'No document selected'
  $('document-count').textContent = String(docs.length)
  $('source-count').textContent = String(docs[selected]?.sourceCount || 0)
  $('chat-document').textContent = docs[selected]?.name || 'No document selected'
  $('chat-context').textContent = docs[selected] ? 'Using this document' : 'Add a document to get started'
  $('welcome-document-label').textContent = docs[selected]?.name || 'Add your first document to begin'
  if (!LOCAL_PREVIEW) {
    $('account-label').textContent = token ? 'Signed in' : 'Your workspace'
    $('account-caption').textContent = token ? 'Your document workspace' : 'Sign in to bring your documents'
  }
}
function setBusy(value) {
  busy = value
  $('messages').setAttribute('aria-busy', String(value))
  for (const id of [
    'send',
    'upload',
    'connect',
    'disconnect',
    'clear',
    'question',
    'attach-document',
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
  $('chat-main').classList.remove('has-conversation')
  status(API_ORIGIN ? 'Sign in to upload documents.' : 'Backend deployment is not configured yet.')
  render()
}
$('question-form').onsubmit = async (event) => {
  event.preventDefault()
  const question = $('question').value.trim()
  if (!question || busy) return
  if (!token) { status('Sign in before asking a question.', true); $('settings').showModal(); return }
  if (!docs.length) {
    status('Upload a document before asking a question.', true)
    return
  }
  say(question, true)
  $('question').value = ''
  resizeComposer()
  setBusy(true)
  status(token ? 'Retrieving and generating…' : 'Searching this document…')
  try {
    if (LOCAL_PREVIEW) {
      const { sampleAnswer } = await import('./preview-data.js')
      const sample = sampleAnswer(question)
      const output = say('')
      const text = document.createElement('div')
      text.className = 'markdown-response'
      output.append(text)
      renderMarkdown(text, sample.answer)
      updateEvidence(sample.evidence, 1)
      answerActions(output, sample.answer, sample.evidence, 1)
      scrollChat(true)
      status('Local preview · sample response, no AI request sent')
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
    output.classList.add('is-streaming')
    const text = document.createElement('div')
    text.className = 'markdown-response'
    output.append(text)
    let buffer = '',
      responseText = '',
      ended = false,
      completed = false,
      streamError = '',
      answerEvidence = '',
      answerSourceCount = 0
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
        answerEvidence = data.sources.map((s) => `${s.documentName}\nReference: ${s.chunkId}`).join('\n\n')
        answerSourceCount = data.sources.length
        updateEvidence(answerEvidence, answerSourceCount)
      }
      if (data.type === 'complete') completed = true
      if (data.type === 'end') ended = true
      scrollChat()
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
    output.classList.remove('is-streaming')
    answerActions(output, responseText, answerEvidence, answerSourceCount)
    saveDocumentChat()
    status('Response complete')
  } catch (error) {
    const message = error.status === 401 || /invalid or expired token/i.test(error.message)
      ? 'Your session has expired. Please sign in again to continue.'
      : error.message || 'Something went wrong. Please try again.'
    say(message)
    status(message, true)
  } finally {
    document.querySelectorAll('.is-streaming').forEach((el) => el.classList.remove('is-streaming'))
    setBusy(false)
    saveDocumentChat()
    $('question').focus({ preventScroll: true })
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
  $('chat-main').classList.remove('has-conversation')
  if (docs[selected]) { docs[selected].chatNodes = []; docs[selected].chatSession = ''; docs[selected].evidence = ''; docs[selected].sourceCount = 0 }
  render()
  closeLibraryOnMobile()
  $('question').focus()
  status('New conversation · ' + (docs[selected]?.name || 'add a document to begin'))
}
$('upload').onchange = async () => {
  const file = $('upload').files[0]
  if (!file) return
  if (LOCAL_PREVIEW) { status('This layout preview uses a sample document. Open the standard local workspace to connect your own documents.'); $('upload').value = ''; return }
  if (!token) { status('Sign in before uploading a document.', true); $('upload').value = ''; $('settings').showModal(); return }
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
    saveDocumentChat()
    docs.push(doc)
    selected = docs.length - 1
    agentId = doc.agentId || ''
    sessionId = ''
    restoreDocumentChat(doc)
    render()
    closeLibraryOnMobile()
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
  $('chat-main').classList.remove('has-conversation')
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

let followChat = true
function scrollChat(force = false) {
  if (force) followChat = true
  if (followChat) requestAnimationFrame(() => { $('chat-scroll').scrollTop = $('chat-scroll').scrollHeight })
}
$('chat-scroll').addEventListener('scroll', () => {
  const el = $('chat-scroll')
  followChat = el.scrollHeight - el.scrollTop - el.clientHeight < 100
})
function resizeComposer() {
  $('question').style.height = 'auto'
  $('question').style.height = Math.min($('question').scrollHeight, 180) + 'px'
}
$('question').addEventListener('input', resizeComposer)
$('question').addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && !matchMedia('(pointer: coarse)').matches) {
    event.preventDefault()
    $('question-form').requestSubmit()
  }
})
$('attach-document').onclick = () => $('upload').click()
function saveDocumentChat() {
  const doc = docs[selected]
  if (!doc) return
  doc.chatNodes = [...$('messages').children]
  doc.chatSession = sessionId
}
function restoreDocumentChat(doc) {
  $('messages').replaceChildren(...(doc.chatNodes || []))
  $('chat-main').classList.toggle('has-conversation', Boolean(doc.chatNodes?.length))
  scrollChat(true)
}
function updateEvidence(text, count) {
  $('evidence').textContent = text
  $('source-count').textContent = String(count)
  if (docs[selected]) { docs[selected].evidence = text; docs[selected].sourceCount = count }
}
function answerActions(output, answer, evidence, sourceCount) {
  const actions = document.createElement('div')
  actions.className = 'message-actions'
  const copy = document.createElement('button')
  copy.textContent = 'Copy answer'
  copy.onclick = async () => {
    try { await navigator.clipboard.writeText(answer); copy.textContent = 'Copied'; setTimeout(() => { copy.textContent = 'Copy answer' }, 1800) }
    catch { status('Copy is unavailable. You can select and copy the answer text.', true) }
  }
  actions.append(copy)
  if (evidence) {
    const source = document.createElement('button')
    source.textContent = 'View source' + (sourceCount > 1 ? 's (' + sourceCount + ')' : '')
    source.onclick = () => { updateEvidence(evidence, sourceCount); showEvidence(true) }
    actions.append(source)
  }
  output.append(actions)
}
let panelReturnFocus = null
const mobileLibrary = matchMedia('(max-width: 767px)')
const overlayEvidence = matchMedia('(max-width: 1199px)')
function syncPanels() {
  const libraryOpen = mobileLibrary.matches ? $('library').classList.contains('mobile-open') : !$('workspace').classList.contains('library-collapsed')
  $('toggle-library').setAttribute('aria-expanded', String(libraryOpen))
  const evidenceOpen = !$('source-panel').hidden
  $('toggle-evidence').setAttribute('aria-expanded', String(evidenceOpen))
  const overlay = (libraryOpen && mobileLibrary.matches) || (evidenceOpen && overlayEvidence.matches)
  $('drawer-backdrop').hidden = !overlay
  $('chat-main').inert = overlay
  for (const [panel, active] of [[$('library'), libraryOpen && mobileLibrary.matches], [$('source-panel'), evidenceOpen && overlayEvidence.matches]]) {
    if (active) { panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true') }
    else { panel.removeAttribute('role'); panel.removeAttribute('aria-modal') }
  }
}
function closeLibraryOnMobile() {
  if (!mobileLibrary.matches || !$('library').classList.contains('mobile-open')) return
  $('library').classList.remove('mobile-open')
  syncPanels()
  $('toggle-library').focus()
}
function showEvidence(open) {
  if (!open && $('source-panel').hidden) return
  if (open) {
    panelReturnFocus = document.activeElement
    $('library').classList.remove('mobile-open')
  }
  $('source-panel').hidden = !open
  $('workspace').classList.toggle('evidence-open', open)
  syncPanels()
  if (open) $('close-evidence').focus()
  else if (panelReturnFocus?.isConnected) panelReturnFocus.focus()
}
$('toggle-evidence').onclick = () => showEvidence($('source-panel').hidden)
$('close-evidence').onclick = () => showEvidence(false)
$('toggle-library').onclick = () => {
  if (mobileLibrary.matches) {
    showEvidence(false)
    panelReturnFocus = $('toggle-library')
    $('library').classList.toggle('mobile-open')
  } else $('workspace').classList.toggle('library-collapsed')
  syncPanels()
  if (mobileLibrary.matches && $('library').classList.contains('mobile-open')) $('close-library').focus()
}
$('close-library').onclick = closeLibraryOnMobile
$('drawer-backdrop').onclick = () => { showEvidence(false); closeLibraryOnMobile() }
document.addEventListener('keydown', (event) => {
  if ($('settings').open) return
  if (event.key === 'Escape') { showEvidence(false); closeLibraryOnMobile(); return }
  if (event.key !== 'Tab' || $('drawer-backdrop').hidden) return
  const panel = !$('source-panel').hidden ? $('source-panel') : $('library')
  const controls = [...panel.querySelectorAll('a, button:not(:disabled), input:not(:disabled), [tabindex="0"]')].filter(el => !el.hidden && el.getClientRects().length)
  const first = controls[0], last = controls.at(-1)
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
})
mobileLibrary.addEventListener('change', () => { $('library').classList.remove('mobile-open'); syncPanels() })
overlayEvidence.addEventListener('change', syncPanels)
syncPanels()

reset()
if (LOCAL_PREVIEW) {
  const { previewDocument } = await import('./preview-data.js')
  docs = [{ ...previewDocument }]
  token = 'local-preview'
  agentId = previewDocument.agentId
  $('preview-banner').hidden = false
  $('mode').textContent = 'Local layout preview'
  $('connect').hidden = true
  $('account-label').textContent = 'Preview workspace'
  $('account-caption').textContent = 'Fictional sample · no account needed'
  $('upload-help').textContent = 'Preview only. Sample questions do not call an AI provider.'
  document.querySelector('.provider-note').textContent = 'Fictional sample content for reviewing the layout. This preview does not use the live backend.'
  status('Choose a suggested question to explore a sample conversation.')
  render()
} else {
  void authOptions()
  void completeGoogle()
  void restoreSession()
}
