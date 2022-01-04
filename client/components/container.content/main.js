import { getSelection } from '../utils/common.js'
import { post } from '../utils/http.js'
import { Clipboard, EVENTS as ClipboardEvents } from '../utils/clipboard.js'
import { Keyboard } from '../utils/keyboard.js'
import { ACCESS_REQUIREMENT } from '../utils/inputAccessManager.js'

export class ContainerContent {
    appId = 'container.content'
    displayName = 'Content'
    type = 'transactional'
    modal = true

    contentURL = `https://${window.location.host}`
    
    #clipboard = null
    #keyboard = null
    #interface = null
    #handlers = {}
    #enabled = false
    target = null

    constructor (container) {
		  this.container = container;
		  container.registerComponent(this);
      
      this.#clipboard = new Clipboard(this.appId);
      for (let evid of Object.values(ClipboardEvents)) {
        this.#clipboard.setAction(evid,
          (event) => {},//noop
          ACCESS_REQUIREMENT.EXCLUSIVE)  
      }

      this.#keyboard = new Keyboard(this.appId, container, ACCESS_REQUIREMENT.EXCLUSIVE)
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

        this.onTextFieldFocus()	
        this.container.show(this.#interface, this.appId)
        this.container.bringToFront(this.#interface)
      }
    }

    disable () {
      if (this.#enabled) {
        this.#enabled = false;

        this.onTextFieldBlur()
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
      let selection = getSelection(this.container)
      let target = this.container.parent
      if (selection.length > 0) {
        target = selection[0]
      }

      console.log(`Creating content on target ${target}`)
      target = this.container.lookup(target)
      
      //ToDo consider child styling suggestions on parent
      return this.container.createFromSerializable(target, {
        nodeName: this.contentTypeToNodeType(contentType),
        src: data,
        computedStyle: this.getStyle(target)
      },null,this.appId);
    }

    getContentType() {
      console.log(`${this.appId} getting content type`)
      try {
        var e = this.container.lookup("ns-content-type");
        return e.options[e.selectedIndex].text;
      } catch (ex) {
        console.error(`${this.appId} could not fetch content type`)
        console.error(ex)
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
        let isData = this.isData(data)
        if (isData) {
          this.uploadAndShow(isData)
        } else if (this.isLink(data)) {
          this.createFromData(this.getContentType(), data)
        } else {
          console.error("not sure what you provided here...")
        }

        dataNode.value = ""
      }
    }
    
    uploadAndShow (data) {
      //ToDo use the result from is data to figure out the content type
      post(this.contentURL, "application/octet-stream", atob(data.data), (uri) => {
        this.createFromData(data.content, uri)
      }, (e) => {
        console.error(`${this.appId} - content load failed on read from server`)
      })
    }

    loadFileContents (type, reader) {
      //ToDo: figure out what to do about other types
      //ToDo: make more resilient... this is shoddy
      
      post(this.contentURL, type, reader.result,
        (uri) => {
          console.log(uri)
          this.createFromData(type, uri)
        },
        (e) => {
          console.error(`${this.appId} - content load failed on read from server`)
        })
    }

    readFile(file) {
      console.log(`${this.appId} loading file ${file.name}`)
      console.log(file)
      var reader = new FileReader();
      var mimeType = file.type
      reader.onload = (e) => {
        console.log(`${this.appId} raw file content loaded`)
        this.loadFileContents(mimeType, reader)
      }
      reader.readAsArrayBuffer(file)
    }

    loadFromFile(e) {
      console.log(`${this.appId} Loading from file`)
      for (const file of e.target.files) {
        this.readFile(file)
      }
    }

    onTextFieldFocus() {
      this.#clipboard.enable()
      this.#keyboard.enable()
    }

    onTextFieldBlur() {
      this.#clipboard.disable()
      this.#keyboard.disable()
    }
}