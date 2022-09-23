import { container } from "../../nodeshow.js"
import { KeyboardManager } from "./KeyboardManager.js"
import { InputAccessManagerInstance as InputAccessManager } from "./InputAccessManager.mjs"

//[TODO][FIX]: in certian situations the keyboar will believe certain keys are still pressed when they are not.
/*
    Key Press Handler Modes:
        1. strict: trigger action when a,b,c and only those are pressed.
        2. nonStrict: trigger action when a,b,c become pressed at the same time, regardless of any other keys
    
    Key Up Handler:
        # This triggers per single key, no grouping option.
*/
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

    #debug = true
    
    #pressedPrintables = new Set()
    #pressedNonPrintables = new Set()
    #setAlreadyMatched = new Set()
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

        this.#windowBlur = (e) => this.clearState(e)
        this.#handlers["keyup"] = (e) => this.handleKeyUp(e)
        this.#handlers["keydown"] = (e) => this.handleKeydown(e)
        window.addEventListener('blur', this.#windowBlur);
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
        this.#manager.register(this)
        if (this.#debug) {
            console.log(`[KEYBOARD_${this.#callerId}] enabled`)
        }
    }

    disable() {
        this.clearState()
        this.#manager.unregister(this)
        if (this.#debug) {
            console.log(`[KEYBOARD_${this.#callerId}] disabled`)
        }
    }

    clearState(e) {
        console.log(`[KEYBOARD_${this.#callerId}]: onBlur`)
        this.#pressedPrintables = new Set()
        this.#pressedNonPrintables = new Set()
        this.#setAlreadyMatched = new Set()
        this.#toggled = new Set()
    }

    isPrintable (key) {
        return key.length === 1
    }

    isUppercase (key) {
        return key === key.toUpperCase()
    }
    
    #setUnion(left, right) {
        return new Set([...left, ...right]);
    }

    #setDifference(left, right) {
        return new Set([...left].filter(x => !right.has(x)));
    }

    #setIntersection(left, right) {
        return new Set([...left].filter(x => right.has(x)));
    }

    setAction(keys, context, handler, preventDefault, strict = true) {
        this.#actions[this.setToKey(keys)] = {
            keys: keys,
            context: context,
            handler: handler, 
            preventDefault: preventDefault,
            strict: strict
        }
    }

    setKeyUpAction(keys, context, handler, preventDefault) {
        this.#actionsUp[this.setToKey(keys)] = {
            keys: keys,
            context: context,
            handler: handler, 
            preventDefault: preventDefault
        }
    }

    onPritable(context, handler, preventDefault, strict = false) {
        this.#onPrintable = {
            context: context, 
            handler: handler,
            preventDefault: preventDefault,
            strict: strict
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

    keyToSet(key) {
        return new Set(key.split("_"))
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

    #invokeMatchHandler(detail, e, intersection) {
        if (detail.preventDefault) {
            if (this.#debug) {
                console.log(`[KEYBOARD_${this.#callerId}] Key: Action prevent default by ${this.#callerId}`)
            }
            e.preventDefault();
        }
        if (detail.handler) {
            try {
                detail.handler.apply(detail.context, [e.key, intersection]);
            } catch(e) {
                console.error(`[KEYBOARD_${this.#callerId}] Handler Exception ${e}`);
            }
        }
    }

    #applyActionAndDefault(e, actionSet) {
        let allPressed = this.getPressed()
        for (const [key, detail] of Object.entries(actionSet)) {
            let intersection = this.#setIntersection(detail.keys, allPressed);
            let match = (intersection.size === detail.keys.size)
            let isStrict = (allPressed.size === intersection.size)
            let intersectionAsKey = this.setToKey(intersection)
            let alreadyMatched = ((allPressed.size > 1) && this.#setAlreadyMatched.has(intersectionAsKey))

            if (match && (!detail.strict || isStrict) && !alreadyMatched) {
                this.#setAlreadyMatched.add(intersectionAsKey);
                this.#invokeMatchHandler(detail, e, intersection);
            }
        }
    }

    #keyUpUnmatch(key) {
        let rmlist = []
        for (const keys of this.#setAlreadyMatched) {
            let set = this.keyToSet(keys)
            if (set.has(key)) {
                rmlist.push(keys)
            }
        }
        for (const rm of rmlist) {
            this.#setAlreadyMatched.delete(rm)
        }
    }

    #applyActioAndDefaultnOnKeyUp(e, actionSet) {
        let matchSet = new Set([e.key])
        for (const [tag, detail] of Object.entries(actionSet)) {
            let intersection = this.#setIntersection(detail.keys, matchSet);
            let match = (intersection.size === detail.keys.size)
            let isStrict = (matchSet.size === intersection.size)
            if (match && isStrict) {
                this.#invokeMatchHandler(detail, e, intersection);
            }
        }
    }

    getPressed() {
        return this.#setUnion(this.#pressedNonPrintables, this.#pressedPrintables);
    }

    handleKeydown(e) {
        if (this.#debug) {
            console.log(`[KEYBOARD_${this.#callerId}][KEY DOWN] ${e.key}`)
        }

        let isPrintable = this.isPrintable(e.key)        
        if (isPrintable) {
            this.#pressedPrintables.add(e.key)
        } else {
            this.#pressedNonPrintables.add(e.key)
        }
        
        this.#applyActionAndDefault(e, this.#actions)

        if (isPrintable && this.shouldActOnPrintable() && this.shouldPreventDefault(this.#onPrintable)) {
            if (this.#debug) {
                console.log(`[KEYBOARD_${this.#callerId}] KeyDown: Printable prevent default by ${this.#callerId}`)
            }
            e.preventDefault();
        }
        
        if (isPrintable && this.shouldActOnPrintable() && this.#onPrintable) {
            if (this.#onPrintable.strict && (this.#pressedPrintables.size > 1 || this.#pressedNonPrintables > 0)) {
                return;
            }
            this.#onPrintable.handler.apply(this.#onPrintable.context, [e.key])
        }

        if (this.#debug) {
            console.log(this.#pressedPrintables)
            console.log(this.#pressedNonPrintables)
            console.log(this.#setAlreadyMatched)
        }
    }

    handleKeyUp(e) {
        if (this.#debug) {
            console.log(`[KEYBOARD_${this.#callerId}] KEY_UP(${this.#callerId}) ${e.key}`)
        }

        this.#keyUpUnmatch(e.key)
        let isPrintable = this.isPrintable(e.key)
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

        this.#applyActioAndDefaultnOnKeyUp(e, this.#actionsUp)
        
        if (isPrintable && this.shouldActOnPrintable() && this.shouldPreventDefault(this.#onPrintableUp)) {
            if (this.#debug) {
                console.log(`[KEYBOARD_${this.#callerId}] KeyUp: Printable prevent default by ${this.#callerId}`)
            }
            e.preventDefault();
        }

        if (isPrintable && this.shouldActOnPrintable() && this.#onPrintableUp) {
            try {
                this.#onPrintableUp.handler.apply(this.#onPrintableUp.context, [e.key]);
            } catch(e) {
                console.error(`[KEYBOARD_${this.#callerId}] Handler Exception ${e}`);
            }
            
        }

        if (this.#debug) {
            console.log(this.#pressedPrintables)
            console.log(this.#pressedNonPrintables)
            console.log(this.#setAlreadyMatched)
        }
	}
}