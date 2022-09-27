import KeyboardTracker from "./KeyboardTracker.js"
import { InputAccessManagerInstance as InputAccessManager } from "./InputAccessManager.mjs"

/** @class
 *  @summary Component managing simultaneous access to the keyboard. 
 *  @description TODO
 * */ 

class KeyboardManager {
	
	#accessMgr = null;
	#changeCallback = null;
	#RESOURCE = 'keyboard'
	#activeListeners = new Set([])
	#keyboards = new Map([])

	constructor(accessManager) {
		this.#accessMgr = accessManager
	}

	setChangeCallback(cb) {
		this.#changeCallback = cb;
	}

	newKeyboard(instance) {
		this.#keyboards.set(instance.getId(),instance);
	}
	
	#applyListenerChange() {
		let allowedListeners = new Set(this.#accessMgr.getAllowed(this.#RESOURCE))
		let toRegister = KeyboardTracker.setDifference(allowedListeners, this.#activeListeners)
		let toUnregister = KeyboardTracker.setDifference(this.#activeListeners, allowedListeners)

		for (const instanceId of toUnregister) {
			this.#unregisterInstanceHandlers(this.#keyboards.get(instanceId))
		}

		for (const instanceId of toRegister) {
			this.#registerInstanceHandlers(this.#keyboards.get(instanceId))
		}
	}

	enable(instance) {
		this.#accessMgr.register(this.#RESOURCE, instance.getId(), instance.getAccessMode())
		this.#applyListenerChange()

		if (this.#changeCallback) {
			this.#changeCallback()
		}
	}

	disable(instance) {
		this.#accessMgr.unregister(this.#RESOURCE, instance.getId())
		this.#applyListenerChange()

		if (this.#changeCallback) {
			this.#changeCallback()
		}
	}

	handlersChanged(instance) {
		if (this.#activeListeners.has(instance.getId)) {
			this.#registerInstanceHandlers(instance);	
		}
	}

	#registerInstanceHandlers(instance) {
		let handlers = instance.getHandlers()
		this.#activeListeners.add(instance.getId())

		for (const [ignore, handlerInfo] of handlers) {
			try {
				let method = KeyboardTracker[handlerInfo.action]
				let args = [handlerInfo.keys, handlerInfo.listenerId, handlerInfo.handlerSpecifier]
				if (handlerInfo.action.includes("Printable")) {
					args = args.slice(1)
				}
				
				method.apply(KeyboardTracker, args)
			} catch (e) {
				console.error(`Failed to set keyboard event handler for ${instance.getId()}. For keys: ${JSON.stringify(handlerInfo.keys)}`, e)
			}
		}
	}

	#unregisterInstanceHandlers(instance) {
		let handlers = instance.getHandlers();
		this.#activeListeners.delete(instance.getId())

		for (const [ignore, handlerInfo] of handlers) {
			try {
				let methodName = handlerInfo.action.replace("set","remove")
				let method = KeyboardTracker[methodName]
				let args = [handlerInfo.keys, handlerInfo.listenerId]
				if (handlerInfo.action.includes("Printable")) {
					args = args.slice(1)
				}

				method.apply(KeyboardTracker, args)
			} catch (e) {
				console.error(`Failed to remove keyboard event handler for ${instance.getId()}. For keys: ${JSON.stringify(handlerInfo.keys)}`, e)
			}
		}
	}
}

let keyboardManager = new KeyboardManager(InputAccessManager);

export class Keyboard {
	static monoId = 0;

	#debug = true;
	#appId = null
	#container = null
	#uid = null;
	#handlers = new Map()
	#accessMode = null
	#manager = keyboardManager

	static generateUID() {
		Keyboard.monoId += 1; 
		return Keyboard.monoId;
	}

	constructor(appId, container, accessMode) {
		this.#appId = appId;
		this.#container = container;
		this.#accessMode = accessMode
		this.#uid = `${this.#appId}-${Keyboard.generateUID()}`
		
		this.#manager.newKeyboard(this)
		console.log(`[KEYBOARD ${this.#uid}] New Keyboard`)
	}

	getId() {
		return this.#uid
	}

	getAccessMode() {
		return this.#accessMode
	}

	getHandlers() {
		return this.#handlers
	}

	enable() {
		this.#manager.enable(this);
		if (this.#debug) {
            console.log(`[KEYBOARD ${this.#uid}] enabled`)
        }
	}

	disable() {
		this.#manager.disable(this);
		if (this.#debug) {
            console.log(`[KEYBOARD ${this.#uid}] disabled`)
        }
	}

	getCurrentKeyState() {
		return KeyboardTracker.getCurrentKeyState();
	}

	formHandlerSpec(scope, handler, preventDefault, isStrict) {
		let handlerSpec = {scope:scope, handler:handler, preventDefault: preventDefault, strict: isStrict}
		KeyboardTracker.validateKeyHandlerSpecifier(handlerSpec)
		return handlerSpec
	}

	//new Set(['Backspace']), this, (key) => this.removePrintable(-1), true, true
	setKeyDownAction(keys, scope, handler, preventDefault, isStrict) {
		this.#handlers.set("setKeyDownAction"+KeyboardTracker.setToKey(keys), {
			action:"setKeyDownAction",
			listenerId: this.#uid,
			keys: keys,
			handlerSpecifier: this.formHandlerSpec(scope, handler, preventDefault, isStrict)
		})
		this.#manager.handlersChanged(this)
	}

    removeKeyDownAction(keys) {
		this.#handlers.delete("setKeyDownAction"+KeyboardTracker.setToKey(keys))
		KeyboardTracker.removeKeyDownAction(keys, this.#uid)
    }

    setKeyUpAction(keys, scope, handler, preventDefault) {
		this.#handlers.set("setKeyUpAction"+KeyboardTracker.setToKey(keys), {
			action:"setKeyUpAction",
			listenerId: this.#uid,
			keys: keys,
			handlerSpecifier: this.formHandlerSpec(scope, handler, preventDefault, false)
		})
		this.#manager.handlersChanged(this)
	}

    removeKeyUpAction(keys) {
		this.#handlers.delete("setKeyUpAction"+KeyboardTracker.setToKey(keys))
		KeyboardTracker.removeKeyUpAction(keys, this.#uid)
    }

    setPrintableKeyDownAction(scope, handler, preventDefault) {
		this.#handlers.set("setPrintableKeyDownAction"+KeyboardTracker.PRINTABLES_KEY_DOWN_TAG, {
			action:"setPrintableKeyDownAction",
			listenerId: this.#uid,
			keys: null,
			handlerSpecifier: this.formHandlerSpec(scope, handler, preventDefault, false)
		})
		this.#manager.handlersChanged(this)
	}

    removePrintableKeyDownAction() {
		this.#handlers.delete("setPrintableKeyDownAction"+KeyboardTracker.PRINTABLES_KEY_DOWN_TAG)
		KeyboardTracker.removePrintableKeyDownAction(keys, this.#uid)
    }

    setPrintableKeyUpAction(scope, handler, preventDefault) {
		this.#handlers.set("setPrintableKeyUpAction"+KeyboardTracker.PRINTABLES_KEY_UP_TAG, {
			action:"setPrintableKeyUpAction",
			listenerId: this.#uid,
			keys: null,
			handlerSpecifier: this.formHandlerSpec(scope, handler, preventDefault, false)
		})
		this.#manager.handlersChanged(this)
	}

    removePrintableKeyUpAction() {
		this.#handlers.delete("setPrintableKeyUpAction"+KeyboardTracker.PRINTABLES_KEY_UP_TAG)
		KeyboardTracker.removePrintableKeyUpAction(keys, this.#uid)
    }
}

export class MobileKeyboard {

}