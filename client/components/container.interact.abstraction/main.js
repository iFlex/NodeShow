import { ACTIONS } from "../../Container.js"
import { EVENTS as MouseEvents, Mouse } from '../utils/mouse.js'
import { Keyboard } from '../utils/Keyboards.js'
import { ACCESS_REQUIREMENT } from '../utils/InputAccessManager.mjs'

//ToDo: Mobile integration
export class ContainerAbstractionActuator {
    appId = 'container.interact.abstraction'
    #textNode = 'container.interact.abstraction-textNode'
    #editOperationName = "editAbstractionLevels"

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

        //if new components get added check if external operation can be performed by any of the new components
        //this could also be wired in directly in the constructor, but leads to more wiring
        this.#container.addEventListener(ACTIONS.componentAdded, (e) => { this.updateCanEdit(); })
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

    tryEditLink() {
        this.#container.tryExecuteWithComponent(this.#editOperationName, new Set([this.hideInterface()]))
    }

    updateDisplayedStatus() {
        let currentLevel = this.#container.getCurrentContentAbstractionLevel(this.#target)
        let totalAbsLevels = this.#container.getAbstractionLevels(this.#target)
        this.#container.lookup(this.#textNode).innerHTML = `${currentLevel}/${totalAbsLevels}`
    }

    changeLevel(amount) {
        let currentLevel = this.#container.getCurrentContentAbstractionLevel(this.#target) + amount
        let totalAbsLevels = this.#container.getAbstractionLevels(this.#target)
        currentLevel = Math.min(Math.max(0, currentLevel), totalAbsLevels)

        this.#container.setCurrentContentAbstractionLevel(this.#target, currentLevel, this.appId)
        this.updateDisplayedStatus()
    }

    showInterface(node) {
        this.#target = node
        let pos = this.#container.getPosition(node)
        
        this.updateDisplayedStatus()
        // if (this.#canEdit) {
        //     this.#container.show(this.#editButtonId, this.appId)
        // } else {
        //     this.#container.hide(this.#editButtonId, this.appId)
        // }

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

    onClick(id) {
        let node = this.#container.lookup(id)
        let totalAbsLevels = this.#container.getAbstractionLevels(node)
        if (totalAbsLevels > 0) { 
            this.showInterface(node);
        } else {
            this.hideInterface();
        }
    }
}