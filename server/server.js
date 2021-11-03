const PORT=8080;
const SERVER="http://localhost:"+PORT+"/";
const NGPS_LOCATION = "../client"
const NGPS_ENTRYPOINT = NGPS_LOCATION + "/index.html";
const USER_STORAGE = '../users'
const PERSIST_LOCATION = '../prezzos'

//HTTP
const http = require('http');
const url = require('url');
const server = http.createServer(handleRequest);
const io = require('socket.io')(server,{  
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
const fs = require('fs');
const dispatcher = new HttpDispatcher();
const HttpUtils = require('./HttpUtils')
const FileStorage = require('./FileStorage')
const UserBase = require('./UserBase')
const PresentationBase = require('./PresentationBase');
const FolderKeyFileStorage = require('./FolderKeyFileStorage')

const UserStorage = new FileStorage(USER_STORAGE);
const PresentationStorage = new FolderKeyFileStorage(PERSIST_LOCATION);
const Users = new UserBase(UserStorage);
const Presentations = new PresentationBase(PresentationStorage);
const Events = require('./NodeShowEvents');

dispatcher.setStatic("/");
dispatcher.setStaticDirname(NGPS_LOCATION);

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
  res.writeHead(200, {'Content-Type': 'text/html'});
  res.write(id);
  res.end();
});

// dispatcher.onGet("/", function(req, res) {
//   const queryObject = url.parse(req.url, true).query;
//   console.log(queryObject);

//   try{
//     let file = fs.readFileSync(NGPS_ENTRYPOINT);
//     res.writeHead(200, {'Content-Type': "text/html"});
//     res.write(file);
//     res.end();
//   }catch(e){
//     console.log("Error locating:"+url);
//     file = 0;
//   } 
// });


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

function handleRequest(request, response){
    console.log(`${request.method} - ${request.url}`)
    try {
      
      // var wasStatic = false;
      // if(request.method.toLowerCase() == "get") {
      //     //static content server
      //     wasStatic = HttpUtils.handleStaticGet(request, response, NGPS_LOCATION)
      // }

      // if (!wasStatic) {
      dispatcher.dispatch(request, response);
      //}
    } catch(err) {
        console.log(err.stack);
    }
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
      let userId = utils.makeAuthToken(64);
      
      prezzo.sockets[userId] = socket;
      socket2prezzo[socket] = prezzo;
      
      console.log(`Registered new user ${userId} for prezzo ${prezId}`)
      socket.emit('register', JSON.stringify({"userId": userId}))

      //beam over presentation
      broadcast(null, ['user.joined',{userId:userId}], prezzo.sockets);
      sendPresentationToNewUser(socket, prezzo.presentation)//Presentations.get(prezId))
    }
  });

  socket.on('update', handleBridgeUpdate);
 
  socket.on("disconnect", (e) => {
    console.log(`Connection closed:${e}`);
    let prezzo = socket2prezzo[socket];
    delete socket2prezzo[socket];

    if (prezzo) {
      let leavingUserId = findUserBySocket(socket, prezzo);
      delete prezzo.sockets[leavingUserId];

      broadcast(null, ['user.left',{userId:leavingUserId}], prezzo.sockets);
      console.log(`${leavingUserId} has closed their connection`);
    }
  });
});
  
function findUserBySocket(socket, prezzo){
  for( const [userId, psocket] of Object.entries(prezzo.sockets)) {
    if (socket == psocket) {
      return userId;
    }
  }
  return null;
}

function isRobot(socket) {
  //ToDo: implement
  return true;
}

function handleBridgeUpdate(data) {
  console.log("Received update");
  let parsed = JSON.parse(data);
  let prezId = parsed.presentationId;
  let userId = parsed.userId;

  let prezzo = presentations[prezId];

  if (prezzo){
    let originSocket = prezzo.sockets[userId];
    console.log(`event:${parsed.event} on:${prezId} by:${userId}`)

    if(originSocket || isRobot(originSocket)) {
      //update in memory model of prezzo      
      prezzo.presentation.update(parsed);
      broadcast(userId, ['update',data], prezzo.sockets);
    }
  }
}

function broadcast(senderId, message, sockets) {
  if(message.length != 2) {
    console.log("Invalid broadcast call");
    return;
  }

  for (const [socUserId, socket] of Object.entries(sockets)) {
    if (socUserId != senderId) {
      socket.emit(message[0], message[1]);
    }
  }
}

function sendPresentationToNewUser(socket, prezzo) {
  console.log("Beaming presentation to new user");
  let nodes = prezzo.getNodesInOrder();
  console.log(`Node count ${nodes.length}`)
  for (const node of nodes) {
    socket.emit('update', JSON.stringify({
      presentationId: prezzo.id,
      event: Events.CONTAINER_CREATE,
      detail: {
          parentId: node.parentId,
          descriptor:node.descriptor
      }
    }));
  }
}

//listen
server.listen(PORT, function(){
    console.log("Server listening on: http://localhost:%s", PORT);
});
