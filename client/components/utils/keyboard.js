import { container } from "../../nodeshow.js"
import { KeyboardManager } from "./KeyboardManager.js"
import { InputAccessManagerInstance as InputAccessManager } from "./inputAccessManager.js"

//[TODO][FIX]: in certian situations the keyboar will believe certain keys are still pressed when they are not.
//[TODO]: different press modes. 
// e.g. trigger action when a,b,c and only those are pressed //mode:strict
//      trigger action when a is press regardless of any other keys //mode:default
//      trigger action when a,b,c are pressed regardless of any others //mode:default
//      onKeyUp should trigger per single key as there is no way to depress simultaneously
export const EVENTS = {
    'keydown':'container.keydown',
    'keyup':'container.keyup'
}

function onKeyDown(e) {
    container.emit(EVENTS.keydown,{ originalEvent: e});
}

function onKeyUp(e) {
    container.emit(EVENTS.keyup, { originalEvent: e});
}

document.addEventListener("keydown", onKeyDown)
document.addEventListener("keyup", onKeyUp)

export const keyboardManager = new KeyboardManager(InputAccessManager);

/** @class
 *  @summary Component implementing consistent access to keyboard input. 
 *  @description TODO
 * */
export class Keyboard {
    
    #pressedPrintables = new Set()
    #pressedNonPrintables = new Set()
    #toggled = new Set()

    #toggleStyleKeys = new Set(['CapsLock'])
    #uppsercaseTogglers = new Set(['Shift','CapsLock'])
    #keysPreventingPrintable = new Set(['Control'])
    #callerId = null;
    #accessMode = null;

    #handlers = {}
    #actions = {}
    #windowBlur = null
    #actionsUp = {}
    #onPrintable = null
    #onPrintableUp = null
    #manager = keyboardManager

    constructor(appId, container, accessMode) {
        console.log(`NEW KEYBOARD created by ${appId}`)
        this.#callerId = appId;
        this.#accessMode = accessMode

        this.#windowBlur = (e) => this.onBlur(e)
        this.#handlers["keyup"] = (e) => this.handleKeyUp(e)
        this.#handlers["keydown"] = (e) => this.handleKeydown(e)
    }
    
    getId () {
        return this.#callerId
    }

    getAccessMode () {
        return this.#accessMode
    }

    getHandlers () {
        return this.#handlers
    }

    enable() {
        window.addEventListener('blur', this.#windowBlur);
        this.#manager.register(this)
    }

    disable() {
        window.removeEventListener('blur', this.#windowBlur);
        this.onBlur()
        this.#manager.unregister(this)
    }

    onBlur(e) {
        console.log(`[KEYBOARD]: onBlur`)
        this.#pressedPrintables = new Set()
        this.#pressedNonPrintables = new Set()
        this.#toggled = new Set()
    }

    isPrintable (key) {
        return key.length === 1
    }

    isUppercase (key) {
        return key === key.toUpperCase()
    }

    setAction(keys, context, handler, preventDefault, strict) {
        this.#actions[this.setToKey(keys)] = {
            context: context,
            handler: handler, 
            preventDefault: preventDefault
        }
    }

    setKeyUpAction(keys, context, handler, preventDefault) {
        this.#actionsUp[this.setToKey(keys)] = {
            context: context,
            handler: handler, 
            preventDefault: preventDefault
        }
    }

    onPritable(context, handler, preventDefault) {
        this.#onPrintable = {
            context: context, 
            handler: handler,
            preventDefault: preventDefault
        }
    }

    onKeyUpPrintable(context, handler, preventDefault) {
        this.#onPrintableUp = {
            context: context, 
            handler: handler,
            preventDefault: preventDefault
        }
    }

    /* Not the most efficient thing...*/
    setToKey(set, singleKey) {
        let map = {}
        for (let key of set.keys()) {
            map[key] = true
        }

        if (singleKey) {
            map[singleKey] = true
        }
        
        return Object.keys(map).sort().join('_')
    }

    shouldActOnPrintable() {
        for (const n of this.#keysPreventingPrintable) {
            if (this.#pressedNonPrintables.has(n)) {
                return false;
            }
        }
        return true;
    }

    shouldPreventDefault(desc) {
        if (desc && desc.preventDefault) {
            return desc.preventDefault
        }

        return false;
    }

    #isUppercaseEngaged() {
        let uppercase = false
        for (let key of this.#pressedNonPrintables) {
            if (this.#uppsercaseTogglers.has(key)) {
                uppercase = !uppercase
            }
        }

        return uppercase;
    }

    #depressUppercaseIfNeeded () {
        let isUppercaseEngaged = this.#isUppercaseEngaged()
        if (!isUppercaseEngaged) {
            for (const key of this.#pressedPrintables) {
                if (this.isUppercase(key)) {
                    this.#pressedPrintables.delete(key)
                }
            }
        }
    }

    #applyActionAndDefault(e, key, actionSet) {
        let action = actionSet[key]
        if (action && action.preventDefault) {
            console.log(`Key: Action prevent default by ${this.#callerId}`)
            e.preventDefault();
        }
        
        if (action && action.handler) {
            action.handler.apply(action.context, [e.key])
        }
    }

    handleKeydown(e) {
        let isPrintable = this.isPrintable(e.key)        
        if (isPrintable) {
            this.#pressedPrintables.add(e.key)
        } else {
            this.#pressedNonPrintables.add(e.key)
        }
        
        let key = this.setToKey(this.#pressedNonPrintables, e.key)
        this.#applyActionAndDefault(e, key, this.#actions)

        if (isPrintable && this.shouldActOnPrintable() && this.shouldPreventDefault(this.#onPrintable)) {
            console.log(`KeyDown: Printable prevent default by ${this.#callerId}`)
            e.preventDefault();
        }
        
        if (isPrintable && this.shouldActOnPrintable() && this.#onPrintable) {
            this.#onPrintable.handler.apply(this.#onPrintable.context, [e.key])
        }

        // console.log(`KEY DOWN ${e.key}`)
        // console.log(this.#pressedPrintables)
        // console.log(this.#pressedNonPrintables)
    }

    handleKeyUp(e) {
        let isPrintable = this.isPrintable(e.key)
        
        let key = this.setToKey(this.#pressedNonPrintables, e.key)
        this.#applyActionAndDefault(e, key, this.#actionsUp)
        
        if (isPrintable && this.shouldActOnPrintable() && this.shouldPreventDefault(this.#onPrintableUp)) {
            console.log(`KeyUp: Printable prevent default by ${this.#callerId}`)
            e.preventDefault();
        }

        if (isPrintable && this.shouldActOnPrintable() && this.#onPrintableUp) {
            this.#onPrintableUp.handler.apply(this.#onPrintableUp.context, [e.key])
        }

        if (isPrintable) {
            this.#pressedPrintables.delete(e.key)
        } else {
            if (this.#toggleStyleKeys.has(e.key)) {
                if (this.#toggled.has(e.key)) {
                    //this is toggle off
                    this.#toggled.delete(e.key)
                    this.#pressedNonPrintables.delete(e.key)
                } else {
                    //this is a toggle on
                    this.#toggled.add(e.key)
                }
            } else {
                this.#pressedNonPrintables.delete(e.key)    
            }
            this.#depressUppercaseIfNeeded()
        }

        console.log(`KEY_UP(${this.#callerId}) ${e.key}`)
        console.log(this.#pressedPrintables)
        console.log(this.#pressedNonPrintables)
	}

}