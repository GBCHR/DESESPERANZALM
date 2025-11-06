// Funciones de validación para el sistema de panadería

function validarNombreProducto(valor) {
    // Permite letras, números, espacios y algunos caracteres especiales comunes en nombres de productos
    return /^[A-Za-zÁÉÍÓÚáéíóúÑñ0-9\s\-\.]+$/.test(valor.trim());
}

function validarPrecio(valor) {
    const numero = parseFloat(valor);
    // El precio debe ser un número positivo
    return !isNaN(numero) && numero >= 0 && isFinite(numero);
}

function validarStock(valor) {
    const numero = parseInt(valor, 10);
    // El stock debe ser un número entero positivo
    return !isNaN(numero) && numero >= 0 && Number.isInteger(parseFloat(valor));
}

function validarArchivo(archivo) {
    if (!archivo) return true; // El archivo es opcional
    
    // Verificar tipo de archivo
    const tiposPermitidos = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
    if (!tiposPermitidos.includes(archivo.type)) {
        return false;
    }
    
    // Verificar tamaño (máximo 5MB)
    const tamañoMaximo = 5 * 1024 * 1024; // 5MB en bytes
    if (archivo.size > tamañoMaximo) {
        return false;
    }
    
    return true;
}

function validarURL(valor) {
    if (!valor || valor.trim() === '') return true; // URL es opcional
    try {
        new URL(valor);
        return true;
    } catch {
        return false;
    }
}

function sanitizarInput(valor) {
    // Elimina caracteres peligrosos para prevenir XSS
    return valor.replace(/[<>'"]/g, '');
}

// Validación para formularios de productos
function validarFormularioProducto(nombre, precio, stock, archivo) {
    const errores = [];

    // Validar nombre
    if (!nombre || nombre.trim() === '') {
        errores.push('El nombre del producto es obligatorio');
    } else if (!validarNombreProducto(nombre)) {
        errores.push('El nombre del producto contiene caracteres no permitidos');
    } else if (nombre.trim().length < 3) {
        errores.push('El nombre del producto debe tener al menos 3 caracteres');
    }

    // Validar precio
    if (precio === '' || precio === null || precio === undefined) {
        errores.push('El precio es obligatorio');
    } else if (!validarPrecio(precio)) {
        errores.push('El precio debe ser un número positivo válido');
    } else if (parseFloat(precio) < 0) {
        errores.push('El precio no puede ser negativo');
    }

    // Validar stock (si se proporciona)
    if (stock !== '' && stock !== null && stock !== undefined) {
        if (!validarStock(stock)) {
            errores.push('El stock debe ser un número entero positivo (sin decimales)');
        } else if (parseInt(stock, 10) < 0) {
            errores.push('El stock no puede ser negativo');
        }
    }

    // Validar archivo de imagen (si se proporciona)
    if (archivo && !validarArchivo(archivo)) {
        if (!['image/jpeg', 'image/jpg', 'image/png', 'image/gif'].includes(archivo.type)) {
            errores.push('El archivo debe ser una imagen (JPG, PNG o GIF)');
        } else if (archivo.size > 5 * 1024 * 1024) {
            errores.push('La imagen no puede ser mayor a 5MB');
        }
    }

    return errores;
}

// Validación para formulario de login
function validarLogin(username, password) {
    const errores = [];

    // Validar username
    if (!username || username.trim() === '') {
        errores.push('El nombre de usuario es obligatorio');
    } else if (username.trim().length < 3) {
        errores.push('El nombre de usuario debe tener al menos 3 caracteres');
    }

    // Validar password
    if (!password || password === '') {
        errores.push('La contraseña es obligatoria');
    } else if (password.length < 6) {
        errores.push('La contraseña debe tener al menos 6 caracteres');
    }

    return errores;
}

// Validación para formulario de registro
function validarRegistro(username, password, confirmPassword) {
    const errores = [];

    // Validar username
    if (!username || username.trim() === '') {
        errores.push('El nombre de usuario es obligatorio');
    } else if (username.trim().length < 3) {
        errores.push('El nombre de usuario debe tener al menos 3 caracteres');
    } else if (!/^[A-Za-z0-9_]+$/.test(username)) {
        errores.push('El nombre de usuario solo puede contener letras, números y guiones bajos');
    }

    // Validar password
    if (!password || password === '') {
        errores.push('La contraseña es obligatoria');
    } else if (password.length < 6) {
        errores.push('La contraseña debe tener al menos 6 caracteres');
    }

    // Validar confirmación de contraseña
    if (confirmPassword !== undefined) {
        if (!confirmPassword || confirmPassword === '') {
            errores.push('Debe confirmar la contraseña');
        } else if (password !== confirmPassword) {
            errores.push('Las contraseñas no coinciden');
        }
    }

    return errores;
}

// Exportar funciones para uso global
if (typeof window !== 'undefined') {
    window.validarNombreProducto = validarNombreProducto;
    window.validarPrecio = validarPrecio;
    window.validarStock = validarStock;
    window.validarURL = validarURL;
    window.validarArchivo = validarArchivo;
    window.sanitizarInput = sanitizarInput;
    window.validarFormularioProducto = validarFormularioProducto;
    window.validarLogin = validarLogin;
    window.validarRegistro = validarRegistro;
}

