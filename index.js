const express = require('express');
const cors = require('cors');
const mysql = require('mysql2'); // Cambiado a mysql2 para soporte moderno y Promises
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');

const SECRET_KEY = 'tu_clave_secreta';

const app = express();

// Middleware para manejar JSON
app.use(express.json());

// Configuración de CORS
const corsOptions = {
    origin: ['https://monraspgit.github.io', 'https://ines-back-1.onrender.com', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Métodos permitidos
    credentials: true, // Si necesitas enviar cookies o autenticación
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Maneja solicitudes preflight

// Middleware adicional para cabeceras CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }
    next();
});

// Conexión a la base de datos (Usar Pool de Conexiones)
const pool = mysql.createPool({
    host: 'bl7zutikwjblgxjdv8w4-mysql.services.clever-cloud.com',
    user: 'u1k0ig8cpdifi91b',
    password: 'LqSNfS6SoLsP3T2RdoM3',
    database: 'bl7zutikwjblgxjdv8w4',
    waitForConnections: true,
    connectionLimit: 10, // Máximo de conexiones simultáneas
    queueLimit: 0, // Sin límite en la cola
});


// Verificar conexión inicial
pool.getConnection((err, connection) => {
    if (err) {
        console.error('Error conectando al pool de base de datos:', err.message);
        return;
    }
    console.log('Conectado a la base de datos');
    connection.release(); // Liberar la conexión inicial
});

// Endpoint de ejemplo: Login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'El nombre de usuario y la contraseña son obligatorios.' });
    }

    const query = `SELECT * FROM users WHERE username = ? LIMIT 1`;

    try {
        const [results] = await pool.promise().query(query, [username]);

        if (results.length === 0) {
            return res.status(401).json({ error: 'Credenciales inválidas.' });
        }

        const user = results[0];

        if (user.password !== password) {
            return res.status(401).json({ error: 'Credenciales inválidas.' });
        }

        const token = jwt.sign(
            {
                id: user.id,
                username: user.username,
                role: user.role,
            },
            SECRET_KEY,
            { expiresIn: '1h' }
        );

        res.status(200).json({
            message: 'Inicio de sesión exitoso.',
            token,
            user: {
                id: user.id,
                username: user.username,
                role: user.role,
            },
        });
    } catch (err) {
        console.error('Error en el login:', err);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});






app.post('/api/compras', (req, res) => {
    const { registros } = req.body;

    if (!registros || !Array.isArray(registros)) {
        console.error('Registros inválidos o ausentes:', req.body);
        return res.status(400).json({ error: 'El formato del cuerpo de la solicitud es inválido.' });
    }

    // Filtrar y preparar los datos para la consulta masiva
    const valores = registros
        .filter((registro) => registro.nombre && registro.unidad && registro.cantidad_pedida != null && registro.pendiente != null && registro.fecha_envio)
        .map(({ nombre, unidad, cantidad_pedida, pendiente, fecha_envio, numero_compra }) => [
            nombre,
            unidad,
            cantidad_pedida,
            pendiente,
            fecha_envio,
            numero_compra || null, // Usar NULL si no hay número de compra
        ]);

    if (valores.length === 0) {
        console.error('No hay registros válidos para insertar.');
        return res.status(400).json({ error: 'No hay registros válidos para insertar.' });
    }

    console.log('Cantidad de registros válidos para insertar:', valores.length);

    // Consulta de inserción masiva
    const query = `
        INSERT INTO compras (nombre, unidad, cantidad_pedida, pendiente, fecha_envio, numero_compra)
        VALUES ?
    `;

    // Ejecutar la consulta masiva
    pool.query(query, [valores], (err, results) => {
        if (err) {
            console.error('Error en la inserción masiva:', err);
            return res.status(500).json({ error: 'Hubo un error al guardar los registros.' });
        }

        console.log('Inserción exitosa. Filas afectadas:', results.affectedRows);
        res.status(200).json({
            message: 'Registros guardados exitosamente.',
            insertados: results.affectedRows,
        });
    });
});



// obetener loas compras sin numero
app.get('/api/compras/sin-numero', (req, res) => {
    const query = `SELECT * FROM compras WHERE numero_compra IS NULL`;

    pool.query(query, (err, results) => {
        if (err) {
            console.error('Error al obtener compras sin número de compra:', err);
            return res.status(500).json({ error: 'Error al obtener compras sin número de compra.' });
        }

        res.status(200).json(results);
    });
});














// actualizar el numero
app.put('/api/compras/actualizar-numeros', (req, res) => {
    const { registros } = req.body;

    if (!registros || !Array.isArray(registros) || registros.length === 0) {
        return res.status(400).json({ error: 'Debe proporcionar un arreglo de registros con id y numero_compra.' });
    }

    // Validar que cada registro tenga los campos requeridos
    const valores = registros
        .filter((registro) => registro.id && registro.numero_compra)
        .map((registro) => [registro.numero_compra, registro.id]);

    if (valores.length === 0) {
        return res.status(400).json({ error: 'No hay registros válidos para actualizar.' });
    }

    console.log('Registros a actualizar:', valores);

    // Construir la consulta masiva
    const query = `
        INSERT INTO compras (id, numero_compra)
        VALUES ?
        ON DUPLICATE KEY UPDATE numero_compra = VALUES(numero_compra)
    `;

    // Ejecutar la consulta masiva
    pool.query(query, [valores], (err, results) => {
        if (err) {
            console.error('Error en la actualización masiva:', err);
            return res.status(500).json({ error: 'Hubo un error al actualizar los números de compra.' });
        }

        console.log('Actualización exitosa. Filas afectadas:', results.affectedRows);
        res.status(200).json({
            message: 'Números de compra actualizados exitosamente.',
            actualizados: results.affectedRows,
        });
    });
});














// filtra por fecha

app.get('/api/compras/filtrar-por-fecha', (req, res) => {
    const { fecha_envio } = req.query;

    if (!fecha_envio) {
        return res.status(400).json({ error: 'La fecha de envío es obligatoria para filtrar.' });
    }

    const query = `SELECT * FROM compras WHERE fecha_envio = ?`;

    pool.query(query, [fecha_envio], (err, results) => {
        if (err) {
            console.error('Error al filtrar compras por fecha:', err);
            return res.status(500).json({ error: 'Error interno del servidor.' });
        }

        res.status(200).json(results);
    });
});


// filtra por n compras
app.get('/api/compras/filtrar-por-numero', (req, res) => {
    console.log('Request recibida en /api/compras/filtrar-por-numero');
    const { numero_compra } = req.query;

    if (!numero_compra) {
        console.log('Número de compra no proporcionado');
        return res.status(400).json({ error: 'El número de compra es obligatorio para filtrar.' });
    }

    const query = 'SELECT * FROM compras WHERE numero_compra = ?';
    pool.query(query, [numero_compra], (err, results) => {
        if (err) {
            console.error('Error al filtrar compras por número de compra:', err);
            return res.status(500).json({ error: 'Error interno del servidor.' });
        }

        console.log('Resultados encontrados:', results);
        res.status(200).json(results);
    });
});







// Manejo global de errores en conexiones
pool.on('error', (err) => {
    console.error('Error en el pool de conexiones:', err);
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
        console.log('Reconexión automática al pool...');
    }
});

// Iniciar el servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});
