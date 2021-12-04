//Caution: keyboard will be in incorrect state if window looses focus between keydown and keyup
//BUG: pressedPrintables is unreliable: shift modifies that character code. need some map based translation.
// e.g. SHIFT+/ = ? if you then lift shift before ? the next keyUp event will be / instead of ?
export class Keyboard {
    
    #pressedPrintables = new Set([])
    #pressedNonPrintables = new Set([])
    #keysPreventingPrintable = new Set(['Control'])

    #actions = {}
    #onPrintable = null
    printablePreventDefault = true;

    constructor() {
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

    onPritable(context, handler) {
        this.#onPrintable = {
            context: context, 
            handler: handler
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

    handleKeydown(e) {
        console.log(`KEY DOWN ${e.key}`)
        let isPrintable = this.isPrintable(e.key)        
        if (isPrintable) {
            this.#pressedPrintables.add(e.key)
        } else {
            this.#pressedNonPrintables.add(e.key)
        }
        console.log(this.#pressedPrintables)
        console.log(this.#pressedNonPrintables)

        let action = this.#actions[this.setToKey(this.#pressedNonPrintables, e.key)]
        if (action && action.preventDefault) {
            console.log('KeyDown: Action prevent default')
            e.preventDefault();
        }
        
        if (action && action.handler) {
            action.handler.apply(action.context, [e.key])
        }

        if (isPrintable && this.shouldActOnPrintable() && this.printablePreventDefault) {
            console.log('KeyDown: Printable prevent default')
            e.preventDefault();
        }
        
        if (isPrintable && this.shouldActOnPrintable() && this.#onPrintable) {
            this.#onPrintable.handler.apply(this.#onPrintable.context, [e.key])
        }
    }

    handleKeyUp(e) {
        let isPrintable = this.isPrintable(e.key)
        let action = this.#actions[this.setToKey(this.#pressedNonPrintables, e.key)]
        
        if (action && action.preventDefault) {
            console.log('KeyUp: Action prevent default')
            e.preventDefault(); 
        }
            
        if (isPrintable && this.shouldActOnPrintable() && this.printablePreventDefault) {
            console.log('KeyUp: Printable prevent default')
            e.preventDefault();
        }

        if (isPrintable) {
            this.#pressedPrintables.delete(e.key)
        } else {
            this.#pressedNonPrintables.delete(e.key)
        }
        console.log(`KEY UP ${e.key}`)
        console.log(this.#pressedPrintables)
        console.log(this.#pressedNonPrintables)

	
		// 	//special commands
		// 	if (key == '/') {
		// 		console.log("processing special command")
		// 		//href - interpret text as link
		// 		let units = this.getAllTextUnits()
		// 		let text = ""
		// 		for (const unit of units) {
		// 			text += unit.innerText;
		// 		}
		// 		if (this.isLink(text)) {
		// 			for(const unit of units) {
		// 				this.container.delete(unit.id, this.appId);
		// 			}
		// 			this.container.createFromSerializable(this.target.id, {
		// 				nodeName:"img",
		// 				src:text
		// 			},null,this.appId);
		// 		}

		// 		let r = this.isData(text)
		// 		if (r) {
		// 			if (r.content == 'image') {
		// 				for(const unit of units) {
		// 					this.container.delete(unit.id, this.appId);
		// 				}

		// 				console.log("adding image...")
		// 				this.container.createFromSerializable(this.target.id, {
		// 					nodeName:"img",
		// 					src:text
		// 				},null,this.appId);
		// 			}
		// 			console.log(r)
		// 		}
		// 	}
		// 	if (key == ';') {
		// 		let units = this.getAllTextUnits()
		// 		let text = ""
		// 		for (const unit of units) {
		// 			text += unit.innerText;
		// 		}

		// 		let style = this.textToStyle(text)
		// 		console.log(style)
		// 		this.container.styleChild(this.target, style, this.appId)
				
		// 		for(const unit of units) {
		// 			this.container.delete(unit.id, this.appId);
		// 		}
		// 	}
		// }
	}

}