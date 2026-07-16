import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { Anchor, Download, Eye, EyeOff, FileDown, FileUp, LoaderCircle, LockKeyhole, LogOut, Pencil, Plus, RotateCcw, Settings, Trash2, X } from 'lucide-react'
import englishSource from './data/menu.en.json'
import greekSource from './data/menu.el.json'
import { downloadMenuPdf } from './pdfMenu'
import type { MenuCategory, MenuData, MenuItem } from './menu.types'

const sourceMenus: Record<MenuData['id'], MenuData> = {
  en: englishSource as MenuData,
  el: greekSource as MenuData,
}

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value))
const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
const displayPrice = (item: MenuItem) => [item.pricePrefix?.trim(), item.price.trim()].filter(Boolean).join(' ')

type ItemEditor = { categoryId: string; item: MenuItem; isNew: boolean }
type AuthStatus = 'checking' | 'authenticated' | 'unauthenticated'

function normalizeMenu(menu: MenuData): MenuData {
  const normalized = clone(menu)
  normalized.categories.forEach((category) => {
    category.items.forEach((item) => {
      if (item.pricePrefix) return
      const legacyPrefix = item.price.match(/^(Το κιλό|Per kilo)\s*-\s*/i)
      if (!legacyPrefix) return
      item.pricePrefix = `${legacyPrefix[1]} -`
      item.price = item.price.slice(legacyPrefix[0].length)
    })
  })
  return normalized
}

function loadMenus(): Record<MenuData['id'], MenuData> {
  return {
    en: normalizeMenu(sourceMenus.en),
    el: normalizeMenu(sourceMenus.el),
  }
}

async function fetchMenuFile(id: MenuData['id']): Promise<MenuData> {
  const response = await fetch(`/api/menu/${id}`)
  if (!response.ok) throw new Error(`Could not load ${id} menu JSON.`)
  return normalizeMenu(await response.json() as MenuData)
}

async function saveMenuFile(menu: MenuData): Promise<void> {
  const response = await fetch(`/api/menu/${menu.id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(menu),
  })
  if (!response.ok) throw new Error(`Could not save ${menu.id} menu JSON.`)
}

function AnchorMark() {
  return (
    <div className="anchor-mark" aria-hidden="true">
      <span className="anchor-ring"><Anchor strokeWidth={1.7} /></span>
    </div>
  )
}

function LoginScreen({ onAuthenticated }: { onAuthenticated: (username: string) => void }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const login = async (event: FormEvent) => {
    event.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError('')

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      if (!response.ok) {
        setError(response.status === 429
          ? 'Έγιναν πολλές προσπάθειες. Δοκιμάστε ξανά σε λίγα λεπτά.'
          : 'Το όνομα χρήστη ή ο κωδικός δεν είναι σωστά.')
        return
      }

      const session = await response.json() as { username: string }
      onAuthenticated(session.username)
    } catch {
      setError('Δεν ήταν δυνατή η σύνδεση. Δοκιμάστε ξανά.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="login-emblem" aria-hidden="true"><Anchor strokeWidth={1.8} /></div>
        <span className="login-kicker">CAPTAIN JIMMY'S</span>
        <h1>Σύνδεση διαχειριστή</h1>
        <p>Συνδεθείτε για να δείτε και να επεξεργαστείτε το μενού.</p>
        <form onSubmit={login}>
          <label>
            Όνομα χρήστη
            <input
              autoFocus
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </label>
          <label>
            Κωδικός πρόσβασης
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {error && <div className="login-error" role="alert">{error}</div>}
          <button type="submit" disabled={submitting}>
            {submitting ? <LoaderCircle className="spin" size={20} /> : <LockKeyhole size={20} />}
            {submitting ? 'Σύνδεση...' : 'Σύνδεση'}
          </button>
        </form>
      </section>
    </main>
  )
}

function App() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>('checking')
  const [authUsername, setAuthUsername] = useState('')
  const [menus, setMenus] = useState(loadMenus)
  const [activeId, setActiveId] = useState<MenuData['id']>('el')
  const [editing, setEditing] = useState(false)
  const [itemEditor, setItemEditor] = useState<ItemEditor | null>(null)
  const [categoryEditor, setCategoryEditor] = useState<MenuCategory | null>(null)
  const [notice, setNotice] = useState('')
  const [savingJson, setSavingJson] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const menusRef = useRef(menus)
  const importRef = useRef<HTMLInputElement>(null)
  const menu = menus[activeId]
  const menuLabel = activeId === 'el' ? 'Ελληνικό μενού' : 'Αγγλικό μενού'

  useEffect(() => {
    fetch('/api/auth/session', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Session check failed')
        return response.json() as Promise<{ authenticated: boolean; username: string }>
      })
      .then((session) => {
        setAuthUsername(session.authenticated ? session.username : '')
        setAuthStatus(session.authenticated ? 'authenticated' : 'unauthenticated')
      })
      .catch(() => setAuthStatus('unauthenticated'))
  }, [])

  useEffect(() => {
    menusRef.current = menus
  }, [menus])

  const showNotice = (message: string) => {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 2200)
  }

  useEffect(() => {
    if (authStatus !== 'authenticated') return
    let mounted = true

    Promise.all([fetchMenuFile('en'), fetchMenuFile('el')])
      .then(([en, el]) => {
        if (!mounted) return
        const next = { en, el }
        menusRef.current = next
        setMenus(next)
      })
      .catch(() => showNotice('Χρησιμοποιούνται τα αποθηκευμένα στοιχεία'))

    return () => { mounted = false }
  }, [authStatus])

  const itemCount = useMemo(
    () => menu.categories.reduce((total, category) => total + category.items.filter((item) => !item.hidden).length, 0),
    [menu],
  )

  const updateActive = (updater: (draft: MenuData) => void, successMessage?: string) => {
    const next = clone(menusRef.current)
    updater(next[activeId])
    menusRef.current = next
    setMenus(next)
    setSavingJson(true)

    void saveMenuFile(next[activeId])
      .then(() => {
        if (successMessage) showNotice(successMessage)
      })
      .catch(() => window.alert('Η αλλαγή εμφανίστηκε, αλλά δεν αποθηκεύτηκε. Δοκιμάστε ξανά.'))
      .finally(() => setSavingJson(false))
  }

  const openNewItem = (categoryId: string) => {
    setItemEditor({ categoryId, isNew: true, item: { id: makeId('dish'), name: '', description: '', price: '' } })
  }

  const saveItem = (event: FormEvent) => {
    event.preventDefault()
    if (!itemEditor?.item.name.trim() || !itemEditor.item.price.trim()) return
    updateActive((draft) => {
      const category = draft.categories.find((entry) => entry.id === itemEditor.categoryId)
      if (!category) return
      if (itemEditor.isNew) category.items.push(itemEditor.item)
      else {
        const index = category.items.findIndex((entry) => entry.id === itemEditor.item.id)
        if (index >= 0) category.items[index] = itemEditor.item
      }
    }, itemEditor.isNew ? 'Το πιάτο προστέθηκε' : 'Το πιάτο ενημερώθηκε')
    setItemEditor(null)
  }

  const removeItem = (categoryId: string, itemId: string) => {
    if (!window.confirm('Θέλετε σίγουρα να διαγράψετε αυτό το πιάτο;')) return
    updateActive((draft) => {
      const category = draft.categories.find((entry) => entry.id === categoryId)
      if (category) category.items = category.items.filter((entry) => entry.id !== itemId)
    }, 'Το πιάτο διαγράφηκε')
  }

  const toggleItem = (categoryId: string, itemId: string) => {
    updateActive((draft) => {
      const item = draft.categories.find((entry) => entry.id === categoryId)?.items.find((entry) => entry.id === itemId)
      if (item) item.hidden = !item.hidden
    }, 'Η αλλαγή αποθηκεύτηκε')
  }

  const saveCategory = (event: FormEvent) => {
    event.preventDefault()
    if (!categoryEditor?.title.trim()) return
    updateActive((draft) => {
      const index = draft.categories.findIndex((entry) => entry.id === categoryEditor.id)
      if (index >= 0) draft.categories[index].title = categoryEditor.title
      else draft.categories.push(categoryEditor)
    }, 'Η κατηγορία αποθηκεύτηκε')
    setCategoryEditor(null)
  }

  const removeCategory = (categoryId: string) => {
    if (!window.confirm('Θέλετε να διαγράψετε αυτή την κατηγορία και όλα τα πιάτα της;')) return
    updateActive((draft) => {
      draft.categories = draft.categories.filter((entry) => entry.id !== categoryId)
    }, 'Η κατηγορία διαγράφηκε')
  }

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(menu, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `captain-jimmys-menu-${activeId}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const downloadPdf = async () => {
    if (downloadingPdf) return
    setDownloadingPdf(true)
    try {
      await downloadMenuPdf(menu)
      showNotice('Το PDF είναι έτοιμο')
    } catch {
      window.alert('Δεν ήταν δυνατή η δημιουργία του PDF. Δοκιμάστε ξανά.')
    } finally {
      setDownloadingPdf(false)
    }
  }

  const importJson = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const imported = normalizeMenu(JSON.parse(await file.text()) as MenuData)
      if (!imported.restaurant || !Array.isArray(imported.categories)) throw new Error('Invalid menu')
      imported.id = activeId
      updateActive((draft) => {
        Object.assign(draft, imported)
      }, 'Το μενού εισήχθη και αποθηκεύτηκε')
    } catch {
      window.alert('Αυτό το αρχείο δεν είναι έγκυρο μενού.')
    } finally {
      event.target.value = ''
    }
  }

  const resetMenu = () => {
    if (!window.confirm(`Να επανέλθει το αρχικό ${menuLabel}; Όλες οι αλλαγές σας θα χαθούν.`)) return
    updateActive((draft) => {
      Object.assign(draft, clone(sourceMenus[activeId]))
    }, 'Επαναφέρθηκε το αρχικό μενού')
  }

  const authenticated = (username: string) => {
    setAuthUsername(username)
    setAuthStatus('authenticated')
  }

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      setEditing(false)
      setItemEditor(null)
      setCategoryEditor(null)
      setAuthUsername('')
      setAuthStatus('unauthenticated')
    }
  }

  if (authStatus === 'checking') {
    return <main className="auth-loading"><LoaderCircle className="spin" size={34} /><span>Έλεγχος σύνδεσης...</span></main>
  }

  if (authStatus === 'unauthenticated') {
    return <LoginScreen onAuthenticated={authenticated} />
  }

  return (
    <div className={`app-shell ${editing ? 'is-editing' : ''}`}>
      <header className="topbar">
        <div className="language-area">
          <span className="topbar-label">Ποιο μενού θέλετε;</span>
          <div className="language-switch" aria-label="Επιλογή μενού">
            <button className={activeId === 'el' ? 'active' : ''} onClick={() => setActiveId('el')}>Ελληνικό</button>
            <button className={activeId === 'en' ? 'active' : ''} onClick={() => setActiveId('en')}>Αγγλικό</button>
          </div>
        </div>
        <div className="topbar-actions">
          <button className="pdf-button" onClick={downloadPdf} disabled={downloadingPdf}>
            {downloadingPdf ? <LoaderCircle className="spin" size={20} /> : <FileDown size={20} />}
            {downloadingPdf ? 'Δημιουργία PDF...' : 'Λήψη PDF'}
          </button>
          <button className={`manage-toggle ${editing ? 'active' : ''}`} onClick={() => setEditing((value) => !value)}>
            {editing ? <Eye size={20} /> : <Settings size={20} />}
            {editing ? 'Τέλος αλλαγών' : 'Κάνε αλλαγές'}
          </button>
          <button className="logout-button" onClick={logout} title={`Συνδεδεμένος ως ${authUsername}`}>
            <LogOut size={20} />
            Αποσύνδεση
          </button>
        </div>
      </header>

      {editing && (
        <aside className="editor-bar">
          <div className="editor-summary">
            <span className="editor-label">Κάνετε αλλαγές στο</span>
            <strong>{menuLabel}</strong>
            <small>{menu.categories.length} κατηγορίες · {itemCount} πιάτα</small>
            <span className={`save-state ${savingJson ? 'saving' : ''}`}>
              {savingJson ? 'Αποθήκευση...' : 'Οι αλλαγές αποθηκεύονται αυτόματα'}
            </span>
          </div>
          <div className="editor-actions">
            <button className="add-category-primary" onClick={() => setCategoryEditor({ id: makeId('category'), title: '', items: [] })}>
              <Plus size={18} /> Νέα κατηγορία
            </button>
            <details className="advanced-tools">
              <summary>Περισσότερες επιλογές</summary>
              <div className="advanced-buttons">
                <button onClick={() => importRef.current?.click()}><FileUp size={16} /> Εισαγωγή αρχείου</button>
                <button onClick={exportJson}><Download size={16} /> Αντίγραφο ασφαλείας</button>
                <button className="danger-action" onClick={resetMenu}><RotateCcw size={16} /> Επαναφορά αρχικού</button>
              </div>
            </details>
            <input ref={importRef} type="file" accept="application/json,.json" onChange={importJson} hidden />
          </div>
        </aside>
      )}

      <main className="menu-paper">
        <div className="inner-frame">
          <div className="corner corner-tl" /><div className="corner corner-tr" />
          <div className="corner corner-bl" /><div className="corner corner-br" />
          <section className="brand">
            <span className="sprig left">❧</span>
            <h1>{menu.restaurant}</h1>
            <span className="sprig right">❧</span>
            {menu.subtitle && <p>{menu.subtitle}</p>}
            <AnchorMark />
          </section>

          <div className="category-grid">
            {menu.categories.map((category) => (
              <section className="category" key={category.id}>
                <div className="category-heading">
                  <div className="title-row">
                    <h2>{category.title}</h2>
                    {editing && (
                      <span className="inline-actions">
                        <button onClick={() => setCategoryEditor(clone(category))}><Pencil size={16} /><span>Αλλαγή ονόματος</span></button>
                        <button className="danger-action" onClick={() => removeCategory(category.id)}><Trash2 size={16} /><span>Διαγραφή</span></button>
                      </span>
                    )}
                  </div>
                  <div className="ornament"><span>◇</span></div>
                </div>
                <div className="dish-list">
                  {category.items.map((item) => (!item.hidden || editing) && (
                    <article className={`dish ${item.hidden ? 'hidden-dish' : ''} ${editing ? 'editing-dish' : ''}`} key={item.id}>
                      <div className="dish-copy">
                        <div className="dish-name">{item.name}</div>
                        {item.description && <div className="dish-description">{item.description}</div>}
                      </div>
                      <span className="leader" aria-hidden="true" />
                      <span className="price">{displayPrice(item)}</span>
                      {editing && (
                        <div className="dish-actions">
                          <button onClick={() => toggleItem(category.id, item.id)}>
                            {item.hidden ? <Eye size={16} /> : <EyeOff size={16} />}
                            <span>{item.hidden ? 'Εμφάνιση' : 'Απόκρυψη'}</span>
                          </button>
                          <button onClick={() => setItemEditor({ categoryId: category.id, item: clone(item), isNew: false })}>
                            <Pencil size={16} /><span>Αλλαγή</span>
                          </button>
                          <button className="danger-action" onClick={() => removeItem(category.id, item.id)}>
                            <Trash2 size={16} /><span>Διαγραφή</span>
                          </button>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
                {editing && <button className="add-dish" onClick={() => openNewItem(category.id)}><Plus size={18} /> Προσθήκη πιάτου</button>}
              </section>
            ))}
          </div>

          {menu.note && <footer className="menu-note"><span>- ◇ -</span><p>{menu.note}</p></footer>}
        </div>
      </main>

      {itemEditor && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setItemEditor(null)}>
          <form className="modal" onSubmit={saveItem} onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="close-modal" aria-label="Κλείσιμο" onClick={() => setItemEditor(null)}><X /></button>
            <span className="modal-kicker">{menuLabel}</span>
            <h3>{itemEditor.isNew ? 'Νέο πιάτο' : 'Αλλαγή πιάτου'}</h3>
            <label>Όνομα πιάτου<input autoFocus value={itemEditor.item.name} onChange={(event) => setItemEditor({ ...itemEditor, item: { ...itemEditor.item, name: event.target.value } })} required /></label>
            <label>Περιγραφή <small>(προαιρετικό)</small><textarea value={itemEditor.item.description ?? ''} onChange={(event) => setItemEditor({ ...itemEditor, item: { ...itemEditor.item, description: event.target.value } })} /></label>
            <label>
              Κείμενο πριν από την τιμή <small>(προαιρετικό)</small>
              <input
                value={itemEditor.item.pricePrefix ?? ''}
                onChange={(event) => setItemEditor({ ...itemEditor, item: { ...itemEditor.item, pricePrefix: event.target.value } })}
                placeholder="π.χ. Το κιλό -"
              />
            </label>
            <label>Τιμή<input inputMode="decimal" value={itemEditor.item.price} onChange={(event) => setItemEditor({ ...itemEditor, item: { ...itemEditor.item, price: event.target.value } })} placeholder="0,00" required /></label>
            <div className="modal-actions"><button type="button" onClick={() => setItemEditor(null)}>Ακύρωση</button><button className="primary" type="submit">Αποθήκευση</button></div>
          </form>
        </div>
      )}

      {categoryEditor && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setCategoryEditor(null)}>
          <form className="modal compact" onSubmit={saveCategory} onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="close-modal" aria-label="Κλείσιμο" onClick={() => setCategoryEditor(null)}><X /></button>
            <span className="modal-kicker">{menuLabel}</span>
            <h3>{menu.categories.some((category) => category.id === categoryEditor.id) ? 'Αλλαγή κατηγορίας' : 'Νέα κατηγορία'}</h3>
            <label>Όνομα κατηγορίας<input autoFocus value={categoryEditor.title} onChange={(event) => setCategoryEditor({ ...categoryEditor, title: event.target.value })} required /></label>
            <div className="modal-actions"><button type="button" onClick={() => setCategoryEditor(null)}>Ακύρωση</button><button className="primary" type="submit">Αποθήκευση</button></div>
          </form>
        </div>
      )}

      {notice && <div className="toast">{notice}</div>}
    </div>
  )
}

export default App
