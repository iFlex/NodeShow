import {container} from '../../nodeshow.js'

class ContainerContent {
    appId = 'container.content'
    #interface = null
    #handlers = {}
    #enabled = false
    target = null

    constructor (container) {
		  this.container = container;
		  container.registerComponent(this);
      
      this.#handlers['container.edit.pos.selected'] = (e) => this.setTarget(e.detail.id),
		  this.#handlers['container.edit.pos.unselected'] = (e) => this.unsetTarget(),

      this.loadInterface()  
    }

    loadInterface() {
      //create interface holder
      this.#interface = this.container.createFromSerializable(null, {
        "nodeName":"div",
        "computedStyle":{
          "top":"0px",
          "left":"0px",
          "position":"absolute"
        },
        "permissions":{"container.broadcast":{"*":false}}
      },
      null,
      this.appId)

      this.container.hide(this.#interface, this.appId)
      //load interface style and html
      this.container.loadStyle("style.css", this.appId)
      this.container.loadHtml(this.#interface, "interface.html", this.appId)
    }

    enable () {
      if (!this.#enabled) {
        this.#enabled = true
        for (const [key, value] of Object.entries(this.#handlers)) {
          document.addEventListener(key, value)
        }	
        this.container.show(this.#interface, this.appId)
      }
    }

    disable () {
      if (this.#enabled) {
        this.#enabled = false;

        for (const [key, value] of Object.entries(this.#handlers)) {
          document.removeEventListener(key, value)
        }	
        this.container.hide(this.#interface, this.appId)
      }
    }

    isEnabled() {
      return this.#enabled
    }

    setTarget (id) {
      try {
        this.target = this.container.lookup(id);
      } catch (e) {
        this.target = this.container.parent
      }
    }

    unsetTarget() {
      this.target = this.container.parent
    }

    isLink(data) {
      var expression = /[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)?/gi;
      var regex = new RegExp(expression);
      
      return data.match(regex);
    }
  
    isData(text) {
      //data:image/jpeg;base64
      let colon = text.indexOf(':')
      let semi = text.indexOf(';')
      let firstCom = text.indexOf(',')
  
      let pre = text.substring(0, colon)
      let type = text.substring(colon+1, semi)
      
      let encsep = type.indexOf('/')
      let format = type.substring(encsep+1, type.length)
      type = type.substring(0, encsep)
  
      let encoding = text.substring(semi+1, firstCom)
      let data = text.substring(firstCom+1, text.length)
  
      if (pre == 'data') {
        return {
          content: type, 
          format: format,
          encoding: encoding,
          data: data
        }
      }
      return null;
    }

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
    getStyle() {
      let childStyle = {
        'position':'absolute',
        'min-width':'150px',
        'min-height':'150px',
        'margin': '0px',
        'padding': '0px',	
        'top':'0px',
        'left':'0px'
      }

      let parentSuggestion = this.target.getAttribute("data-child-style")
      if (parentSuggestion) {
        parentSuggestion = JSON.parse(parentSuggestion)
        //apply parent suggestion to child style if there is any
        for (const [key, value] of Object.entries(parentSuggestion)) {
          childStyle[key] = value
        }
      }
      
      return childStyle
    }

    contentTypeToNodeType(type) {
      console.log(`content type:${type}`)
      if (type === 'Image') {
        return "img"
      }
      //default to the good ol' div
      return 'div'
    }

    createFromData(contentType, data) {
      console.log(`Creating content on target ${this.target.id}`)
      //ToDo consider child styling suggestions on parent
      return this.container.createFromSerializable(this.target.id, {
        nodeName: this.contentTypeToNodeType(contentType),
        src: data,
        computedStyle: this.getStyle()
      },null,this.appId);
    }

    getContentType() {
      console.log(`getting content type`)
      try {
        var e = this.container.lookup("ns-content-type");
        return e.options[e.selectedIndex].text;
      } catch (ex) {
        return undefined
      }
      return undefined
    }

    loadFromText() {
      let dataNode = this.container.lookup("ns-content-url")
      if (dataNode && dataNode.value) {
        let data = dataNode.value
        if (this.isData(data)) {
          //ToDo use the result from is data to figure out the content type
          this.createFromData(this.getContentType(), data)
        } else if (this.isLink(data)) {
          this.createFromData(this.getContentType(), data)
        } else {
          console.error("not sure what you provided here...")
        }

        dataNode.value = ""
      }
    }
}

let ccontent = new ContainerContent(container);
ccontent.enable()