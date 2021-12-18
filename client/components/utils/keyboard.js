//Caution: keyboard will be in incorrect state if window looses focus between keydown and keyup
//BUG: pressedPrintables is unreliable: shift modifies that character code. need some map based translation.
// e.g. SHIFT+/ = ? if you then lift shift before ? the next keyUp event will be / instead of ?
//ToDo: when window loses focus, depress all keys
export class Keyboard {
    
    #pressedPrintables = new Set([])
    #pressedNonPrintables = new Set([])
    #keysPreventingPrintable = new Set(['Control'])
    #callerId = null;

    #actions = {}
    #actionsUp = {}
    #onPrintable = null
    #onPrintableUp = null

    constructor(appId) {
        console.log(`NEW KEYBOARD created by ${appId}`)
        this.#callerId = appId;

        window.addEventListener('blur', (e) => this.onBlur(e));
        this.onKeyUp = (e) => this.handleKeyUp(e)
        this.onKeyDown = (e) => this.handleKeydown(e)
    }
    
    enable () {
        document.addEventListener("keydown", this.onKeyDown)
        document.addEventListener("keyup", this.onKeyUp)
    }

    disable () {
        document.removeEventListener("keydown", this.onKeyDown)
        document.removeEventListener("keyup", this.onKeyUp)
    }

    onBlur(e) {
        console.log(`[KEYBOARD]: onBlur`)
        this.#pressedPrintables = new Set([])
        this.#pressedNonPrintables = new Set([])
    }

    isPrintable (key) {
        return key.length === 1
    }

    setAction(keys, context, handler, preventDefault) {
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
        let action = this.#actions[this.setToKey(this.#pressedNonPrintables, e.key)]
        
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
            this.#pressedNonPrintables.delete(e.key)
        }

        console.log(`KEY_UP(${this.#callerId}) ${e.key}`)
        console.log(this.#pressedPrintables)
        console.log(this.#pressedNonPrintables)
	}

}