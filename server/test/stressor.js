const io = require('socket.io-client')
const https = require('https')

const NODE_SHOW_PSK = 'thisisfordemoonly'

let NODE_SHOW_HOST = 'localhost'
let NODE_SHOW_PORT = 8080
let PREZ_ID = "rLueD"
let SESH_ID = undefined
let INTERVAL = 1
let EVENT = 'container.create' //'container.update'
const MAX_REQ = 1000;//25000
//TODO: split test in create and update events

let metrics = {
	acked:0,
	total_processing_time:0,
	avg_response_time:0,
}

let socketIoConfig = {
    rejectUnauthorized: false,
    requestCert: true,  
    agent: false,
	extraHeaders: {
		Authorization: `${NODE_SHOW_PSK}`//[TODO]: use real oauth
	}
}

socket = io(`https://${NODE_SHOW_HOST}:${NODE_SHOW_PORT}`, socketIoConfig);

socket.on('disconnect', (e) => {
	console.error(`Socket disconnected ${e}`)
})
socket.on("connect_error", (err) => {  
	console.log(`connect_error due to ${err.message}`);
});
socket.on('error', function(err) {
  console.log("Error while Socket.IO emit")
  console.log(err)
});

let updateData = {
	presentationId: PREZ_ID,
    sessionId: SESH_ID,
    event: EVENT,
    detail: {
      parentId:"",
      id:"b46345b7-8e70-4e90-8737-b80e788826ad",
      descriptor:{
      	"id":"b46345b7-8e70-4e90-8737-b80e788826ad",
				"nodeName":"DIV",
				"className":"",
				"innerHTML":"",
				"cssText":"z-index: 34; position: absolute; width: 306px; height: 198px; margin: 5px; padding: 5px; background-color: rgb(96, 91, 86); top: 80px; left: 290px;",
				"computedStyle":{
				    "z-index":"34",
				    "position":"absolute",
				    "width":"306px",
				    "height":"198px",
				    "margin-top":"5px",
				    "margin-right":"5px",
				    "margin-bottom":"5px",
				    "margin-left":"5px",
				    "padding-top":"5px",
				    "padding-right":"5px",
				    "padding-bottom":"5px",
				    "padding-left":"5px",
				    "background-color":"rgb(96, 91, 86)",
				    "top":"80px",
				    "left":"290px"
				},
				"data":{}
      }
    }
}

let id = 0
function sendData() {
	let sent = Date.now()
	if (metrics.acked >= MAX_REQ) {
		process.exit(0);
	}

	if (updateData.event == 'container.create') {
		updateData.detail.id = `${id}-stress-test`
		updateData.detail.descriptor.id = updateData.detail.id
		id++;	
	}
	
	//console.log(`Sending`)
	//socket.emit('update', updateData, (e) => {
	socket.emit('update', updateData, (e) => {
		let recvd = Date.now()
		let delta = recvd - sent
		
		metrics.total_processing_time += delta
		metrics.acked++;
		metrics.avg_response_time = metrics.total_processing_time / metrics.acked
		console.log(metrics)
	});
}

if (INTERVAL < 1) {
	socket.on('connect', (e) => {
		console.log(`Sending ${MAX_REQ} messages as fast as I can`)
		while(true) {
			sendData();
		}
	})
} else {
	socket.on('connect', (e) => {
		console.log(`Sending ${MAX_REQ} messages, 1 message every ${INTERVAL}ms`)
		setInterval(sendData, INTERVAL)
	});	
}

