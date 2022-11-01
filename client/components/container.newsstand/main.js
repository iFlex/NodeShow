import { ACTIONS } from "../../Container.js"
import { EVENTS as MouseEvents, Mouse } from '../utils/mouse.js'
import { Keyboard } from '../utils/Keyboards.js'
import { ACCESS_REQUIREMENT } from '../utils/InputAccessManager.mjs'

//ToDo: Found bug: if you propagate events about the interface. The server will mess up the container where the interface is shown...
//seems to be connected to the fact that the interface is not sent over the network, but container.update on news card will contain information about it
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

    save() {
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
      while (node && node != this.#container.parent) {
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
      this.#container.delete(target, this.appId, true);
    }

    showInterface(node) {
      if (!node) {
        return;
      }

      this.#target = node
      this.#container.setParent(this.#interface, this.#target, this.appId, null, false)
      this.#container.show(this.#interface, this.appId, false)
    }

    hideInterface() {
      this.#container.hide(this.#interface, this.appId, false)
      this.#container.setParent(this.#interface, this.#container.parent, this.appId, null, false)
      
      let target = this.#target
      this.#target = null;
      return target
    }

    onClick(e) {
      let node = this.findContainingDiv(this.#container.lookupReal(e.detail.originalEvent.target, false))
      this.showInterface(node);
    }
}