//Next gen Container

//ToDo
//fetch component interfaces and styles from server
//load them into DOM

//Node data attributes are strings
//ToDo: make collapse a bit more content aware (based on settings). e.g. collapse but fit title (first text child). or collapse only modifiable
class Container {
	//ToDo: make all fields private
    parent = null;
	presentationId = null;
	socket = null;

    /*
    Permissions describing what operations can be performed on containers
    Format {"containerId":{"operation":{"callerId":true/false}}}
    e.g. {
        "7702-container":{
            "container.delete":{
                "app:container.creator":false - denies delete permissions to app container.create
                "777398fas99292": false - denies delete permissions to user 777398fas99292
            },
            "container.move":{
                "*":false - denied move permissions to everyone
            }
        }
    }
    */
    permissions = {}
	metastate = {}

    components = {}
    skipSetOnDOM = {"nodeName":true, "children":true}

    static clone(obj) {
        return JSON.parse(JSON.stringify(obj))
    }

	static getQueryVariable(variable) {
		var query = window.location.search.substring(1);
		var vars = query.split('&');
		for (var i = 0; i < vars.length; i++) {
		    var pair = vars[i].split('=');
		    if (decodeURIComponent(pair[0]) == variable) {
		        return decodeURIComponent(pair[1]);
		    }
		}
		console.log('Query variable %s not found', variable);
	}

	static generateUUID() { // Public Domain/MIT
	    var d = new Date().getTime();//Timestamp
	    var d2 = ((typeof performance !== 'undefined') && performance.now && (performance.now()*1000)) || 0;//Time in microseconds since page-load or 0 if unsupported
	    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
	        var r = Math.random() * 16;//random number between 0 and 16
	        if(d > 0){//Use timestamp until depleted
	            r = (d + r)%16 | 0;
	            d = Math.floor(d/16);
	        } else {//Use microseconds since page-load if supported
	            r = (d2 + r)%16 | 0;
	            d2 = Math.floor(d2/16);
	        }
	        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
	    });
	}

    static isFunction(obj) {
        return typeof obj === 'function'
    }

    //Note: this should be very fast as it is heavily used in nearly all operations
	static lookup(id) {
		if (id instanceof Element) {
            return id;
        }

        let el = document.getElementById(id);
        if (!el) {
            throw `Could not find element ${id}`
        }

        return el
    }

    constructor(parentDom) {
		this.parent = parentDom;
		this.presentationId = Container.getQueryVariable("pid")
	}

    isOperationAllowed(operation, resource, callerId) {
        let rules = ((this.permissions[resource.id] || {})[operation] || {})
        
        if (rules) {
            let explicit = rules[callerId]
            if(explicit == false) {
                throw `DENIED ${operation} on ${resource.id} to ${callerId}`
            }
            if(explicit == true) {
                return true;
            }

            let general = rules["*"]
            if (general == false) {
                throw `DENIED ${operation} on ${resource.id} to ${callerId}`
            }
        } 

        return true;
    }

    setPermission(id, permName, opCaller, allow, callerId) {
        let elem = Container.lookup(id);
        let operation = `set.${permName}`
        this.isOperationAllowed(operation, elem, callerId)

        if (!(elem.id in this.permissions)) {
            this.permissions[elem.id] = {}
        }
        if (!(permName in this.permissions[elem.id])) {
            this.permissions[elem.id][opCaller] = {}
        }
        this.permissions[elem.id][permName][opCaller] = allow
        //ToDo: emit update
    }

    //ToDo: permission matching e.g. container.set.*
    getPermission(id, permName, opCaller) {
        let elem = Container.lookup(id);
        //prevent returning a pointer to the actual permission
        let permission = this.permissions[elem.id]
        if (permName) {
            permission = permission[permName]
            if (opCaller) {
                permission = permission[opCaller]
            }
        } else {
            permission = this.permissions[elem.id]
        }
        return Container.clone(permission)
    }

    lookup (id) {
        return Container.lookup(id);
    }

    //ToDo: get interface and style from server
    registerComponent(pointer) {
        let name = pointer.appId
        if (pointer in this.components) {
            throw `${name} component is already registered`
        }

        this.components[pointer] = name;
        console.log(`Registered ${name}`);
    }

    #unregisterComponent(component) {
        component.disable()
        delete this.components[component]
        console.log(`Unregistered component ${component.appId}`)
    }

    unregisterComponent(component) {
        if (component in this.components) {
            this.#unregisterComponent(component)
            return
        }
        //unreister by name
        for (const comp of Object.keys(this.components)) {
            if (this.components[comp] == component) {
                this.#unregisterComponent(comp)
                break;
            }
        }
    }

	index() {
		let queue = [this.parent]
		var index = 0
		var labeledCount = 0;
		do {
			let item = queue[index]
			if (!item.id && item.nodeName != "SCRIPT" && item.nodeName != "BODY") {
				item.id = Container.generateUUID()	
				labeledCount += 1;
			}

			if (item.children) {
				for (const child of item.children) {
					queue.push(child)
				}
			}
			index ++;
		} while(index < queue.length)

		console.log(`Indexed ${index} document entities. Labeled ${labeledCount}`)
	}

	init(element) {
		//ToDo: check element type and enforce dom object
		console.log(`Initialising presentation engine with ID: ${this.presentationId}`)
		this.index();
		this.emit("Container.init", {presentationId:this.presentationId});
	}

	setParent(childId, parentId, callerId) {
        //ToDo permissions
        //this.isOperationAllowed('container.delete', id, callerId);
        let parent = Container.lookup(parentId);
        let child = Container.lookup(childId);
        this.isOperationAllowed('container.create', parent, callerId);
        
        let prevParentId = child.parent.id;
        jQuery(child).detach().appendTo(parent);
        this.emit('container.ser.parent', {
            id: childId,
            prevParent: prevParentId,
            parentId: parentId,
            callerId: callerId
        })
    }

	
	setWidth(id, width, callerId) {
        let elem = Container.lookup(id)
        this.isOperationAllowed('container.set.width', elem, callerId);
        
        let prevWidth = this.getWidth(id);
        jQuery(elem).css({width: width});
        this.emit("container.set.width", {
            id: id, 
            width: width, 
            prevWidth: prevWidth,
            callerId: callerId
        });
	}

	setHeight(id, height, callerId) {
        let elem = Container.lookup(id);
        this.isOperationAllowed('container.set.height', elem, callerId);
        
        let prevHeight = this.getHeight(id);
        jQuery(elem).css({height: height});
        this.emit("container.set.height", {
            id: id, 
            height: height, 
            prevHeight: prevHeight,
            callerId: callerId
        });
    }

	setPosition(id, position, callerId) {
        let elem = Container.lookup(id);
        this.isOperationAllowed('container.move', elem, callerId);
		
        jQuery(elem).css({top: position.top, left: position.left, position:'absolute'});
        this.emit("container.setPosition", {
            id: id, 
            position: position,
            callerId: callerId
        });
	}


	getPosition(id) {
		return jQuery(Container.lookup(id)).position();
	}

	move(id, dx, dy, callerId) {
		let pos = this.getPosition(id)
        pos.top += dy;
        pos.left += dx;
        this.setPosition(id, pos, callerId)
	}

    setAngle(id, angle, rotX, rotY, callerId) {
        this.isOperationAllowed('container.set.rotation', id, callerId);
        //ToDo
    }
    
    getAngle(id) {
        //ToDo
    }

    rotate(id, deg, rotX, rotY, callerId) {
        //ToDo
    }

	getWidth(id) {
		return jQuery(Container.lookup(id)).width();
	}

	getHeight(id) {
		return jQuery(Container.lookup(id)).height();
	}

    delete(id, callerId) {
        let child = Container.lookup(id)
        this.isOperationAllowed('container.delete', child, callerId);

        if (child != this.parent) {
            child.parentNode.removeChild(child);
            this.emit('container.delete', {
                id:id,
                callerId: callerId
            });

        } else {
            console.log(`A delete attempt was made on the root of the doc. Pls don't...`);
        }
    }

    hide(id, callerId) {
        let elem = Containr.lookup(id);
        this.isOperationAllowed('container.hide', elem, callerId);
        
        $(elem).hide();
        this.emit('container.hide', {
            id:id,
            callerId:callerId
        });
    }

    show(id, callerId) {
        let elem = Containr.lookup(id);
        this.isOperationAllowed('container.show', elem, callerId);
        
        $(elem).show();
        this.emit('container.show', {
            id:id,
            callerId:callerId
        });
    }

    //Collapse subsystem
    //ToDo: find a better way to store state rather than as string in data- objects
    //collpase settings should be sent to the server somehow
    isCollapsed(id) {
        let node = Container.lookup(id)
        
        if (node.getAttribute('data-prev-style')) {
            return true;
        }
        return false;
    }

    collapse(id, callerId) {
        let node = Container.lookup(id)
        this.isOperationAllowed('container.collapse', node, callerId);
        if (node.getAttribute('data-prev-style')) {
            //already collapsed
            return;
        }

        let settings = JSON.parse(node.getAttribute('data-collapse-settings'))
        let prevState = this.toSerializableStyle(id)
        
        try {
            if (settings.height) {
                this.setHeight(id, settings.height, callerId)
            }
            if (settings.width) {
                this.setWidth(id, settings.width, callerId)
            }
        } catch (e) {
            //may partially fail due to permissions
            console.error(e)
        }
        
        node.setAttribute('data-prev-style', JSON.stringify(prevState))
        node.style.overflow = 'hidden';
        this.emit('container.collapse', {
            id:id,
            callerId:callerId
        });
    }

    setCollapseMode(id, settings) {
        Container.lookup(id).setAttribute('data-collapse-settings', JSON.stringify(settings))    
    }

    expand(id, callerId) {
        let node = Container.lookup(id);
        this.isOperationAllowed('container.expand', node, callerId);
        
        let prevStat = JSON.parse(node.getAttribute('data-prev-style'))
        if (prevStat) {
            this.styleChild(node, prevStat)
            node.removeAttribute('data-prev-style')
            this.emit('container.expand', {
                id:id,
                callerId:callerId
            });
        }
    }

    //get bounding box in absolute coordinates
    //wonder if the browser is willing to give this up... rather than having to compute it in JS
    getContentBoundingBox(id) {
        let result = {
            top: undefined,
            left: undefined,
            bottom: undefined,
            right: undefined,
            width: undefined,
            height: undefined
        }

        let node = Container.lookup(id)
        if (node.children) {
            for(const child of node.children) {
                let rect = child.getBoundingClientRect();
                if (result.left == undefined || result.left > rect.left) {
                    result.left = rect.left
                }
                if (result.top == undefined || result.top > rect.top) {
                    result.top = rect.top
                }
                if (result.bottom == undefined || result.bottom < rect.bottom) {
                    result.bottom = rect.bottom
                }
                if (result.right == undefined || result.right < rect.right) {
                    result.right = rect.right
                }
            }

            result.width = Math.abs(result.right - result.left)
            result.height = Math.abs(result.bottom - result.top)
        }
        return result;
    }

    getBoundingBox(id) {
        Container.lookup(id).getBoundingClientRect();
    }

    styleChild(child, style) {
        let computedStyle = window.getComputedStyle(child)
        for (const [tag, value] of Object.entries(style)) {
            if (Container.isFunction(value)) {
                let computedValue = value.call(this, computedStyle.getPropertyValue(tag))
                child.style.setProperty(tag, computedValue)
            } else {
                child.style.setProperty(tag, value) //important
            }
        }
    }

    updateChild(child, rawDescriptor){
        var total = 0;
        var set = 0;
        
        //set an id for this untagged child...
        if (!child.id && !rawDescriptor.id) {
            child.id = Container.generateUUID();
        }
        //bulindly applying all properties received
        for (const [tag, value] of Object.entries(rawDescriptor)) {
            if (this.skipSetOnDOM[tag] || !value){
                continue;
            }
            
            try {
                child[tag] = value;
            } catch (e) {
                console.error(`Could not set tag:${tag} on ${child.id}`);
                console.error(e);
            }
        }

        //applying style
        if (rawDescriptor['cssText']){
            child.style.cssText = rawDescriptor['cssText']    
        }

        if (rawDescriptor['computedStyle']) {
            this.styleChild(child, rawDescriptor['computedStyle'])    
        }  
    }

    updateStyleFromSerializable(id, style) {
        let child = Container.lookup(id)
        this.styleChild(child, style)
    }

    //Prone to UID collisions. It won't complain if you want to create an element that already exists
	createFromSerializable(parentId, rawDescriptor, insertBefore, callerId) {
        //this.isOperationAllowed('container.create', parentId, callerId);

		let parent = this.parent;
        let child = undefined
		
        if (parentId) {
			parent = Container.lookup(parentId);
		}
		try {
            child = Container.lookup(rawDescriptor.id)
        } catch (e){
            console.log(`Could not locate child by id ${rawDescriptor.id}, will generate it`)
        }
        
        if (!child) {
            if (rawDescriptor.nodeName.toLowerCase() == 'body'){
                //child = this.parent
                console.log("No need to re-create the body object");
                return;
            } else {
                child = document.createElement(rawDescriptor['nodeName'])    
                if (insertBefore) {
                    parent.insertBefore(child, insertBefore);
                } else {
                    parent.appendChild(child);
                }
            }
        }
        
        this.updateChild(child, rawDescriptor)

        if (rawDescriptor.permissions) {
            this.permissions[child.id] = Container.clone(rawDescriptor.permissions)
        }
        
        //ToDo: fix this event firing (it's not accurate)
        this.emit("container.create", {
            presentationId: this.presentationId, 
            parentId: parent.id, 
            id: child.id, 
            callerId: callerId,
            descriptor: rawDescriptor
        });
        return child;
    }

    addDomChild(parentId, domNode, callerId) {
        let parent = Container.lookup(parentId);
        this.isOperationAllowed('container.create', parent, callerId);

        if (domNode) {
            domNode.id = Container.generateUUID();
            parent.appendChild(domNode);
            this.emit("container.create", {
                presentationId: this.presentationId, 
                parentId: parent.id,
                callerId: callerId,
                id: domNode.id
            });
        }
    }

    toSerializableStyle(id) {
        let elem = Container.lookup(id);
        let computedStyle = window.getComputedStyle(elem)

        let result = {}
        for (const item of computedStyle) {
            result[item] = computedStyle.getPropertyValue(item)
        }

        return result;
    }

	toSerializable(id) {
		let relevantProps = ['id','nodeName','innerHTML','className', 'src']

		let elem = Container.lookup(id);
		
		let serialize = {}
		for (const tag of relevantProps) {
			serialize[tag] = elem[tag];
		}

        serialize['cssText'] = elem.style.cssText;
		serialize['computedStyle'] = this.toSerializableStyle(id);
        //save data- tags
        let data = $(elem).data();
        for(const [tag, value] of Object.entries(data)) {
            serialize[tag] = value
        }
        //save metadata
        serialize["permissions"] = this.permissions[elem.id]

		return serialize;
	}

	//ToDo: consider creating an abstraction over the event system. The current solution is a synchronous event system which could start buckling with many listeners and events.
	emit(type, details) {
        details['type'] = type;
		const event = new CustomEvent(type, {
		  bubbles: true,
		  detail: details
		});

        this.parent.dispatchEvent(event);
	}

    //ToDo: is this the best way to emit from app?
    appEmit(appId, type, details) {
        this.emit(appId+'.'+type, details); 
    }
}

class LiveBridge {
	container = null;
	socket = null;
	userId = null;

    host = window.location.host;
    port = window.location.port;

    #events = {
        'container.create': {send:this.sendUpdate, recv:null},
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
        let raw = null
        if (eventType != 'container.delete') {
            raw = this.container.toSerializable(targetId);
        }

        let update = {
            presentationId: this.container.presentationId,
            userId: this.userId,
            event: eventType,
            detail: {
                parentId: e.detail.parentId,
                id: targetId,
                descriptor:raw
            }
        }

        console.log("Sending server update")
        console.log(update)
        
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

let container = new Container(document.body);
container.init();

let bridge = new LiveBridge(container);
bridge.registerSocketIo();