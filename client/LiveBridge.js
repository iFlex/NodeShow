import {Container, ACTIONS} from "./Container.js"
/**
 * LiveBridge Module
 * @module LiveBridge
 * @description This module handles communication with the server in order to keep the presentation persisted and up to date with other's changes.
 */
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

/** @class */
export class LiveBridge {
	container = null;
	socket = null;
    userId = null; //not currently used for any interaction
	sessionId = null;
    debug = false;
    RETRY_INTERVAL = 500;
    
    host = window.location.host;
    port = window.location.port;

    #ready = false
    #retryQueue = {}

    metrics = {
        sent: 0,
        recv: 0,
        retry: 0,
        rtt: 0,
    }

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
    /**
     * @summary Method determines if a callerId is local or remote
     * @description This method checks if a provided caller id originates from the local machine or comes from the network.
     * @param {string} callerId - callerId to check
     * @return {boolean} wether or not the caller is local.
     */
    isCallerIdLocal(callerId) {
        return (!callerId || callerId == this.sessionId || this.container.getComponent(callerId))
    }

    /**
     * @summary Sends an update event to the server
     * @description [TODO]
     * @param {object} event - event to be sent as a update
     */
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
            if (this.debug) {
                console.error("Attempted to send update about undefined ID... Aborting")
            }
            return;
        }

        let eventType = e.detail.type
        let parentId = e.detail.parentId
        let raw = null
        if (eventType != 'container.delete') {
            raw = this.container.toSerializable(targetId);
            try {
                this.container.isOperationAllowed(ACTIONS.bridge, this.container.lookup(targetId), e.detail.callerId)    
            } catch (e) {
                return;
            }
            
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
        let start = Date.now()
        this.socket.emit("update", update, () => {
            //server ACKed message
            this.removeUpdateFromQueue(update)
            let delta = Date.now() - start
            if (!this.metrics.rtt) {
                this.metrics.rtt = delta
            }
        });
        this.metrics.sent++;
    }
    
    /**
     * @summary Registers with the server.
     * @description This method initiates the LiveBridge, it opens the socket.io connection and sends a register event to the server.
     * This method also wires in the handler methods for the various socket.io events (e.g. update, connect, disconnect, etc)
     */
	registerSocketIo() {
		console.log(`Registering Live Bridge via SocketIo ${this.host}`);
		this.socket = io(`https://${this.host}`, {rejectUnauthorized: true})
		this.socket.emit('register', {"presentationId":this.container.presentationId});

		this.socket.on('register', d => {
		  	console.log(`Registered with remote via SocketIo with UID:${d.userId} SID:${d.sessionId}`)
		  	this.userId = d.userId;
            this.sessionId = d.sessionId;
		 	console.log(d);
            this.#ready = true
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

        //TODO: make this tick only if there's stuff in the retry queue
        setInterval((e) => {
            this.retry()
        }, this.RETRY_INTERVAL)
    }

    /**
     * @summary Method retries to send unsuccessful updates.
     */
    retry() {
        for (let [evkey, update] of Object.entries(this.#retryQueue)) {
            this.socket.emit("update", update, () => {
                //server ACKed message
                this.removeUpdateFromQueue(update)
            });
            this.metrics.retry++;
        }

        //console.log(`[LiveBridge] Sent ${this.metrics.sent} Recvd: ${this.metrics.recv} Retried: ${this.metrics.retry} RTT: ${this.metrics.rtt}`)
        this.metrics.rtt = null;
    }

    /**
     * @summary Handler method for events coming from the server.
     * @description [TODO]
     * @param {object} data - event coming from the server
     */
	handleUpdate(data) {
        this.metrics.recv++;

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
        //events that are complementary to each other must be added under the same key.
        //e.g show and hide (if they ever get broadcast)
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
	beam(snapshot, queue, index) {
        if (!this.#ready) {
            throw `LiveBridge not ready yet`
        }

        if (queue.length == 0) {
            queue.push(this.container.parent)
            index = 0;
        }
		var count = 0;
        var faliures = 0;
		do {
			let item = queue[index]
			let parentId = null;
			if (item != this.container.parent && item.parentNode != this.container.parent) {
				parentId = item.parentNode.id;
			}

			if (item.id) {
				let raw = this.container.toSerializable(item.id, snapshot);

                let jsndata = {
                    presentationId: this.container.presentationId,
                    sessionId: this.sessionId,
                    event: ACTIONS.create,
                    detail: {
                        parentId: parentId,
                        descriptor:raw
                    }
                }
                console.log("BEAMING ITEM:")
                console.log(jsndata)
                this.#ready = false
                this.socket.emit("update", jsndata, (e) => {
                    console.log("ACK")
                    this.#ready = true
                });
			}

			if (item.children) {
				for (const child of item.children) {
					queue.push(child)
				}
			}
		
			index ++;
            return index
		} while(index < queue.length)
        console.log(`beamed ${count} elements out of ${index} with failures ${faliures}`);
	}
}