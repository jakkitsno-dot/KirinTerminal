const { ipcMain } = require('electron');
const { initServer } = require('./pty-server');
const EventEmitter = require('events');

module.exports = function(mainWindow) {
  // A fake WebSocketServer object
  class FakeWSS extends EventEmitter {
    constructor() {
      super();
    }
  }

  const wss = new FakeWSS();
  
  // We maintain a map of all "fake websockets" by ID
  const connections = new Map();

  ipcMain.on('ws-connect', (event, wsId) => {
    class FakeWS extends EventEmitter {
      constructor(id, sender) {
        super();
        this.id = id;
        this.sender = sender;
        this.readyState = 1; // OPEN
      }
      send(data) {
        if (!mainWindow.isDestroyed()) {
          this.sender.send(`ws-message-${this.id}`, data.toString());
        }
      }
      close() {
        this.readyState = 3; // CLOSED
        this.emit('close');
        connections.delete(this.id);
      }
    }

    const ws = new FakeWS(wsId, event.sender);
    connections.set(wsId, ws);
    
    // Trigger wss.on('connection') inside pty-server
    wss.emit('connection', ws);
  });

  ipcMain.on('ws-send', (event, { id, data }) => {
    const ws = connections.get(id);
    if (ws) {
      // Trigger ws.on('message') inside pty-server
      ws.emit('message', Buffer.from(data));
    }
  });

  ipcMain.on('ws-close', (event, id) => {
    const ws = connections.get(id);
    if (ws) {
      ws.close();
    }
  });

  // Initialize the main pty server logic with our fake WSS
  initServer(wss);
};
