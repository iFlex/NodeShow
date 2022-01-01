import { Keyboard } from '../utils/keyboard.js'

//[TODO]: add cancel button to cancel creating abstraction level
//        add function trigger editing existing abstraction level (call start())
//        add visualisation of how much abstraction each container has + ability to random access any of them / edit any of them

export class ContainerEditAbstraction {
    appId = 'container.edit.abstraction'
	target = null;

    #container = null;
    #hoverTarget = null;
    #handlers = {}
    #enabled = false
    #keyboard = null;

    #finalize = null;
    #preview = null;
    #summarizeFrom = null;
    #newLevel = null;

    constructor(container) {
        this.#container = container
        this.#container.registerComponent(this);

        this.#keyboard = new Keyboard(this.appId)
        this.#keyboard.setAction(new Set(["ArrowDown"]), this, (e) => this.collapse(), false);
        this.#keyboard.setAction(new Set(["ArrowUp"]), this, (e) => this.expand(), false);
        
        this.#handlers['container.select.selected'] = (e) => this.onSelection(e.detail.selection)
        this.#handlers["mouseover"] = (e) => { this.#hoverTarget = e.target }

        this.#finalize = this.#container.createFromSerializable(document.body,
        {
            "nodeName":"div",
            "computedStyle":{
                "position":"absolute",
                "top":"0px",
                "left":"0px",
                "display":"none",
                "background-color":"black"
            },
            "data":{
                "ignore":true
            },
            "permissions":{
                "container.broadcast":{"*":false},
                "container.bridge":{"*":false}
            }
        },
        null,
        this.appId)
        this.#container.loadHtml(this.#finalize, "interface.html", this.appId)
        this.#container.hide(this.#finalize, this.appId)
    }

    enable() {
        if(!this.#enabled) {
            for (const [key, value] of Object.entries(this.#handlers)) {
                document.addEventListener(key, value)
            }
            this.#enabled = true
            this.#keyboard.enable();
        }
    }  
    
    disable() {
        if (this.#enabled) {
            for (const [key, value] of Object.entries(this.#handlers)) {
                document.removeEventListener(key, value)
            }
            this.#enabled = false
            this.#keyboard.disable();
        }
    }

    isEnabled() {
		return this.#enabled
	}

    onSelection (selection) {
        this.target = selection[0]
    }

    findClosestDiv(start) {
        if(!start) {
            return null
        }

        let node = start
        while(node) {
            if (node.nodeName.toLowerCase() == 'div') {
                return node
            }
            node = node.parentNode
        }
        return node
    }

    createAbstractionPreview(target, existing) {
        let pos = this.#container.getPosition(target)
        let w = this.#container.getWidth(target)

        let style = this.#container.toSerializableStyle(target)
        this.#preview = this.#container.createFromSerializable(this.#container.parent,
        {
            "nodeName":"div",
            "computedStyle": style
        },
        null,
        this.appId)

        pos.left += w
        this.#container.setPosition(this.#preview, pos, this.appId)

        pos.top -= this.#container.getHeight(this.#finalize)
        this.#container.setPosition(this.#finalize, pos, this.appId)
        this.#container.show(this.#finalize, this.appId)

        for (const e of existing) {
            this.#container.setParent(e.id, this.#preview.id, this.appId)
            this.#container.setAbstractionLevel(e, 0)
        }

        return this.#preview
    }

    start(target, level) {
        //this.#container.componentStartedWork(this.appId, {})

        this.#newLevel = level;
        this.#summarizeFrom = this.#container.getAllInAbstractionLevel(target, level);
        return this.createAbstractionPreview(target, this.#summarizeFrom)
    }

    stop(op) {
        if (!this.#preview) {
            return;
        }
        //this.#container.componentStoppedWork(this.appId)
        
        if (op != "cancel") {
            let toMove = []
            for (const c of this.#preview.children) {
                toMove.push(c)
            }

            if (this.#newLevel > 0) {
                let prevLevelCount = this.#container.getAllInAbstractionLevel(this.target, this.#newLevel - 1).length
                if (toMove.length > prevLevelCount) {
                    throw `Previous abstraction leve containes ${prevLevelCount} content items while new level contains ${toMove.length}. New level needs to have less or equal to previous.`
                }
            }

            for (const e of toMove) {
                this.#container.setParent(e.id, this.target.id, this.appId)
                this.#container.setAbstractionLevel(e, this.#newLevel)
            }
        }

        this.#container.delete(this.#preview, this.appId)
        this.#container.hide(this.#finalize, this.appId)

        this.#preview = null;
        this.#summarizeFrom = null;
        this.#newLevel = null;
    }   

    collapse(target) {
        this.target = this.findClosestDiv(target || this.target || this.#hoverTarget)
        if (this.target) {
            if(!this.#container.collapse(this.target, this.appId)) {
                this.#container.createAbstractionLevel(target)
                this.start(this.target, this.#container.getAbstractionLevels(this.target))
            }
        }
    }

    expand(target) {
        this.target = this.findClosestDiv(target || this.target || this.#hoverTarget)
        if (this.target) {
            this.#container.expand(this.target, this.appId)
        }
    }
}