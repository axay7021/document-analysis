// Apply before the stylesheet loads to avoid a bright flash in dark mode.
;(() => {
  const key = 'document-analysis-theme'
  const system = matchMedia('(prefers-color-scheme: dark)')
  let preference = null
  try {
    const saved = localStorage.getItem(key)
    if (saved === 'dark' || saved === 'light') preference = saved
  } catch {}
  function apply(theme) {
    document.documentElement.dataset.theme = theme
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.content = theme === 'dark' ? '#202124' : '#ffffff'
    const toggle = document.getElementById('toggle-theme')
    if (toggle) {
      const label = 'Switch to ' + (theme === 'dark' ? 'light' : 'dark') + ' mode'
      toggle.setAttribute('aria-label', label)
      toggle.setAttribute('aria-pressed', String(theme === 'dark'))
      toggle.title = label
    }
  }
  apply(preference || (system.matches ? 'dark' : 'light'))
  system.addEventListener('change', () => {
    if (!preference) apply(system.matches ? 'dark' : 'light')
  })
  document.addEventListener('DOMContentLoaded', () => {
    apply(document.documentElement.dataset.theme)
    document.getElementById('toggle-theme').addEventListener('click', () => {
      preference = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'
      try { localStorage.setItem(key, preference) } catch {}
      apply(preference)
    })
  })
})()
