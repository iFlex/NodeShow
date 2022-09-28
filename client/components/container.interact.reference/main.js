import { EVENTS as MouseEvents, Mouse } from '../utils/mouse.js'
import { Keyboard } from '../utils/Keyboards.js'
import { ACCESS_REQUIREMENT } from '../utils/InputAccessManager.mjs'

//ToDo: interface showing the link and options to: navigate, pull-in, close, edit (if-applicable)
export class ContainerReferenceActuator {
    appId = 'container.interact.reference'
	
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
    }

    enable() {
        if(!this.#enabled) {
            this.#enabled = true
            this.#mouse.enable();	
			this.#keyboard.enable();
        }
    }  
    
    disable() {
        if (this.#enabled) {
            this.#enabled = false
            this.#mouse.disable();	
			this.#keyboard.disable();
        }
    }

    isEnabled() {
		return this.#enabled
	}

    shouldNavigateToLink() {
        let keyboardState = this.#keyboard.getCurrentKeyState();
        return keyboardState.get("pressedNonPrintables").has("Control")
    }

    onClick(id, button) {
        let url = this.#container.getReference(id)
        if (url && this.shouldNavigateToLink()){
            window.open(url, "_blank");
        }
    }
}