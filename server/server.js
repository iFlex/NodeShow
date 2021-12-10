const process = require('process')

const PORT= process.env.PORT || 8080;
const SERVER=`http://localhost:${PORT}/`;
const NGPS_LOCATION = process.env.NODE_SHOW_CLIENT_HOME || "../client"
const NGPS_ENTRYPOINT = NGPS_LOCATION + "/index.html";
const USER_STORAGE = process.env.USER_STORAGE_HOME || '../users'
const PERSIST_LOCATION = process.env.PREZZO_STORAGE_HOME || '../prezzos'
const DEBUG_MODE = process.env.DEBUG_MODE || false;
const STATIC_CONTENT = './static'
const UPLOADS = './static/'

console.log(`Configured NodeShow server with`)
console.log(`Server config: ${SERVER}`)
console.log(`NodeShow client: ${NGPS_LOCATION}`)
console.log(`Presentation Storage: ${PERSIST_LOCATION}`)

//HTTP
const https = require('https');
const url = require('url');
const fs = require('fs');
const formidable = require('formidable')

if (!process.env.TLS_CERT_KEY || !process.env.TLS_CERT) {
  console.log("Please provide environment variables for the HTTPS server TLS config")
  console.log("TLS_CERT: path to certificate")
  console.log("TLS_CERT_KEY: path to the key file")
  process.exit(0)
}

const options = {
  key: fs.readFileSync(process.env.TLS_CERT_KEY),
  cert: fs.readFileSync(process.env.TLS_CERT),
  ciphers: "DEFAULT:!SSLv2:!RC4:!EXPORT:!LOW:!MEDIUM:!SHA1"
};

const server = https.createServer(options, handleRequest);

//ToDo: use debug mode and other settings to properly build the cors here
const io = require('socket.io')(server, {  
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

const HttpDispatcher = require('httpdispatcher');
const dispatcher = new HttpDispatcher();
const HttpUtils = require('./HttpUtils')
const UserBase = require('./UserBase')
const PresentationBase = require('./PresentationBase');
//Storage
const FileStorage = require('./FileStorage')
const FolderKeyFileStorage = require('./FolderKeyFileStorage')
//const RAMStorage = require('./RAMKeyStorage')

const UserStorage = new FileStorage(USER_STORAGE);
const Users = new UserBase(UserStorage);

const PresentationStorage = new FolderKeyFileStorage(PERSIST_LOCATION);
const Presentations = new PresentationBase(PresentationStorage);
const Events = require('./NodeShowEvents');

//dispatcher.setStatic("/");
//dispatcher.setStaticDirname(NGPS_LOCATION);
const debug_level = 0;

var utils = new (function(){
  this.makeAuthToken = function(length){
    token = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for( var i=0;i<length;++i)
        token += possible.charAt(Math.floor(Math.random() * possible.length));
    return token;
  }
})();

//RAM FAST PRESENTATION ROUTING
var presentations = {}
var socket2prezzo = {}

console.log(Presentations.list())
for (const prezzoId of Presentations.list()) {
  presentations[prezzoId] = {"id":prezzoId, sockets:{}, presentation: Presentations.get(prezzoId)}
}


function newPrezzo() {
  let prezzo = Presentations.createNew()
  presentations[prezzo.id] = {"id":prezzo.id, sockets:{}, presentation: prezzo}

  return prezzo.id;
}

dispatcher.onGet("/new", function(req, res) {
  let id = newPrezzo();
  console.log(`Created new prezzo ${id}`)
  
  res.writeHead(200, {'Content-Type': 'text/html'});
  res.write(id);
  res.end();
});


dispatcher.onGet("/list", function(req, res) {
  let result = []
  for (const [key, val] of Object.entries(presentations)) {
    result.push(key)
  }
  
  state = JSON.stringify(result, null, 2)
  res.writeHead(200, {'Content-Type': 'text/html'});
  res.write(state);
  res.end();
});


dispatcher.onGet("/edit", function(req, res) {
  const queryObject = url.parse(req.url, true).query;
  console.log(queryObject);

  try{
    let file = fs.readFileSync(NGPS_ENTRYPOINT);
    res.writeHead(200, {"Content-Type": "text/html"});
    res.write(file);
    res.end();
  }catch(e){
    console.log("Error locating:"+url);
    file = 0;
  } 
});


function handlePost(request, response) {
  var form = new formidable.IncomingForm({uploadDir:UPLOADS});
  form.parse(request, function(err, fields, files) {
      if (err) {
        console.error(err.message);
        return;
      }

      response.writeHead(200, {'content-type': 'text/plain'});
      response.write('received upload:\n\n');

      console.log(`Usaer Uploaded:`)
      console.log(JSON.stringify({fields: fields, files: files}))

      // This last line responds to the form submission with a list of the parsed data and files.
      response.end("OK");
      //ToDo: submit this to a headless browser which can then beam the contents over to everyone (via this server ofc)
  });
  return;
}

function handleRequest(request, response){
    console.log(`${request.method} - ${request.url}`)
    try {
      var wasStatic = false;
      if(request.method.toLowerCase() == "get") {
        //static content server
        wasStatic = HttpUtils.handleStaticGet(request, response, NGPS_LOCATION)
        if (!wasStatic){
          wasStatic = HttpUtils.handleStaticGet(request, response, STATIC_CONTENT)
        }
        if (!wasStatic) {
          dispatcher.dispatch(request, response);
        }
      } else if(request.method.toLowerCase() == "post") {
        handlePost(request, response)
      }
    } catch(err) {
      console.log(err.stack);
    }
}

function parseCookies (headers) {
  var list = {},
      rc = headers.cookie;

  rc && rc.split(';').forEach(function( cookie ) {
      var parts = cookie.split('=');
      list[parts.shift().trim()] = decodeURI(parts.join('='));
  });

  return list;
}


function findUserIdFromRequest(hdr) {
  console.log(hdr)
  let cookies = parseCookies(hdr);
  return cookies['user_id']
}

io.on('connection', function (socket) {
  console.log("New socket.io connection")
  socket.on('register', function (data) {
    console.log("Register request:")
    console.log(data)

    let parsed = JSON.parse(data);
    let prezId = parsed.presentationId;
    let prezzo = presentations[prezId];

    if (prezzo) {
      let user = Users.lookup(findUserIdFromRequest(socket.handshake.headers));
      user.sessionId = utils.makeAuthToken(64); 
      if (!user.id) {
        user.id = user.sessionId
      }

      prezzo.sockets[user.sessionId] = { user: user, socket: socket };
      socket2prezzo[socket] = prezzo;
      
      let registerMsg = {userId: user.id, sessionId: user.sessionId, name: user.name, presentationId: prezId}
      console.log(`Registered new user Name(${user.name}) UID(${user.id}) SID(${user.sessionId}) for prezzo ${prezId}`)
      socket.emit('register', JSON.stringify(registerMsg))
      //beam over presentation
      broadcast(null, ['user.joined', registerMsg], prezzo.sockets);
      sendPresentationToNewUser(socket, prezzo.presentation)//Presentations.get(prezId))
    }
  });

  socket.on('update', handleBridgeUpdate);
 
  socket.on("disconnect", (e) => {
    console.log(`Connection closed:${e}`);
    let prezzo = socket2prezzo[socket];
    delete socket2prezzo[socket];

    if (prezzo) {
      let leavingSessionId = findUserBySocket(socket, prezzo);
      delete prezzo.sockets[leavingSessionId];

      broadcast(null, ['user.left',{sessionId:leavingSessionId}], prezzo.sockets);
      console.log(`Session ${leavingSessionId} has ended`);
    }
  });
});
  
function findUserBySocket(socket, prezzo){
  for( const [sessionId, record] of Object.entries(prezzo.sockets)) {
    if (record.socket == socket) {
      return sessionId;
    }
  }
  return null;
}

function isRobot(socket) {
  //ToDo: implement
  return true;
}

function handleBridgeUpdate(data) {
  let parsed = JSON.parse(data);
  if(debug_level > 1) {
    console.log(data)
  }

  let prezId = parsed.presentationId;
  let sessionId = parsed.sessionId;
  let prezzo = presentations[prezId];

  if (prezzo) {
    let sessionData = prezzo.sockets[sessionId]
    if (!sessionData) {
      console.log(`Could not find session data for session ${sessionId} in prezzo: ${prezId}`)
      return;
    }

    let originSocket = sessionData.socket;
    let userId = sessionData.user.id;

    if(originSocket || isRobot(originSocket)) {
      console.log(`event:${parsed.event} on:${prezId} by: UID(${userId}) SID(${sessionId})`)
      
      parsed.userId = userId;
      parsed = prezzo.presentation.update(parsed);
      broadcast(sessionId, ['update', JSON.stringify(parsed)], prezzo.sockets);
    }
  }
}

function broadcast(senderId, message, sockets) {
  if(debug_level > 1){DEBUG_MODE
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

function sendPresentationToNewUser(socket, prezzo) {
  console.log("Beaming presentation to new user");
  let nodes = prezzo.getNodesAnyOrder(); //prezzo.getNodesInOrder();
  console.log(`Node count ${nodes.length}`)
  for (const node of nodes) {
    if (debug_level > 1) {
      console.log(node)
    }
    socket.emit('update', JSON.stringify({
      presentationId: prezzo.id,
      event: Events.create,
      detail: {
          parentId: node.parentId,
          descriptor: node
      }
    }));
  }
}

//listen
server.listen(PORT, function(){
    console.log("Server listening on: https://localhost:%s", PORT);
});
