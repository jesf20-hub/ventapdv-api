import express from 'express';
import pg from 'pg';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// Railway proporciona DATABASE_URL automáticamente
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL no configurada');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: connectionString
});

async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        stock INTEGER NOT NULL,
        category VARCHAR(100)
      )
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS clients (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        email VARCHAR(255),
        address TEXT
      )
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS sales (
        id SERIAL PRIMARY KEY,
        date TIMESTAMP DEFAULT NOW(),
        items JSONB NOT NULL,
        total DECIMAL(10,2) NOT NULL,
        client_id INTEGER,
        status VARCHAR(50) DEFAULT 'completed'
      )
    `);
    
    console.log('Tablas creadas exitosamente');
  } catch (err) {
    console.error('Error inicializando DB:', err);
  } finally {
    client.release();
  }
}

app.get('/api/products', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const { name, price, stock, category } = req.body;
    const result = await pool.query(
      'INSERT INTO products (name, price, stock, category) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, price, stock, category]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, price, stock, category } = req.body;
    const result = await pool.query(
      'UPDATE products SET name=$1, price=$2, stock=$3, category=$4 WHERE id=$5 RETURNING *',
      [name, price, stock, category, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM products WHERE id=$1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/clients', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM clients ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/clients', async (req, res) => {
  try {
    const { name, phone, email, address } = req.body;
    const result = await pool.query(
      'INSERT INTO clients (name, phone, email, address) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, phone, email, address]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/clients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, email, address } = req.body;
    const result = await pool.query(
      'UPDATE clients SET name=$1, phone=$2, email=$3, address=$4 WHERE id=$5 RETURNING *',
      [name, phone, email, address, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/clients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM clients WHERE id=$1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/sales', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM sales ORDER BY id DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sales', async (req, res) => {
  try {
    const { items, total, client_id } = req.body;
    const result = await pool.query(
      'INSERT INTO sales (items, total, client_id) VALUES ($1, $2, $3) RETURNING *',
      [JSON.stringify(items), total, client_id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/sync', async (req, res) => {
  try {
    const products = await pool.query('SELECT * FROM products');
    const clients = await pool.query('SELECT * FROM clients');
    const sales = await pool.query('SELECT * FROM sales');
    res.json({
      products: products.rows,
      clients: clients.rows,
      sales: sales.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

await initDB();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server corriendo en puerto ${PORT}`));