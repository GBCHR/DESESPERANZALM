// Test simple para verificar que el servidor inicia
console.log('🧪 Iniciando test del servidor...')

try {
    require('./app.js')
    console.log('✅ Archivo app.js cargado correctamente')
} catch (error) {
    console.error('❌ Error al cargar app.js:', error.message)
    console.error('Stack:', error.stack)
}