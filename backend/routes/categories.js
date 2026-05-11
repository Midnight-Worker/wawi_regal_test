const express = require("express");
const db = require("../db");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const categories = await db.query(`
      SELECT
        id,
        name,
        description,
        created_at,
        updated_at
      FROM categories
      ORDER BY name
    `);

    res.json({
      ok: true,
      categories
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: error.message
    });
  }
});

router.post("/", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const description = String(req.body.description || "").trim() || null;

    if (!name) {
      res.status(400).json({
        ok: false,
        message: "Name fehlt"
      });
      return;
    }

    const result = await db.query(
      `
      INSERT INTO categories
      (name, description)
      VALUES (?, ?)
      `,
      [name, description]
    );

    const category = await db.getOne(
      `
      SELECT
        id,
        name,
        description,
        created_at,
        updated_at
      FROM categories
      WHERE id = ?
      `,
      [result.insertId]
    );

    res.json({
      ok: true,
      message: "Kategorie angelegt",
      category
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: error.message
    });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const name = String(req.body.name || "").trim();
    const description = String(req.body.description || "").trim() || null;

    if (!id) {
      res.status(400).json({
        ok: false,
        message: "Ungueltige Kategorie-ID"
      });
      return;
    }

    if (!name) {
      res.status(400).json({
        ok: false,
        message: "Name fehlt"
      });
      return;
    }

    await db.query(
      `
      UPDATE categories
      SET name = ?, description = ?
      WHERE id = ?
      `,
      [name, description, id]
    );

    const category = await db.getOne(
      `
      SELECT
        id,
        name,
        description,
        created_at,
        updated_at
      FROM categories
      WHERE id = ?
      `,
      [id]
    );

    res.json({
      ok: true,
      message: "Kategorie gespeichert",
      category
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: error.message
    });
  }
});

module.exports = router;
