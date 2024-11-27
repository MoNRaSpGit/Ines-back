const express = require('express');
const cors = require('cors');
const mysql = require('mysql');
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

// Conexión a la base de datos
const db = mysql.createConnection({
    host: 'bl7zutikwjblgxjdv8w4-mysql.services.clever-cloud.com',
    user: 'u1k0ig8cpdifi91b',
    password: 'LqSNfS6SoLsP3T2RdoM3',
    database: 'bl7zutikwjblgxjdv8w4',
});

db.connect((err) => {
    if (err) {
        console.error('Error conectando a la base de datos:', err.message);
        return;
    }
    console.log('Conectado a la base de datos');
});


// -------------------------------0 ----------------------
// Aquí van los endpoints

app.post('/api/prueba', (req, res) => {
    const receivedData = req.body;

    console.log('Datos recibidos en el servidor:', receivedData);

    res.status(200).json({
        message: 'Datos recibidos correctamente',
        receivedData: receivedData,
    });
});

// Endpoint para guardar datos en la tabla purchases
app.post('/api/purchases', (req, res) => {
    const receivedData = req.body;

    if (!Array.isArray(receivedData) || receivedData.length === 0) {
        return res.status(400).json({ error: 'No se enviaron datos o el formato es incorrecto.' });
    }

    const insertOrUpdatePromises = receivedData.map((data) => {
        const {
            purchase_number,
            product_name,
            quantity_requested,
            quantity_delivered,
            pending_delivery,
            unit,
            shipping_date,
            arrival_date,
        } = data;

        if (!purchase_number || !product_name || !quantity_requested || !shipping_date) {
            console.error('Faltan datos obligatorios en un registro:', {
                purchase_number,
                product_name,
                quantity_requested,
                shipping_date,
            });
            throw new Error('Faltan datos obligatorios en un registro.');
        }

        return new Promise((resolve, reject) => {
            // Verificar si ya existe un registro con el mismo purchase_number y product_name
            const checkQuery = `
                SELECT id FROM purchases 
                WHERE purchase_number = ? AND product_name = ?
            `;
            const checkValues = [purchase_number, product_name];

            db.query(checkQuery, checkValues, (err, results) => {
                if (err) {
                    console.error('Error ejecutando el SELECT:', err);
                    return reject(err);
                }

                if (results.length > 0) {
                    // Si existe, realizar un UPDATE
                    const updateQuery = `
                        UPDATE purchases 
                        SET 
                            quantity_requested = ?,
                            quantity_delivered = ?,
                            pending_delivery = ?,
                            unit = ?,
                            shipping_date = ?,
                            arrival_date = ?
                        WHERE 
                            purchase_number = ? AND product_name = ?
                    `;
                    const updateValues = [
                        quantity_requested,
                        quantity_delivered || 0,
                        pending_delivery || 0,
                        unit || null,
                        shipping_date,
                        arrival_date || null,
                        purchase_number,
                        product_name,
                    ];

                    db.query(updateQuery, updateValues, (err, result) => {
                        if (err) {
                            console.error('Error ejecutando el UPDATE:', err);
                            return reject(err);
                        }
                        console.log('Registro actualizado exitosamente:', { id: results[0].id });
                        resolve({
                            id: results[0].id,
                            purchase_number,
                            product_name,
                            quantity_requested,
                            quantity_delivered: quantity_delivered || 0,
                            pending_delivery: pending_delivery || 0,
                            unit: unit || null,
                            shipping_date,
                            arrival_date: arrival_date || null,
                            updated_at: new Date(), // Fecha actual para simular un campo actualizado
                        });
                    });
                } else {
                    // Si no existe, realizar un INSERT
                    const insertQuery = `
                        INSERT INTO purchases 
                        (purchase_number, product_name, quantity_requested, quantity_delivered, pending_delivery, unit, shipping_date, arrival_date)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    `;
                    const insertValues = [
                        purchase_number,
                        product_name,
                        quantity_requested,
                        quantity_delivered || 0,
                        pending_delivery || 0,
                        unit || null,
                        shipping_date,
                        arrival_date || null,
                    ];

                    db.query(insertQuery, insertValues, (err, result) => {
                        if (err) {
                            console.error('Error ejecutando el INSERT:', err);
                            return reject(err);
                        }
                        console.log('Datos insertados exitosamente:', { id: result.insertId });
                        resolve({
                            id: result.insertId,
                            purchase_number,
                            product_name,
                            quantity_requested,
                            quantity_delivered: quantity_delivered || 0,
                            pending_delivery: pending_delivery || 0,
                            unit: unit || null,
                            shipping_date,
                            arrival_date: arrival_date || null,
                            created_at: new Date(), // Fecha actual para simular un campo creado
                        });
                    });
                }
            });
        });
    });

    Promise.all(insertOrUpdatePromises)
        .then((processedProducts) => {
            res.status(201).json({ message: 'Todos los datos fueron procesados exitosamente.', processedProducts });
        })
        .catch((error) => {
            console.error('Error procesando los datos:', error.message);
            res.status(500).json({ error: 'Ocurrió un error al procesar los datos.' });
        });
});




// Endpoint para obtener todos los registros de la tabla purchases
app.get('/api/purchases', (req, res) => {
    const query = 'SELECT * FROM purchases';

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error ejecutando el SELECT:', err);
            return res.status(500).json({ error: 'Error al obtener los datos de la tabla purchases.' });
        }

        res.status(200).json(results);
    });
});

// Endpoint para filtrar registros de purchases
app.get('/api/purchases/filter', (req, res) => {
    const { shipping_date, purchase_number } = req.query;

    let query = 'SELECT * FROM purchases WHERE 1=1';
    const queryParams = [];

    if (shipping_date) {
        query += ' AND shipping_date = ?';
        queryParams.push(shipping_date);
    }

    if (purchase_number) {
        query += ' AND purchase_number = ?';
        queryParams.push(purchase_number);
    }

    db.query(query, queryParams, (err, results) => {
        if (err) {
            console.error('Error ejecutando el SELECT con filtros:', err);
            return res.status(500).json({ error: 'Error al filtrar los datos de la tabla purchases.' });
        }

        res.status(200).json(results);
    });
});

// Edita purchase_number
app.put('/api/products/:id', (req, res) => {
    const { id } = req.params;
    const { purchase_number } = req.body;

    if (!purchase_number) {
        return res.status(400).json({ error: 'El número de compra es obligatorio.' });
    }

    const query = `
        UPDATE purchases 
        SET purchase_number = ? 
        WHERE id = ?
    `;

    db.query(query, [purchase_number, id], (err, result) => {
        if (err) {
            console.error('Error ejecutando el UPDATE:', err);
            return res.status(500).json({ error: 'Error al actualizar el número de compra.' });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Producto no encontrado.' });
        }

        res.status(200).json({ message: 'Número de compra actualizado exitosamente.' });
    });
});

// Endpoint para obtener productos sin purchase_number
app.get('/api/products/no-assigned', (req, res) => {
    const query = `
        SELECT * 
        FROM purchases 
        WHERE purchase_number = 'No asignado'
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error('Error ejecutando el SELECT:', err);
            return res.status(500).json({ error: 'Error al obtener los productos sin número asignado.' });
        }

        res.status(200).json(results);
    });
});

// Endpoint para registrar un usuario
app.post(
    '/api/register',
    [
        body('username').isLength({ min: 3 }).withMessage('El nombre de usuario debe tener al menos 3 caracteres'),
        body('email').isEmail().withMessage('Debe proporcionar un correo electrónico válido'),
        body('password').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres'),
        body('role').optional().isIn(['admin', 'common']).withMessage('El rol debe ser "admin" o "common"'),
    ],
    (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { username, email, password, role = 'common' } = req.body;

        const query = `
            INSERT INTO users (username, email, password, role)
            VALUES (?, ?, ?, ?)
        `;

        db.query(query, [username, email, password, role], (err, result) => {
            if (err) {
                console.error('Error ejecutando el INSERT:', err);
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(400).json({ error: 'El correo electrónico ya está registrado.' });
                }
                return res.status(500).json({ error: 'Error al registrar el usuario.' });
            }

            res.status(201).json({
                message: 'Usuario registrado exitosamente',
                userId: result.insertId,
            });
        });
    }
);

// Endpoint de autenticación
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'El nombre de usuario y la contraseña son obligatorios.' });
    }

    const query = `SELECT * FROM users WHERE username = ? LIMIT 1`;

    db.query(query, [username], (err, results) => {
        if (err) {
            console.error('Error consultando la base de datos:', err);
            return res.status(500).json({ error: 'Error interno del servidor.' });
        }

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
    });
});

// Endpoint para actualizar la cantidad entregada y la fecha de llegada
app.put('/api/purchases/:id', (req, res) => {
    const { id } = req.params;
    const { quantity_delivered, arrival_date } = req.body;

    if (!quantity_delivered || !arrival_date) {
        return res.status(400).json({ error: 'Faltan datos obligatorios: cantidad entregada y fecha de llegada.' });
    }

    const today = new Date().toISOString().split('T')[0]; // Fecha actual en formato YYYY-MM-DD

    if (arrival_date < today) {
        return res.status(400).json({ error: 'La fecha de llegada no puede ser anterior a la fecha actual.' });
    }

    const query = `
        UPDATE purchases
        SET 
            quantity_delivered = quantity_delivered + ?, 
            pending_delivery = pending_delivery - ?, 
            arrival_date = ?
        WHERE id = ? AND pending_delivery >= ?
    `;

    const values = [quantity_delivered, quantity_delivered, arrival_date, id, quantity_delivered];

    db.query(query, values, (err, result) => {
        if (err) {
            console.error('Error ejecutando el UPDATE:', err);
            return res.status(500).json({ error: 'Error al actualizar los datos.' });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Registro no encontrado o cantidad inválida.' });
        }
        res.status(200).json({ message: 'Datos actualizados exitosamente', id });
    });
});



const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});
