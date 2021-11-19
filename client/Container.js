//ToDo
//fetch component interfaces and styles from server
//load them into DOM

//Node data attributes are strings
//ToDo: make collapse a bit more content aware (based on settings). e.g. collapse but fit title (first text child). or collapse only modifiable
let CONTAINER_COUNT = 0
export class Container {
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

    constructor(parentDom) {
        console.log("CREATED CONTAINER OBJECT")
		this.parent = parentDom;
		this.presentationId = Container.getQueryVariable("pid")
	}

    //<utils>
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

    lookup (id) {
        return Container.lookup(id);
    }

    index(root) {
		let queue = [root || this.parent]
		var index = 0
		var labeledCount = 0;
		do {
			let item = queue[index]
			if (!item.id && item.nodeName != "SCRIPT" && item.nodeName != "BODY") {
				item.id = Container.generateUUID()	
                CONTAINER_COUNT++;
				labeledCount += 1;
			}
            
            //init actions
            try {
                this.initActions(item)
                this.loadPermissionsFromDom(item)
            } catch (e) {
                console.log("Could not init container actions. Did you not include the module?")
                console.error(e)
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

    //ToDo: make this regex
    detectUnit(val) {
        let units = ['px','%']
        for (const unit of units) {
            if (val.endsWith(unit)) {
                return unit
            }
        }
        return undefined
    }
    //</utils>

    //<Permissions Subsystem>
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

    loadPermissionsFromDom (node) {
        let perms = JSON.parse(node.getAttribute("data-container-permissions"))
        if (perms && typeof perms != 'string') {
            console.log("Loading permissions from DOM")
            this.permissions[node.id] = perms
        }
    }
    //</permissions Subsystem>

    //<extensions subsystem>
    //ToDo: get interface and style from server
    registerComponent(pointer) {
        let name = pointer.appId
        if (name in this.components) {
            throw `${name} component is already registered`
        }

        this.components[name] = pointer;
        console.log(`Registered ${name}`);
    }

    #unregisterComponent(component) {
        component.disable()
        delete this.components[component.appId]
        console.log(`Unregistered component ${component.appId}`)
    }

    unregisterComponent(component) {
        if (component.appId in this.components) {
            this.#unregisterComponent(component)
            return
        }
    }

    getComponent(appName) {
        for (const [name, pointer] of Object.entries(this.components)) {
            if (appName == name) {
                return pointer
            }
        }

        return null;
    }
    //</extensions subsystem>
    
    //<nesting>
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
    //</nesting>

    //<size>
    //contextualise width and height based on type of element and wrapping
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
    
    getWidth(id) {
		return jQuery(Container.lookup(id)).width();
	}

	getHeight(id) {
		return jQuery(Container.lookup(id)).height();
	}
    //</size>
	
    setAngle(id, angle, originX, originY, callerId) {
        this.isOperationAllowed('container.set.angle', id, callerId);
        let node = Container.lookup(id)
        this.styleChild(node, {
            "transform-origin": `${originX} ${originY}`,
            "transform":`rotate(${angle})`
        })
    }
    getAngle(id) {
        //ToDo
    }
    //</rotation>

    hide(id, callerId) {
        let elem = Container.lookup(id);
        this.isOperationAllowed('container.hide', elem, callerId);
        
        $(elem).hide();
        this.emit('container.hide', {
            id:id,
            callerId:callerId
        });
    }

    show(id, callerId) {
        let elem = Container.lookup(id);
        this.isOperationAllowed('container.show', elem, callerId);
        
        $(elem).show();
        this.emit('container.show', {
            id:id,
            callerId:callerId
        });
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

    styleChild(child, style, callerId) {
        let computedStyle = window.getComputedStyle(child)
        for (const [tag, value] of Object.entries(style)) {
            if (Container.isFunction(value)) {
                let computedValue = value.call(this, computedStyle.getPropertyValue(tag))
                child.style.setProperty(tag, computedValue)
            } else {
                child.style.setProperty(tag, value) //important
            }
        }
        this.emit('container.update', {id:child.id, callerId:callerId})
    }

    updateChild(child, rawDescriptor, callerId){
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
            this.styleChild(child, rawDescriptor['computedStyle'], callerId)    
        } else {
            this.emit('container.update', {id:child.id, callerId:callerId})
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
        
        try {
            this.initActions(child)
        } catch (e) {
            console.log("Could not init container actions. Did you not include the module?")
            console.error(e)
        }

        //ToDo: fix this event firing (it's not accurate)
        CONTAINER_COUNT ++;
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
            CONTAINER_COUNT++;
            this.emit("container.create", {
                presentationId: this.presentationId, 
                parentId: parent.id,
                callerId: callerId,
                id: domNode.id
            });
        }
    }

    delete(id, callerId) {
        let child = Container.lookup(id)
        this.isOperationAllowed('container.delete', child, callerId);

        if (child != this.parent) {
            child.parentNode.removeChild(child);
            CONTAINER_COUNT--;
            this.emit('container.delete', {
                id:id,
                callerId: callerId
            });

        } else {
            console.log(`A delete attempt was made on the root of the doc. Pls don't...`);
        }
    }

    //<serialization>
    toSerializableStyle(id, snapshot) {
        let elem = Container.lookup(id);
        let computedStyle = elem.style;
        if (snapshot) {
            computedStyle = window.getComputedStyle(elem)
        }

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
    //</serialization>

    bringToFront(id) {
        let node = Container.lookup(id)
        node.style.zIndex = `${CONTAINER_COUNT + 1}` 
    }

    sendToBottom(id) {
        let node = Container.lookup(id)
        node.style.zIndex = "0"
    }

    setZIndex(id, index) {
        let node = Container.lookup(id)
        node.style.zIndex = `${index}` 
    }

    //<events>
    notifyUpdate(id) {
        let node = Container.lookup(id)
        this.emit('container.update', {id:node.id})
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
    //</events>
}