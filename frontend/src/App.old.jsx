import { useEffect, useState } from "react";
import "./style.css";

const colorButtons = [
  { key: "r", label: "Rot", className: "red" },
  { key: "g", label: "Grün", className: "green" },
  { key: "b", label: "Blau", className: "blue" },
  { key: "w", label: "Weiß", className: "white" },
  { key: "t", label: "Türkis", className: "turquoise" },
  { key: "y", label: "Gelb", className: "yellow" },
  { key: "o", label: "Aus", className: "off" }
];

const colorClassMap = {
  r: "red",
  g: "green",
  b: "blue",
  w: "white",
  t: "turquoise",
  y: "yellow",
  o: "off"
};

function App() {
  const [ports, setPorts] = useState([]);
  const [selectedPort, setSelectedPort] = useState("/dev/ttyUSB0");
  const [baudrate, setBaudrate] = useState(115200);
  const [connected, setConnected] = useState(false);

  const [selectedLed, setSelectedLed] = useState(1);
  const [rawCommand, setRawCommand] = useState("");
  const [logs, setLogs] = useState([]);
  const [ledColors, setLedColors] = useState(() => {
    const initial = {};
    for (let i = 1; i <= 72; i++) {
      initial[i] = "o";
    }
    return initial;
  });

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

  function addLog(message) {
    const time = new Date().toLocaleTimeString();

    setLogs((oldLogs) => {
      const nextLogs = [...oldLogs, `[${time}] ${message}`];
      return nextLogs.slice(-120);
    });
  }

  async function loadPorts() {
    try {
      const result = await apiGet("/api/ports");

      if (!result.ok) {
        addLog(result.message || "Ports konnten nicht geladen werden");
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

      addLog("Ports geladen");
    } catch (error) {
      addLog(`Ports konnten nicht geladen werden: ${error.message}`);
    }
  }

  async function refreshStatus() {
    try {
      const result = await apiGet("/api/status");

      setConnected(result.connected);

      if (result.port) {
        setSelectedPort(result.port);
      }

      if (Array.isArray(result.logs)) {
        const arduinoLines = result.logs.map((item) => {
          const time = new Date(item.time).toLocaleTimeString();
          return `[${time}] Arduino: ${item.line}`;
        });

        setLogs((oldLogs) => {
          const merged = [...oldLogs, ...arduinoLines];
          return Array.from(new Set(merged)).slice(-120);
        });
      }
    } catch {
      setConnected(false);
    }
  }

  async function connect() {
    const result = await apiPost("/api/connect", {
      port: selectedPort,
      baudrate
    });

    setConnected(Boolean(result.connected));
    addLog(result.message);
  }

  async function disconnect() {
    const result = await apiPost("/api/disconnect");

    setConnected(false);
    addLog(result.message);
  }

  async function setLed(number, color) {
    const result = await apiPost("/api/led", {
      number,
      color
    });

    addLog(result.message);

    if (result.ok) {
      setLedColors((old) => ({
        ...old,
        [number]: color
      }));
    }
  }

  async function setAll(color) {
    const result = await apiPost("/api/all", {
      color
    });

    addLog(result.message);

    if (result.ok) {
      const next = {};
      for (let i = 1; i <= 72; i++) {
        next[i] = color;
      }
      setLedColors(next);
    }
  }

  async function sendRaw() {
    const command = rawCommand.trim();

    if (!command) {
      addLog("Kein Befehl eingegeben");
      return;
    }

    const result = await apiPost("/api/command", {
      command
    });

    addLog(result.message);

    if (result.ok) {
      updateUiFromCommand(command);
    }
  }

  async function strandtest() {
    const result = await apiPost("/api/strandtest");
    addLog(result.message);
  }

  function updateUiFromCommand(command) {
    const clean = command.trim().toLowerCase();

    if (clean.length === 2 && clean[0] === "a") {
      const color = clean[1];

      if (colorClassMap[color]) {
        const next = {};
        for (let i = 1; i <= 72; i++) {
          next[i] = color;
        }
        setLedColors(next);
      }
    }

    const color = clean[0];
    const number = Number(clean.slice(1));

    if (colorClassMap[color] && number >= 1 && number <= 72) {
      setLedColors((old) => ({
        ...old,
        [number]: color
      }));
    }
  }

  function handleRawKeyDown(event) {
    if (event.key === "Enter") {
      sendRaw();
    }
  }

  useEffect(() => {
    loadPorts();
    refreshStatus();

    const interval = setInterval(refreshStatus, 3000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  return (
    <main className="app">
      <header className="hero">
        <div>
          <h1>Regalbeleuchtung</h1>
          <p>Tablet → Browser → Raspberry Pi → Arduino → WS2812</p>
        </div>

        <div className={connected ? "status connected" : "status"}>
          {connected ? "verbunden" : "nicht verbunden"}
        </div>
      </header>

      <section className="card">
        <h2>Verbindung</h2>

        <div className="row">
          <label>
            Port
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
          </label>

          <label>
            Baudrate
            <input
              type="number"
              value={baudrate}
              onChange={(event) => setBaudrate(Number(event.target.value))}
            />
          </label>

          <button className="primary" onClick={connect}>
            Verbinden
          </button>

          <button onClick={disconnect}>Trennen</button>

          <button onClick={loadPorts}>Ports neu laden</button>
        </div>
      </section>

      <section className="card">
        <h2>Einzelne LED</h2>

        <div className="row">
          <label>
            LED-Nummer
            <input
              type="number"
              min="1"
              max="72"
              value={selectedLed}
              onChange={(event) => setSelectedLed(Number(event.target.value))}
            />
          </label>

          <div className="button-row">
            {colorButtons.map((color) => (
              <button
                key={color.key}
                className={`color ${color.className}`}
                onClick={() => setLed(selectedLed, color.key)}
              >
                {color.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="card">
        <h2>Alle LEDs</h2>

        <div className="button-row">
          {colorButtons.map((color) => (
            <button
              key={color.key}
              className={`color ${color.className}`}
              onClick={() => setAll(color.key)}
            >
              Alle {color.label}
            </button>
          ))}

          <button className="primary" onClick={strandtest}>
            Strandtest
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Direkter Befehl</h2>

        <div className="row">
          <input
            className="raw"
            value={rawCommand}
            placeholder="z. B. r27, ar, ao, s"
            onChange={(event) => setRawCommand(event.target.value)}
            onKeyDown={handleRawKeyDown}
          />

          <button onClick={sendRaw}>Senden</button>
        </div>

        <p className="hint">
          Beispiele: r27, g1, y32, o32, ar, ag, ab, aw, at, ay, ao, s
        </p>
      </section>

      <section className="card">
        <h2>LED-Raster</h2>

        <div className="led-grid">
          {Array.from({ length: 72 }, (_, index) => {
            const number = index + 1;
            const color = ledColors[number] || "o";

            return (
              <button
                key={number}
                className={`led ${colorClassMap[color] || "off"} ${
                  selectedLed === number ? "selected" : ""
                }`}
                onClick={() => setSelectedLed(number)}
              >
                {number}
              </button>
            );
          })}
        </div>
      </section>

      <section className="card">
        <h2>Log</h2>

        <pre className="log">{logs.join("\n")}</pre>
      </section>
    </main>
  );
}

export default App;
