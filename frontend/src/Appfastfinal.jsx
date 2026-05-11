import { useEffect, useMemo, useState } from "react";
import "./style.css";

const stockColorNames = {
  r: "Rot",
  y: "Gelb",
  g: "Grün",
  o: "Aus"
};

const stockColorClassMap = {
  r: "stock-red",
  y: "stock-yellow",
  g: "stock-green",
  o: "stock-off"
};

const shelfLayout = {
  left: [
    [1, 2, 3, 4, 5, 6],
    [7, 8, 9, 10, 11, 12],
    [13, 14, 15, 16, 17, 18],
    [19, 20, 21, 22, 23, 24],
    [25, 26, 27, 28, 29, 30],
    [31, 32, 33, 34, 35, 36]
  ],
  right: [
    [37, 38, 39, 40, 41, 42],
    [43, 44, 45, 46, 47, 48],
    [49, 50, 51, 52, 53, 54],
    [55, 56, 57, 58, 59, 60],
    [61, 62, 63, 64, 65, 66],
    [67, 68, 69, 70, 71, 72]
  ]
};

const emptyArticleForm = {
  name: "",
  ean: "",
  quantity: 0,
  description: "",
  shelf_position: 1,
  category_id: "",
  green_from: 100,
  yellow_from: 20,
  red_below: 5
};

function App() {
  const [articles, setArticles] = useState([]);
  const [allArticles, setAllArticles] = useState([]);
  const [categories, setCategories] = useState([]);

  const [ledStatus, setLedStatus] = useState({
    connected: false,
    port: "",
    baudrate: 115200,
    logs: []
  });

  const [search, setSearch] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedShelf, setSelectedShelf] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const [ports, setPorts] = useState([]);
  const [selectedPort, setSelectedPort] = useState("/dev/ttyUSB0");
  const [baudrate, setBaudrate] = useState(115200);

  const [showArticleForm, setShowArticleForm] = useState(false);
  const [newArticle, setNewArticle] = useState(emptyArticleForm);
  const [newArticleImage, setNewArticleImage] = useState(null);
  const [savingArticle, setSavingArticle] = useState(false);

  async function apiGet(path) {
    const response = await fetch(path);
    return await response.json();
  }

  async function apiPost(path, body = {}) {
    const response = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    return await response.json();
  }

  async function apiUploadArticleImage(articleId, imageFile) {
    const formData = new FormData();
    formData.append("image", imageFile);

    const response = await fetch(`/api/articles/${articleId}/image`, {
      method: "POST",
      body: formData
    });

    return await response.json();
  }

  function showMessage(text) {
    setMessage(text || "");

    if (text) {
      window.clearTimeout(showMessage.timer);
      showMessage.timer = window.setTimeout(() => {
        setMessage("");
      }, 3500);
    }
  }

  function formatShelfNumber(number) {
    return String(number).padStart(2, "0");
  }

  function updateNewArticleField(field, value) {
    setNewArticle((old) => ({
      ...old,
      [field]: value
    }));
  }

  function resetArticleForm() {
    setNewArticle(emptyArticleForm);
    setNewArticleImage(null);
    setShowArticleForm(false);
  }

  async function saveNewArticle() {
    try {
      setSavingArticle(true);

      if (!newArticle.name.trim()) {
        showMessage("Artikelname fehlt");
        return;
      }

      const createResult = await apiPost("/api/articles", {
        name: newArticle.name,
        ean: newArticle.ean,
        quantity: Number(newArticle.quantity),
        description: newArticle.description,
        shelf_position: Number(newArticle.shelf_position),
        category_id: newArticle.category_id ? Number(newArticle.category_id) : null,
        green_from: Number(newArticle.green_from),
        yellow_from: Number(newArticle.yellow_from),
        red_below: Number(newArticle.red_below)
      });

      if (!createResult.ok) {
        showMessage(createResult.message || "Artikel konnte nicht angelegt werden");
        return;
      }

      let finalMessage = createResult.message || "Artikel angelegt";

      if (newArticleImage && createResult.article?.id) {
        const imageResult = await apiUploadArticleImage(
          createResult.article.id,
          newArticleImage
        );

        if (!imageResult.ok) {
          showMessage(
            `Artikel angelegt, aber Bild konnte nicht gespeichert werden: ${imageResult.message}`
          );
          return;
        }

        finalMessage = "Artikel mit Bild angelegt";
      }

      showMessage(finalMessage);
      resetArticleForm();

      await loadAllArticles();
      await loadArticles();
    } catch (error) {
      showMessage(`Artikel konnte nicht gespeichert werden: ${error.message}`);
    } finally {
      setSavingArticle(false);
    }
  }

  async function loadCategories() {
    try {
      const result = await apiGet("/api/categories");

      if (!result.ok) {
        showMessage(result.message || "Kategorien konnten nicht geladen werden");
        return;
      }

      setCategories(result.categories);
    } catch (error) {
      showMessage(`Kategorien konnten nicht geladen werden: ${error.message}`);
    }
  }

  async function loadAllArticles() {
    try {
      const result = await apiGet("/api/articles");

      if (!result.ok) {
        showMessage(result.message || "Regalübersicht konnte nicht geladen werden");
        return;
      }

      setAllArticles(result.articles);
    } catch (error) {
      showMessage(`Regalübersicht konnte nicht geladen werden: ${error.message}`);
    }
  }

  async function loadArticles() {
    try {
      setLoading(true);

      const params = new URLSearchParams();

      if (search.trim()) {
        params.set("search", search.trim());
      }

      if (selectedCategoryId) {
        params.set("category_id", selectedCategoryId);
      }

      if (selectedShelf) {
        params.set("shelf_position", selectedShelf);
      }

      const query = params.toString();
      const path = query ? `/api/articles?${query}` : "/api/articles";

      const result = await apiGet(path);

      if (!result.ok) {
        showMessage(result.message || "Artikel konnten nicht geladen werden");
        return;
      }

      setArticles(result.articles);
    } catch (error) {
      showMessage(`Artikel konnten nicht geladen werden: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function loadLedStatus() {
    try {
      const result = await apiGet("/api/led/status");
      setLedStatus(result);

      if (result.port) {
        setSelectedPort(result.port);
      }

      if (result.baudrate) {
        setBaudrate(result.baudrate);
      }
    } catch {
      setLedStatus((old) => ({
        ...old,
        connected: false
      }));
    }
  }

  async function loadPorts() {
    try {
      const result = await apiGet("/api/led/ports");

      if (!result.ok) {
        showMessage(result.message || "Ports konnten nicht geladen werden");
        return;
      }

      setPorts(result.ports);

      if (result.ports.length > 0) {
        const preferredPort =
          result.ports.find((port) => port.path.includes("/dev/serial/by-id")) ||
          result.ports.find((port) => port.path === "/dev/ttyUSB0") ||
          result.ports.find((port) => port.path === "/dev/ttyACM0") ||
          result.ports[0];

        setSelectedPort(preferredPort.path);
      }
    } catch (error) {
      showMessage(`Ports konnten nicht geladen werden: ${error.message}`);
    }
  }

  async function connectLed() {
    const result = await apiPost("/api/led/connect", {
      port: selectedPort,
      baudrate
    });

    showMessage(result.message);
    await loadLedStatus();
  }

  async function disconnectLed() {
    const result = await apiPost("/api/led/disconnect");

    showMessage(result.message);
    await loadLedStatus();
  }

  async function allOff() {
    const result = await apiPost("/api/led/all/off");

    showMessage(result.message);
    await loadLedStatus();
  }

  async function strandtest() {
    const result = await apiPost("/api/led/strandtest");

    showMessage(result.message);
    await loadLedStatus();
  }

  async function lightArticle(articleId) {
    await apiPost("/api/led/all/off");

    const result = await apiPost(`/api/articles/${articleId}/light`);

    showMessage(result.message);

    if (!result.ok) {
      return;
    }

    await loadLedStatus();
  }

  async function lightShelfPreview(shelfNumber, color = "w") {
    await apiPost("/api/led/all/off");

    const result = await apiPost("/api/led/single", {
      number: shelfNumber,
      color
    });

    if (result.ok) {
      showMessage(`Fach ${formatShelfNumber(shelfNumber)} markiert`);
    } else {
      showMessage(result.message);
    }

    await loadLedStatus();
  }

  async function setQuantity(article, nextQuantity) {
    const quantity = Math.max(0, Number(nextQuantity));

    const result = await apiPost(`/api/articles/${article.id}/quantity`, {
      quantity
    });

    showMessage(result.message);

    if (result.ok && result.article) {
      setArticles((oldArticles) =>
        oldArticles.map((item) =>
          item.id === article.id ? result.article : item
        )
      );

      setAllArticles((oldArticles) =>
        oldArticles.map((item) =>
          item.id === article.id ? result.article : item
        )
      );
    }
  }

  function handleSearchKeyDown(event) {
    if (event.key === "Enter") {
      loadArticles();
    }
  }

  function clearFilters() {
    setSearch("");
    setSelectedCategoryId("");
    setSelectedShelf("");
  }

  function handleShelfClick(shelfNumber) {
    setSelectedShelf(String(shelfNumber));
    setSearch("");
    setSelectedCategoryId("");
    lightShelfPreview(shelfNumber, "w");
  }

  function getShelfStatusClass(shelfArticles) {
    if (!shelfArticles || shelfArticles.length === 0) {
      return "empty";
    }

    const colors = shelfArticles.map((item) => item.stock_color);

    if (colors.includes("r")) {
      return "danger";
    }

    if (colors.includes("y")) {
      return "warning";
    }

    if (colors.includes("g")) {
      return "good";
    }

    return "filled";
  }

  function getShelfTitle(shelfNumber, shelfArticles, resultArticles) {
    if (!shelfArticles || shelfArticles.length === 0) {
      return `Fach ${formatShelfNumber(shelfNumber)}`;
    }

    const lines = [
      `Fach ${formatShelfNumber(shelfNumber)}`,
      `${shelfArticles.length} Artikel insgesamt`
    ];

    if (resultArticles && resultArticles.length !== shelfArticles.length) {
      lines.push(`${resultArticles.length} Treffer in aktueller Suche`);
    }

    lines.push("");
    lines.push(...shelfArticles.map((item) => `- ${item.name}`));

    return lines.join("\n");
  }

  function renderShelfBlock(title, rows) {
    const hasSearchFilter = Boolean(search.trim() || selectedCategoryId || selectedShelf);

    return (
      <div className="regal-block">
        <div className="regal-title">{title}</div>

        <div className="regal-rows">
          {rows.map((row, rowIndex) => (
            <div className="regal-row" key={`${title}-${rowIndex}`}>
              {row.map((shelfNumber) => {
                const shelfArticles = shelfGroups.get(shelfNumber) || [];
                const resultArticles = resultShelfGroups.get(shelfNumber) || [];
                const statusClass = getShelfStatusClass(shelfArticles);
                const isSelected = String(shelfNumber) === String(selectedShelf);
                const hasResultMatch = hasSearchFilter && resultArticles.length > 0;

                return (
                  <button
                    key={shelfNumber}
                    className={`regal-cell ${statusClass} ${
                      isSelected ? "selected" : ""
                    } ${hasResultMatch ? "has-match" : ""}`}
                    onClick={() => handleShelfClick(shelfNumber)}
                    title={getShelfTitle(shelfNumber, shelfArticles, resultArticles)}
                  >
                    <span className="regal-number">
                      {formatShelfNumber(shelfNumber)}
                    </span>

                    {shelfArticles.length > 0 && (
                      <small
                        className={
                          hasResultMatch ? "regal-count match" : "regal-count"
                        }
                      >
                        {hasResultMatch ? resultArticles.length : shelfArticles.length}
                      </small>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const shelfGroups = useMemo(() => {
    const map = new Map();

    for (const article of allArticles) {
      const key = article.shelf_position;

      if (!map.has(key)) {
        map.set(key, []);
      }

      map.get(key).push(article);
    }

    return map;
  }, [allArticles]);

  const resultShelfGroups = useMemo(() => {
    const map = new Map();

    for (const article of articles) {
      const key = article.shelf_position;

      if (!map.has(key)) {
        map.set(key, []);
      }

      map.get(key).push(article);
    }

    return map;
  }, [articles]);

  const activeFilterText = useMemo(() => {
    const parts = [];

    if (search.trim()) {
      parts.push(`Suche: "${search.trim()}"`);
    }

    if (selectedCategoryId) {
      const category = categories.find(
        (item) => String(item.id) === String(selectedCategoryId)
      );

      parts.push(`Kategorie: ${category ? category.name : selectedCategoryId}`);
    }

    if (selectedShelf) {
      parts.push(`Fach: ${formatShelfNumber(selectedShelf)}`);
    }

    return parts.join(" · ");
  }, [search, selectedCategoryId, selectedShelf, categories]);

  useEffect(() => {
    loadCategories();
    loadPorts();
    loadLedStatus();
    loadAllArticles();
    loadArticles();

    const interval = window.setInterval(() => {
      loadLedStatus();
    }, 3000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      loadArticles();
    }, 300);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [search, selectedCategoryId, selectedShelf]);

  return (
    <main className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">Regalbeleuchtung</p>
          <h1>Lager-Finder</h1>
          <p className="hero-text">
            Artikel suchen, Fach anzeigen, Bestand prüfen.
          </p>
        </div>

        <div className={ledStatus.connected ? "status connected" : "status"}>
          <span className="status-dot" />
          {ledStatus.connected ? "LED verbunden" : "LED nicht verbunden"}
        </div>
      </header>

      {message && <div className="message">{message}</div>}

      <section className="card connection-card">
        <div>
          <h2>LED-Verbindung</h2>
          <p className="muted">
            {ledStatus.port || "Kein Port"} @ {ledStatus.baudrate || baudrate}
          </p>
        </div>

        <div className="connection-controls">
          <select
            value={selectedPort}
            onChange={(event) => setSelectedPort(event.target.value)}
          >
            {ports.length === 0 && (
              <>
                <option value="/dev/ttyUSB0">/dev/ttyUSB0</option>
                <option value="/dev/ttyACM0">/dev/ttyACM0</option>
              </>
            )}

            {ports.map((port) => (
              <option key={port.path} value={port.path}>
                {port.path}
                {port.friendlyName ? ` - ${port.friendlyName}` : ""}
                {port.manufacturer ? ` - ${port.manufacturer}` : ""}
              </option>
            ))}
          </select>

          <input
            className="baudrate-input"
            type="number"
            value={baudrate}
            onChange={(event) => setBaudrate(Number(event.target.value))}
          />

          <button className="primary" onClick={connectLed}>
            Verbinden
          </button>

          <button onClick={disconnectLed}>Trennen</button>

          <button onClick={allOff}>Alle aus</button>

          <button onClick={strandtest}>Test</button>
        </div>
      </section>

      <section className="card search-card">
        <div className="search-line">
          <input
            className="search-input"
            value={search}
            placeholder="Artikel, EAN, Kategorie oder Beschreibung suchen..."
            onChange={(event) => {
              setSearch(event.target.value);
              setSelectedShelf("");
            }}
            onKeyDown={handleSearchKeyDown}
            autoFocus
          />

          <select
            className="category-select"
            value={selectedCategoryId}
            onChange={(event) => {
              setSelectedCategoryId(event.target.value);
              setSelectedShelf("");
            }}
          >
            <option value="">Alle Kategorien</option>

            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>

          <button className="primary" onClick={loadArticles}>
            Suchen
          </button>

          <button
            className="success-button"
            onClick={() => setShowArticleForm((old) => !old)}
          >
            + Neuer Artikel
          </button>
        </div>

        <div className="result-info">
          {loading ? "Lade Artikel..." : `${articles.length} Artikel gefunden`}

          {activeFilterText && (
            <>
              <span className="filter-divider"> · </span>
              <span>{activeFilterText}</span>
              <button className="link-button" onClick={clearFilters}>
                Filter löschen
              </button>
            </>
          )}
        </div>
      </section>

      {showArticleForm && (
        <section className="card article-form-card">
          <div className="section-heading">
            <div>
              <h2>Neuen Artikel erfassen</h2>
              <p className="muted">
                Artikel einpflegen, Fach zuordnen und optional direkt ein Bild
                vom Tablet hochladen.
              </p>
            </div>

            <button onClick={resetArticleForm}>Schließen</button>
          </div>

          <div className="article-form-grid">
            <label>
              Artikelname
              <input
                value={newArticle.name}
                placeholder="z. B. Spax Schrauben 4 x 30 mm"
                onChange={(event) =>
                  updateNewArticleField("name", event.target.value)
                }
              />
            </label>

            <label>
              EAN
              <input
                value={newArticle.ean}
                placeholder="EAN-Nummer"
                onChange={(event) =>
                  updateNewArticleField("ean", event.target.value)
                }
              />
            </label>

            <label>
              Kategorie
              <select
                value={newArticle.category_id}
                onChange={(event) =>
                  updateNewArticleField("category_id", event.target.value)
                }
              >
                <option value="">Keine Kategorie</option>

                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Bestand
              <input
                type="number"
                min="0"
                value={newArticle.quantity}
                onChange={(event) =>
                  updateNewArticleField("quantity", Number(event.target.value))
                }
              />
            </label>

            <label>
              Regalplatz
              <select
                value={newArticle.shelf_position}
                onChange={(event) =>
                  updateNewArticleField(
                    "shelf_position",
                    Number(event.target.value)
                  )
                }
              >
                {Array.from({ length: 72 }, (_, index) => {
                  const shelfNumber = index + 1;

                  return (
                    <option key={shelfNumber} value={shelfNumber}>
                      Fach {formatShelfNumber(shelfNumber)}
                    </option>
                  );
                })}
              </select>
            </label>

            <label>
              Rot unter
              <input
                type="number"
                min="0"
                value={newArticle.red_below}
                onChange={(event) =>
                  updateNewArticleField("red_below", Number(event.target.value))
                }
              />
            </label>

            <label>
              Gelb unter
              <input
                type="number"
                min="0"
                value={newArticle.yellow_from}
                onChange={(event) =>
                  updateNewArticleField(
                    "yellow_from",
                    Number(event.target.value)
                  )
                }
              />
            </label>

            <label>
              Grün ab
              <input
                type="number"
                min="0"
                value={newArticle.green_from}
                onChange={(event) =>
                  updateNewArticleField("green_from", Number(event.target.value))
                }
              />
            </label>
          </div>

          <label className="description-field">
            Beschreibung
            <textarea
              value={newArticle.description}
              placeholder="Kurze Beschreibung, Größe, Material, Besonderheiten..."
              onChange={(event) =>
                updateNewArticleField("description", event.target.value)
              }
            />
          </label>

          <div className="image-upload-row">
            <label className="image-upload-box">
              Bild auswählen oder Foto machen
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(event) =>
                  setNewArticleImage(event.target.files?.[0] || null)
                }
              />

              <span>
                {newArticleImage
                  ? newArticleImage.name
                  : "Noch kein Bild ausgewählt"}
              </span>
            </label>

            {newArticleImage && (
              <div className="image-preview">
                <img
                  src={URL.createObjectURL(newArticleImage)}
                  alt="Vorschau"
                />
              </div>
            )}
          </div>

          <div className="article-form-actions">
            <button
              onClick={() =>
                lightShelfPreview(Number(newArticle.shelf_position), "w")
              }
            >
              Fach {formatShelfNumber(newArticle.shelf_position)} testen
            </button>

            <button
              className="success-button"
              onClick={saveNewArticle}
              disabled={savingArticle}
            >
              {savingArticle ? "Speichere..." : "Artikel speichern"}
            </button>
          </div>
        </section>
      )}

      <section className="shelf-overview">
        <div className="section-heading">
          <div>
            <h2>Regalübersicht</h2>
            <p className="muted">
              Zwei Regalhälften mit je 6 Reihen und 6 Fächern — passend zum
              echten LED-Aufbau.
            </p>
          </div>

          <div className="legend">
            <span className="legend-item">
              <i className="legend-dot good" /> gut
            </span>
            <span className="legend-item">
              <i className="legend-dot warning" /> knapp
            </span>
            <span className="legend-item">
              <i className="legend-dot danger" /> kritisch
            </span>
          </div>
        </div>

        <div className="regal-layout">
          {renderShelfBlock("Linke Regalhälfte · Fach 01–36", shelfLayout.left)}
          {renderShelfBlock("Rechte Regalhälfte · Fach 37–72", shelfLayout.right)}
        </div>

        <p className="regal-help">
          Tippen filtert die Artikelliste nach diesem Fach und schaltet vorher
          alle LEDs aus. Danach leuchtet nur das gewählte Fach weiß.
        </p>
      </section>

      <section className="article-list">
        {articles.map((article) => (
          <article
            className="article-card"
            key={article.id}
            id={`article-${article.id}`}
          >
            <div className="article-image">
              {article.image_path ? (
                <img src={article.image_path} alt={article.name} />
              ) : (
                <span>kein Bild</span>
              )}
            </div>

            <div className="article-content">
              <div className="article-topline">
                <span
                  className={`stock-pill ${
                    stockColorClassMap[article.stock_color] || "stock-off"
                  }`}
                >
                  {stockColorNames[article.stock_color] || "?"}
                </span>

                <span className="shelf-badge">
                  Fach {formatShelfNumber(article.shelf_position)}
                </span>

                {article.category_name && (
                  <span className="category-badge">{article.category_name}</span>
                )}
              </div>

              <h2>{article.name}</h2>

              <p className="description">
                {article.description || "Keine Beschreibung vorhanden."}
              </p>

              <div className="meta-grid">
                <div>
                  <span>EAN</span>
                  <strong>{article.ean || "—"}</strong>
                </div>

                <div>
                  <span>Bestand</span>
                  <strong>{article.quantity}</strong>
                </div>

                <div>
                  <span>Rot unter</span>
                  <strong>{article.red_below}</strong>
                </div>

                <div>
                  <span>Gelb unter</span>
                  <strong>{article.yellow_from}</strong>
                </div>

                <div>
                  <span>Grün ab</span>
                  <strong>{article.green_from}</strong>
                </div>
              </div>

              <div className="article-actions">
                <button
                  className="primary big-action"
                  onClick={() => lightArticle(article.id)}
                >
                  Fach anzeigen
                </button>

                <button
                  onClick={() => setQuantity(article, article.quantity - 1)}
                >
                  -1
                </button>

                <button
                  onClick={() => setQuantity(article, article.quantity + 1)}
                >
                  +1
                </button>

                <input
                  className="quantity-input"
                  type="number"
                  min="0"
                  value={article.quantity}
                  onChange={(event) =>
                    setQuantity(article, Number(event.target.value))
                  }
                />
              </div>
            </div>
          </article>
        ))}

        {!loading && articles.length === 0 && (
          <div className="empty-state">
            <h2>Nichts gefunden</h2>
            <p>Suchbegriff ändern, Kategorie zurücksetzen oder Fachfilter löschen.</p>
          </div>
        )}
      </section>

      <section className="card log-card">
        <h2>Arduino-Log</h2>

        <pre>
          {(ledStatus.logs || [])
            .slice(-20)
            .map((item) => {
              const time = new Date(item.time).toLocaleTimeString();
              return `[${time}] ${item.line}`;
            })
            .join("\n")}
        </pre>
      </section>
    </main>
  );
}

export default App;
