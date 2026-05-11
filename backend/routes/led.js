const express = require("express");
const ledController = require("../serial/ledController");

const router = express.Router();

router.get("/status", (req, res) => {
  res.json(ledController.getStatus());
});

router.get("/ports", async (req, res) => {
  try {
    const ports = await ledController.listPorts();

    res.json({
      ok: true,
      ports
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: error.message
    });
  }
});

router.post("/connect", async (req, res) => {
  const port = req.body.port;
  const baudrate = req.body.baudrate;

  const result = await ledController.openSerialPort(port, baudrate);
  res.json(result);
});

router.post("/disconnect", async (req, res) => {
  const result = await ledController.closeSerialPort();
  res.json(result);
});

router.post("/command", async (req, res) => {
  const result = await ledController.sendCommand(req.body.command);
  res.json(result);
});

router.post("/single", async (req, res) => {
  const result = await ledController.setLed(req.body.number, req.body.color);
  res.json(result);
});

router.post("/all", async (req, res) => {
  const result = await ledController.setAll(req.body.color);
  res.json(result);
});

router.post("/all/off", async (req, res) => {
  const result = await ledController.allOff();
  res.json(result);
});

router.post("/strandtest", async (req, res) => {
  const result = await ledController.strandtest();
  res.json(result);
});

module.exports = router;
