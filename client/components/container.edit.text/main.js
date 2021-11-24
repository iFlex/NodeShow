import {container} from '../../nodeshow.js'

//ToDo:
//newlines (support them properly)
//font and letter size tracking
//transparent text boxes that are draggable from text
//better line comprehension in text manipulation:
//  - fixed line heights
//  - cursor move up to shorter line doesn't work (it works, but need to fix new line represenation for it to be perfect)
//fix cursor bugs...
//fix prevent default functionality (only do it for our commands, do not prevent default stuff for copy and paste)
//span compaction (combine if style is identical)
//unicode support

//wrapping - add in logic to support:
/*
	1. resizing container as text is typed (both with and height)
	2. automatically wrapping a line that is too long
		-> cursor support for this (depends on knowing char height and width)
*/

//line spacing

const textItemPerms = {"container.move":{"*":false}, "container.edit":{"*":false}}
	
class ContainerTextInjector {
	appId = "container.edit.text"

	container = null;	
	target = null;
	#interface = null;
	#debug = false;

	#newline = '&#13;'

	#cursorDiv = null
	cursorDescriptor = {
		nodeName:"DIV", 
		className: "text-document-cursor", 
		computedStyle:{"position":"absolute"}
	}
	lineDescriptor = {
		nodeName: "DIV", 
		className: "text-document-line", 
		permissions:textItemPerms
	}
	textUnitDescriptor = {
		nodeName: "SPAN", 
		className: "text-document-unit", 
		permissions:textItemPerms,
		"data-container-actions":[
			{"trigger":"click","call":"container.edit.text.onTextUnitClick","params":[]}
		]
	}
	preventDefaults = {'u':true,'b':true,'i':true,' ':true}
	
	textContainerStyle  = {
	  "width": "auto",
	  "height":  "auto",
	  //"min-width":  "300px", //these mins shuold be overridable depending on the text
	  //"min-height": "150px",
	  "padding": "20px"
	}

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

		//create cursor pointer
		this.#cursorDiv = this.container.createFromSerializable(null, this.cursorDescriptor, null, this.appId)
		this.container.hide(this.#cursorDiv)
	}
 
	enable() {
		document.addEventListener("keydown", (e) => this.handleKeydown(e))
		document.addEventListener("keyup",(e) => this.handleKeyUp(e))

	    document.addEventListener('container.edit.pos.selected', e => this.setTarget(e.detail.id));
		document.addEventListener('container.edit.pos.unselected', (e) => this.unsetTarget());

		//clipboard
		document.addEventListener('paste', (event) => this.paste(event));
		document.addEventListener('cut', (event) => this.cut(event));
		//selection
		document.addEventListener('selectionchange', (e) => this.onSelectionChange(e));	
	}

	disable() {
		document.removeEventListener("keydown", (e) => this.handleKeydown(e))
		document.removeEventListener("keyup",(e) => this.handleKeyUp(e))

		document.removeEventListener('container.edit.pos.selected', e => this.setTarget(e.detail.id));
		document.removeEventListener('container.edit.pos.unselected', (e) => this.unsetTarget());

		//clipboard
		document.removeEventListener('paste', (event) => this.paste(event));
		document.removeEventListener('cut', (event) => this.cut(event));
		//selection
		document.removeEventListener('selectionchange', (e) => this.onSelectionChange(e));	
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
		return elem.className && elem.className.includes(this.textUnitDescriptor.className);
	}

	isTextUnitInCurrentTarget(unit) {
		while(unit) {
			if(unit == this.target) {
				return true;
			}
			unit = unit.parentNode
		}
		return false;
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
		let unit = this.container.createFromSerializable(line.id, this.textUnitDescriptor, null, this.appId)
		return unit
	}

	styleTarget() {
		if ( this.target ) {
			this.container.styleChild(this.target, this.textContainerStyle)
		}
	}
	/*
		Inclusive set of text units from start to end
		ToDo: deal with situatoin when start is after end
	*/
	findBetweenTextUnits (start, end, stopAtEOL) {
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
			if (stopAtEOL) {
				break;
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

	//carful not to mess up the cursor here
	//BUG: screws up the cursor when the selection is deleted
	onSelectionChange(e) {
		// let docSelect = document.getSelection();
		// if (docSelect 
		// 	&& docSelect.focusNode
		// 	&& docSelect.anchorNode) {
		// 	if(this.isTextUnitInCurrentTarget(docSelect.focusNode.parentNode)) {
		// 		this.cursorSetOnTextUnit(this.cursor, docSelect.focusNode.parentNode, docSelect.focusOffset)
		// 	}
		// }
	}

	//ToDo: deal with reversed selections
	getSelected () {
		let docSelect = document.getSelection();
		
		//figure out if selection belongs to target
		if (docSelect 
			&& docSelect.focusNode
			&& docSelect.anchorNode) {
			
			let focusTunitInTarget = this.isTextUnitInCurrentTarget(docSelect.focusNode.parentNode)
			let anchorTunitInTarget = this.isTextUnitInCurrentTarget(docSelect.anchorNode.parentNode)

			if (focusTunitInTarget && anchorTunitInTarget) {
				var start = docSelect.anchorNode.parentNode
				var startOffset = docSelect.anchorOffset
				var end = docSelect.focusNode.parentNode
				var endOffset = docSelect.focusOffset
				
				if (start == end && startOffset == endOffset) {
					this.clearSelection();
					return null;
				}

				if (this.isTextUnitBefore(end, start)) {
					let aux = start;
					start = end;
					end = aux;
				}

				if (start == end && (startOffset > endOffset)){
					let aux = endOffset;
					endOffset = startOffset;
					startOffset = aux;
				}

				let startSplit = this.splitTextUnit(start, startOffset)
				let startNode = startSplit[1]
				if (start == end) {
				 	endOffset -= startOffset
					end = startNode
				}
				let endSplit = this.splitTextUnit(end, endOffset)
				let endNode = endSplit[0]
				
				this.makeSelection(startNode, endNode)

				if (startSplit[0]) {
					this.cursorSetOnTextUnit(this.cursor, startSplit[0], startSplit[0].innerHTML.length)
				} else if(endSplit[1]) {
					this.cursorSetOnTextUnit(this.cursor, endSplit[1], 0)
				}

				return this.findBetweenTextUnits(startNode, endNode)			
			}
		}
		return null;
	}

	selectAll() {
		if (this.target) {
			this.makeSelection(this.target.firstChild.firstChild, this.target.lastChild.lastChild)
		}
	}

	//cursor logic
	//BUG: placing cursor on click is not accurate sadly. Check calculatios
	onTextUnitClick(e) {
		let textUnit = e.target
		let clickP = e.layerX
		let charWidth = this.container.getWidth(textUnit) / textUnit.innerHTML.length;
		let offset = Math.ceil(clickP/charWidth)

		this.cursorSetOnTextUnit(this.cursor, textUnit, offset)
	}

	cursorUpdateVisible(cursor, blinker) {
		let textUnit = cursor.textUnit
		if(!textUnit) {
			return
		}

		let unitPos = this.container.getPosition(textUnit)
		let unitHeight = this.container.getHeight(textUnit)
		let charWidth = this.container.getWidth(textUnit) / textUnit.innerHTML.length
		unitPos.left += Math.ceil(charWidth * cursor.localCharNo)

		this.container.setPosition(this.#cursorDiv, {top:unitPos.top,left:unitPos.left})
		this.container.setHeight(this.#cursorDiv, unitHeight)
		this.container.show(this.#cursorDiv)
		this.container.bringToFront(this.#cursorDiv)
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
	*/
	cursorSeekTextUnit(cursor, charNo, makeIfAbsent) {
		//console.log("Cursor SEEK")
		cursor.textUnit = cursor.line.firstChild
		if (!cursor.textUnit && makeIfAbsent) {
			cursor.textUnit = this.makeNewTextChild(cursor.line)
		}

		let lineLen = 0;
		for (const child of cursor.line.children) {
			lineLen += child.innerHTML.length
		}

		cursor.charNo = 0;
		cursor.localCharNo = 0;
		this.cursorMove(cursor, Math.min(charNo, lineLen), true)	
		
		//console.log(cursor)
		//console.log("Cursor SEEK---")
	}


	cursorToPrevUnit(cursor) {
		console.log(`Cursor jump to prev text unit from`)
		console.log(cursor.textUnit)
		let switchTo = cursor.textUnit.previousSibling;
		if(!switchTo && this.cursorPutOnLine(cursor, cursor.lineNo - 1)) {
			switchTo = this.cursor.line.lastChild
		}
		console.log("Switch to:")
		console.log(switchTo)
		if (switchTo) {
			this.cursorSetOnTextUnit(cursor, switchTo, switchTo.innerHTML.length)
		}
		console.log(cursor)
		console.log("switch to prev------")
	}

	cursorToNextUnit(cursor) {
		console.log(`Cursor jumps to next textUnit`)
		console.log(cursor.textUnit)
		let switchTo = cursor.textUnit.nextSibling
		if(!switchTo && this.cursorPutOnLine(cursor, cursor.lineNo + 1)) {
			switchTo = this.cursor.line.firstChild
		}
		
		if(switchTo) {
			this.cursorSetOnTextUnit(cursor, switchTo, 0)
		}
		console.log(cursor)
		console.log("switch to next------")
	}

	/*
	Seems stable for now
	 */
	cursorMove(cursor, charsRemaining) {
		console.log(`Cursor will move by ${charsRemaining}`)
		let moved = 0;
		while (charsRemaining != 0) {
			if (charsRemaining < 0) {
				if (cursor.localCharNo == 0) {
					this.cursorToPrevUnit(cursor)
				}
				
				if (cursor.localCharNo == 0) {
					//cannot cotinue moving
					break
				}

				cursor.localCharNo --;
				cursor.charNo --;
				moved --;

				charsRemaining ++;

				if (cursor.localCharNo == 0) {
					this.cursorToPrevUnit(cursor)
				}
			} else {
				if (cursor.localCharNo == cursor.textUnit.innerHTML.length) {
					this.cursorToNextUnit(cursor)
				}
				if (cursor.localCharNo == cursor.textUnit.innerHTML.length) {
					//cannot continue moving
					break;
				}
				cursor.localCharNo ++;
				cursor.charNo ++;
				moved ++;

				charsRemaining --;

				if (cursor.localCharNo == cursor.textUnit.innerHTML.length) {
					this.cursorToNextUnit(cursor)
				}
			}
		}

		this.cursorUpdateVisible(this.cursor, this.#cursorDiv)
	}

	cursorPutAt(cursor, line, char, makeIfAbsent) {
		this.cursorPutOnLine(cursor, line, makeIfAbsent)
		this.cursorSeekTextUnit(cursor, char, makeIfAbsent)
		this.cursorUpdateVisible(this.cursor, this.#cursorDiv)
	}

	cursorCharNoFromLocalCharNo(cursor) {
		cursor.charNo = cursor.localCharNo;
		let textUnit = cursor.textUnit.previousSibling;
		while(textUnit) {
			cursor.charNo += textUnit.innerHTML.length
			textUnit = textUnit.previousSibling
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
		console.log(`Placing cursor on text unit at offset ${offset}`)
		console.log(textUnit)
		cursor.textUnit = textUnit
		cursor.localCharNo = offset;
		this.cursorFromLocalCharNo(cursor)
		console.log(cursor)

		this.cursorUpdateVisible(this.cursor, this.#cursorDiv)
	}

	splitTextUnit(unit, offset) {
		if (!this.isTextUnit(unit)) {
			throw 'You can use splitTextUnit only on textUnits'
		}
		
		// if (unit.innerHTML.length == 0) {
		// 	return [null, null]
		// }

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

		let right = this.container.createFromSerializable(unit.parentNode.id, descriptor, unit.nextSibling, this.appId)	
		
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
			let parent = unit.parentNode
			this.container.delete(unit, this.appId)
			if (parent.children.length == 0) {
				this.container.delete(parent, this.appId)
			}
		}
	}

	addPrintable(text) {
		this.styleTarget()
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

	/*
	ToDo: Seems to be working ok
	*/
	newLine() {
		let moveToNewLine = new Set([])
		if (this.cursor.textUnit) {
			let split = this.splitTextUnit(this.cursor.textUnit, this.cursor.localCharNo)
			console.log(split)
			if (split[1]) {
				moveToNewLine = this.findBetweenTextUnits(split[1]).units
			}
		}
		console.log(moveToNewLine)
		//make new line and pull in items
		let line = this.makeNewLine(this.cursor.lineNo + 1)
		for (const textUnit of moveToNewLine) {
			this.container.setParent(textUnit, line, this.appId)
		}
		//update cursor
		this.cursorToNextUnit(this.cursor)
	}

	//ToDo: remove lines rendered empty
	//BUG: sometimes removing in between text units creates ghost text units
	//BUG: when deleting past line end, the current line does not get moved into the upper line
	//BUG: sometimes this doesn't delete anyting...
	removePrintable(count) {
		console.log(`Remove printable ${count}`)
		console.log(this.cursor)

		if (!count) {
			return;
		}

		//ToDo: update cursor in deleteSelection
		if (this.deleteSelection()) {
			return;
		}

		let start = undefined
		let end = undefined

		if (count > 0) {
			start = this.splitTextUnit(this.cursor.textUnit, this.cursor.localCharNo)
			this.cursorMove(this.cursor, count)
			end = this.splitTextUnit(this.cursor.textUnit, this.cursor.localCharNo)
			if(start[1] && start[1] == end[1]) { //split happened on the same text unit
				start[1] = end[0]
			}
		} else {
			end = this.splitTextUnit(this.cursor.textUnit, this.cursor.localCharNo)
			this.cursorMove(this.cursor, count)
			start = this.splitTextUnit(this.cursor.textUnit, this.cursor.localCharNo)
			if (this.cursor.textUnit == end[0]) {
				//this is a special annoying case
				end[0] = start[1]
			}
		}
		let delList = this.findBetweenTextUnits(start[1] || start[0], end[0] || end[1])
		let toDelete = delList.units
		if (!start[1]) {
			toDelete.delete(start[0])
		}
		if (!end[0]) {
			toDelete.delete(end[1])
		}
		this.deleteTextUnits(toDelete)

		console.log(this.cursor)
		console.log("Remove printable ----")
	}

	getTextUnitDistanceFromRoot(textUnit) {
		let dist = 0;
		let node = textUnit
		while (node) {
			if (this.isTextUnit(node) && !node.previousSibling) {
				node = node.parentNode
			} else {
				node = node.previousSibling	
			}
			dist ++;
		}

		return dist;
	}

	isTextUnitBefore(textUnit1, textUnit2) {
		return this.getTextUnitDistanceFromRoot(textUnit1) < this.getTextUnitDistanceFromRoot(textUnit2)
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

		this.cursorUpdateVisible(this.cursor, this.#cursorDiv)
	}

	setFontSize (fontSize) {
		let selection = this.getSelected()
		if (!selection || selection.units.size == 0) {
			selection = {units:this.getAllTextUnits()}
		}
		this.styleTextUnits({"font-size": fontSize}, selection.units)

		this.cursorUpdateVisible(this.cursor, this.#cursorDiv)
	}

	setFont(fontFam) {
		let selection = this.getSelected()
		if (!selection || selection.units.size == 0) {
			selection = {units:this.getAllTextUnits()}
		}
		this.styleTextUnits({"font-family": fontFam}, selection.units);

		this.cursorUpdateVisible(this.cursor, this.#cursorDiv)
	}

	align (alignment) {
		let selection = this.getSelected()
		if (!selection || selection.lines.size == 0) {
			selection = {lines:this.target.children}
		}
		this.styleLines({"text-align": alignment,  "text-justify": "inter-word"}, selection.lines)
		
		this.cursorUpdateVisible(this.cursor, this.#cursorDiv)
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

		this.cursorUpdateVisible(this.cursor, this.#cursorDiv)
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

		this.cursorUpdateVisible(this.cursor, this.#cursorDiv)
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

		this.cursorUpdateVisible(this.cursor, this.#cursorDiv)
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
		if (key == "Down" || key == "ArrowDown") {
			this.cursorPutAt(this.cursor, this.cursor.lineNo + 1, this.cursor.charNo)
		}
   	 	if (key == "Up" || key == "ArrowUp") {
   	 		this.cursorPutAt(this.cursor, this.cursor.lineNo - 1, this.cursor.charNo)
   	 	}
		if (key == "Left" || key == "ArrowLeft") {
			this.cursorMove(this.cursor, -1)
		}
      	if (key == "Right" || key == "ArrowRight") {
      		this.cursorMove(this.cursor, 1)
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
			if (key == '8') {
				this.changeFontSize(1)
			}
			if (key == '9') {
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
					},null,this.appId);
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
						},null,this.appId);
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