import {Container} from "./Container.js"

export class LiveBridge {
	container = null;
	socket = null;
	userId = null;

    host = window.location.host;
    port = window.location.port;

    #events = {
        'container.create': {send:this.sendUpdate, recv:null},
        'container.update': {send:this.sendUpdate, recv:null},
        'container.setPosition': {send:this.sendUpdate, recv:null},
        'container.set.width': {send:this.sendUpdate, recv:null},
        'container.set.height': {send:this.sendUpdate, recv:null},
        'container.delete': {send:this.sendUpdate, recv:null},
    }

	//should plug into all relevant events and report them to the server
	constructor(container) {
		this.container = container;
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

    sendUpdate(e) {
        //check if this update originates from our user and not from the network
        if(e.detail.callerId && e.detail.callerId != this.userId){
            console.log("Not sending network update back to the network")
            return;
        }

        let targetId = e.detail.id;
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

        //console.log("Sending server update")
        //console.log(update)
        
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
        this.socket.on('user.joined', d => console.log(`User joined ${d.userId}`))
        this.socket.on('user.left', d => console.log(`User left ${d.userId}`))
    }

	handleUpdate(data) {
		console.log("Received server update");
		console.log(data);
        
        if (!data.userId) {
            //populate with userId in case it's not there. all network updates should have a value for the userid
            data.userId = this.host
        }

		let detail = data.detail
        if(data.event == 'container.setPosition' || data.event == 'container.set.width' || data.even == 'container.set.height') {
            this.container.updateStyleFromSerializable(detail.id, detail.descriptor.computedStyle, data.userId);
        }
        if(data.event == 'container.update') {
            let child = this.container.lookup(detail.id)
            this.container.updateChild(child, detail.descriptor, data.userId)
        }
        if(data.event == 'container.delete') {
            this.container.delete(detail.id, "user:"+data.userId, data.userId)
        }

        if(data.event == 'container.create') {
            this.container.createFromSerializable(detail.parentId, detail.descriptor, null, data.userId);
        }
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
                    event:"container.create",
                    detail: {
                        parentId: parentId,
                        descriptor:raw
                    }
                })

				this.socket.emit("update", jsndata, function(err, success) {
                    console.log(success);
                    if (err) {
                        console.log("Socket failure");
                        console.log(err);
                        faliures++;
                    } else {
                        count ++;
                    }
                });
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