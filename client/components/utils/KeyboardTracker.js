/*
    Key Press Handler Modes:
        1. strict: trigger action when a,b,c and only those are pressed.
        2. nonStrict: trigger action when a,b,c become pressed at the same time, regardless of any other keys
    
    Key Up Handler:
        # This triggers per single key, no grouping option.
*/

//[TODO][FIX]: prevent default doesn't seem to prevent browser shortcuts from working. They seem to take precendence and prevent the handlers from firing.
//example: CTRL + C + F
/** @class
 *  @summary Component implementing consistent access to keyboard input. 
 *  @description TODO
 * */
class KeyboardTracker {
    static PRINTABLES_KEY_DOWN_TAG = 'PRINTABLES:KEYDN'
    static PRINTABLES_KEY_UP_TAG = 'PRINTABLES:KEYUP'

    #debug = true

    #pressedPrintables = new Set()
    #pressedNonPrintables = new Set()
    #setAlreadyMatched = new Set()
    #toggled = new Set()

    #toggleStyleKeys = new Set(['CapsLock'])
    #uppsercaseTogglers = new Set(['Shift','CapsLock'])
    #keysPreventingPrintable = new Set(['Control'])
    
    #actions = new Map();
    #actionsUp = new Map();
    #onPrintable = new Map();
    #onPrintableUp = new Map();

    constructor() {
        console.log(`[KEYBOARD] Monitor instantiated`)
        document.addEventListener("keydown", (e) => this.#onKeyDown(e))
        document.addEventListener("keyup", (e) => this.#onKeyUp(e))
        window.addEventListener('blur', (e) => this.#clearState(e))
    }

    #clearState(e) {
        console.log(`[KEYBOARD]: clear state`)
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

    setDifference(left, right) {
        return new Set([...left].filter(x => !right.has(x)));
    }

    #setIntersection(left, right) {
        return new Set([...left].filter(x => right.has(x)));
    }

    validateKeyHandlerSpecifier(config) {
        //handlerConfig = {scope = scope, handler = function, preventDefault = false, strict = true}
        if (typeof config['scope'] !== 'object') {
            throw "Incorrectly formed keyboard event handler specifier. 'scope' field must be an object";
        }
        if (typeof config['handler'] !== 'function') {
            throw "Incorrectly formed keyboard event handler specifier. 'handler' field must be a function";
        }
        if (config['preventDefault'] && typeof config['preventDefault'] !== 'boolean' ) {
            throw "Incorrectly formed keyboard event handler specifier. 'preventDefault' field must be a boolean"
        }
        if (config['strict'] && typeof config['strict'] !== 'boolean' ) {
            throw "Incorrectly formed keyboard event handler specifier. 'strict' field must be a boolean"
        }
    }
    

    #addToNestedMap(map, layer1Key, layer2Key, value) {
        let innerMap = map.get(layer1Key) || new Map()
        innerMap.set(layer2Key, value)
        map.set(layer1Key, innerMap)
    }

    #removeFromNestedMap(map, layer1Key, layer2Key) {
        let innerMap = map.get(layer1Key) || new Map()
        innerMap.delete(layer2Key)

        if (innerMap.size == 0) {
            map.delete(layer1Key)
        }
    }

    setKeyDownAction(keys, listenerId, handlerSpecifier) {
        this.validateKeyHandlerSpecifier(handlerSpecifier)
        this.#addToNestedMap(this.#actions, this.setToKey(keys), listenerId, handlerSpecifier)
    }

    removeKeyDownAction(keys, listenerId) {
        this.#removeFromNestedMap(this.#actions, this.setToKey(keys), listenerId)
    }

    setKeyUpAction(keys, listenerId, handlerSpecifier) {
        this.validateKeyHandlerSpecifier(handlerSpecifier)
        this.#addToNestedMap(this.#actionsUp, this.setToKey(keys), listenerId, handlerSpecifier)
    }

    removeKeyUpAction(keys, listenerId) {
        this.#removeFromNestedMap(this.#actionsUp, this.setToKey(keys), listenerId)
    }

    setPrintableKeyDownAction(listenerId, handlerSpecifier) {
        this.validateKeyHandlerSpecifier(handlerSpecifier)
        this.#addToNestedMap(this.#onPrintable, KeyboardTracker.PRINTABLES_KEY_DOWN_TAG, listenerId, handlerSpecifier)
    }

    removePrintableKeyDownAction(listenerId) {
        this.#removeFromNestedMap(this.#onPrintable, KeyboardTracker.PRINTABLES_KEY_DOWN_TAG, listenerId)
    }

    setPrintableKeyUpAction(listenerId, handlerSpecifier) {
        this.validateKeyHandlerSpecifier(handlerSpecifier)
        this.#addToNestedMap(this.#onPrintableUp, KeyboardTracker.PRINTABLES_KEY_UP_TAG, listenerId, handlerSpecifier)
    }

    removePrintableKeyUpAction(listenerId) {
        this.#removeFromNestedMap(this.#onPrintableUp, KeyboardTracker.PRINTABLES_KEY_UP_TAG, listenerId)
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
                console.log(`[KEYBOARD] Key: Action prevent default`)
            }
            e.preventDefault();
        }
        if (detail.handler) {
            try {
                detail.handler.apply(detail.scope, [e.key, intersection]);
            } catch(e) {
                console.error(`[KEYBOARD] Handler Exception ${e}`);
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
    
    #invokeHandlersAndDefault(handlers, isStrict, e, intersection) {
        for (const [id, handlerSpec] of handlers) {
            if (!handlerSpec.strict || handlerSpec.strict == isStrict) {
                this.#invokeMatchHandler(handlerSpec, e, intersection);
            }
        }
    }

    #matchListener(actualKeys, strExpectedKeys) {
        let expectedPressed = this.keyToSet(strExpectedKeys)
        let intersection = this.#setIntersection(expectedPressed, actualKeys);
        let match = (intersection.size === expectedPressed.size)
        let isStrict = (actualKeys.size === intersection.size)

        return {match:match, isStrict:isStrict, intersection: intersection}
    }

    //ToDo: extract for loop into method
    #applyKeyDownActions(e, actionSet) {
        let allPressed = this.getPressed()
        for (const [strKeys, handlers] of actionSet) {
            let match = this.#matchListener(allPressed, strKeys)
            let intersectionAsKey = this.setToKey(match.intersection)
            let alreadyMatched = ((allPressed.size > 1) && this.#setAlreadyMatched.has(intersectionAsKey))
            
            if (match.match && !alreadyMatched) {
                this.#setAlreadyMatched.add(intersectionAsKey);
                this.#invokeHandlersAndDefault(handlers, match.isStrict, e, match.intersection)
            }
        }
    }
    
    #applySingleKeyActionAndDefault(e, actionSet) {
        let keyChanged = new Set([e.key])
        for (const [strKeys, handlers] of actionSet) {
            let match = this.#matchListener(keyChanged, strKeys)
            if (match.match) {
                this.#invokeHandlersAndDefault(handlers, match.isStrict, e, match.intersection)
            }
        }
    }

    #applyPrintableKeyActionAndDefault(e, actionSet) {
        if (this.shouldActOnPrintable() && this.isPrintable(e.key)) {
            for (const [strKeys, handlers] of actionSet) {
                this.#invokeHandlersAndDefault(handlers, false, e, new Set([]))
            }
        }
    }

    getPressed() {
        return this.#setUnion(this.#pressedNonPrintables, this.#pressedPrintables);
    }

    #onKeyDown(e) {
        let isPrintable = this.isPrintable(e.key)        
        if (isPrintable) {
            this.#pressedPrintables.add(e.key)
        } else {
            this.#pressedNonPrintables.add(e.key)
        }

        if (this.#debug) {
            console.log(`[KEYBOARD][KEY DOWN] ${e.key}`)
            console.log(this.#pressedPrintables)
            console.log(this.#pressedNonPrintables)
        }

        this.#applyKeyDownActions(e, this.#actions);
        this.#applyPrintableKeyActionAndDefault(e, this.#onPrintable);
    }

    #onKeyUp(e) {
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
        this.#keyUpUnmatch(e.key)
        
        if (this.#debug) {
            console.log(`[KEYBOARD][KEY_UP] ${e.key}`)
            console.log(this.#pressedPrintables)
            console.log(this.#pressedNonPrintables)
        }

        this.#applySingleKeyActionAndDefault(e, this.#actionsUp)
        this.#applyPrintableKeyActionAndDefault(e, this.#onPrintableUp)
	}
}

export default new KeyboardTracker();