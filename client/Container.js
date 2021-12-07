//ToDo
//fetch component interfaces and styles from server
//load them into DOM

//Node data attributes are strings
//ToDo: make collapse a bit more content aware (based on settings). e.g. collapse but fit title (first text child). or collapse only modifiable
export const ACTIONS = {
    create: 'container.create',
    delete: 'container.delete',
    deleteSparingChildren: 'container.delete.sparingChildren',
    setParent: 'container.set.parent',
    update: 'container.update',
    
    setPosition: 'container.setPosition',
    setWidth: 'container.set.width',
    setHeight: 'container.set.height',
    setAngle: 'container.set.angle',
    setSiblingPosition: 'container.set.sibling.position',
    hide: 'container.hide',
    show: 'container.show',
    componentAdded: 'container.component.added',
    componentRemoved: 'container.component.removed'
}

//events that can automatically triger other events.
//WARNING: the related events will only receive id and callerId as details as well as the original_event data.
let ACTIONS_CHAIN = {}
    ACTIONS_CHAIN[ACTIONS.setPosition] = [ACTIONS.update]
    ACTIONS_CHAIN[ACTIONS.setWidth] = [ACTIONS.update]
    ACTIONS_CHAIN[ACTIONS.setHeight] = [ACTIONS.update]
    ACTIONS_CHAIN[ACTIONS.setAngle] = [ACTIONS.update]
    ACTIONS_CHAIN[ACTIONS.setSiblingPosition] = [ACTIONS.update]

export class Container {
	//ToDo: make all fields private
    parent = null;
	presentationId = null;
	socket = null;
    debug = false;
    CONTAINER_COUNT = 0;
    /*
    Permissions describing what operations can be performed on containers
    Format {"containerId":{"operation":{"callerId":true/false}}}
    e.g. {
        "7702-container":{
            "container.delete":{
                "container.creator":false - denies delete permissions to app container.create
                "777398fas99292": false - denies delete permissions to user 777398fas99292
            },
            "container.setPosition":{
                "*":false - denied move permissions to everyone
            }
        }
    }
    */
    permissions = {}
	metastate = {}
    
    components = {}
    skipSetOnDOM = {"nodeName":true, "children":true, "childNodes":true}

    constructor(parentDom, debug) {
        console.log("CREATED CONTAINER OBJECT")
		this.parent = parentDom;
		this.presentationId = Container.getQueryVariable("pid")
        this.debug = debug
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

    index (root, emit) {
		let queue = [root || this.parent]
		var index = 0
		var labeledCount = 0;
		do {
			let item = queue[index]
            if (!item.id && item.nodeName != "SCRIPT" && item.nodeName != "BODY") {
				item.id = Container.generateUUID()	
                this.CONTAINER_COUNT++;
				labeledCount += 1;
			}
            
            if (item.children) {
				for (const child of item.children) {
					queue.push(child)
				}
			}

            this.#initDOMcontainer(item)
			index ++;

            if(emit != false) {
                this.emit(ACTIONS.create, {
                    presentationId: this.presentationId, 
                    parentId: (item.parentNode || this.root).id, 
                    id: item.id
                });
            }
		} while(index < queue.length)

		console.log(`Indexed ${index} document entities. Labeled ${labeledCount}`)
	}

	init (element) {
		//ToDo: check element type and enforce dom object
		console.log(`Initialising presentation engine with ID: ${this.presentationId}`)
		this.index();
		this.emit("Container.init", {presentationId:this.presentationId});
	}

    #initDOMcontainer(item) {
        //init actions
        try {
            this.initActions(item)
            this.loadPermissionsFromDom(item)
        } catch (e) {
            console.log("Could not init container actions. Did you not include the module?")
            console.error(e)
        }
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
            this.permissions[elem.id][permName] = {}
        }
        this.permissions[elem.id][permName][opCaller] = allow
        //ToDo: emit update
    }

    removePermission(id, permName, opCaller, callerId) {
        let elem = Container.lookup(id);
        let operation = `remove.${permName}`
        this.isOperationAllowed(operation, elem, callerId)
        
        if (this.permissions[elem.id] && this.permissions[elem.id][permName]){
            if (opCaller) {
                if (opCaller in this.permissions[elem.id][permName]) {
                    delete this.permissions[elem.id][permName][opCaller]
                }
            } else {
                delete this.permissions[elem.id][permName]
            }
        }
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
        this.emit(ACTIONS.componentAdded, {
            name: name
        }) 
    }

    #unregisterComponent(component) {
        component.disable()
        delete this.components[component.appId]
        console.log(`Unregistered component ${component.appId}`)
        this.emit(ACTIONS.componentRemoved, {
            name: component.appId
        }) 
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

    listComponents() {
        return Object.keys(this.components)
    }
    //</extensions subsystem>
    
    //<nesting>
	setParent(childId, parentId, callerId, options) {
        let parent = Container.lookup(parentId);
        let child = Container.lookup(childId);

        this.isOperationAllowed(ACTIONS.setParent, child, callerId);
        this.isOperationAllowed(ACTIONS.create, parent, callerId);
        console.log(`Change parent for ${child.id} to ${parent.id}`)

        let prevParentId = child.parentNode.id;
        if (options && options.insertBefore && parent.firstChild) {
            jQuery(child).detach().insertBefore(Container.lookup(options.insertBefore));
        } else {
            jQuery(child).detach().appendTo(parent);    
        }

        this.emit(ACTIONS.setParent, {
            id: child.id,
            prevParent: prevParentId,
            parentId: parent.id,
            callerId: callerId
        })
        //update server on updated elements
        this.notifyUpdate(child, callerId)
        this.notifyUpdate(prevParentId, callerId)
        this.notifyUpdate(parent, callerId)
    }
    //</nesting>

    //<size>
    //contextualise width and height based on type of element and wrapping
	setWidth(id, width, callerId) {
        let elem = Container.lookup(id)
        this.isOperationAllowed(ACTIONS.setWidth, elem, callerId);
        
        let prevWidth = this.getWidth(id);
        jQuery(elem).css({width: width});
        this.emit(ACTIONS.setWidth, {
            id: elem.id, 
            width: width, 
            prevWidth: prevWidth,
            callerId: callerId
        });
	}

	setHeight(id, height, callerId) {
        let elem = Container.lookup(id);
        this.isOperationAllowed(ACTIONS.setHeight, elem, callerId);
        
        let prevHeight = this.getHeight(elem);
        jQuery(elem).css({height: height});
        this.emit(ACTIONS.setHeight, {
            id: elem.id, 
            height: height, 
            prevHeight: prevHeight,
            callerId: callerId
        });
    }
    
    getWidth(id) {
        return jQuery(Container.lookup(id)).width()
	}

	getHeight(id) {
        return jQuery(Container.lookup(id)).height()
	}

    getContentHeight (id) {
        return Container.lookup(id).scrollHeight
    }

    getContentWidth (id) {
        return Container.lookup(id).scrollWidth
    }
    //</size>
	
    setAngle(id, angle, originX, originY, callerId) {
        this.isOperationAllowed(ACTIONS.setAngle, id, callerId);
        let node = Container.lookup(id)
        this.styleChild(node, {
            "transform-origin": `${originX} ${originY}`,
            "transform":`rotate(${angle})`
        })
        this.emit(ACTIONS.setAngle, {
            id:node.id, 
            //prevAngle:prevAngle,
            // prevOrigin:{

            // },
            angle: angle,
            origin:{
                originX: originX,
                originY: originY
            },
            callerId:id
        })
    }

    getAngle(id) {
        //ToDo
    }
    //</rotation>

    hide(id, callerId) {
        let elem = Container.lookup(id);
        this.isOperationAllowed(ACTIONS.hide, elem, callerId);
        
        $(elem).hide();
        this.emit(ACTIONS.hide, {
            id:elem.id,
            callerId:callerId
        });
    }

    show(id, callerId) {
        let elem = Container.lookup(id);
        this.isOperationAllowed(ACTIONS.show, elem, callerId);
        
        $(elem).show();
        this.emit(ACTIONS.show, {
            id:elem.id,
            callerId:callerId
        });
    }

    //get bounding box in absolute coordinates
    //wonder if the browser is willing to give this up... rather than having to compute it in JS
    getContentBoundingBox(id) {
        // let result = {
        //     top: undefined,
        //     left: undefined,
        //     bottom: undefined,
        //     right: undefined,
        //     width: undefined,
        //     height: undefined
        // }

        // let node = Container.lookup(id)
        // if (node.children) {
        //     for(const child of node.children) {
        //         let rect = child.getBoundingClientRect();
        //         if (result.left == undefined || result.left > rect.left) {
        //             result.left = rect.left
        //         }
        //         if (result.top == undefined || result.top > rect.top) {
        //             result.top = rect.top
        //         }
        //         if (result.bottom == undefined || result.bottom < rect.bottom) {
        //             result.bottom = rect.bottom
        //         }
        //         if (result.right == undefined || result.right < rect.right) {
        //             result.right = rect.right
        //         }
        //     }

        //     result.width = Math.abs(result.right - result.left)
        //     result.height = Math.abs(result.bottom - result.top)
        // }
        let node = Container.lookup(id)
        let result = this.getPosition(node)
        result.right = result.left + node.scrollWidth //warning: scroll width and height are integers not fractions 
        result.bottom = result.top + node.scrollHeight
        result.bbox = node.getBoundingClientRect();
        return result;
    }

    getBoundingBox(id) {
        let bbox = this.getPosition(id)
        bbox.right = bbox.left + this.getWidth(id)
        bbox.bottom = bbox.top + this.getHeight(id)
        return bbox;
    }

    styleChild(child, style, callerId, emit) {
        let computedStyle = window.getComputedStyle(child)
        for (const [tag, value] of Object.entries(style)) {
            if (Container.isFunction(value)) {
                let computedValue = value.call(this, computedStyle.getPropertyValue(tag))
                child.style.setProperty(tag, computedValue)
            } else {
                child.style.setProperty(tag, value) //important
            }
        }

        if(emit != false) {
            this.emit(ACTIONS.update, {id:child.id, callerId:callerId})
        }
    }

    getChildAt(parentId, index) {
        let parent = Container.lookup(parentId)
        if (index < 0 || index >= parent.childNodes.length) {
            return undefined;
        }

        return parent.childNodes[index]
    }

    getSiblingPosition(siblingId) {
        let sibling = Container.lookup(siblingId)
        let parent = sibling.parentNode
        if (parent) {
            for ( let i = 0 ; i < parent.childNodes.length; ++i ) {
                if (parent.childNodes[i].id == sibling.id) {
                    return i;
                }
            }
        }
        return undefined;
    }

    setSiblingPosition(siblingId, index, callerId) {
        let sibling = Container.lookup(siblingId)
        this.isOperationAllowed(ACTIONS.setSiblingPosition, sibling, callerId);
        let parent = sibling.parentNode

        let switchSibling = this.getChildAt(parent, index)
        
        if(this.debug) {
            console.log(`Moving ${siblingId} before:`)
            console.log(switchSibling)
        }
        //special case, no move needed
        if (switchSibling == sibling) {
            return;
        }

        parent.removeChild(sibling)
        if (switchSibling) {
            parent.insertBefore(sibling, switchSibling)
        } else {
            parent.appendChild(sibling)
        }

        this.emit(ACTIONS.setSiblingPosition, {
            id: sibling.id,
            position: index,
            callerId: callerId
        })
    }

    changeSiblingPosition(siblingId, amount, callerId) {
        let sibling = Container.lookup(siblingId)
        let pos = this.getSiblingPosition(sibling)
        this.setSiblingPosition(sibling, pos + amount, callerId)
    }

    addDomChild(parentId, domNode, callerId) {
        let parent = Container.lookup(parentId);
        this.isOperationAllowed(ACTIONS.create, parent, callerId);

        if (domNode) {
            domNode.id = Container.generateUUID();
            parent.appendChild(domNode);
            this.#initDOMcontainer(domNode)
            
            this.CONTAINER_COUNT++;
            this.emit(ACTIONS.create, {
                presentationId: this.presentationId, 
                parentId: parent.id,
                callerId: callerId,
                id: domNode.id
            });
        }
    }

    delete (id, callerId) {
        let child = Container.lookup(id)
        this.isOperationAllowed(ACTIONS.delete, child, callerId);

        if (child != this.parent) {
            child.parentNode.removeChild(child);
            this.CONTAINER_COUNT--;
            this.emit(ACTIONS.delete, {
                id: child.id,
                callerId: callerId
            });

        } else {
            console.log(`A delete attempt was made on the root of the doc. Pls don't...`);
        }
    }

    deleteSparingChildren(id, callerId) {
        let elem = Container.lookup(id)
        this.isOperationAllowed(ACTIONS.delete, elem, callerId);
        this.isOperationAllowed(ACTIONS.deleteSparingChildren, elem, callerId);

        let parent = elem.parentNode || this.parent
        let children = []
        for (const child of elem.children) {
            children.push(child)
        }
        
        for (const child of children) {
            let pos = this.getPosition(child)
            try {
                this.setParent(child, parent, callerId)
                this.setPosition(child, pos, callerId)
            } catch (e) {
                console.log(`core: failed to save child`)
                console.error(e)
            }
        }

        this.delete(elem, callerId)
    }

    bringToFront(id) {
        let node = Container.lookup(id)
        node.style.zIndex = `${this.CONTAINER_COUNT + 1}` 
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
    notifyUpdate(id, callerId) {
        let node = (id) ? Container.lookup(id) : this.parent
        this.emit(ACTIONS.update, {id:node.id, callerId:callerId})
    }

	//ToDo: consider creating an abstraction over the event system. The current solution is a synchronous event system which could start buckling with many listeners and events.
	emit(type, details) {
        details['type'] = type;
		const event = new CustomEvent(type, {
		  bubbles: true,
		  detail: details
		});

        this.parent.dispatchEvent(event);

        //fire related events
        if (ACTIONS_CHAIN[type]) {
            for (const relatedEvent of ACTIONS_CHAIN[type]) {
                this.emit(relatedEvent, { id:details.id, callerId:details.callerId, original_event:details})
            }
        }
	}

    //ToDo: is this the best way to emit from app?
    appEmit(appId, type, details) {
        this.emit(appId+'.'+type, details); 
    }
    //</events>
}