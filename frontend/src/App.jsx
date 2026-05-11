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

function App() {
  const [articles, setArticles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [ledStatus, setLedStatus] = useState({
    connected: false,
    port: "",
    baudrate: 115200,
    logs: []
  });

  const [search, setSearch] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const [ports, setPorts] = useState([]);
  const [selectedPort, setSelectedPort] = useState("/dev/ttyUSB0");
  const [baudrate, setBaudrate] = useState(115200);

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

  function showMessage(text) {
    setMessage(text || "");

    if (text) {
      window.clearTimeout(showMessage.timer);
      showMessage.timer = window.setTimeout(() => {
        setMessage("");
      }, 3500);
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
  }

  async function strandtest() {
    const result = await apiPost("/api/led/strandtest");

    showMessage(result.message);
  }

  async function lightArticle(articleId) {
    const result = await apiPost(`/api/articles/${articleId}/light`);

    showMessage(result.message);

    if (!result.ok) {
      return;
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
    }
  }

  function handleSearchKeyDown(event) {
    if (event.key === "Enter") {
      loadArticles();
    }
  }

  const shelfGroups = useMemo(() => {
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

  useEffect(() => {
    loadCategories();
    loadPorts();
    loadLedStatus();
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
  }, [search, selectedCategoryId]);

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
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={handleSearchKeyDown}
            autoFocus
          />

          <select
            className="category-select"
            value={selectedCategoryId}
            onChange={(event) => setSelectedCategoryId(event.target.value)}
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
        </div>

        <div className="result-info">
          {loading ? "Lade Artikel..." : `${articles.length} Artikel gefunden`}
        </div>
      </section>

      <section className="shelf-overview">
        <h2>Belegte Fächer</h2>

        <div className="shelf-grid">
          {Array.from({ length: 72 }, (_, index) => {
            const shelfNumber = index + 1;
            const shelfArticles = shelfGroups.get(shelfNumber) || [];

            return (
              <button
                key={shelfNumber}
                className={
                  shelfArticles.length > 0
                    ? "shelf-cell filled"
                    : "shelf-cell"
                }
                onClick={() => {
                  setSelectedCategoryId("");
                  setSearch("");
                  window.setTimeout(() => {
                    const element = document.getElementById(
                      `shelf-${shelfNumber}`
                    );

                    if (element) {
                      element.scrollIntoView({
                        behavior: "smooth",
                        block: "start"
                      });
                    }
                  }, 50);
                }}
                title={
                  shelfArticles.length > 0
                    ? shelfArticles.map((item) => item.name).join(", ")
                    : `Fach ${shelfNumber}`
                }
              >
                <span>{shelfNumber}</span>
                {shelfArticles.length > 0 && (
                  <small>{shelfArticles.length}</small>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <section className="article-list">
        {articles.map((article) => (
          <article
            className="article-card"
            key={article.id}
            id={`shelf-${article.shelf_position}`}
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

                <span className="shelf-badge">Fach {article.shelf_position}</span>

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
            <p>Suchbegriff ändern oder Kategorie zurücksetzen.</p>
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
