const express = require('express');
const cors = require('cors');
const db = require('./db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// --- ROUTES ---

// GET All Items (Combined Dashboard)
app.get('/api/items', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM production_items ORDER BY created_at DESC LIMIT 1000');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// POST New Item (From Operator)
app.post('/api/items', async (req, res) => {
    const { id, barcode, date, productName, productNameEn, serialNumber, weight, status } = req.body;

    // Use upsert logic to avoid duplicates
    const query = `
    INSERT INTO production_items (uid, barcode, date, product_name, product_name_en, serial_number, weight, status, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    ON CONFLICT (uid) DO NOTHING
    RETURNING *;
  `;
    const values = [id, barcode, date, productName, productNameEn, serialNumber, weight, status || 'created'];

    try {
        const result = await db.query(query, values);
        if (result.rows.length > 0) {
            res.status(201).json(result.rows[0]);
        } else {
            res.status(200).json({ message: 'Item already exists' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});

// PATCH Item (Grading / Palletizing)
app.patch('/api/items/:id', async (req, res) => {
    const { id } = req.params;
    const { status, sort, labUserId, batchId } = req.body;

    let query = '';
    let values = [];

    if (status === 'graded') {
        query = `
      UPDATE production_items 
      SET status = $1, sort = $2, graded_at = NOW(), lab_user_id = $3
      WHERE uid = $4
      RETURNING *;
    `;
        values = [status, sort, labUserId, id];
    } else if (status === 'palletized') {
        query = `
      UPDATE production_items 
      SET status = $1, batch_id = $2, palletized_at = NOW()
      WHERE uid = $3
      RETURNING *;
    `;
        values = [status, batchId, id];
    } else {
        return res.status(400).json({ error: 'Invalid status update' });
    }

    try {
        const result = await db.query(query, values);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Item not found' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database update error' });
    }
});

// GET Pending Items (Lab Filter)
app.get('/api/items/pending', async (req, res) => {
    try {
        // Return formatted for Lab (snake_case to camelCase conversion done in frontend or here)
        // We'll keep DB snake_case for now and frontend adapter handles it, 
        // OR we can alias here:
        const query = `
      SELECT 
       uid as id, barcode, date, product_name as "productName", 
       product_name_en as "productNameEn", serial_number as "serialNumber", 
       weight, status, sort, created_at as "createdAt"
      FROM production_items 
      WHERE status = 'created'
      ORDER BY serial_number DESC
    `;
        const result = await db.query(query);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error' });
    }
});


app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
