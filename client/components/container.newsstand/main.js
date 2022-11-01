import { ACTIONS } from "../../Container.js"
import { EVENTS as MouseEvents, Mouse } from '../utils/mouse.js'
import { Keyboard } from '../utils/Keyboards.js'
import { ACCESS_REQUIREMENT } from '../utils/InputAccessManager.mjs'

//ToDo: Mobile integration
export class NewsStand {
    appId = 'container.newsstand'
 
    #target = null;
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
        this.onClick(e)
      })

      this.#interface = this.#container.createFromSerializable(document.body, {
        "nodeName":"div",
        "computedStyle":{
          "position":"static",
          "width":"inherit",
          "height":"auto",
          "display":"none"
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
      this.#container.loadHtml(this.#interface, this.#container.toComponentLocalURL("interface.html", this.appId), this.appId)
    }

    enable() {
      if(!this.#enabled) {
        this.#enabled = true
        this.#mouse.enable();
        this.#keyboard.enable();
      }
    }  
    
    open() {
      //ToDo
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

    findContainingDiv(node) {
      while (node != this.#container.parent) {
        if (node.nodeName === 'DIV') {
          if (node.id === "newsstand-interface") {
            return null;
          }
          return node
        }
        node = this.#container.getParent(node);
      }
      return null;
    }

    delete() {
      let target = this.hideInterface();
      this.#container.delete(target, this.appId);
    }

    showInterface(node) {
      if (!node) {
        return;
      }

      this.#target = node
      this.#container.setParent(this.#interface, this.#target, this.appId)
      this.#container.show(this.#interface, this.appId)
    }

    hideInterface() {
      this.#container.hide(this.#interface, this.appId)
      this.#container.setParent(this.#interface, this.#container.parent, this.appId)
      
      let target = this.#target
      this.#target = null;
      return target
    }

    onClick(e) {
      let node = this.findContainingDiv(this.#container.lookup(e.explicitOriginalTarget))
      this.showInterface(node);
    }
}