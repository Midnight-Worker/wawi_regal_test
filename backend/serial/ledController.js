const { SerialPort } = require("serialport");

const DEFAULT_SERIAL_PORT = process.env.SERIAL_PORT || "/dev/ttyUSB0";
const DEFAULT_BAUDRATE = Number(process.env.BAUDRATE || 115200);
const LED_COUNT = Number(process.env.LED_COUNT || 72);

let serialPort = null;
let currentPortName = DEFAULT_SERIAL_PORT;
let currentBaudrate = DEFAULT_BAUDRATE;
let lastArduinoLines = [];

function addLogLine(line) {
  const cleanLine = String(line || "").trim();

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
  return ["r", "g", "b", "w", "t", "y", "o"].includes(
    String(color || "").toLowerCase()
  );
}

function validateLedNumber(number) {
  return Number.isInteger(number) && number >= 1 && number <= LED_COUNT;
}

async function listPorts() {
  const ports = await SerialPort.list();

  return ports.map((port) => ({
    path: port.path,
    manufacturer: port.manufacturer || "",
    friendlyName: port.friendlyName || "",
    pnpId: port.pnpId || ""
  }));
}

function openSerialPort(portName, baudrate) {
  return new Promise((resolve) => {
    if (isConnected()) {
      resolve({
        ok: true,
        message: `Bereits verbunden mit ${currentPortName}`,
        connected: true,
        port: currentPortName,
        baudrate: currentBaudrate
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

      setTimeout(() => {
        resolve({
          ok: true,
          message: `Verbunden mit ${currentPortName} @ ${currentBaudrate}`,
          connected: true,
          port: currentPortName,
          baudrate: currentBaudrate
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

async function setLed(number, color) {
  const ledNumber = Number(number);
  const ledColor = String(color || "").toLowerCase();

  if (!validateLedNumber(ledNumber)) {
    return {
      ok: false,
      message: `LED-Nummer muss zwischen 1 und ${LED_COUNT} liegen`
    };
  }

  if (!validateColor(ledColor)) {
    return {
      ok: false,
      message: "Ungueltige Farbe"
    };
  }

  return await sendCommand(`${ledColor}${ledNumber}`);
}

async function setAll(color) {
  const ledColor = String(color || "").toLowerCase();

  if (!validateColor(ledColor)) {
    return {
      ok: false,
      message: "Ungueltige Farbe"
    };
  }

  return await sendCommand(`a${ledColor}`);
}

async function allOff() {
  return await setAll("o");
}

async function strandtest() {
  return await sendCommand("s");
}

function getStatus() {
  return {
    connected: isConnected(),
    port: currentPortName,
    baudrate: currentBaudrate,
    logs: lastArduinoLines
  };
}

function getStockColor(article) {
  const quantity = Number(article.quantity || 0);
  const redBelow = Number(article.red_below || 5);
  const yellowFrom = Number(article.yellow_from || 20);
  const greenFrom = Number(article.green_from || 100);

  if (quantity < redBelow) {
    return "r";
  }

  if (quantity < yellowFrom) {
    return "y";
  }

  if (quantity >= greenFrom) {
    return "g";
  }

  return "y";
}

module.exports = {
  listPorts,
  openSerialPort,
  closeSerialPort,
  sendCommand,
  setLed,
  setAll,
  allOff,
  strandtest,
  getStatus,
  getStockColor,
  validateLedNumber,
  validateColor
};
