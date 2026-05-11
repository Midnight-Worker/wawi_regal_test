const express = require("express");
const cors = require("cors");
const path = require("path");
const { SerialPort } = require("serialport");

const app = express();

const HTTP_PORT = process.env.HTTP_PORT || 3000;
const DEFAULT_SERIAL_PORT = process.env.SERIAL_PORT || "/dev/ttyUSB0";
const DEFAULT_BAUDRATE = Number(process.env.BAUDRATE || 115200);

let serialPort = null;
let currentPortName = DEFAULT_SERIAL_PORT;
let currentBaudrate = DEFAULT_BAUDRATE;
let lastArduinoLines = [];

app.use(cors());
app.use(express.json());

// -------------------------
// Hilfsfunktionen
// -------------------------

function addLogLine(line) {
  const cleanLine = String(line).trim();

  if (!cleanLine) {
    return;
  }

  lastArduinoLines.push({
    time: new Date().toISOString(),
    line: cleanLine
  });

  if (lastArduinoLines.length > 100) {
    lastArduinoLines.shift();
  }
}

function isConnected() {
  return serialPort !== null && serialPort.isOpen;
}

function validateColor(color) {
  return ["r", "g", "b", "w", "t", "y", "o"].includes(String(color).toLowerCase());
}

function validateLedNumber(number) {
  return Number.isInteger(number) && number >= 1 && number <= 72;
}

function openSerialPort(portName, baudrate) {
  return new Promise((resolve) => {
    if (isConnected()) {
      resolve({
        ok: true,
        message: `Bereits verbunden mit ${currentPortName}`,
        connected: true
      });
      return;
    }

    currentPortName = portName || DEFAULT_SERIAL_PORT;
    currentBaudrate = Number(baudrate || DEFAULT_BAUDRATE);

    serialPort = new SerialPort({
      path: currentPortName,
      baudRate: currentBaudrate,
      autoOpen: false
    });

    serialPort.on("data", (data) => {
      const text = data.toString();
      const lines = text.split(/\r?\n/);

      for (const line of lines) {
        addLogLine(line);
      }
    });

    serialPort.on("error", (error) => {
      addLogLine(`Serial error: ${error.message}`);
    });

    serialPort.on("close", () => {
      addLogLine("Serial connection closed");
    });

    serialPort.open((error) => {
      if (error) {
        const message = `Verbindung fehlgeschlagen: ${error.message}`;
        serialPort = null;

        resolve({
          ok: false,
          message,
          connected: false
        });

        return;
      }

      // Arduino resetet oft beim Öffnen des seriellen Ports.
      setTimeout(() => {
        resolve({
          ok: true,
          message: `Verbunden mit ${currentPortName} @ ${currentBaudrate}`,
          connected: true
        });
      }, 1800);
    });
  });
}

function closeSerialPort() {
  return new Promise((resolve) => {
    if (!isConnected()) {
      serialPort = null;

      resolve({
        ok: true,
        message: "Nicht verbunden",
        connected: false
      });

      return;
    }

    serialPort.close((error) => {
      if (error) {
        resolve({
          ok: false,
          message: `Trennen fehlgeschlagen: ${error.message}`,
          connected: true
        });

        return;
      }

      serialPort = null;

      resolve({
        ok: true,
        message: "Verbindung getrennt",
        connected: false
      });
    });
  });
}

function sendCommand(command) {
  return new Promise((resolve) => {
    const cleanCommand = String(command || "").trim().toLowerCase();

    if (!cleanCommand) {
      resolve({
        ok: false,
        message: "Leerer Befehl"
      });
      return;
    }

    if (!isConnected()) {
      resolve({
        ok: false,
        message: "Nicht mit Arduino verbunden"
      });
      return;
    }

    const text = cleanCommand + "\n";

    serialPort.write(text, (writeError) => {
      if (writeError) {
        resolve({
          ok: false,
          message: `Senden fehlgeschlagen: ${writeError.message}`
        });
        return;
      }

      serialPort.drain((drainError) => {
        if (drainError) {
          resolve({
            ok: false,
            message: `Senden nicht abgeschlossen: ${drainError.message}`
          });
          return;
        }

        resolve({
          ok: true,
          message: `Gesendet: ${cleanCommand}`,
          command: cleanCommand
        });
      });
    });
  });
}

// -------------------------
// API
// -------------------------

app.get("/api/status", (req, res) => {
  res.json({
    connected: isConnected(),
    port: currentPortName,
    baudrate: currentBaudrate,
    logs: lastArduinoLines
  });
});

app.get("/api/ports", async (req, res) => {
  try {
    const ports = await SerialPort.list();

    res.json({
      ok: true,
      ports: ports.map((port) => ({
        path: port.path,
        manufacturer: port.manufacturer || "",
        friendlyName: port.friendlyName || "",
        pnpId: port.pnpId || ""
      }))
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: error.message
    });
  }
});

app.post("/api/connect", async (req, res) => {
  const port = req.body.port || DEFAULT_SERIAL_PORT;
  const baudrate = Number(req.body.baudrate || DEFAULT_BAUDRATE);

  const result = await openSerialPort(port, baudrate);
  res.json(result);
});

app.post("/api/disconnect", async (req, res) => {
  const result = await closeSerialPort();
  res.json(result);
});

app.post("/api/command", async (req, res) => {
  const command = req.body.command;
  const result = await sendCommand(command);
  res.json(result);
});

app.post("/api/led", async (req, res) => {
  const number = Number(req.body.number);
  const color = String(req.body.color || "").toLowerCase();

  if (!validateLedNumber(number)) {
    res.status(400).json({
      ok: false,
      message: "LED-Nummer muss zwischen 1 und 72 liegen"
    });
    return;
  }

  if (!validateColor(color)) {
    res.status(400).json({
      ok: false,
      message: "Ungueltige Farbe"
    });
    return;
  }

  const result = await sendCommand(`${color}${number}`);
  res.json(result);
});

app.post("/api/all", async (req, res) => {
  const color = String(req.body.color || "").toLowerCase();

  if (!validateColor(color)) {
    res.status(400).json({
      ok: false,
      message: "Ungueltige Farbe"
    });
    return;
  }

  const result = await sendCommand(`a${color}`);
  res.json(result);
});

app.post("/api/strandtest", async (req, res) => {
  const result = await sendCommand("s");
  res.json(result);
});

// -------------------------
// React-Frontend ausliefern
// -------------------------

const frontendDistPath = path.join(__dirname, "..", "frontend", "dist");

app.use(express.static(frontendDistPath));

app.get("*", (req, res) => {
  res.sendFile(path.join(frontendDistPath, "index.html"));
});

// -------------------------
// Server starten
// -------------------------

app.listen(HTTP_PORT, "0.0.0.0", () => {
  console.log(`Regalbeleuchtung-Webserver läuft auf Port ${HTTP_PORT}`);
  console.log(`Standard-Serial-Port: ${DEFAULT_SERIAL_PORT}`);
  console.log(`Baudrate: ${DEFAULT_BAUDRATE}`);
});
