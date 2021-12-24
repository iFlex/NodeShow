//ToDo: use debug mode and other settings to properly build the cors here
const SocketIo = require('socket.io')

class Streamer {
  #io = null
  #prezBase = null
  #workGroup = {}
  #socket2workGroup = {}

  constructor(server, prezBase) {
    this.#prezBase = prezBase
    this.#io = SocketIo(server, {  
      cors: {
        //origin: "https://example.com",
        methods: ["GET", "POST"],
        allowedHeaders: ["Access-Control-Allow-Origin"],
        extraHeaders : {
          'Access-Control-Allow-Origin': '*'
        }
        //credentials: true 
      }
    });
  }

  start() {
    this.#io.on('connection', (socket) => this.onConnect(socket))
  }

  onConnect(socket) {
    console.log("New socket.io connection")
    socket.on('register', (data) => this.onRegister(data, socket));
    socket.on('update', (data) => this.onUpdate(data, socket));
    socket.on("disconnect", (e) => this.onDisconnect(e, socket));
  }

  onDisconnect(info, socket) {
    console.log(`Connection closed:${info}`);
    let workGroup = this.#socket2workGroup[socket];
    
    if (workGroup) {
      delete this.#socket2workGroup[socket];

      let leavingSessionId = findUserBySocket(socket, workGroup);
      delete workGroup.sockets[leavingSessionId];

      this.broadcast(null, ['user.left',{sessionId:leavingSessionId}], workGroup.sockets);
      console.log(`Session ${leavingSessionId} has ended`);
    }
  }

  getPrezAndWorkGroup(prezId) {
    let prezzo = null;
    let workGroup = this.#workGroup[prezId]
    if (!workGroup) {
      prezzo = this.#prezBase.get(prezId);
      if (prezzo) {
        this.#workGroup[prezId] = {
          sockets:{}, 
          presentation: prezzo
        }
      }
    } else {
      prezzo = workGroup.presentation
    }

    return [prezzo, workGroup]
  }

  onRegister(parsed, socket) {
    console.log("Register request:")
    console.log(parsed)

    let prezId = parsed.presentationId;
    let pwg = this.getPrezAndWorkGroup(prezId)
    let prezzo = pwg[0]
    let workGroup = pwg[1]

    if (prezzo) {
      let cookie = parseCookies(socket.handshake.headers)
      let user = Users.lookup(cookie.id);
      user.sessionId = utils.makeAuthToken(64); 
      if (!user.id) {
        user.id = user.sessionId
      }

      workGroup.sockets[user.sessionId] = { user: user, socket: socket };
      this.#socket2workGroup[socket] = workGroup;
      
      let registerMsg = {userId: user.id, sessionId: user.sessionId, name: user.name, presentationId: prezId}
      console.log(`Registered new user Name(${user.name}) UID(${user.id}) SID(${user.sessionId}) for prezzo ${prezId}`)
      socket.emit('register', registerMsg)
      //beam over presentation
      this.broadcast(null, ['user.joined', registerMsg], prezzo.sockets);
      this.sendPresentationToNewUser(socket, prezzo)//Presentations.get(prezId))
    }
  }

  onUpdate(data, originSocket) {
    if(debug_level > 1) {
      console.log(data)
    }

    let prezId = parsed.presentationId;
    let sessionId = parsed.sessionId;
    
    let pwg = this.getPrezAndWorkGroup(prezId)
    let prezzo = pwg[0]
    let workGroup = pwg[1]

    if (prezzo) {
      //identifying user
      let sessionData = workGroup.sockets[sessionId]
      let userId = undefined
      if (!sessionData) {
        console.log(`Could not find session data for session ${sessionId} in prezzo: ${prezId}`)
        //return;
      } else {
        userId = sessionData.user.id;  
      }
      
      //broadcasting
      console.log(`event:${parsed.event} on:${prezId} by: UID(${userId}) SID(${sessionId})`)
      parsed.userId = userId;
      parsed = prezzo.update(parsed);
      this.broadcast(sessionId, ['update', parsed], workGroup.sockets);
    }
  }

  findUserBySocket(socket, workGroup){
    for( const [sessionId, record] of Object.entries(workGroup.sockets)) {
      if (record.socket == socket) {
        return sessionId;
      }
    }
    return null;
  }

  broadcast(senderId, message, sockets) {
    if(debug_level > 1){
      console.log("Broadcasting to all users in prezzo")
      console.log(message)
    }

    if(message.length != 2) {
      console.log("Invalid broadcast call");
      return;
    }

    for (const [socSessionId, record] of Object.entries(sockets)) {
      if (socSessionId != senderId) {
        record.socket.emit(message[0], message[1]);
      }
    }
  }

  sendPresentationToNewUser(socket, prezzo) {
    console.log("Beaming presentation to new user");
    let nodes = prezzo.getNodesAnyOrder(); //prezzo.getNodesInOrder();
    console.log(`Node count ${nodes.length}`)
    for (const node of nodes) {
      if (debug_level > 1) {
        console.log(node)
      }
      socket.emit('update', {
        presentationId: prezzo.id,
        event: Events.create,
        detail: {
            parentId: node.parentId,
            descriptor: node
        }
      });
    }
  }
}

module.exports = Streamer