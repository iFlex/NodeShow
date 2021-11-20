import {container} from '../../nodeshow.js'

const textItemPerms = {"container.move":{"*":false}, "container.edit":{"*":false}}
	
class ContainerTextInjector {
	appId = "container.edit.text"

	container = null;	
	target = null;
	#interface = null;
	#debug = false;

	#newline = '&#13;'

	lineDescriptor = {nodeName: "DIV", className: "text-document-line", permissions:textItemPerms}
	textUnitDescriptor = {nodeName: "SPAN", className: "text-document-unit", permissions:textItemPerms}
	preventDefaults = {'u':true,'b':true,'i':true,' ':true}
	state = {
		control:false,
		bold:false,
		italic:false,
		underlined: false
	}

	cursor = {
		lineNo: 0,
		charNo: 0,
		textUnit: null,
		localCharNo: 0
	}
	
	//ToDo:
	//fix prevent default functionality (only do it for our commands, do not prevent default stuff for copy and paste)
	//selections - reverse selection & other edge cases
	//selections - ghost selections (nothing is selected on screen but it returns some selection)
	//line breaking and combining  // key: fs.readFileSync(process.env.TLS_CERT_KEY),
  	// cert: fs.readFileSync(process.env.TLS_CERT),
  	// ciphers: "DEFAULT:!SSLv2:!RC4:!EXPORT:!LOW:!MEDIUM:!SHA1" on edit
	//span compaction (combine if style is identical)

	//cursor concept	

	//resizing by other
	//resize container when text wraps
	//wrapping

	constructor (container, debug) {
		this.container = container;
		container.registerComponent(this);
		
		this.#debug = debug
		if(debug) {
			this.lineDescriptor['computedStyle'] = {
				"border-width": "3px",
    			"border-color": "red",
    			"border-style": "dotted"
			}
			this.textUnitDescriptor['computedStyle'] = this.lineDescriptor.computedStyle;
			console.log("Text editor runnign in debug mode")
		}

		//create interface holder
		this.#interface = this.container.createFromSerializable(null, {
			"nodeName":"div",
			"computedStyle":{
				"top":"0px",
				"left":"0px",
				"position":"absolute"
			}
		},
		null,
		this.appId)
		this.container.hide(this.#interface)
		//load interface style and html
		this.container.loadStyle("style.css", this.appId)
		this.container.loadHtml(this.#interface, "interface.html", this.appId)
	}
 
	enable() {
		document.addEventListener("keydown", (e) => this.handleKeydown(e))
		document.addEventListener("keyup",(e) => this.handleKeyUp(e))

	    document.addEventListener('container.edit.pos.selected', e => this.setTarget(e.detail.id));
		document.addEventListener('container.edit.pos.unselected', (e) => this.unsetTarget());

		//clipboard
		document.addEventListener('paste', (event) => this.paste(event));
		document.addEventListener('cut', (event) => this.cut(event));	
	}

	disable() {
		document.removeEventListener("keydown", (e) => this.handleKeydown(e))
		document.removeEventListener("keyup",(e) => this.handleKeyUp(e))

		document.removeEventListener('container.edit.pos.selected', e => this.setTarget(e.detail.id));
		document.removeEventListener('container.edit.pos.unselected', (e) => this.unsetTarget());

		//clipboard
		document.removeEventListener('paste', (event) => this.paste(event));
		document.removeEventListener('cut', (event) => this.cut(event));
		this.container.hide(this.#interface)
	}

	static isPrintableCharacter(key) {
		return key.length === 1;
	}

	static findFirstDivParent(elem) {
		if (!elem)
			return null;

		if (elem.nodeName == 'DIV') {
			return elem
		}

		return ContainerTextInjector.findFirstDivParent(elem.parentNode)
	}

	setTarget(id) {
		console.log(`Setting text edit target to ${id}`)
		this.target = ContainerTextInjector.findFirstDivParent(this.container.lookup(id));
		console.log(`Closest div parent:`)
		console.log(this.target)
		
		let pos = this.container.getPosition(this.target)
		pos.originX = 0.0
		pos.originY = 1.0
		this.container.setPosition(this.#interface, pos, this.appId)
		this.#interface.style['min-width'] = this.container.getWidth(this.target)
		this.container.show(this.#interface)


	}

	unsetTarget(){
		this.target = null;
		this.container.hide(this.#interface)
	}

	//doesn't support rich text yet
	paste (event) {
	    let paste = (event.clipboardData || window.clipboardData).getData('text');
	    this.addPrintable(paste)
	    event.preventDefault();
	}

	cut (event) {
		this.deleteSelection();
		event.preventDefault();
	}
	
	isLine(elem) {
		return elem.className.includes(this.lineDescriptor.className); 
	}

	isNewLine(elem) {
		return this.isLine(elem) && elem.children.length == 0;
	}

	isTextUnit(elem) {
		return elem.className.includes(this.textUnitDescriptor.className);
	}

	makeNewLine(insertAt) {
		let lineBefore = undefined;
		if (this.target.children && insertAt >= 0 && insertAt < this.target.children.length) {
			lineBefore = this.target.children[insertAt]
		}
		return this.container.createFromSerializable(this.target.id, this.lineDescriptor, lineBefore, this.appId)
	}

	makeNewTextChild (line) {
		console.log(this.textUnitDescriptor)
		let unit = this.container.createFromSerializable(line.id, this.textUnitDescriptor)
		unit.addEventListener("click", e => this.onTextUnitClick(e))
		return unit
	}

	//cursor logic
	onTextUnitClick(e) {
		console.log("moving cursor")
		console.log(e)
		let textUnit = e.target
		let clickP = e.layerX
		let charWidth = Math.floor(this.container.getWidth(textUnit) / textUnit.innerHTML.length);

		this.cursor.textUnit = e.target
		this.cursor.localCharNo = Math.floor(clickP/charWidth)
		this.cursorFromLocalCharNo(this.cursor)
	}

	cursorPutOnLine(cursor, lineNo, makeIfAbsent) {
		let line = Math.max(0, lineNo)
		if (makeIfAbsent && (!this.target.children || line >= this.target.children.length)) {
			this.makeNewLine()
		}
		line = Math.min(line, this.target.children.length - 1)

		let linePtr = this.target.children[line]
		if (!linePtr) {
			throw `What the fuck JavaScript? line=${line} children=${this.target.children.length}`
		}
		cursor.lineNo = line
		cursor.line = linePtr
		return line == lineNo 
	}


	/* 
	This will seek the text unit on the current line. If no text unit exists - then it will create one and cap the position
	Should always be called after a cursorPutOnLine()
	*/
	cursorSeekTextUnit(cursor, charNo) {
		console.log("Cursor SEEK")
		cursor.textUnit = cursor.line.firstChild
		if (!cursor.textUnit) {
			cursor.textUnit = this.makeNewTextChild(cursor.line)
		}

		cursor.charNo = 0;
		cursor.localCharNo = 0;
		this.cursorMove(cursor, charNo)	
		
		console.log(cursor)
		console.log("Cursor SEEK---")
	}

	cursorMove(cursor, charsRemaining) {
		let moved = 0;
		let prevTextUnit = null;
		console.log("cursor move")
		console.log(cursor)
		while (charsRemaining != 0) {
			let unitLen = cursor.textUnit.innerHTML.length;
			if (charsRemaining > 0) {
				//if you can fit the move within the current text unit, we're done
				if (cursor.localCharNo + charsRemaining < unitLen) {
					cursor.charNo += charsRemaining
					cursor.localCharNo += charsRemaining
					moved += charsRemaining;
					charsRemaining = 0;
				} else {
					//jump to next text unit
					let delta = unitLen - cursor.localCharNo;
					cursor.charNo += delta;
					cursor.localCharNo += delta;

					prevTextUnit = cursor.textUnit;
					cursor.textUnit = cursor.textUnit.nextSibling;

					//update counts
					charsRemaining -= delta;
					moved += delta;
					
					//overflow
					if (!cursor.textUnit) {
						//go to next line, do not make one if absent
						let lineChanged = this.cursorPutOnLine(cursor, cursor.lineNo + 1, false)
						if (lineChanged) {
							this.cursorPutAt(cursor, cursor.lineNo, 0, false)
							charsRemaining--;
							moved++;
						} else {
							//no more unites to follow, we're done
							charsRemaining = 0;
							cursor.textUnit = prevTextUnit
						}
					} else {
						cursor.localCharNo = 0;
					}
				}
			} else {
				//if you can fit the move within the current text unit, we're done
				if (cursor.localCharNo + charsRemaining >= 0) {
					cursor.charNo += charsRemaining
					cursor.localCharNo += charsRemaining
					moved += charsRemaining;
					charsRemaining = 0;
				} else {
					//jump to next text unit
					let delta = cursor.localCharNo;

					cursor.charNo -= delta;
					cursor.localCharNo -= delta;
					prevTextUnit = cursor.textUnit;
					cursor.textUnit = cursor.textUnit.prevSibling;

					//update counts
					charsRemaining += delta;
					moved -= delta;
					
					//overflow
					if (!cursor.textUnit) {
						//go to prev line, do not make one if absent
						let lineChanged = this.cursorPutOnLine(cursor, cursor.lineNo - 1, false)
						if (lineChanged) {
							cursor.textUnit = cursor.line.lastChild;
							cursor.localCharNo = cursor.textUnit.innerHTML.length;
							charsRemaining++;
							moved--;

							this.cursorCharNoFromLocalCharNo(cursor)
						} else {
							//no more unites to follow, we're done
							charsRemaining = 0;
							cursor.textUnit = prevTextUnit;
						}
					} else {
						cursor.localCharNo = cursor.textUnit.innerHTML.length;
					}
				}
			}
		}
		console.log(cursor)
		console.log('cursor move -----')
		return moved;
	}

	cursorPutAt(cursor, line, char, makeIfAbsent) {
		this.cursorPutOnLine(cursor, line, makeIfAbsent)
		this.cursorSeekTextUnit(cursor, char)
	}

	cursorCharNoFromLocalCharNo(cursor) {
		cursor.charNo = cursor.localCharNo;
		let textUnit = cursor.textUnit.prevSibling;
		while(textUnit) {
			cursor.charNo += textUnit.innerHTML.length
			textUnit = textUnit.prevSibling
		}
	}

	cursorFromLocalCharNo(cursor) {
		this.cursorCharNoFromLocalCharNo(cursor)
		cursor.line = cursor.textUnit.parentNode;

		let line = cursor.textUnit.parentNode
		let lineNo = 0;
		while(line) {
			line = line.previousSibling
			lineNo++;
		}
		cursor.lineNo = lineNo - 1;
	}

	cursorSetOnTextUnit(cursor, textUnit, offset) {
		cursor.textUnit = textUnit
		cursor.localCharNo = offset;
		this.cursorFromLocalCharNo(cursor)
	}

	splitTextUnit(unit, offset) {
		if (!this.isTextUnit(unit)) {
			throw 'You can use splitTextUnit only on textUnits'
		}

		if (offset == 0) {
			return [unit.previousSibling, unit]
		}
		
		if (offset == unit.innerHTML.length) {
			return [unit, unit.nextSibling]
		}

		let rightText = unit.innerHTML.substring(offset, unit.innerHTML.length)
		unit.innerHTML = unit.innerHTML.substring(0, offset)
		
		let descriptor = this.container.toSerializable(unit.id)
		delete descriptor.id;
		descriptor.innerHTML = rightText;
		descriptor.permissions = textItemPerms

		let right = this.container.createFromSerializable(unit.parentNode.id, descriptor, unit.nextSibling)	
		right.addEventListener("click", e => this.onTextUnitClick(e))
		
		return [unit, right]
	}

	getCurrentLine(makeIfNone) {
		let lastLine = null;
		for (let child of this.target.children) {
			if (this.isLine(child)) {
				lastLine = child;
			}
		}

		if(makeIfNone && !lastLine) {
			return this.makeNewLine();
		}
		return lastLine;
	}

	getCurrentTextChild(createIfNone) {
		let line = this.getCurrentLine(createIfNone);
		if (!line) {
			return {};
		}
  		let lastChild = line.lastChild;
		if (createIfNone && !lastChild) {
			lastChild = this.makeNewTextChild(line);
		}
		if (createIfNone && lastChild && this.isNewLine(lastChild)) {
			line = this.makeNewLine();
			lastChild = this.makeNewTextChild(line);
		}
		return {child:lastChild, line:line}
	}

	deleteSelection() {
		let selection = this.getSelected();
		if (selection && selection.units && selection.units.size > 0) {
			this.deleteTextUnits(selection.units);
			return true;
		}
		this.clearSelection()
		return false;
	}

	deleteTextUnits(units) {
		for (const unit of units) {
			this.container.delete(unit, this.appId)
		}
	}

	addPrintable(text) {
		//if there's a selection delete it first
		this.deleteSelection();
		console.log("Add printable: cursor:")
		console.log(this.cursor)
		
		this.cursorPutAt(this.cursor, this.cursor.lineNo, this.cursor.charNo, true);
		console.log(this.cursor)
		let textUnit = this.cursor.textUnit;
		let existing = textUnit.innerHTML
		let before = existing.substring(0, this.cursor.localCharNo)
		let after = existing.substring(this.cursor.localCharNo, existing.length)
		textUnit.innerHTML = `${before}${text}${after}`
		this.cursorMove(this.cursor, text.length)
		this.container.notifyUpdate(textUnit.id)
		console.log(this.cursor)
		console.log("Add printable---------")
	}

	newLine() {
		let moveToNewLine = {}
		if (this.cursor.textUnit) {
			let startMove = this.splitTextUnit(this.cursor.textUnit, this.cursor.localCharNo)[1]
			if (startMove) {
				moveToNewLine = this.findBetweenTextUnits(startMove).units
			}
		}

		this.cursor.lineNo++;
		this.makeNewLine(this.cursor.lineNo)
		this.cursorPutOnLine(this.cursor, this.cursor.lineNo, true);
		this.cursorSeekTextUnit(this.cursor, 0)
		for (const [key, value] of Object.entries(moveToNewLine)) {
			this.container.setParent(value, this.cursor.line, this.appId)
		}
	}

	//ToDo: remove lines rendered empty
	//ToDo: Bug: when deleting sometimes everyting after the pointer gets erased
	removePrintable(count) {
		if (!count) {
			return;
		}

		//ToDo: update cursor in deleteSelection
		if (this.deleteSelection()) {
			return;
		}

		let start = undefined
		let end = undefined
		console.log("REM")
		console.log(this.cursor)
		if (count > 0) {
			start = this.splitTextUnit(this.cursor.textUnit, this.cursor.localCharNo)
			this.cursorMove(this.cursor, count)
			end = this.splitTextUnit(this.cursor.textUnit, this.cursor.localCharNo)
		} else {
			end = this.splitTextUnit(this.cursor.textUnit, this.cursor.localCharNo)
			this.cursorMove(this.cursor, count)
			start = this.splitTextUnit(this.cursor.textUnit, this.cursor.localCharNo)	
		}
		console.log(this.cursor)
		console.log("--------")
		let delList = this.findBetweenTextUnits(start[1] || start[0], end[0] || end[1])
		console.log(delList)
		let toDelete = delList.units
		if (!start[1]) {
			toDelete.delete(start[0])
		}
		if (!end[0]) {
			toDelete.delete(end[1])
		}
		this.deleteTextUnits(toDelete)
	}

	styleTextUnits(style, textUnits) {
		for (const unit of textUnits) {
			if (this.isTextUnit(unit)) {
				this.container.styleChild(unit, style)
			}
		}
	}

	styleLines (style, lines) {
		for (const unit of lines) {
			if (this.isLine(unit)) {
				this.container.styleChild(unit, style)
			}
		}
	}

	getAllTextUnits() {
		let result = []
		for (const line of this.target.children) {
			if (this.isLine(line)) {
				for(const unit of line.children) {
					if(this.isTextUnit(unit)) {
						result.push(unit)
					}
				}
			}
		}

		return result;
	}

	changeFontSize(delta) {
		let selection = this.getSelected()
		if (!selection || selection.units.size == 0) {
			selection = {units:this.getAllTextUnits()}
		}

		let modFunc = function(e) {
			try {
				let fsize = parseInt(e,10) + delta
				return fsize+"px"
			} catch (ex){
				return e
			}
		}
		this.styleTextUnits({"font-size": modFunc}, selection.units)
	}

	setFontSize (fontSize) {
		let selection = this.getSelected()
		if (!selection || selection.units.size == 0) {
			selection = {units:this.getAllTextUnits()}
		}
		this.styleTextUnits({"font-size": fontSize}, selection.units)
	}

	setFont(fontFam) {
		let selection = this.getSelected()
		if (!selection || selection.units.size == 0) {
			selection = {units:this.getAllTextUnits()}
		}
		this.styleTextUnits({"font-family": fontFam}, selection.units);
	}

	align (alignment) {
		let selection = this.getSelected()
		if (!selection || selection.lines.size == 0) {
			selection = {lines:this.target.children}
		}
		this.styleLines({"text-align": alignment,  "text-justify": "inter-word"}, selection.lines)
	}

	bold () {
		let toggleFunc = function(e) {
			if (e == "bold") {
				return "normal"
			}
			return "bold"
		}

		let selection = this.getSelected()
		if (selection && selection.units.size > 0) {
			this.styleTextUnits({"font-weight": toggleFunc}, selection.units)
		} else {
			this.state.bold = toggleFunc(this.state.bold);
		}
	}

	italic (textUnits) {
		let toggleFunc = function(e) {
			if (e == 'italic') {
				return 'normal'
			}
			return 'italic'
		}

		let selection = this.getSelected()
		if (selection && selection.units.size > 0) {
			this.styleTextUnits({"font-style": toggleFunc}, selection.units)
		} else {
			this.state.italic = toggleFunc(this.state.italic);
		}
	}

	underlined (textUnits) {
		let toggleFunc = function(e) {
			if (e == 'underline') {
				return 'none'
			}
			return 'underline'
		}

		let selection = this.getSelected()
		if (selection && selection.units.size > 0) {
			this.styleTextUnits({"text-decoration": toggleFunc}, selection.units)
		} else {
			this.state.underlined = toggleFunc(this.state.underlined);
		}
	}

	/*
		Inclusive set of text units from start to end
	*/
	findBetweenTextUnits (start, end) {
		if (!start && !end) {
			throw `Can't find text units between nothing and nothing...`
		}
		if (!end) {
			end = start.parentNode.lastChild
		}
		if (!start) {
			start = end.parentNode.firstChild;
		}

		let units = new Set([])
		let lines = new Set([])
		var currentLine = start.parentNode
		var currentTextUnit = start
			
		while (currentLine) {
			if (!currentTextUnit) {
				currentTextUnit = currentLine.firstChild
			}

			lines.add(currentLine)
			while (currentTextUnit) {
				if (this.isTextUnit(currentTextUnit)){
					units.add(currentTextUnit)
					if (currentTextUnit == end) {
						units.add(end)
						return {lines:lines, units:units}
					}
				}
				currentTextUnit = currentTextUnit.nextSibling
			}

			currentLine = currentLine.nextSibling
		}
		return {lines:lines, units:units}
	}

	makeSelection(start, end) {
		let range = new Range();
  		range.setStart(start.firstChild, 0);
  		range.setEnd(end.lastChild, end.lastChild.length);

  		let sel = this.clearSelection()
		sel.addRange(range)
	}

	clearSelection () {
		let sel = document.getSelection();
		sel.removeAllRanges();
		return sel;
	}

	//ToDo: deal with reversed selections
	getSelected () {
		let docSelect = document.getSelection();
		
		//figure out if selection belongs to target
		if (docSelect 
			&& docSelect.focusNode
			&& docSelect.anchorNode
			&& this.isTextUnit(docSelect.focusNode.parentNode) 
			&& this.isTextUnit(docSelect.anchorNode.parentNode)) {
			
			var start = docSelect.anchorNode.parentNode
			var startOffset = docSelect.anchorOffset
			var end = docSelect.focusNode.parentNode
			var endOffset = docSelect.focusOffset
			
			if (start == end && startOffset == endOffset) {
				this.clearSelection();
				return null;
			}

			let position = start.compareDocumentPosition(end)
			if (position === Node.DOCUMENT_POSITION_PRECEDING){
			  var aux = start;
			  start = end;
			  end = start;
			}
			if (!position && startOffset > endOffset) {
			  var aux = startOffset;
			  startOffset = endOffset;
			  endOffset = startOffset;
			}

			let startSplit = this.splitTextUnit(start, startOffset)
			let startNode = startSplit[1]
			if (start == end) {
			 	endOffset -= startOffset
				end = startNode
			}
			let endSplit = this.splitTextUnit(end, endOffset)
			let endNode = endSplit[0]

			//position cursor
			//ToDo: set the cursor where the selection ends
			if (startSplit[0]) {
				this.cursorSetOnTextUnit(this.cursor, startSplit[0], startSplit[0].innerHTML.length)
			} else if(endSplit[1]) {
				this.cursorSetOnTextUnit(this.cursor, endSplit[1], 0)
			}
			console.log("Cursor now at")
			console.log(this.cursor)
			
			this.makeSelection(startNode, endNode)	
			return this.findBetweenTextUnits(startNode, endNode)			
		}
		return null;
	}

	selectAll() {
		if (this.target) {
			this.makeSelection(this.target.firstChild.firstChild, this.target.lastChild.lastChild)
		}
	}

	handleKeydown(e) {
		let key = e.key
		
		if (key == 'Backspace') {
			this.removePrintable(-1);
		}
		if (key == 'Enter') {
			this.newLine();
		}
		if (key == 'Control') {
			this.state.control = true;
		}

		if (!this.state.control) {
			if (ContainerTextInjector.isPrintableCharacter(key)) {
				this.addPrintable(key)
			}
		}
		
		//stop annoying scroll down on space
		if (key in this.preventDefaults) {
			e.preventDefault();
		}
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

	textToStyle(text) {
		let units = text.split(";")
		let stl = {}
		for (const unit of units) {
			let parts = unit.split(":")
			if(parts.length == 2){
				stl[parts[0].trim()] = parts[1].trim();
			}
		}

		return stl;
	}

	handleKeyUp(e) {
		let key = e.key
		if (key == 'Control') {
			this.state.control = false;
		}

		if (this.state.control) {
			e.preventDefault();
			console.log(`CTRL ${key}`)
			if (key == 'b') {
				this.bold()
			}
			if (key == 'i') {
				this.italic()
			}
			if (key == 'u') {
				this.underlined()
			}
			if (key == '1') {
				this.align('left')
			}
			if (key == '2') {
				this.align('center')
			}
			if (key == '3') {
				this.align('right')
			}
			if (key == '4') {
				this.align('justify')
			}
			if (key == '+') {
				this.changeFontSize(1)
			}
			if (key == '-') {
				this.changeFontSize(-1)
			}
			if (key == 'a') {
				this.selectAll()
			}
			//special commands
			if (key == '/') {
				console.log("processing special command")
				//href - interpret text as link
				let units = this.getAllTextUnits()
				let text = ""
				for (const unit of units) {
					text += unit.innerText;
				}
				if (this.isLink(text)) {
					for(const unit of units) {
						this.container.delete(unit.id);
					}
					this.container.createFromSerializable(this.target.id, {
						nodeName:"img",
						src:text
					});
				}

				let r = this.isData(text)
				if (r) {
					if (r.content == 'image') {
						for(const unit of units) {
							this.container.delete(unit.id);
						}

						console.log("adding image...")
						this.container.createFromSerializable(this.target.id, {
							nodeName:"img",
							src:text
						});
					}
					console.log(r)
				}
			}
			if (key == ';') {
				let units = this.getAllTextUnits()
				let text = ""
				for (const unit of units) {
					text += unit.innerText;
				}

				let style = this.textToStyle(text)
				console.log(style)
				this.container.styleChild(this.target, style)
				
				for(const unit of units) {
					this.container.delete(unit.id);
				}
			}
		}
	}
}

export let texter = new ContainerTextInjector(container, true);
texter.enable()