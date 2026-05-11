const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

const db = require("../db");
const ledController = require("../serial/ledController");

const router = express.Router();

const uploadDir = path.join(__dirname, "..", "uploads", "articles");

fs.mkdirSync(uploadDir, {
  recursive: true
});

const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    callback(null, uploadDir);
  },
  filename: (req, file, callback) => {
    const articleId = req.params.id || "new";
    const timestamp = Date.now();
    const extension = path.extname(file.originalname || "").toLowerCase() || ".jpg";

    callback(null, `${articleId}-${timestamp}${extension}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 8 * 1024 * 1024
  }
});

function normalizeArticleInput(body) {
  return {
    name: String(body.name || "").trim(),
    ean: String(body.ean || "").trim() || null,
    quantity: Number(body.quantity || 0),
    description: String(body.description || "").trim() || null,
    shelf_position: Number(body.shelf_position),
    category_id: body.category_id ? Number(body.category_id) : null,
    green_from: Number(body.green_from || 100),
    yellow_from: Number(body.yellow_from || 20),
    red_below: Number(body.red_below || 5)
  };
}

function validateArticleInput(article) {
  if (!article.name) {
    return "Artikelname fehlt";
  }

  if (!Number.isInteger(article.quantity) || article.quantity < 0) {
    return "Anzahl muss eine positive ganze Zahl oder 0 sein";
  }

  if (
    !Number.isInteger(article.shelf_position) ||
    article.shelf_position < 1 ||
    article.shelf_position > 72
  ) {
    return "Regalplatz muss zwischen 1 und 72 liegen";
  }

  if (!Number.isInteger(article.green_from) || article.green_from < 0) {
    return "green_from ist ungueltig";
  }

  if (!Number.isInteger(article.yellow_from) || article.yellow_from < 0) {
    return "yellow_from ist ungueltig";
  }

  if (!Number.isInteger(article.red_below) || article.red_below < 0) {
    return "red_below ist ungueltig";
  }

  return null;
}

async function getArticleById(id) {
  return await db.getOne(
    `
    SELECT
      a.id,
      a.name,
      a.ean,
      a.quantity,
      a.description,
      a.image_path,
      a.shelf_position,
      a.category_id,
      c.name AS category_name,
      a.green_from,
      a.yellow_from,
      a.red_below,
      a.is_active,
      a.created_at,
      a.updated_at
    FROM articles a
    LEFT JOIN categories c ON c.id = a.category_id
    WHERE a.id = ?
    `,
    [id]
  );
}

router.get("/", async (req, res) => {
  try {
    const search = String(req.query.search || "").trim();
    const categoryId = req.query.category_id ? Number(req.query.category_id) : null;
    const shelfPosition = req.query.shelf_position
      ? Number(req.query.shelf_position)
      : null;

    const params = [];
    const where = ["a.is_active = TRUE"];

    if (search) {
      where.push(`
        (
          a.name LIKE ?
          OR a.ean LIKE ?
          OR a.description LIKE ?
          OR c.name LIKE ?
        )
      `);

      const like = `%${search}%`;
      params.push(like, like, like, like);
    }

    if (categoryId) {
      where.push("a.category_id = ?");
      params.push(categoryId);
    }

    if (shelfPosition) {
      where.push("a.shelf_position = ?");
      params.push(shelfPosition);
    }

    const articles = await db.query(
      `
      SELECT
        a.id,
        a.name,
        a.ean,
        a.quantity,
        a.description,
        a.image_path,
        a.shelf_position,
        a.category_id,
        c.name AS category_name,
        a.green_from,
        a.yellow_from,
        a.red_below,
        CASE
          WHEN a.quantity < a.red_below THEN 'r'
          WHEN a.quantity < a.yellow_from THEN 'y'
          WHEN a.quantity >= a.green_from THEN 'g'
          ELSE 'y'
        END AS stock_color,
        a.created_at,
        a.updated_at
      FROM articles a
      LEFT JOIN categories c ON c.id = a.category_id
      WHERE ${where.join(" AND ")}
      ORDER BY a.shelf_position, a.name
      `,
      params
    );

    res.json({
      ok: true,
      articles
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: error.message
    });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const article = await getArticleById(id);

    if (!article) {
      res.status(404).json({
        ok: false,
        message: "Artikel nicht gefunden"
      });
      return;
    }

    article.stock_color = ledController.getStockColor(article);

    res.json({
      ok: true,
      article
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
    const article = normalizeArticleInput(req.body);
    const validationError = validateArticleInput(article);

    if (validationError) {
      res.status(400).json({
        ok: false,
        message: validationError
      });
      return;
    }

    const result = await db.query(
      `
      INSERT INTO articles
      (
        name,
        ean,
        quantity,
        description,
        shelf_position,
        category_id,
        green_from,
        yellow_from,
        red_below
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        article.name,
        article.ean,
        article.quantity,
        article.description,
        article.shelf_position,
        article.category_id,
        article.green_from,
        article.yellow_from,
        article.red_below
      ]
    );

    const createdArticle = await getArticleById(result.insertId);
    createdArticle.stock_color = ledController.getStockColor(createdArticle);

    res.json({
      ok: true,
      message: "Artikel angelegt",
      article: createdArticle
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
    const article = normalizeArticleInput(req.body);
    const validationError = validateArticleInput(article);

    if (validationError) {
      res.status(400).json({
        ok: false,
        message: validationError
      });
      return;
    }

    const oldArticle = await getArticleById(id);

    if (!oldArticle) {
      res.status(404).json({
        ok: false,
        message: "Artikel nicht gefunden"
      });
      return;
    }

    await db.query(
      `
      UPDATE articles
      SET
        name = ?,
        ean = ?,
        quantity = ?,
        description = ?,
        shelf_position = ?,
        category_id = ?,
        green_from = ?,
        yellow_from = ?,
        red_below = ?
      WHERE id = ?
      `,
      [
        article.name,
        article.ean,
        article.quantity,
        article.description,
        article.shelf_position,
        article.category_id,
        article.green_from,
        article.yellow_from,
        article.red_below,
        id
      ]
    );

    const updatedArticle = await getArticleById(id);
    updatedArticle.stock_color = ledController.getStockColor(updatedArticle);

    res.json({
      ok: true,
      message: "Artikel gespeichert",
      article: updatedArticle
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: error.message
    });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    await db.query(
      `
      UPDATE articles
      SET is_active = FALSE
      WHERE id = ?
      `,
      [id]
    );

    res.json({
      ok: true,
      message: "Artikel deaktiviert"
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: error.message
    });
  }
});

router.post("/:id/light", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const article = await getArticleById(id);

    if (!article) {
      res.status(404).json({
        ok: false,
        message: "Artikel nicht gefunden"
      });
      return;
    }

    const color = ledController.getStockColor(article);

    const ledResult = await ledController.setLed(article.shelf_position, color);

    res.json({
      ok: ledResult.ok,
      message: ledResult.ok
        ? `Fach ${article.shelf_position} leuchtet fuer ${article.name}`
        : ledResult.message,
      article,
      led: {
        shelf_position: article.shelf_position,
        color,
        result: ledResult
      }
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: error.message
    });
  }
});

router.post("/:id/quantity", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const quantity = Number(req.body.quantity);

    if (!Number.isInteger(quantity) || quantity < 0) {
      res.status(400).json({
        ok: false,
        message: "Anzahl muss eine positive ganze Zahl oder 0 sein"
      });
      return;
    }

    const article = await getArticleById(id);

    if (!article) {
      res.status(404).json({
        ok: false,
        message: "Artikel nicht gefunden"
      });
      return;
    }

    await db.query(
      `
      UPDATE articles
      SET quantity = ?
      WHERE id = ?
      `,
      [quantity, id]
    );

    const updatedArticle = await getArticleById(id);
    updatedArticle.stock_color = ledController.getStockColor(updatedArticle);

    res.json({
      ok: true,
      message: "Anzahl gespeichert",
      article: updatedArticle
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: error.message
    });
  }
});

router.post("/:id/image", upload.single("image"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const article = await getArticleById(id);

    if (!article) {
      res.status(404).json({
        ok: false,
        message: "Artikel nicht gefunden"
      });
      return;
    }

    if (!req.file) {
      res.status(400).json({
        ok: false,
        message: "Keine Bilddatei empfangen"
      });
      return;
    }

    const imagePath = `/uploads/articles/${req.file.filename}`;

    await db.query(
      `
      UPDATE articles
      SET image_path = ?
      WHERE id = ?
      `,
      [imagePath, id]
    );

    const updatedArticle = await getArticleById(id);
    updatedArticle.stock_color = ledController.getStockColor(updatedArticle);

    res.json({
      ok: true,
      message: "Bild gespeichert",
      article: updatedArticle
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: error.message
    });
  }
});

module.exports = router;
