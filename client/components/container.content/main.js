import { container } from '../../nodeshow.js'
import { getSelection } from '../utils/common.js'

class ContainerContent {
    appId = 'container.content'
    #interface = null
    #handlers = {}
    #enabled = false
    target = null

    constructor (container) {
		  this.container = container;
		  container.registerComponent(this);
    
      this.loadInterface()  
    }

    loadInterface() {
      //create interface holder
      this.#interface = this.container.createFromSerializable(document.body, {
        "nodeName":"div",
        "computedStyle":{
          "top":"0px",
          "left":"0px",
          "position":"fixed"
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
        this.container.bringToFront(this.#interface)
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
    getStyle(target) {
      let childStyle = {
        'position':'absolute',
        'min-width':'150px',
        'min-height':'150px',
        'margin': '0px',
        'padding': '0px',	
        'top':'0px',
        'left':'0px'
      }

      let parentSuggestion = target.getAttribute("data-child-style")
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
      if (type.toLowerCase().includes('image')) {
        return "img"
      }
      //default to the good ol' div
      return 'div'
    }

    createFromData(contentType, data) {
      let selection = getSelection()
      let target = this.container.parent
      if (selection.length > 0) {
        target = selection[0]
      }

      console.log(`Creating content on target ${target}`)
      
      //ToDo consider child styling suggestions on parent
      return this.container.createFromSerializable(target, {
        nodeName: this.contentTypeToNodeType(contentType),
        src: data,
        computedStyle: this.getStyle(target)
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

    mimeTypeToContainerType (type) {
      return "img"
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

    loadFileContents (type, reader) {
      //ToDo: figure out what to do about other types
      this.createFromData(type, reader.result)
    }

    readFile(file) {
      console.log(`${this.appId} loading file ${file.name}`)
    
      var reader = new FileReader();
      var mimeType = file.type
      reader.onload = (e) => {
        console.log(`${this.appId} raw file content loaded`)
        this.loadFileContents(mimeType, reader)
      }
      //ToDo: based on type of file, decide how to read
      reader.readAsDataURL(file);
    }

    loadFromFile(e) {
      console.log(`${this.appId} Loading from file`)
      for (const file of e.target.files) {
        this.readFile(file)
      }
    }
}

new ContainerContent(container);