import { EVENTS as MouseEvents, Mouse } from '../utils/mouse.js'
import { Keyboard } from '../utils/Keyboards.js'
import { ACCESS_REQUIREMENT } from '../utils/InputAccessManager.mjs'

//ToDo: interface showing the link and options to: navigate, pull-in, close, edit (if-applicable)
export class ContainerReferenceActuator {
    appId = 'container.interact.reference'
    #linkNodeId = 'container.interact.reference-link-node'
    #textNodeId = 'container.interact.reference-text-node'
    #editButtonId = 'container.interact.reference-edit-button'
    #editOperationName = "editURLreference"

    #target = null;
    #canEdit = false;
    #interface = null;
    #container = null;
    #enabled = false
    #keyboard = null;
    #mouse = null;

    constructor(container) {
        this.#container = container
        this.#container.registerComponent(this);

        this.#keyboard = new Keyboard(this.appId, container, ACCESS_REQUIREMENT.DEFAULT)
        this.#mouse = new Mouse(this.appId, container);
		this.#mouse.setAction(MouseEvents.CLICK, (e) => {
			this.onClick(e.detail.id, e.detail.originalEvent.button != 0)
		})

        this.#interface = this.#container.createFromSerializable(document.body, {
			"nodeName":"div",
			"computedStyle":{
				"top":"0px",
				"left":"0px",
				"position":"absolute"
			},
			"data":{
				"ignore":true,
				"containerPermissions":{
					"container.broadcast":{"*":false},
					"container.bridge":{"*":false}
				}
			}
		},
		null,
		this.appId)

		this.#container.hide(this.#interface, this.appId)
		//load interface style and html
		this.#container.loadStyle("style.css", this.appId)
		this.#container.loadHtml(this.#interface, "interface.html", this.appId)
    }

    enable() {
        if(!this.#enabled) {
            this.#enabled = true
            this.#mouse.enable();	
			this.#keyboard.enable();
            this.updateCanEdit();
        }
    }  
    
    disable() {
        if (this.#enabled) {
            this.#enabled = false
            this.#mouse.disable();	
			this.#keyboard.disable();
        }
    }

    updateCanEdit() {
        this.#canEdit = this.#container.canExecuteWithComponent(this.#editOperationName);
    }

    isEnabled() {
		return this.#enabled
	}

    shouldNavigateToLink() {
        let keyboardState = this.#keyboard.getCurrentKeyState();
        return keyboardState.get("pressedNonPrintables").has("Control")
    }

    tryEditLink() {
        this.#container.tryExecuteWithComponent(this.#editOperationName, new Set([this.hideInterface()]))
    }

    showInterface(node, url) {
        this.#target = node
        let pos = this.#container.getPosition(node)
        
        this.#container.lookup(this.#linkNodeId).href = url
        this.#container.lookup(this.#textNodeId).innerHTML = url
        if (this.#canEdit) {
            this.#container.show(this.#editButtonId, this.appId)
        } else {
            this.#container.hide(this.#editButtonId, this.appId)
        }

        this.#container.show(this.#interface)
        let height = this.#container.getHeight(this.#interface)
        pos.top -= height;
        this.#container.setPosition(this.#interface, pos, this.appId)
        this.#container.bringToFront(this.#interface, this.appId)
    }

    hideInterface() {
        let target = this.#target
        this.#target = null;
        this.#container.hide(this.#interface, this.appId)
        return target
    }

    onClick(id, button) {
        let url = this.#container.getReference(id)
        if (url) { 
            if (this.shouldNavigateToLink()){
                window.open(url, "_blank");
            } else {
                this.showInterface(this.#container.lookup(id), url);
            }
        } else {
            this.hideInterface();
        }
    }
}