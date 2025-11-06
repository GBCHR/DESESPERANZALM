const express = require('express');

module.exports = function(pool) {
  const router = express.Router();
  
  // In-memory cart endpoints
  let cart = [];

  router.get('/', (req, res) => {
    res.json(cart);
  });

  router.post('/agregar', (req, res) => {
    const { id, nombre, precio, cantidad } = req.body;
    const productoExistente = cart.find(item => item.id === id);

    if (productoExistente) {
      productoExistente.cantidad += cantidad;
    } else {
      cart.push({ id, nombre, precio, cantidad });
    }

    res.json({ mensaje: 'Producto agregado al carrito', carrito: cart });
  });

  router.delete('/eliminar/:id', (req, res) => {
    const id = parseInt(req.params.id);
    cart = cart.filter(item => item.id !== id);
    res.json({ mensaje: 'Producto eliminado', carrito: cart });
  });

  router.get('/total', (req, res) => {
    const total = cart.reduce((sum, item) => sum + item.precio * item.cantidad, 0);
    res.json({ total });
  });

  
  router.post('/comprar', async (req, res) => {
    try {
      if (!req.session?.userId) return res.status(401).json({ mensaje: 'Debes iniciar sesión para comprar' })

      const userId = req.session.userId
      const { items, total } = req.body

      if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ mensaje: 'Carrito vacío' })

      
      const conn = await pool.getConnection()
      try {
        await conn.beginTransaction()
        const insertIds = []
        for (const it of items) {
          
          let pid = (it.id !== undefined && it.id !== null && it.id !== '') ? Number.parseInt(it.id) : null
          const qty = Number.parseInt(it.quantity)
          let price = Number.parseFloat(it.price)

          if ((!pid || Number.isNaN(pid)) && it.name) {
            
            const [prodRows] = await conn.execute('SELECT id, precio, stock FROM productos WHERE nombre = ? LIMIT 1', [it.name])
            if (Array.isArray(prodRows) && prodRows.length > 0) {
              pid = prodRows[0].id
              if (!price || Number.isNaN(price)) price = Number.parseFloat(prodRows[0].precio) || 0
            }
          }

          if (!pid || Number.isNaN(pid) || !qty || qty <= 0) {
            await conn.rollback()
            conn.release()
            return res.status(400).json({ mensaje: 'Datos de carrito inválidos' })
          }
          
          // Verificar stock disponible
          const [stockCheck] = await conn.execute('SELECT stock FROM productos WHERE id = ?', [pid])
          if (!stockCheck || stockCheck.length === 0) {
            await conn.rollback()
            conn.release()
            return res.status(400).json({ mensaje: 'Producto no encontrado' })
          }
          
          const stockDisponible = stockCheck[0].stock
          if (stockDisponible < qty) {
            await conn.rollback()
            conn.release()
            return res.status(400).json({ mensaje: `Stock insuficiente. Solo quedan ${stockDisponible} unidades disponibles` })
          }
          
          // Descontar stock
          await conn.execute('UPDATE productos SET stock = stock - ? WHERE id = ?', [qty, pid])
          
          // Si el stock llega a 0, desactivar el producto
          await conn.execute('UPDATE productos SET activo = 0 WHERE id = ? AND stock <= 0', [pid])
          
          const lineTotal = Number((qty * price).toFixed(2))
          const [r] = await conn.execute('INSERT INTO compras (id_usuario, id_pan, cantidad, total) VALUES (?, ?, ?, ?)', [userId, pid, qty, lineTotal])
          insertIds.push(r.insertId)
        }
        await conn.commit()
        conn.release()
        
        return res.json({ mensaje: 'Compra registrada', items: insertIds, total })
      } catch (err) {
        await conn.rollback().catch(()=>{})
        conn.release()
        console.error('Error inserting compra:', err)
        return res.status(500).json({ mensaje: 'Error al procesar la compra' })
      }
    } catch (err) {
      console.error('Error en /carrito/comprar:', err)
      return res.status(500).json({ mensaje: 'Error del servidor' })
    }
  })

  return router
}
