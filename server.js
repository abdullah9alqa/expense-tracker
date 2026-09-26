require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;

const ALLOWED_CATEGORIES = ["Food", "Transport", "Bills", "Entertainment", "Other"];

// ---- Middleware ----
app.use(cors());       
app.use(express.json());

// ---- Database connection pool ----
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});


const SELECT_COLUMNS = `
  id,
  title,
  amount::float AS amount,
  category,
  to_char(date, 'YYYY-MM-DD') AS date
`;

function validateExpense(body, isUpdate = false) {
  const errors = [];
  const { title, amount, category, date } = body;

  // title
  if (!isUpdate || title !== undefined) {
    if (typeof title !== "string" || title.trim().length === 0) {
      errors.push("title is required and must be a non-empty string.");
    }
  }

  // amount
  if (!isUpdate || amount !== undefined) {
    const numericAmount = Number(amount);
    if (amount === undefined || amount === null || isNaN(numericAmount) || numericAmount <= 0) {
      errors.push("amount is required and must be a number greater than 0.");
    }
  }

  // category
  if (!isUpdate || category !== undefined) {
    if (!ALLOWED_CATEGORIES.includes(category)) {
      errors.push(`category is required and must be one of: ${ALLOWED_CATEGORIES.join(", ")}.`);
    }
  }

  // date
  if (!isUpdate || date !== undefined) {
    const parsedDate = new Date(date);
    if (!date || isNaN(parsedDate.getTime())) {
      errors.push("date is required and must be a valid date (YYYY-MM-DD).");
    }
  }

  return errors;
}

function isValidId(id) {
  return Number.isInteger(Number(id)) && Number(id) > 0;
}

// GET /api/expenses - return all expenses
app.get("/api/expenses", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ${SELECT_COLUMNS} FROM expenses ORDER BY date DESC, id DESC`
    );
    res.status(200).json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Something went wrong on the server." });
  }
});

// GET /api/expenses/:id - return one expense
app.get("/api/expenses/:id", async (req, res) => {
  const { id } = req.params;

  if (!isValidId(id)) {
    return res.status(404).json({ message: `Expense with id ${id} not found.` });
  }

  try {
    const result = await pool.query(
      `SELECT ${SELECT_COLUMNS} FROM expenses WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: `Expense with id ${id} not found.` });
    }

    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Something went wrong on the server." });
  }
});

// POST /api/expenses - add a new expense
app.post("/api/expenses", async (req, res) => {
  const errors = validateExpense(req.body, false);
  if (errors.length > 0) {
    return res.status(400).json({ message: errors.join(" ") });
  }

  const { title, amount, category, date } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO expenses (title, amount, category, date)
       VALUES ($1, $2, $3, $4)
       RETURNING ${SELECT_COLUMNS}`,
      [title.trim(), amount, category, date]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Something went wrong on the server." });
  }
});

// PUT /api/expenses/:id - update an expense
app.put("/api/expenses/:id", async (req, res) => {
  const { id } = req.params;

  if (!isValidId(id)) {
    return res.status(404).json({ message: `Expense with id ${id} not found.` });
  }

  const errors = validateExpense(req.body, false); 
  if (errors.length > 0) {
    return res.status(400).json({ message: errors.join(" ") });
  }

  const { title, amount, category, date } = req.body;

  try {
    const result = await pool.query(
      `UPDATE expenses
       SET title = $1, amount = $2, category = $3, date = $4
       WHERE id = $5
       RETURNING ${SELECT_COLUMNS}`,
      [title.trim(), amount, category, date, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: `Expense with id ${id} not found.` });
    }

    res.status(200).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Something went wrong on the server." });
  }
});

// DELETE /api/expenses/:id - delete an expense
app.delete("/api/expenses/:id", async (req, res) => {
  const { id } = req.params;

  if (!isValidId(id)) {
    return res.status(404).json({ message: `Expense with id ${id} not found.` });
  }

  try {
    const result = await pool.query(
      `DELETE FROM expenses WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: `Expense with id ${id} not found.` });
    }

    res.status(200).json({ message: `Expense with id ${id} deleted.`, id: result.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Something went wrong on the server." });
  }
});

// ---- Start the server ----
app.listen(PORT, () => {
  console.log(`Expense Tracker API running on http://localhost:${PORT}`);
});
