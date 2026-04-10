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
    // Tabla de unidades de medida
    await client.query(`
      CREATE TABLE IF NOT EXISTS unit_types (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) NOT NULL,
        abreviation VARCHAR(10) NOT NULL
      )
    `);
    
    // Tabla de familias/categorías
    await client.query(`
      CREATE TABLE IF NOT EXISTS families (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT
      )
    `);
    
    // Tabla de productos mejorada
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        sku VARCHAR(50) UNIQUE,
        barcode VARCHAR(50),
        description TEXT,
        price DECIMAL(10,2) NOT NULL,
        cost DECIMAL(10,2),
        stock INTEGER NOT NULL DEFAULT 0,
        min_stock INTEGER DEFAULT 5,
        category VARCHAR(100),
        family_id INTEGER REFERENCES families(id),
        unit_type_id INTEGER REFERENCES unit_types(id),
        status VARCHAR(20) DEFAULT 'active',
        image_url TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Insertar unidades por defecto
    const unitsExist = await client.query('SELECT COUNT(*) FROM unit_types');
    if (parseInt(unitsExist.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO unit_types (name, abreviation) VALUES 
        ('Pieza', 'pza'),
        ('Kilogramo', 'kg'),
        ('Gramo', 'g'),
        ('Litro', 'L'),
        ('Mililitro', 'mL'),
        ('Caja', 'caja'),
        ('Paquete', 'pqt'),
        ('Bolsa', 'bolsa'),
        ('Metro', 'm'),
        ('Centímetro', 'cm')
      `);
    }
    
    // Insertar familias por defecto
    const familiesExist = await client.query('SELECT COUNT(*) FROM families');
    if (parseInt(familiesExist.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO families (name, description) VALUES 
        ('Bebidas', 'Bebidas frías y calientes'),
        ('Snacks', 'Botanas y frituras'),
        ('Panadería', 'Pan y productos de horno'),
        ('Lácteos', 'Leche, queso y derivados'),
        ('Huevos', 'Huevos de gallina'),
        ('Abarrotes', 'Productos de tienda básica'),
        ('Limpieza', 'Productos de limpieza'),
        ('Personal', 'Cuidado personal')
      `);
    }
    
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
    const result = await pool.query(`
      SELECT p.*, f.name as family_name, u.name as unit_name, u.abreviation as unit_abrev
      FROM products p
      LEFT JOIN families f ON p.family_id = f.id
      LEFT JOIN unit_types u ON p.unit_type_id = u.id
      ORDER BY p.id
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const { 
      name, sku, barcode, description, price, cost, stock, min_stock,
      category, family_id, unit_type_id, status, image_url 
    } = req.body;
    const result = await pool.query(`
      INSERT INTO products (name, sku, barcode, description, price, cost, stock, min_stock, category, family_id, unit_type_id, status, image_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *
    `, [name, sku, barcode, description, price, cost, stock, min_stock, category, family_id, unit_type_id, status || 'active', image_url]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      name, sku, barcode, description, price, cost, stock, min_stock,
      category, family_id, unit_type_id, status, image_url 
    } = req.body;
    const result = await pool.query(`
      UPDATE products SET name=$1, sku=$2, barcode=$3, description=$4, price=$5, cost=$6, stock=$7, min_stock=$8, category=$9, family_id=$10, unit_type_id=$11, status=$12, image_url=$13, updated_at=NOW()
      WHERE id=$14 RETURNING *
    `, [name, sku, barcode, description, price, cost, stock, min_stock, category, family_id, unit_type_id, status, image_url, id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Unit Types endpoints
app.get('/api/unit-types', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM unit_types ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/unit-types', async (req, res) => {
  try {
    const { name, abreviation } = req.body;
    const result = await pool.query('INSERT INTO unit_types (name, abreviation) VALUES ($1, $2) RETURNING *', [name, abreviation]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Families endpoints
app.get('/api/families', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM families ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/families', async (req, res) => {
  try {
    const { name, description } = req.body;
    const result = await pool.query('INSERT INTO families (name, description) VALUES ($1, $2) RETURNING *', [name, description]);
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