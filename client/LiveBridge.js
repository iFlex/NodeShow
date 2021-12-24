import {Container, ACTIONS} from "./Container.js"

/*
    Events:
    syncrhonizing, synchronized, lost-connection, got-connection, user-joined, user-left
*/
let RELEVANT_EVENTS = [
ACTIONS.create, 
ACTIONS.delete, 
ACTIONS.setParent, 
ACTIONS.update,
ACTIONS.setPosition,
ACTIONS.setWidth,
ACTIONS.setHeight
]

export class LiveBridge {
	container = null;
	socket = null;
    userId = null; //not currently used for any interaction
	sessionId = null;
    debug = false;
    
    host = window.location.host;
    port = window.location.port;

    #retryQueue = {}

    //events that are sent over the network
    #events = {}
    
	//should plug into all relevant events and report them to the server
	constructor(container, debug) {
		this.container = container;
		this.debug = debug;

        for (const event of RELEVANT_EVENTS) {
            this.#events[event] = {send:this.sendUpdate, recv:null}
        }
        
        console.log("LiveBridge will act on the following events:")
        console.log(Object.keys(this.#events))

        this.container.parent.addEventListener("container.init", e => {
			this.registerSocketIo()
		});
        
        for(const [key, value] of Object.entries(this.#events)) {
            console.log(`Binding Bridge to Container event ${key}`)
            this.container.parent.addEventListener(key, e => {
                value.send.apply(this, [e])
            });
        }

	}

    //no caller id, current user or component
    isCallerIdLocal(callerId) {
        return (!callerId || callerId == this.sessionId || this.container.getComponent(callerId))
    }

    sendUpdate(e) {
        //check if this update originates from our user and not from the network
        if(!this.isCallerIdLocal(e.detail.callerId)) {
            if(this.debug){
                console.log(`Not sending network update back to the network. CallerId ${e.detail.callerId}`)
                console.log(e.detail)
            }
            return;
        }
        let targetId = e.detail.id;
        if (!targetId) {
            console.error("Attempted to send update about undefined ID... Aborting")
            return;
        }

        let eventType = e.detail.type
        let parentId = e.detail.parentId
        let raw = null
        if (eventType != 'container.delete') {
            raw = this.container.toSerializable(targetId);
            this.container.isOperationAllowed(ACTIONS.bridge, this.container.lookup(targetId), e.detail.callerId)

            let pid = Container.lookup(targetId).parentNode.id
            if (pid && pid != parentId) {
                parentId = pid
            }
        } 

        let detail = Container.clone(e.detail)
        detail.parentId = parentId,
        detail.id = targetId
        detail.descriptor = raw

        let update = {
            presentationId: this.container.presentationId,
            sessionId: this.sessionId,
            event: eventType,
            detail: detail
        }

        if(this.debug) {
            console.log("Sending server update")
            console.log(update)
        }

        this.addUpdateToQueue(update)
        this.socket.emit("update", update, () => {
            //server ACKed message
            this.removeUpdateFromQueue(update)
        });
    }
    
	registerSocketIo() {
		console.log(`Registering Live Bridge via SocketIo ${this.host}`);
		this.socket = io(`https://${this.host}`)
		this.socket.emit('register', {"presentationId":this.container.presentationId});

		this.socket.on('register', d => {
		  	console.log(`Registered with remote via SocketIo with UID:${d.userId} SID:${d.sessionId}`)
		  	this.userId = d.userId;
            this.sessionId = d.sessionId;
		 	console.log(d);
		});

		this.socket.on('update', d => this.handleUpdate(d))
        this.socket.on('user.joined', d => {
            console.log(`User joined ${d.name}-${d.userId}`)
        })
        this.socket.on('user.left', d => {
            console.log(`User left ${d.name}-${d.userId}`)
        })

        this.socket.on('connect', e => this.handleReconnect(e))
        this.socket.on('disconnect', e => this.handleDisconnect(e))
        this.socket.on('error', e => { console.error(`[LiveBridge] - connection error ${e}`)})
    }

	handleUpdate(data) {
		if(this.debug) {
            console.log("Received server update");
		    console.log(data);
        }
        
        if (!data.sessionId) {
            //populate with userId in case it's not there. all network updates should have a value for the userid
            data.sessionId = this.host
        }

        try {
            let detail = data.detail
            if(data.event == ACTIONS.update //Should maybe not listen to the other 3 as they should cause a container.update anyway
            || data.event == ACTIONS.setPosition
            || data.event == ACTIONS.setWidth
            || data.event == ACTIONS.setHeight
            ) {
                let child = this.container.lookup(detail.id)
                this.container.updateChild(child, detail.descriptor, data.sessionId)
            }
            if(data.event == ACTIONS.delete) {
                this.container.delete(detail.id, data.sessionId)
            }
            if(data.event == ACTIONS.create) {
                this.container.createFromSerializable(detail.parentId, detail.descriptor, null, data.sessionId);
            }
            if(data.event == ACTIONS.setParent) {
                this.container.setParent(detail.id, detail.parentId, data.sessionId)
            }
        } catch (e) {
            console.error(`Failed to handle update ${data.event}`, e);
            if(this.debug) {
                console.error(data)    
            }
        }
	}

    keyFromUpdate(update) {
        return `${update.event}${update.detail.id}`
    }

    addUpdateToQueue(update) {
        let key = this.keyFromUpdate(update)
        this.container.emit(ACTIONS.syncronizing, {id:update.detail.id})
        this.#retryQueue[key] = update
    }

    removeUpdateFromQueue(update) {
        let key = this.keyFromUpdate(update)
        this.container.emit(ACTIONS.syncronized, {id:update.detail.id})
        delete this.#retryQueue[key]
    }

    handleReconnect() {
        console.log(`[LiveBridge] connected`)
        this.container.emit(ACTIONS.connected, {})
    }

    handleDisconnect() {
        console.log(`[LiveBridge] disconnected`)
        this.container.emit(ACTIONS.disconnected, {})
    }
	//TESTING
	beam() {	
		let queue = [this.container.parent]
		var index = 0
		var count = 0;
        var faliures = 0;
		do {
			let item = queue[index]
			let parentId = null;
			if (item != this.container.parent && item.parentNode != this.container.parent) {
				parentId = item.parentNode.id;
			}

			if (item.id) {
				let raw = this.container.toSerializable(item.id);
                console.log(raw)
                
                let jsndata = {
                    presentationId: this.container.presentationId,
                    sessionId: this.sessionId,
                    event: ACTIONS.create,
                    detail: {
                        parentId: parentId,
                        descriptor:raw
                    }
                }

				this.socket.emit("update", jsndata);
			}

			if (item.children) {
				for (const child of item.children) {
					queue.push(child)
				}
			}
		
			index ++;
		} while(index < queue.length)
        console.log(`beamed ${count} elements out of ${index} with failures ${faliures}`);
	}
}