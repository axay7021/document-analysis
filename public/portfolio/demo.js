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
    headers: {
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...options.headers,
    },
    signal: AbortSignal.timeout(120000),
  })
  if (!response.ok) {
    let message = `Request failed (${response.status})`
    try {
      const body = await response.json()
      message = body.message || body.error || message
    } catch {}
    throw new Error(message)
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
    const text = document.createTextNode('')
    output.append(text)
    let buffer = '',
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
      if (data.type === 'chunk' || data.type === 'message')
        text.appendData(data.content || '')
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
    status(error.message, true)
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
  try { await api('/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) }) } finally { reset() }
}
$('login-form').onsubmit = async (event) => {
  event.preventDefault()
  $('login').disabled = true
  $('login-status').textContent = 'Connecting…'
  try {
    if (!API_ORIGIN) throw new Error('Backend deployment is not configured yet.')
    const url = new URL(API_ORIGIN)
    if (
      url.protocol !== 'https:' &&
      !(
        url.protocol === 'http:' &&
        ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
      )
    )
      throw new Error('Use HTTPS for a remote backend, or HTTP on localhost.')
    origin = url.origin
    const registering = $('register-mode').checked
    const response = await api(registering ? '/auth/register' : '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: $('email').value,
        password: $('password').value,
        ...(registering ? { firstName: $('first-name').value, lastName: $('last-name').value } : {}),
      }),
    })
    const result = await response.json()
    if (!result.data?.token)
      throw new Error('The backend did not return a login token.')
    token = result.data.token
    docs = []
    selected = 0
    agentId = ''
    sessionId = ''
    $('password').value = ''
    $('settings').close()
    $('mode').textContent = 'Connected to your backend'
    $('connect').hidden = true
    $('disconnect').hidden = false
    $('messages').replaceChildren()
    say('Connected. Upload a PDF, TXT or Markdown document to begin.')
    status('Authenticated · credentials stay in this tab')
    render()
  } catch (error) {
    origin = ''
    token = ''
    $('login-status').textContent = error.message
  } finally {
    $('login').disabled = false
  }
}
reset()
