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
app.use(cors());
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

// Endpoint para guardar o actualizar datos en la tabla purchases
app.post('/api/purchases', (req, res) => {
    const receivedData = req.body;

    if (!Array.isArray(receivedData) || receivedData.length === 0) {
        return res.status(400).json({ error: 'No se enviaron datos o el formato es incorrecto.' });
    }

    const upsertPromises = receivedData.map((data) => {
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

        const checkQuery = `
            SELECT * FROM purchases 
            WHERE purchase_number = ? AND product_name = ?
        `;
        const updateQuery = `
            UPDATE purchases 
            SET quantity_requested = ?, 
                quantity_delivered = ?, 
                pending_delivery = ?, 
                unit = ?, 
                shipping_date = ?, 
                arrival_date = ?
            WHERE purchase_number = ? AND product_name = ?
        `;
        const insertQuery = `
            INSERT INTO purchases 
            (purchase_number, product_name, quantity_requested, quantity_delivered, pending_delivery, unit, shipping_date, arrival_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

        return new Promise((resolve, reject) => {
            // Verificar si el producto ya existe
            db.query(checkQuery, [purchase_number, product_name], (err, results) => {
                if (err) {
                    console.error('Error verificando existencia:', err);
                    return reject(err);
                }

                if (results.length > 0) {
                    // Si ya existe, actualizar el registro
                    db.query(
                        updateQuery,
                        [
                            quantity_requested,
                            quantity_delivered || 0,
                            pending_delivery || 0,
                            unit || null,
                            shipping_date,
                            arrival_date || null,
                            purchase_number,
                            product_name,
                        ],
                        (updateErr, updateResult) => {
                            if (updateErr) {
                                console.error('Error ejecutando el UPDATE:', updateErr);
                                return reject(updateErr);
                            }
                            console.log('Datos actualizados exitosamente:', { purchase_number, product_name });
                            resolve({ message: 'Actualizado', purchase_number, product_name });
                        }
                    );
                } else {
                    // Si no existe, insertar un nuevo registro
                    db.query(
                        insertQuery,
                        [
                            purchase_number,
                            product_name,
                            quantity_requested,
                            quantity_delivered || 0,
                            pending_delivery || 0,
                            unit || null,
                            shipping_date,
                            arrival_date || null,
                        ],
                        (insertErr, insertResult) => {
                            if (insertErr) {
                                console.error('Error ejecutando el INSERT:', insertErr);
                                return reject(insertErr);
                            }
                            console.log('Datos insertados exitosamente:', { id: insertResult.insertId });
                            resolve({ message: 'Insertado', id: insertResult.insertId, purchase_number, product_name });
                        }
                    );
                }
            });
        });
    });

    Promise.all(upsertPromises)
        .then((results) => {
            res.status(200).json({
                message: 'Operación completada exitosamente.',
                results,
            });
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
        query += ' AND DATE(shipping_date) = ?'; // Asegura que compares solo la parte de la fecha.
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


app.post('/api/excel/save', (req, res) => {
    const { classification, code, product_name, unit, quantity, observation_date, observation_place } = req.body;

    // Verificar si el cuerpo de la solicitud tiene todos los campos requeridos
    if (!classification || !code || !product_name || !unit || !quantity) {
        console.error('Error: Falta uno o más campos requeridos en el cuerpo de la solicitud.');
        return res.status(400).json({ error: 'Faltan datos requeridos. Verifica que todos los campos estén presentes.' });
    }

    // Imprimir los datos recibidos para verificar
    console.log('Datos recibidos:', req.body);

    // Crear la consulta SQL
    const query = `
        INSERT INTO TablaExcel (classification, code, product_name, unit, quantity, observation_date, observation_place) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    const queryParams = [classification, code, product_name, unit, quantity, observation_date, observation_place];

    // Ejecutar la consulta
    db.query(query, queryParams, (err, results) => {
        if (err) {
            console.error('Error ejecutando la consulta SQL:', err);
            return res.status(500).json({ error: 'Error al insertar los datos en la tabla TablaExcel.' });
        }

        // Verificar si el registro se insertó correctamente
        if (results.affectedRows > 0) {
            res.status(200).json({
                message: 'Datos guardados exitosamente.',
                id: results.insertId // Esto devuelve el ID del registro recién insertado
            });
        } else {
            res.status(500).json({ error: 'No se pudo insertar el registro.' });
        }
    });
});

// Endpoint para filtrar productos por fecha en la tabla 'TablaExcel'
app.get('/api/excel/filter-by-date', (req, res) => {
    const { observation_date } = req.query;

    // Verificar si se recibió la fecha de observación como parámetro
    if (!observation_date) {
        return res.status(400).json({ error: 'La fecha de observación es requerida para filtrar.' });
    }

    // Crear la consulta SQL para obtener los registros que coincidan con la fecha de observación
    const query = 'SELECT * FROM TablaExcel WHERE observation_date = ?';
    const queryParams = [observation_date];

    db.query(query, queryParams, (err, results) => {
        if (err) {
            console.error('Error ejecutando la consulta de filtrado por fecha:', err);
            return res.status(500).json({ error: 'Error al filtrar los datos por fecha.' });
        }

        // Devolver los resultados como una respuesta JSON
        res.status(200).json(results);
    });
});








const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});
