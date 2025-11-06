require('dotenv').config()
const express = require('express')
const session = require('express-session')
const MySQLStore = require('express-mysql-session')(session)
const mysql = require('mysql2/promise')
const path = require('path')
const multer = require('multer')
const fs = require('fs')

const app = express()
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Configuración de multer para subida de archivos
const uploadDir = path.join(__dirname, 'public', 'uploads')

// Asegurar que el directorio existe
try {
	if (!fs.existsSync(uploadDir)) {
		fs.mkdirSync(uploadDir, { recursive: true })
		console.log('📁 Directorio uploads creado')
	}
} catch (error) {
	console.error('❌ Error creando directorio uploads:', error)
}

const storage = multer.diskStorage({
	destination: function (req, file, cb) {
		cb(null, uploadDir)
	},
	filename: function (req, file, cb) {
		// Generar nombre único para el archivo
		const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
		const ext = path.extname(file.originalname)
		cb(null, 'product-' + uniqueSuffix + ext)
	}
})

const fileFilter = (req, file, cb) => {
	// Validar tipos de archivo permitidos
	const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif']
	if (allowedTypes.includes(file.mimetype)) {
		cb(null, true)
	} else {
		cb(new Error('Tipo de archivo no permitido. Solo se permiten imágenes JPG, PNG y GIF.'), false)
	}
}

const upload = multer({ 
	storage: storage,
	fileFilter: fileFilter,
	limits: {
		fileSize: 5 * 1024 * 1024 // 5MB máximo
	}
})

const pool = mysql.createPool({
	host: process.env.MYSQL_HOST || 'bullnodes.com',
	user: process.env.MYSQL_USER || 'bullnodes_gabchariuser',
	password: process.env.MYSQL_PASSWORD || 'RC9R42S2ig6dLHQ8Yhfs87dDO2x5WfF57',
	database: process.env.MYSQL_DATABASE || 'bullnodes_gabchari',
	port: process.env.MYSQL_PORT ? parseInt(process.env.MYSQL_PORT, 10) : 3306,
	waitForConnections: true,
	connectionLimit: 10,
	queueLimit: 0,
	acquireTimeout: 60000,
	timeout: 60000
})

pool.getConnection()
	.then(connection => {
		console.log('✅ Conexión a MySQL establecida')
		connection.release()
	})
	.catch(err => {
		console.error('❌ Error conectando a MySQL:', err.message)
		console.log('⚠️  El servidor continuará sin base de datos')
	})

const sessionStore = new MySQLStore({}, pool)

app.use(session({
	key: 'sid',
	secret: process.env.SESSION_SECRET || 'miclave',
	store: sessionStore,
	resave: false,
	saveUninitialized: false,
	cookie: {
		maxAge: 1000 * 60 * 60 * 24,
		httpOnly: true,
		secure: false,
		sameSite: 'lax'
	}
}))

app.use(express.static(path.join(__dirname, '/public'), {
    setHeaders: (res, path) => {
        if (path.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript')
        }
    }
}))

const carritoRoutes = require('./routes/carrito')(pool)
app.use('/carrito', carritoRoutes)

// Rutas de autenticación
app.post('/login', async (req, res) => {
	try {
		const { username, password } = req.body

		// Validación de entrada
		if (!username || !password) {
			return res.status(400).json({ mensaje: 'Usuario y contraseña son requeridos' })
		}

		if (username.trim().length < 3) {
			return res.status(400).json({ mensaje: 'El usuario debe tener al menos 3 caracteres' })
		}

	const [rows] = await pool.execute('SELECT * FROM usuario WHERE username = ?', [username])

		if (rows.length === 0) {
			return res.status(401).json({ mensaje: 'Usuario o contraseña incorrecta' })
		}

		const user = rows[0]

            
			if (user.password !== password) {
				return res.status(401).json({ mensaje: 'Usuario o contraseña incorrecta' })
			}

	// Establecer la sesión
		req.session.userId = user.id
		req.session.username = user.username
		req.session.admin = user.admin === 1 || user.admin === '1'

        
		res.json({ mensaje: 'Has iniciado sesión correctamente', admin: req.session.admin, username: req.session.username })
	} catch (error) {
		console.error('Error en login:', error)
		// Error de conexión a la base de datos
		if (error.code && (error.code.startsWith('ER_') || error.code === 'ECONNREFUSED')) {
			return res.status(500).json({ mensaje: 'Error de conexión con la base de datos. Por favor, intente más tarde.' })
		}
		res.status(500).json({ mensaje: 'Error interno del servidor al procesar el inicio de sesión' })
	}
})

// Registro de usuarios
app.post('/register', async (req, res) => {
	try {
		const { username, password } = req.body
		
		// Validación de entrada
		if (!username || !password) {
			return res.status(400).json({ mensaje: 'Usuario y contraseña son requeridos' })
		}
		
		if (username.trim().length < 3) {
			return res.status(400).json({ mensaje: 'El usuario debe tener al menos 3 caracteres' })
		}
		
		if (password.length < 6) {
			return res.status(400).json({ mensaje: 'La contraseña debe tener al menos 6 caracteres' })
		}

	const [rows] = await pool.execute('SELECT id FROM usuario WHERE username = ?', [username])
		if (rows.length > 0) return res.status(409).json({ mensaje: 'El nombre de usuario ya está registrado' })

	await pool.execute('INSERT INTO usuario (username, password, admin) VALUES (?, ?, 0)', [username, password])

		res.json({ mensaje: 'Usuario creado correctamente' })
	} catch (err) {
		console.error('Error register:', err)
		// Error de conexión a la base de datos
		if (err.code && (err.code.startsWith('ER_') || err.code === 'ECONNREFUSED')) {
			return res.status(500).json({ mensaje: 'Error de conexión con la base de datos. Por favor, intente más tarde.' })
		}
		res.status(500).json({ mensaje: 'Error interno del servidor al registrar usuario' })
	}
})

app.post('/logout', (req, res) => {
	req.session.destroy(err => {
		if (err) return res.status(500).json({ mensaje: 'Error al cerrar sesión' })
		res.clearCookie('sid')
		res.json({ mensaje: 'Has cerrado sesión' })
	})
})

function requireAuth(req, res, next) {
	if (req.session?.userId) return next()
	res.status(401).json({ mensaje: 'No autorizado' })
}

function requireAdmin(req, res, next) {
	if (req.session?.admin) return next()
	res.status(403).json({ mensaje: 'No autorizado - admin' })
}

app.get('/perfil', requireAuth, (req, res) => {
	res.json({ id: req.session.userId, usuario: req.session.username, admin: req.session.admin })
})

// Endpoint para subir imágenes
app.post('/upload-image', requireAdmin, (req, res) => {
	console.log('=== UPLOAD IMAGE REQUEST ===')
	console.log('User session:', req.session?.userId ? 'Authenticated' : 'Not authenticated')
	
	// Usar multer dentro del handler para mejor manejo de errores
	upload.single('image')(req, res, (err) => {
		if (err) {
			console.error('Multer error:', err.message)
			if (err.code === 'LIMIT_FILE_SIZE') {
				return res.status(400).json({ mensaje: 'El archivo es demasiado grande. Máximo 5MB permitido.' })
			}
			if (err.message?.includes('Tipo de archivo no permitido')) {
				return res.status(400).json({ mensaje: 'Tipo de archivo no permitido. Solo se permiten imágenes JPG, PNG y GIF.' })
			}
			return res.status(400).json({ mensaje: err.message || 'Error al procesar el archivo' })
		}

		try {
			if (!req.file) {
				console.error('No file received')
				return res.status(400).json({ mensaje: 'No se recibió ningún archivo' })
			}
			
			console.log('✅ Archivo subido exitosamente:', req.file.filename)
			
			// Retornar la ruta relativa del archivo subido (sin la barra inicial)
			const imagePath = `uploads/${req.file.filename}`
			res.json({ 
				mensaje: 'Imagen subida correctamente',
				imageUrl: `/${imagePath}`, // Para mostrar en el frontend
				imagePath: imagePath,       // Para guardar en la BD
				fileName: req.file.filename
			})
		} catch (error) {
			console.error('Error uploading image:', error)
			res.status(500).json({ mensaje: 'Error interno al subir la imagen' })
		}
	})
})

// Endpoint temporal para pruebas sin autenticación
app.post('/test-upload', (req, res) => {
	console.log('=== TEST UPLOAD REQUEST ===')
	
	upload.single('image')(req, res, (err) => {
		if (err) {
			console.error('Test Multer error:', err)
			return res.status(400).json({ mensaje: err.message || 'Error al procesar el archivo' })
		}

		try {
			if (!req.file) {
				console.error('Test: No file received')
				return res.status(400).json({ mensaje: 'No se recibió ningún archivo' })
			}
			
			console.log('Test: Archivo subido exitosamente:', req.file.filename)
			
			const imageUrl = `/uploads/${req.file.filename}`
			res.json({ 
				mensaje: 'Test: Imagen subida correctamente',
				imageUrl: imageUrl,
				fileName: req.file.filename
			})
		} catch (error) {
			console.error('Test: Error uploading image:', error)
			res.status(500).json({ mensaje: 'Error interno al subir la imagen' })
		}
	})
})

// Servir panel admin protegido
app.get('/admin', requireAdmin, (req, res) => {
	res.sendFile(path.join(__dirname, 'public', 'admin.html'))
})

// ADMIN: listar usuarios
app.get('/admin/users', requireAdmin, async (req, res) => {
	try {
		const [rows] = await pool.execute('SELECT id, username, admin FROM usuario ORDER BY id ASC')
		res.json(rows)
	} catch (err) {
		console.error('Error getting users:', err)
		res.status(500).json({ mensaje: 'Error al obtener usuarios' })
	}
})

// ADMIN: alternar rol admin de un usuario
app.post('/admin/users/:id/toggle-admin', requireAdmin, async (req, res) => {
	try {
		const userId = req.params.id
	const [rows] = await pool.execute('SELECT id, admin FROM usuario WHERE id = ?', [userId])
		if (rows.length === 0) return res.status(404).json({ mensaje: 'Usuario no encontrado' })
		const user = rows[0]
		const newAdmin = user.admin === 1 ? 0 : 1
		await pool.execute('UPDATE usuario SET admin = ? WHERE id = ?', [newAdmin, userId])
		res.json({ id: userId, admin: newAdmin })
	} catch (err) {
		console.error('Error toggling admin:', err)
		if (err.code && (err.code.startsWith('ER_') || err.code === 'ECONNREFUSED')) {
			return res.status(500).json({ mensaje: 'Error de conexión con la base de datos' })
		}
		res.status(500).json({ mensaje: 'Error interno del servidor al actualizar usuario' })
	}
})

// ADMIN: eliminar usuario
app.delete('/admin/users/:id', requireAdmin, async (req, res) => {
	try {
		const userId = req.params.id
		
		// Validación de entrada
		if (!userId || isNaN(parseInt(userId, 10))) {
			return res.status(400).json({ mensaje: 'ID de usuario inválido' })
		}
		
		await pool.execute('DELETE FROM usuario WHERE id = ?', [userId])
		res.json({ id: userId })
	} catch (err) {
		console.error('Error deleting user:', err)
		if (err.code && (err.code.startsWith('ER_') || err.code === 'ECONNREFUSED')) {
			return res.status(500).json({ mensaje: 'Error de conexión con la base de datos' })
		}
		res.status(500).json({ mensaje: 'Error interno del servidor al eliminar usuario' })
	}
})

// ADMIN: obtener TODOS los productos (activos e inactivos)
app.get('/admin/productos', requireAdmin, async (req, res) => {
	try {
		const [rows] = await pool.execute('SELECT id, nombre, descripcion, tipo, precio, stock, img, temporada, activo FROM productos ORDER BY nombre ASC')
		res.json(rows)
	} catch (err) {
		console.error('Error getting all productos:', err)
		if (err.code && (err.code.startsWith('ER_') || err.code === 'ECONNREFUSED')) {
			return res.status(500).json({ mensaje: 'Error de conexión con la base de datos' })
		}
		res.status(500).json({ mensaje: 'Error interno del servidor al obtener productos' })
	}
})

// Public: obtener productos activos
app.get('/productos', async (req, res) => {
	try {
		const [rows] = await pool.execute('SELECT id, nombre, descripcion, tipo, precio, stock, img, temporada, activo FROM productos WHERE activo = 1 AND stock > 0 ORDER BY nombre ASC')
		res.json(rows)
	} catch (err) {
		console.error('Error getting productos:', err)
		if (err.code && (err.code.startsWith('ER_') || err.code === 'ECONNREFUSED')) {
			return res.status(500).json({ mensaje: 'Error de conexión con la base de datos' })
		}
		res.status(500).json({ mensaje: 'Error interno del servidor al obtener productos' })
	}
})

// Public: productos agrupados por temporada
app.get('/productos/por-temporada', async (req, res) => {
	try {
		const [rows] = await pool.execute('SELECT id, nombre, descripcion, tipo, precio, stock, img, temporada, activo FROM productos WHERE activo = 1 AND stock > 0 ORDER BY temporada ASC, nombre ASC')
		const grouped = {}
		for (const p of rows) {
			const t = p.temporada || 'General'
			if (!grouped[t]) grouped[t] = []
			grouped[t].push(p)
		}
		res.json(grouped)
	} catch (err) {
		console.error('Error grouping productos:', err)
		if (err.code && (err.code.startsWith('ER_') || err.code === 'ECONNREFUSED')) {
			return res.status(500).json({ mensaje: 'Error de conexión con la base de datos' })
		}
		res.status(500).json({ mensaje: 'Error interno del servidor al obtener productos por temporada' })
	}
})

// ADMIN: CRUD de productos
app.post('/admin/productos', requireAdmin, async (req, res) => {
	try {
		const { nombre, descripcion, tipo, precio, stock, img, temporada, activo } = req.body
		
		// Validaciones del servidor
		if (!nombre || nombre.trim().length < 3) {
			return res.status(400).json({ mensaje: 'El nombre del producto debe tener al menos 3 caracteres' })
		}
		
		const precioNum = parseFloat(precio)
		if (isNaN(precioNum) || precioNum < 0) {
			return res.status(400).json({ mensaje: 'El precio debe ser un número positivo' })
		}
		
		const stockNum = parseInt(stock || 0, 10)
		if (isNaN(stockNum) || stockNum < 0) {
			return res.status(400).json({ mensaje: 'El stock debe ser un número entero positivo' })
		}
		
		// Si no hay stock, desactivar automáticamente el producto
		const activoFinal = (stockNum > 0 && activo) ? 1 : 0
		
		const shortImg = img && typeof img === 'string' && img.length > 200 ? img.slice(0,200) + '...[truncated]' : img
		console.log('ADMIN Create producto payload:', { nombre, descripcion, tipo, precio: precioNum, stock: stockNum, img: shortImg, temporada, activo: activoFinal })
		const [r] = await pool.execute('INSERT INTO productos (nombre, descripcion, tipo, precio, stock, img, temporada, activo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [nombre.trim(), descripcion, tipo, precioNum, stockNum, img || null, temporada || null, activoFinal])
		res.json({ id: r.insertId })
	} catch (err) {
		console.error('Error creating producto:', err)
		if (err.code && (err.code.startsWith('ER_') || err.code === 'ECONNREFUSED')) {
			return res.status(500).json({ mensaje: 'Error de conexión con la base de datos' })
		}
		res.status(500).json({ mensaje: 'Error interno del servidor al crear producto' })
	}
})

app.put('/admin/productos/:id', requireAdmin, async (req, res) => {
	try {
		const id = req.params.id
		
		// Validar ID
		if (!id || isNaN(Number(id))) {
			return res.status(400).json({ mensaje: 'ID de producto inválido' })
		}
		
		const { nombre, descripcion, tipo, precio, stock, img, temporada, activo } = req.body
		
		// Validaciones del servidor
		if (!nombre || nombre.trim().length < 3) {
			return res.status(400).json({ mensaje: 'El nombre del producto debe tener al menos 3 caracteres' })
		}
		
		const precioNum = parseFloat(precio)
		if (isNaN(precioNum) || precioNum < 0) {
			return res.status(400).json({ mensaje: 'El precio debe ser un número positivo' })
		}
		
		const stockNum = parseInt(stock || 0, 10)
		if (isNaN(stockNum) || stockNum < 0) {
			return res.status(400).json({ mensaje: 'El stock debe ser un número entero positivo' })
		}
		
		// Si no hay stock, desactivar automáticamente el producto
		const activoFinal = (stockNum > 0 && activo) ? 1 : 0
		
		const shortImgUp = img && typeof img === 'string' && img.length > 200 ? img.slice(0,200) + '...[truncated]' : img
		console.log('ADMIN Update producto', id, { nombre, descripcion, tipo, precio: precioNum, stock: stockNum, img: shortImgUp, temporada, activo: activoFinal })
		await pool.execute('UPDATE productos SET nombre = ?, descripcion = ?, tipo = ?, precio = ?, stock = ?, img = ?, temporada = ?, activo = ? WHERE id = ?', [nombre.trim(), descripcion, tipo, precioNum, stockNum, img || null, temporada || null, activoFinal, id])
		res.json({ id })
	} catch (err) {
		console.error('Error updating producto:', err)
		if (err.code && (err.code.startsWith('ER_') || err.code === 'ECONNREFUSED')) {
			return res.status(500).json({ mensaje: 'Error de conexión con la base de datos' })
		}
		res.status(500).json({ mensaje: 'Error interno del servidor al actualizar producto' })
	}
})

app.delete('/admin/productos/:id', requireAdmin, async (req, res) => {
	try {
		const id = req.params.id
		
		// Validar ID
		if (!id || isNaN(Number(id))) {
			return res.status(400).json({ mensaje: 'ID de producto inválido' })
		}
		
		await pool.execute('DELETE FROM productos WHERE id = ?', [id])
		res.json({ id })
	} catch (err) {
		console.error('Error deleting producto:', err)
		if (err.code && (err.code.startsWith('ER_') || err.code === 'ECONNREFUSED')) {
			return res.status(500).json({ mensaje: 'Error de conexión con la base de datos' })
		}
		res.status(500).json({ mensaje: 'Error interno del servidor al eliminar producto' })
	}
})

// ADMIN: alternar estado activo de un producto
app.post('/admin/productos/:id/toggle-active', requireAdmin, async (req, res) => {
	try {
		const id = req.params.id
		
		// Validar ID
		if (!id || isNaN(Number(id))) {
			return res.status(400).json({ mensaje: 'ID de producto inválido' })
		}
		
		const [rows] = await pool.execute('SELECT id, activo FROM productos WHERE id = ?', [id])
		if (rows.length === 0) return res.status(404).json({ mensaje: 'Producto no encontrado' })
		const producto = rows[0]
		const newActivo = producto.activo === 1 ? 0 : 1
		await pool.execute('UPDATE productos SET activo = ? WHERE id = ?', [newActivo, id])
		res.json({ id, activo: newActivo })
	} catch (err) {
		console.error('Error toggling activo:', err)
		if (err.code && (err.code.startsWith('ER_') || err.code === 'ECONNREFUSED')) {
			return res.status(500).json({ mensaje: 'Error de conexión con la base de datos' })
		}
		res.status(500).json({ mensaje: 'Error interno del servidor al cambiar estado del producto' })
	}
})

const port = process.env.PORT || 3000

// Manejo de errores no capturados
process.on('uncaughtException', (err) => {
	console.error('❌ Error no capturado:', err)
	console.log('🔄 El servidor continúa ejecutándose...')
})

process.on('unhandledRejection', (reason, promise) => {
	console.error('❌ Promesa rechazada no manejada:', reason)
	console.log('🔄 El servidor continúa ejecutándose...')
})

const server = app.listen(port, () => {
	console.log(`🚀 Servidor en http://localhost:${port}`)
	console.log(`📁 Archivos estáticos desde: ${path.join(__dirname, 'public')}`)
	console.log(`📸 Imágenes se guardarán en: ${path.join(__dirname, 'public', 'uploads')}`)
})

server.on('error', (err) => {
	if (err.code === 'EADDRINUSE') {
		console.error(`❌ Puerto ${port} ya está en uso`)
		console.log('💡 Intenta usar otro puerto o cerrar el proceso que lo está usando')
		process.exit(1)
	} else {
		console.error('❌ Error del servidor:', err)
	}
})

