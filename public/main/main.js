(function(){
  // Modal functions
  globalThis.showLoginModal = function() {
    document.getElementById('loginModal').classList.remove('hidden');
    document.getElementById('registerModal').classList.add('hidden');
    document.body.style.overflow = 'hidden';
  }

  globalThis.showRegisterModal = function() {
    document.getElementById('registerModal').classList.remove('hidden');
    document.getElementById('loginModal').classList.add('hidden');
    document.body.style.overflow = 'hidden';
  }

  globalThis.closeModals = function() {
    document.getElementById('loginModal').classList.add('hidden');
    document.getElementById('registerModal').classList.add('hidden');
    document.body.style.overflow = 'auto';
  }

  // Cart state
  const cartKey = 'panaderia_cart_v1'
  let cart = { items: [], total: 0 }

  // Load cart from localStorage
  try {
    const raw = localStorage.getItem(cartKey)
    if (raw) cart = JSON.parse(raw)
  } catch (e) { console.warn('No se pudo leer el carrito:', e) }

  // --- Utilidades pequeñas en español ---
  // Estas funciones ayudan a reducir repetición en el código cliente.
  // peticionJSON: envoltorio de fetch que devuelve JSON o lanza un Error con mensaje
  function peticionJSON(url, opts) {
    return fetch(url, opts).then(async function(res) {
      if (!res.ok) {
        // Intentamos leer un cuerpo JSON con mensaje de error si existe
        const err = await res.json().catch(function(){ return { mensaje: 'Error en la petición' } })
        const e = new Error(err.mensaje || 'Error en la petición')
        e.response = res
        throw e
      }
      return res.json()
    })
  }

  // Toast notification function
  globalThis.mostrarToast = function(message, duration = 3000) {
    try {
      const t = document.createElement('div')
      t.textContent = message
      t.style.position = 'fixed'
      t.style.right = '16px'
      t.style.top = '16px'
      t.style.background = '#8B5E34'
      t.style.color = 'white'
      t.style.padding = '10px 14px'
      t.style.borderRadius = '8px'
      t.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)'
      t.style.zIndex = 9999
      document.body.appendChild(t)
      setTimeout(()=>{ t.style.transition = 'opacity 300ms'; t.style.opacity = '0' }, duration - 300)
      setTimeout(()=>{ try { t.remove() } catch(e){} }, duration)
    } catch(e){ console.debug('toast error', e) }
  }

  // Helper functions for modals
  function abrirModalPorId(id) {
    const m = document.getElementById(id)
    if (!m) return
    m.classList.remove('hidden')
    document.body.style.overflow = 'hidden'
  }
  
  function cerrarModalPorId(id) {
    const m = document.getElementById(id)
    if (!m) return
    m.classList.add('hidden')
    document.body.style.overflow = 'auto'
  }

    globalThis.toggleCart = function() {
      const sidebar = document.getElementById('cartSidebar')
      if (!sidebar) return
      const isOpen = !sidebar.classList.contains('translate-x-full')
      if (isOpen) {
        sidebar.classList.add('translate-x-full')
        document.body.style.overflow = 'auto'
      } else {
        sidebar.classList.remove('translate-x-full')
        document.body.style.overflow = 'hidden'
        updateCartDisplay()
      }
    }

    globalThis.addToCart = function(a, b, c, d) {
      let id = null, name, price, image
      if (typeof a === 'number' || (typeof a === 'string' && /^\d+$/.test(a))) {
        id = Number(a)
        name = b
        price = c
        image = d
      } else {
        name = a
        price = b
        image = c
      }
      const existingItem = cart.items.find(i => i.name === name)
      if (existingItem) existingItem.quantity += 1
      else cart.items.push({ id: id || null, name, price, image, quantity: 1 })
      try { globalThis.mostrarToast('Producto agregado al carrito') } catch(e) { console.debug('toast error', e) }
      persistCart()
      updateCartTotal(); updateCartCount(); updateCartDisplay()
      const sidebar = document.getElementById('cartSidebar')
      if (sidebar) sidebar.classList.remove('translate-x-full')
    }

    globalThis.removeFromCart = function(name) {
      cart.items = cart.items.filter(i => i.name !== name)
      persistCart(); updateCartTotal(); updateCartCount(); updateCartDisplay()
    }

    globalThis.updateQuantity = function(name, delta) {
      const item = cart.items.find(i => i.name === name)
      if (!item) return
      item.quantity = Math.max(0, item.quantity + delta)
      if (item.quantity === 0) removeFromCart(name)
      else { persistCart(); updateCartTotal(); updateCartCount(); updateCartDisplay() }
    }

    function updateCartTotal(){
      cart.total = cart.items.reduce((s,i)=> s + (i.price * i.quantity), 0)
      const el = document.getElementById('cartTotal')
      if (el) el.textContent = '$' + cart.total.toFixed(2) + ' MXN'
    }

    function updateCartCount(){
      const count = cart.items.reduce((s,i)=> s + i.quantity, 0)
      const el = document.querySelector('#cartCounter')
      if (el) el.textContent = count
    }

    function updateCartDisplay(){
      const cartItems = document.getElementById('cartItems')
      if (!cartItems) return
      cartItems.innerHTML = ''
      for (const item of cart.items) {
        const itemElement = document.createElement('div')
        itemElement.className = 'flex items-center space-x-4 p-4 bg-bread-100 rounded-lg'
        itemElement.innerHTML = `
          <img src="${item.image}" alt="${item.name}" class="w-20 h-20 object-cover rounded">
          <div class="flex-1">
            <h3 class="text-bread-700 font-medium">${item.name}</h3>
            <p class="text-bread-600">$${item.price.toFixed(2)} MXN</p>
            <div class="flex items-center space-x-2 mt-2">
              <button class="text-bread-500 hover:text-bread-700" data-action="dec">-</button>
              <span class="text-bread-700">${item.quantity}</span>
              <button class="text-bread-500 hover:text-bread-700" data-action="inc">+</button>
            </div>
          </div>
          <button class="text-bread-500 hover:text-bread-700" data-action="remove">🗑</button>
        `
        itemElement.querySelector('[data-action="dec"]').addEventListener('click', ()=> globalThis.updateQuantity(item.name, -1))
        itemElement.querySelector('[data-action="inc"]').addEventListener('click', ()=> globalThis.updateQuantity(item.name, 1))
        itemElement.querySelector('[data-action="remove"]').addEventListener('click', ()=> globalThis.removeFromCart(item.name))
        cartItems.appendChild(itemElement)
      }
    }

    function persistCart(){
      try { localStorage.setItem(cartKey, JSON.stringify(cart)) } catch(e){ console.warn(e) }
    }

    globalThis.checkout = function(){
      if (cart.items.length === 0) { alert('Tu carrito está vacío'); return }
      (async function(){
        try {
          const payload = { items: cart.items.map(i => ({ id: i.id || null, price: i.price, quantity: i.quantity, name: i.name })), total: cart.total }
          const res = await fetch('/carrito/comprar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
          if (res.status === 401) {
            showLoginModal()
            return
          }
          if (!res.ok) {
            const err = await res.json().catch(()=>({ mensaje: 'Error al procesar la compra' }))
            alert(err.mensaje || 'Error al procesar la compra')
            return
          }
          const data = await res.json()
          cart = { items: [], total: 0 }
          persistCart(); updateCartTotal(); updateCartCount(); updateCartDisplay()
          try { globalThis.mostrarToast(data.mensaje || 'Compra realizada correctamente') } catch(e){}
        } catch (err) {
          console.error('Checkout error', err)
          alert('Error al conectar con el servidor')
        }
      })()
    }

    function showLoginModal(){
      cerrarModalPorId('registerModal')
      abrirModalPorId('loginModal')
    }
    function showRegisterModal(){
      cerrarModalPorId('loginModal')
      abrirModalPorId('registerModal')
    }
    function closeModals(){
      cerrarModalPorId('loginModal')
      cerrarModalPorId('registerModal')
    }

    globalThis.showLoginModal = showLoginModal
    globalThis.showRegisterModal = showRegisterModal
    globalThis.closeModals = closeModals

    function onReady(cb) {
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', cb)
      else cb()
    }

    onReady(function(){
      const loginModal = document.getElementById('loginModal')
      const registerModal = document.getElementById('registerModal')
      if (loginModal) loginModal.addEventListener('click', function(e){ if (e.target === this) closeModals() })
      if (registerModal) registerModal.addEventListener('click', function(e){ if (e.target === this) closeModals() })

      function updateUserUI(user) {
        const loginBtn = document.getElementById('loginBtn')
        if (user?.admin) {
          let rightNav = null
          const navContainer = document.querySelector('nav .container') || document.querySelector('nav')
          if (navContainer) {
            const divs = navContainer.querySelectorAll('div')
            for (const d of divs) {
              if (d.querySelector('#loginBtn') || d.querySelector('#logoutBtn') || d.querySelector('#cartCounter')) {
                rightNav = d
                break
              }
            }
            if (!rightNav) rightNav = navContainer.querySelector('div')
          }
          const onAdminPath = globalThis.location && (globalThis.location.pathname === '/admin' || globalThis.location.pathname === '/admin/')
          if (onAdminPath) {
            if (rightNav) {
              const existingAdmin = rightNav.querySelector('a[href="/admin"]')
              if (existingAdmin) existingAdmin.remove()
            }
          } else {
            if (rightNav && !rightNav.querySelector('a[href="/admin"]')) {
              const a = document.createElement('a')
              a.href = '/admin'
              a.className = 'text-bread-600 hover:text-bread-700 text-sm uppercase tracking-wider'
              a.textContent = 'Admin'
              rightNav.appendChild(a)
            }
          }
        }

        if (!loginBtn) return

        if (!user) {
          loginBtn.classList.remove('relative')
          loginBtn.innerHTML = '<i class="fas fa-user mr-2"></i>Iniciar Sesión'
          loginBtn.setAttribute('onclick', 'showLoginModal()')
          const existingMenu = document.getElementById('userMenu')
          if (existingMenu) existingMenu.remove()
          delete loginBtn.dataset.userListenerAttached
          return
        }

        const displayName = user.username || user.usuario || 'Cuenta'
        loginBtn.classList.add('relative')
        loginBtn.removeAttribute('onclick')
        loginBtn.type = 'button'
        loginBtn.innerHTML = '<span class="flex items-center space-x-2"><i class="fas fa-user"></i><span class="ml-2">' + displayName + '</span></span>'

        let menu = document.getElementById('userMenu')
        if (!menu) {
          menu = document.createElement('div')
          menu.id = 'userMenu'
          menu.className = 'absolute right-0 mt-2 w-40 bg-white border rounded shadow z-50 hidden'
          menu.innerHTML = '<button id="logoutBtnNav" class="w-full text-left px-4 py-2 text-bread-700 hover:bg-bread-100 hover:text-bread-700">Cerrar sesión</button>'
          loginBtn.appendChild(menu)
        }

        if (!loginBtn.dataset.userListenerAttached) {
          loginBtn.addEventListener('click', function(e){
            e.stopPropagation()
            menu.classList.toggle('hidden')
          })
          loginBtn.dataset.userListenerAttached = '1'
        }

        const logoutBtnNav = document.getElementById('logoutBtnNav')
        if (logoutBtnNav && !logoutBtnNav.dataset.navAttached) {
          logoutBtnNav.addEventListener('click', async function(ev){
            ev.stopPropagation()
            try {
              await doLogoutFlow()
            } catch(err) { console.error('logout error', err); alert('Error al cerrar sesión') }
          })
          logoutBtnNav.dataset.navAttached = '1'
        }

        if (!document.body.dataset.userDocCloseAttached) {
          document.addEventListener('click', function docClose() {
            const menuEl = document.getElementById('userMenu')
            if (menuEl && !menuEl.classList.contains('hidden')) menuEl.classList.add('hidden')
          })
          document.body.dataset.userDocCloseAttached = '1'
        }
      }

      const loginForm = document.getElementById('loginForm')
      if (loginForm) loginForm.addEventListener('submit', async function(e){
        e.preventDefault()
        const username = document.getElementById('loginUsername').value
        const password = document.getElementById('loginPassword').value
        
        // Validación del lado del cliente
        if (typeof window.validarLogin === 'function') {
          const errores = window.validarLogin(username, password)
          if (errores.length > 0) {
            alert('Errores de validación:\n• ' + errores.join('\n• '))
            return
          }
        }
        
        try {
          const res = await fetch('/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username, password }) })
          if (!res.ok) { const err = await res.json().catch(()=>({mensaje:'Error en login'})); alert(err.mensaje || 'Usuario o contraseña incorrecta'); return }
          const data = await res.json()
          closeModals()
          try { updateUserUI(data) } catch(e){ console.debug('updateUI error', e) }
          try { globalThis.mostrarToast('Has iniciado sesión correctamente') } catch(e){}
          if (data.admin) {
            try { localStorage.setItem('sessionNotice', 'Has iniciado sesión correctamente') } catch(e){}
            globalThis.location.href = '/admin'
          }
        } catch(err){ console.error(err); alert('Error al conectar con el servidor') }
      })

      const registerForm = document.getElementById('registerForm')
      if (registerForm) registerForm.addEventListener('submit', async function(e){
        e.preventDefault()
        const username = document.getElementById('registerUsername').value
        const password = document.getElementById('registerPassword').value
        const confirmPassword = document.getElementById('confirmPassword').value
        
        // Validación del lado del cliente
        if (typeof window.validarRegistro === 'function') {
          const errores = window.validarRegistro(username, password, confirmPassword)
          if (errores.length > 0) {
            alert('Errores de validación:\n• ' + errores.join('\n• '))
            return
          }
        } else {
          // Fallback si validacion.js no está cargado
          if (password !== confirmPassword) { alert('Las contraseñas no coinciden'); return }
        }
        
        try {
          const res = await fetch('/register', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username, password }) })
          const data = await res.json()
          if (!res.ok) { alert(data.mensaje || 'Error al registrar'); return }
          const loginRes = await fetch('/login', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username, password }) })
          if (!loginRes.ok) {
            const err = await loginRes.json().catch(()=>({mensaje:'Error al iniciar sesión tras registro'}))
            alert(err.mensaje || 'Registro hecho, pero no se pudo iniciar sesión automáticamente')
            showLoginModal()
            return
          }
          const loginData = await loginRes.json()
          closeModals()
          try { updateUserUI(loginData) } catch(e){ console.debug('updateUserUI error', e) }
          try { globalThis.mostrarToast('Registro e inicio de sesión correctos') } catch(e){}
          if (loginData.admin) {
            try { localStorage.setItem('sessionNotice', 'Registro e inicio de sesión correctos') } catch(e){}
            globalThis.location.href = '/admin'
          } else {
            try { if (data && data.mensaje) globalThis.mostrarToast(data.mensaje) } catch(e){}
          }
        } catch(err){ console.error(err); alert('Error al conectar con el servidor') }
      })

      // Check user session on page load
      async function checkUserSession() {
        const maxRetries = 5
        let attempt = 0
        while (attempt < maxRetries) {
          try {
            const user = await peticionJSON('/perfil')
            if (user) { 
              try { updateUserUI(user) } catch(e){ console.debug('updateUserUI error', e) }
              break
            }
          } catch (e) { console.debug('perfil check error', e) }
          attempt++
          await new Promise(function(r){ setTimeout(r, 250) })
        }
      }
      checkUserSession()

      // Alias showToast to mostrarToast
      if (!globalThis.showToast) globalThis.showToast = globalThis.mostrarToast

      try {
        const sn = localStorage.getItem('sessionNotice')
        if (sn) {
          showToast(sn)
          localStorage.removeItem('sessionNotice')
        }
      } catch(e) { console.debug('sessionNotice error', e) }

      async function doLogoutFlow(ev) {
        if (ev && ev.preventDefault) ev.preventDefault()
        try {
          const res = await fetch('/logout', { method: 'POST' })
          if (!res.ok) throw new Error('Logout failed')
          try { localStorage.setItem('sessionNotice', 'Se cerró sesión correctamente') } catch(e) {}
          globalThis.location.href = '/index.html'
        } catch(err){ console.error(err); alert('Error al cerrar sesión') }
      }

      const logoutBtn = document.getElementById('logoutBtn')
      if (logoutBtn) {
        logoutBtn.removeAttribute('onclick')
        logoutBtn.type = 'button'
        logoutBtn.addEventListener('click', doLogoutFlow)
      }

      const logoutBtnNav = document.getElementById('logoutBtnNav')
      if (logoutBtnNav && !logoutBtnNav.dataset.attached) {
        logoutBtnNav.addEventListener('click', doLogoutFlow)
        logoutBtnNav.dataset.attached = '1'
      }

      const btn = document.querySelector('button[onclick="toggleModal()"]')
      if (btn) btn.setAttribute('onclick', 'showLoginModal()')

      document.addEventListener('click', function(e){
        const t = e.target.closest('button[data-toggle-target]')
        if (!t) return
        e.preventDefault()
        const targetId = t.dataset.toggleTarget
        const input = document.getElementById(targetId)
        if (!input) return
        if (input.type === 'password') {
          input.type = 'text'
          t.innerHTML = '<i class="fas fa-eye-slash"></i>'
        } else {
          input.type = 'password'
          t.innerHTML = '<i class="fas fa-eye"></i>'
        }
      })

      updateCartTotal(); updateCartCount(); updateCartDisplay()
    
      async function loadAdminUsers() {
        const tbody = document.getElementById('adminUsersTbody')
        if (!tbody) return
        tbody.innerHTML = '<tr><td colspan="4" class="py-6 text-center text-bread-600">Cargando usuarios...</td></tr>'
        try {
          const res = await fetch('/admin/users')
          if (!res.ok) {
            tbody.innerHTML = '<tr><td colspan="4" class="py-6 text-center text-red-500">No autorizado o error</td></tr>'
            return
          }
          const users = await res.json()
          if (!Array.isArray(users) || users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="py-6 text-center text-bread-600">No hay usuarios</td></tr>'
            return
          }
          tbody.innerHTML = ''
          for (const u of users) {
            const tr = document.createElement('tr')
            tr.className = 'border-b border-gray-100'
            const adminBadge = u.admin
              ? '<span class="px-2 py-1 bg-green-100 text-green-800 rounded-full text-sm">Activo</span>'
              : '<span class="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">Usuario</span>'
            tr.innerHTML = `
              <td class="py-3 px-4 text-bread-700">${u.id}</td>
              <td class="py-3 px-4 text-bread-700">${u.username}</td>
              <td class="py-3 px-4">${adminBadge}</td>
              <td class="py-3 px-4 text-right">
                <div class="flex justify-end items-center space-x-2">
                  <button data-action="toggle-admin" data-id="${u.id}" class="px-3 py-1 border rounded text-sm">${u.admin ? 'Quitar admin' : 'Hacer admin'}</button>
                  <button data-action="delete-user" data-id="${u.id}" class="px-3 py-1 border rounded text-sm text-red-500">Eliminar</button>
                </div>
              </td>
            `
            tbody.appendChild(tr)
          }
        } catch (err) {
          console.error('Error cargando usuarios:', err)
          tbody.innerHTML = '<tr><td colspan="4" class="py-6 text-center text-red-500">Error al cargar usuarios</td></tr>'
        }
      }

      document.addEventListener('click', async function(e){
        const btn = e.target.closest('button[data-action]')
        if (!btn) return
        const action = btn.dataset.action
        const id = btn.dataset.id
        if (!action || !id) return
        if (action === 'toggle-admin') {
          if (!confirm('Cambiar rol admin de este usuario?')) return
          try {
            const res = await fetch(`/admin/users/${id}/toggle-admin`, { method: 'POST' })
            if (!res.ok) throw new Error('Error toggling')
            await loadAdminUsers()
          } catch (err) { console.error(err); alert('Error al cambiar rol') }
        }
        if (action === 'delete-user') {
          if (!confirm('Eliminar usuario permanentemente?')) return
          try {
            const res = await fetch(`/admin/users/${id}`, { method: 'DELETE' })
            if (!res.ok) throw new Error('Error deleting')
            await loadAdminUsers()
          } catch (err) { console.error(err); alert('Error al eliminar usuario') }
        }
      })

      const refreshBtn = document.getElementById('refreshUsersBtn')
      if (refreshBtn) refreshBtn.addEventListener('click', loadAdminUsers)

      loadAdminUsers()
      if (typeof loadPublicProducts === 'function') loadPublicProducts()
      if (typeof loadAdminProducts === 'function') loadAdminProducts()
      
      // Agregar funcionalidad de vista previa de imagen
      const imageInput = document.getElementById('productImage')
      if (imageInput) {
        imageInput.addEventListener('change', function(e) {
          const file = e.target.files[0]
          const preview = document.getElementById('imagePreview')
          const previewImg = document.getElementById('previewImg')
          
          if (file && preview && previewImg) {
            // Validar el archivo antes de mostrar vista previa
            if (typeof window.validarArchivo === 'function' && !window.validarArchivo(file)) {
              alert('Archivo no válido. Solo se permiten imágenes JPG, PNG, GIF de máximo 5MB.')
              e.target.value = ''
              preview.classList.add('hidden')
              return
            }
            
            const reader = new FileReader()
            reader.onload = function(e) {
              previewImg.src = e.target.result
              preview.classList.remove('hidden')
            }
            reader.readAsDataURL(file)
          } else if (preview) {
            preview.classList.add('hidden')
          }
        })
      }
    })

    async function loadPublicProducts() {
      const container = document.getElementById('productos')
      if (!container) return
      container.innerHTML = '<div class="container mx-auto px-6 text-center py-12">Cargando productos...</div>'
      try {
        const res = await fetch('/productos/por-temporada')
        if (!res.ok) { container.innerHTML = '<div class="text-center text-red-500">Error al cargar productos</div>'; return }
        const grouped = await res.json()
        let html = '<div class="container mx-auto px-6">'
        html += '<h2 class="text-4xl font-light text-center text-bread-700 mb-16">Productos Selectos</h2>'
        for (const season of Object.keys(grouped)) {
          html += `<h3 class="text-2xl font-medium text-bread-700 mb-6">${season}</h3>`
          html += '<div class="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">'
          for (const p of grouped[season]) {
            const img = p.img || 'https://via.placeholder.com/400'
            const stockBadge = p.stock <= 5 && p.stock > 0 ? `<span class="text-xs text-orange-600">¡Últimas ${p.stock} unidades!</span>` : ''
            html += `
                  <div class="bg-bread-100 p-8 rounded-xl group hover:shadow-xl transition-all duration-300">
                    <div class="relative overflow-hidden rounded-lg mb-6">
                      <img src="${img}" alt="${p.nombre}" onerror="this.onerror=null;this.src='https://via.placeholder.com/400'" class="w-full h-64 object-cover transform hover:scale-105 transition-transform duration-300">
                    </div>
                    <h3 class="text-xl font-light text-bread-700">${p.nombre}</h3>
                    <p class="text-bread-600 mt-2">${p.descripcion || ''}</p>
                    ${stockBadge ? `<p class="mt-1">${stockBadge}</p>` : ''}
                    <div class="flex justify-between items-center mt-6">
                      <p class="text-bread-700 font-medium">$${Number(p.precio).toFixed(2)} MXN</p>
                      <button onclick="addToCart(${p.id}, '${escapeHtml(p.nombre)}', ${Number(p.precio)}, '${escapeHtml(img)}')" class="bg-bread-500 text-white p-2 rounded-full hover:bg-bread-600 transform hover:scale-110 transition-all duration-300"><i class="fas fa-plus"></i></button>
                    </div>
                  </div>
                `
          }
          html += '</div>'
        }
        html += '</div>'
        container.innerHTML = html
      } catch (err) {
        console.error('Error loading productos:', err)
        container.innerHTML = '<div class="text-center text-red-500">Error al cargar productos</div>'
      }
    }

    function escapeHtml(s) {
      if (!s) return ''
      return String(s).replace(/'/g, "\\'").replace(/\"/g, '\\"')
    }

    async function loadAdminProducts() {
      const tbody = document.getElementById('adminProductsTbody')
      if (!tbody) return
      tbody.innerHTML = '<tr><td colspan="5" class="py-6 text-center text-bread-600">Cargando productos...</td></tr>'
      try {
        const res = await fetch('/admin/productos')
        if (!res.ok) { tbody.innerHTML = '<tr><td colspan="5" class="py-6 text-center text-red-500">No autorizado o error</td></tr>'; return }
        const products = await res.json()
        if (!Array.isArray(products) || products.length === 0) {
          tbody.innerHTML = '<tr><td colspan="5" class="py-6 text-center text-bread-600">No hay productos</td></tr>'
          return
        }
        tbody.innerHTML = ''
        for (const p of products) {
          const tr = document.createElement('tr')
          tr.className = 'border-b border-gray-100'
          tr.innerHTML = `
            <td class="py-3 px-4">
              <div class="flex items-center">
                <img src="${p.img ? `/${p.img}` : 'https://via.placeholder.com/80'}" alt="${p.nombre}" class="w-10 h-10 rounded object-cover mr-3" onerror="this.src='https://via.placeholder.com/80'">
                <div>
                  <p class="text-bread-700">${p.nombre}</p>
                  <p class="text-sm text-bread-600">${p.descripcion || ''}</p>
                </div>
              </div>
            </td>
            <td class="py-3 px-4 text-bread-700">$${Number(p.precio).toFixed(2)} MXN</td>
            <td class="py-3 px-4 text-bread-700">${p.stock || 0}</td>
            <td class="py-3 px-4">${p.activo ? '<span class="px-2 py-1 bg-green-100 text-green-800 rounded-full text-sm">Activo</span>' : '<span class="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">Inactivo</span>'}</td>
            <td class="py-3 px-4 text-right">
              <div class="flex justify-end space-x-2">
                <button data-action="toggle-active" data-id="${p.id}" class="px-3 py-1 ${p.activo ? 'bg-gray-200 text-gray-700' : 'bg-green-200 text-green-700'} rounded text-sm hover:opacity-80">
                  ${p.activo ? 'Desactivar' : 'Activar'}
                </button>
                <button data-action="edit-product" data-id="${p.id}" class="px-3 py-1 border rounded text-sm hover:bg-bread-100">Editar</button>
                <button data-action="delete-product" data-id="${p.id}" class="px-3 py-1 border rounded text-sm text-red-500 hover:bg-red-50">Eliminar</button>
              </div>
            </td>
          `
          tbody.appendChild(tr)
        }
      } catch (err) {
        console.error('Error cargando productos admin:', err)
        tbody.innerHTML = '<tr><td colspan="5" class="py-6 text-center text-red-500">Error al cargar productos</td></tr>'
      }
    }

    globalThis.showAddProductModal = function(){
      const m = document.getElementById('addProductModal')
      if (!m) return
      
      // Si no es edición, requerir imagen
      const form = document.getElementById('addProductForm')
      const imageInput = document.getElementById('productImage')
      const editNote = document.getElementById('imageEditNote')
      
      if (form && !form.dataset.editId && imageInput) {
        imageInput.setAttribute('required', 'required')
      }
      
      // Limpiar vista previa y ocultar nota si no es edición
      if (form && !form.dataset.editId) {
        const preview = document.getElementById('imagePreview')
        if (preview) preview.classList.add('hidden')
        if (editNote) editNote.style.display = 'none'
      }
      
      m.classList.remove('hidden')
      document.body.style.overflow = 'hidden'
    }
    globalThis.closeAddProductModal = function(){
      const m = document.getElementById('addProductModal')
      if (!m) return
      
      // Limpiar el formulario y datos de edición
      const form = document.getElementById('addProductForm')
      if (form) {
        form.reset()
        delete form.dataset.editId
        
        // Restaurar el requerimiento de imagen
        const imageInput = document.getElementById('productImage')
        if (imageInput) imageInput.setAttribute('required', 'required')
        
        // Ocultar vista previa y nota de edición
        const preview = document.getElementById('imagePreview')
        const editNote = document.getElementById('imageEditNote')
        if (preview) preview.classList.add('hidden')
        if (editNote) editNote.style.display = 'none'
      }
      
      m.classList.add('hidden')
      document.body.style.overflow = 'auto'
    }

    const addProductForm = document.getElementById('addProductForm')
    if (addProductForm) addProductForm.addEventListener('submit', async function(e){
      e.preventDefault()
      
      const editId = addProductForm.dataset.editId
      const name = document.getElementById('productName').value.trim()
      const description = document.getElementById('productDescription').value.trim()
      const priceInput = document.getElementById('productPrice').value
      const stockInput = document.getElementById('productStock').value
      const imageFile = document.getElementById('productImage').files[0]
      const season = document.getElementById('productSeason') ? document.getElementById('productSeason').value.trim() : null

      // Validaciones usando el archivo validacion.js
      if (typeof validarFormularioProducto === 'function') {
        const errores = validarFormularioProducto(name, priceInput, stockInput, imageFile)
        if (errores.length > 0) {
          alert('Errores de validación:\n\n' + errores.join('\n'))
          return
        }
      }

      // Validación adicional de números negativos
      const price = Number.parseFloat(priceInput)
      if (price < 0) {
        alert('El precio no puede ser negativo')
        return
      }

      // Validación de stock (debe ser entero positivo)
      const stock = stockInput ? Number.parseInt(stockInput, 10) : 0
      if (stockInput && (!Number.isInteger(stock) || stock < 0)) {
        alert('El stock debe ser un número entero positivo (sin decimales)')
        return
      }

      try {
        let imageUrl = null
        
        // Si hay una imagen nueva, subirla
        if (imageFile) {
          console.log('Subiendo imagen:', imageFile.name, 'Tamaño:', imageFile.size, 'Tipo:', imageFile.type)
          
          const formData = new FormData()
          formData.append('image', imageFile)
          
          // Primero intentar con el endpoint de prueba para diagnosticar
          console.log('Intentando subida con endpoint de prueba...')
          const testRes = await fetch('/test-upload', {
            method: 'POST',
            body: formData,
            credentials: 'same-origin'
          })
          
          console.log('Respuesta de prueba:', testRes.status, testRes.statusText)
          
          if (testRes.ok) {
            console.log('El endpoint de prueba funciona, intentando con el endpoint real...')
          } else {
            const testErr = await testRes.json().catch(() => ({}))
            console.error('Error en endpoint de prueba:', testErr)
          }
          
          const uploadRes = await fetch('/upload-image', {
            method: 'POST',
            body: formData,
            credentials: 'same-origin' // Asegurar que las cookies de sesión se envíen
          })
          
          console.log('Respuesta de subida:', uploadRes.status, uploadRes.statusText)
          
          if (!uploadRes.ok) {
            const err = await uploadRes.json().catch(() => ({ mensaje: 'Error subiendo imagen' }))
            console.error('Error en la subida:', err)
            alert(err.mensaje || 'Error subiendo imagen')
            return
          }
          
          const uploadData = await uploadRes.json()
          console.log('Imagen subida exitosamente:', uploadData)
          imageUrl = uploadData.imagePath // Usar imagePath para la BD
        } else if (editId) {
          // Si es edición y no hay imagen nueva, obtener la imagen actual
          try {
            const res = await fetch('/admin/productos')
            if (res.ok) {
              const products = await res.json()
              const currentProduct = products.find(p => String(p.id) === String(editId))
              if (currentProduct) {
                imageUrl = currentProduct.img
              }
            }
          } catch (e) {
            console.warn('No se pudo obtener la imagen actual del producto')
          }
        }
        
        const payload = { 
          nombre: name, 
          descripcion: description, 
          tipo: '', 
          precio: price,
          stock: stock || 0,
          img: imageUrl, 
          temporada: season || null, 
          activo: 1 
        }
        
        if (editId) {
          const res = await fetch(`/admin/productos/${editId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
          if (!res.ok) { const err = await res.json().catch(()=>({ mensaje: 'Error actualizando' })); alert(err.mensaje || 'Error actualizando'); return }
          delete addProductForm.dataset.editId
          closeAddProductModal()
          showToast('Producto actualizado')
          loadAdminProducts()
        } else {
          const res = await fetch('/admin/productos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
          if (!res.ok) {
            const err = await res.json().catch(()=>({ mensaje: 'Error creando producto' }))
            alert(err.mensaje || 'Error creando producto')
            return
          }
          closeAddProductModal()
          showToast('Producto creado')
          addProductForm.reset()
          // Limpiar vista previa de imagen
          const preview = document.getElementById('imagePreview')
          if (preview) preview.classList.add('hidden')
          loadAdminProducts()
        }
      } catch (err) {
        console.error('Error al crear/actualizar producto:', err)
    let message = 'Error al crear/actualizar producto'
    if (err && err.message) message = err.message
    else if (typeof err === 'string') message = err
    alert('Error al crear/actualizar producto: ' + message)
      }
    })

    document.addEventListener('click', async function(e){
      const btn = e.target.closest('button[data-action]')
      if (!btn) return
      const action = btn.dataset.action
      const id = btn.dataset.id
      if (!action || !id) return
      
      if (action === 'toggle-active') {
        try {
          const res = await fetch(`/admin/productos/${id}/toggle-active`, { method: 'POST' })
          if (!res.ok) throw new Error('Error toggling active')
          const data = await res.json()
          showToast(data.activo ? 'Producto activado' : 'Producto desactivado')
          await loadAdminProducts()
        } catch (err) { console.error(err); alert('Error al cambiar estado del producto') }
      }
      
      if (action === 'delete-product') {
        if (!confirm('Eliminar producto permanentemente?')) return
        try {
          const res = await fetch(`/admin/productos/${id}`, { method: 'DELETE' })
          if (!res.ok) throw new Error('Error deleting')
          showToast('Producto eliminado')
          await loadAdminProducts()
        } catch (err) { console.error(err); alert('Error al eliminar producto') }
      }
      
      if (action === 'edit-product') {
        try {
          const res = await fetch(`/admin/productos`)
          if (!res.ok) throw new Error('Error cargando productos')
          const products = await res.json()
          const p = products.find(x=>String(x.id)===String(id))
          if (!p) { alert('Producto no encontrado'); return }
          document.getElementById('productName').value = p.nombre || ''
          document.getElementById('productDescription').value = p.descripcion || ''
          document.getElementById('productPrice').value = p.precio || 0
          document.getElementById('productStock').value = p.stock || 0
          
          // Para edición, no requerir imagen nueva ya que puede usar la existente
          const imageInput = document.getElementById('productImage')
          const editNote = document.getElementById('imageEditNote')
          if (imageInput) {
            imageInput.removeAttribute('required')
          }
          if (editNote) {
            editNote.style.display = 'block'
          }
          
          // Mostrar imagen actual si existe
          const preview = document.getElementById('imagePreview')
          const previewImg = document.getElementById('previewImg')
          if (p.img && preview && previewImg) {
            previewImg.src = p.img
            preview.classList.remove('hidden')
          }
          
          const seasonEl = document.getElementById('productSeason')
          if (seasonEl) seasonEl.value = p.temporada || ''
          addProductForm.dataset.editId = id
          showAddProductModal()
        } catch(err){ console.error(err); alert('Error al editar producto') }
      }
    })
})();
