import {Container, ACTIONS} from "./Container.js"

export class LiveBridge {
	container = null;
	socket = null;
	userId = null;
    debug = false;
    #users = {}

    host = window.location.host;
    port = window.location.port;

    //events that are sent over the network
    #events = {}

	//should plug into all relevant events and report them to the server
	constructor(container, debug) {
		this.container = container;
		this.debug = debug;

        for (const event of Object.values(ACTIONS)) {
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
        return (!callerId || callerId == this.userId || this.container.getComponent(callerId))
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

            let pid = Container.lookup(targetId).parentNode.id
            if (pid && pid != parentId) {
                parentId = pid
            }
        } 

        let update = {
            presentationId: this.container.presentationId,
            userId: this.userId,
            event: eventType,
            detail: {
                parentId: parentId,
                id: targetId,
                descriptor:raw
            }
        }

        if(this.debug) {
            console.log("Sending server update")
            console.log(update)
        }
        this.socket.emit("update", JSON.stringify(update));
    }
    
	registerSocketIo() {
		console.log(`Registering Live Bridge via SocketIo ${this.host}`);
		this.socket = io(`https://${this.host}`)
		this.socket.emit('register', JSON.stringify({"presentationId":this.container.presentationId}));

		this.socket.on('register', d => {
			try {
				d = JSON.parse(d);
			} catch ( e ){
				console.error(e);
				return;
			}

		  	console.log(`Registered with remote via SocketIo with UID: ${d.userId}`)
		  	this.userId = d.userId;
		 	console.log(d);
		});

		this.socket.on('update', d => this.handleUpdate(JSON.parse(d)))
        this.socket.on('user.joined', d => {
            this.#users[d.userId] = true;
            console.log(`User joined ${d.userId}`)
        })
        this.socket.on('user.left', d =>{
            delete this.#users[d.userId]
            console.log(`User left ${d.userId}`)
        })
        this.socket.on('insert', d => this.handleInsert(JSON.parse(d)))
    }

	handleUpdate(data) {
		if(this.debug) {
            console.log("Received server update");
		    console.log(data);
        }
        
        if (!data.userId) {
            //populate with userId in case it's not there. all network updates should have a value for the userid
            data.userId = this.host
        } else {
            this.#users[data.userId] = true;
        }

        try {
            let detail = data.detail
            if(data.event == ACTIONS.update //Should maybe not listen to the other 3 as they should cause a container.update anyway
            || data.event == ACTIONS.setPosition
            || data.event == ACTIONS.setWidth
            || data.event == ACTIONS.setHeight
            ) {
                let child = this.container.lookup(detail.id)
                this.container.updateChild(child, detail.descriptor, data.userId)
            }
            if(data.event == ACTIONS.delete) {
                this.container.delete(detail.id, data.userId)
            }
            if(data.event == ACTIONS.create) {
                this.container.createFromSerializable(detail.parentId, detail.descriptor, null, data.userId);
            }
            if(data.event == ACTIONS.setParent) {
                this.container.setParent(detail.id, detail.parentId, data.userId)
            }
        } catch (e) {
            console.error(`Failed to handle update`, e);
            if(this.debug) {
                console.error(data)    
            }
        }
	}

    handleInsert(data) {
        let holder = this.container.createFromSerializable(null, {
            "nodeName":"DIV",
            "computedStyle": {
                "position":"absolute",
                "top":"0px",
                "left":"20px",
                "min-width":"500px",
                "min-height":"500px",
                "width":"auto",
                "height":"auto",
                "overflow": "auto"
            }
        })

        this.container.loadHtml(holder, data.detail.url, undefined, true)
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
                
                let jsndata = JSON.stringify({
                    presentationId: this.container.presentationId,
                    userId: this.userId,
                    event: ACTIONS.create,
                    detail: {
                        parentId: parentId,
                        descriptor:raw
                    }
                })

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