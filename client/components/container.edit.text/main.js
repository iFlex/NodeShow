import { container } from '../../nodeshow.js'
import { ACTIONS } from '../../Container.js'
import { Cursor } from './cursor.js'
import { Keyboard } from '../utils/keyboard.js'
//import { getSelection } from '../utils/common.js'
//ToDo:
//delete via delete doesn't work well
//font and letter size tracking
//transparent text boxes that are draggable from text
//better line comprehension in text manipulation:
//  - fixed line heights
//span compaction (combine if style is identical)
//unicode support

//wrapping - add in logic to support:
/*
	1. resizing container as text is typed (both with and height)
	2. automatically wrapping a line that is too long
		-> cursor support for this (depends on knowing char height and width)
*/

//line spacing

const textItemPerms = {}//, "container.edit":{"*":false}}
textItemPerms[ACTIONS.setPosition] = {"*":false}
//textItemPerms[ACTIONS.create] = {"*":false}

//[BUG]: clicking on a text unit doesn't pop up the editor anymore. :D fix plz
class ContainerTextInjector {
	appId = "container.edit.text"

	container = null;	
	target = null;
	#interface = null;
	#keyboard = null;

	#enabled = false
	#handlers = {};

	#debug = false;
	
	#cursorDiv = null
	cursorDescriptor = {
		nodeName:"DIV", 
		className: "text-document-cursor", 
		computedStyle:{"position":"absolute"},
		data:{ignore:true},
		permissions:{
			"container.broadcast":{"*":false},
			"container.bridge":{"*":false}
		}
	}

	lineDescriptor = {
		nodeName: "DIV", 
		className: "text-document-line", 
		permissions:textItemPerms,
		"data":{
			"containerActions":[{"trigger":"click","call":"container.edit.text.onLineClick","params":[]}]
		}
	}
	
	textUnitDescriptor = {
		nodeName: "SPAN", 
		className: "text-document-unit", 
		permissions:textItemPerms,
		computedStyle:{},
		"data":{
			"containerActions":[{"trigger":"click","call":"container.edit.text.onTextUnitClick","params":[]}]
		}
	}
	
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
		underlined: false,
		textColor: "#000000",
		highlightColor: undefined,
		fontFam: "Arial",
		fontSize: "15px"
	}

	cursor = null

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

		this.cursor = new Cursor()
		this.#keyboard = new Keyboard(this.appId);
		this.initKeyboard();

		// this.#handlers['container.select.selected'] = (e) => {
		// 	this.stop();
		// 	this.tryFetchTarget(e.selection)
		// }

		this.#handlers['paste'] = (event) => this.paste(event)
		this.#handlers['cut'] = (event) => this.cut(event)
		this.#handlers['selectionchange'] = (e) => this.onSelectionChange(e)

		//create interface holder
		this.#interface = this.container.createFromSerializable(document.body, {
			"nodeName":"div",
			"computedStyle":{
				"top":"0px",
				"left":"0px",
				"position":"absolute"
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

		this.container.hide(this.#interface, this.appId)
		//load interface style and html
		this.container.loadStyle("style.css", this.appId)
		this.container.loadHtml(this.#interface, "interface.html", this.appId)

		//create cursor pointer
		this.#cursorDiv = this.container.createFromSerializable(document.body, this.cursorDescriptor, null, this.appId)
		this.container.hide(this.#cursorDiv, this.appId)
	}

	/*
		Maybe these 2 could be done automatically by core code
	*/
	enable() {
		if (!this.#enabled) {
			for (const [key, value] of Object.entries(this.#handlers)) {
				document.addEventListener(key, value)
			}
			this.#enabled = true
		}	
	}

	disable() {
		if (this.#enabled) {
			this.stop();
			for (const [key, value] of Object.entries(this.#handlers)) {
				document.removeEventListener(key, value)
			}
			this.#keyboard.disable()
			this.container.hide(this.#interface, this.appId)
			this.#enabled = false
		}
	}

	isEnabled() {
		return this.#enabled
	}

	initKeyboard () {
		this.#keyboard.onPritable(this, (key) => this.addPrintable(key), true)
		this.#keyboard.setAction(new Set(['Backspace']), this, (key) => this.removePrintable(-1), true)
		this.#keyboard.setAction(new Set(['Delete']), this,    (key) => this.removePrintable(1), true)
		this.#keyboard.setAction(new Set(['Enter']), this,     (key) => this.newLine(), true)
		this.#keyboard.setAction(new Set(['Escape']), this,     (key) => this.stop(), true)

		this.#keyboard.setAction(new Set(['Down']), this,          (key) => this.cursorDown(), true)
		this.#keyboard.setAction(new Set(['ArrowDown']), this,     (key) => this.cursorDown(), true)
		this.#keyboard.setAction(new Set(['Up']), this,            (key) => this.cursorUp(), true)
		this.#keyboard.setAction(new Set(['ArrowUp']), this,       (key) => this.cursorUp(), true)
		this.#keyboard.setAction(new Set(['Left']), this,          (key) => this.cursorLeft(), true)
		this.#keyboard.setAction(new Set(['ArrowLeft']), this,     (key) => this.cursorLeft(), true)
		this.#keyboard.setAction(new Set(['Right']), this,         (key) => this.cursorRight(), true)
		this.#keyboard.setAction(new Set(['ArrowRight']), this,    (key) => this.cursorRight(), true)

		this.#keyboard.setAction(new Set(['Control','u']), this, (key) => this.underlined(), true)
		this.#keyboard.setAction(new Set(['Control','i']), this, (key) => this.italic(), true)
		this.#keyboard.setAction(new Set(['Control','b']), this, (key) => this.bold(), true)
		this.#keyboard.setAction(new Set(['Control','a']), this, (key) => this.selectAll(), true)
		this.#keyboard.setAction(new Set(['Control','1']), this, (key) => this.align('left'), true)
		this.#keyboard.setAction(new Set(['Control','2']), this, (key) => this.align('center'), true)
		this.#keyboard.setAction(new Set(['Control','3']), this, (key) => this.align('right'), true)
		this.#keyboard.setAction(new Set(['Control','4']), this, (key) => this.align('justify'), true)
		this.#keyboard.setAction(new Set(['Control','+']), this, (key) => this.changeFontSize(1), true)
		this.#keyboard.setAction(new Set(['Control','-']), this, (key) => this.changeFontSize(-1), true)
		this.#keyboard.setAction(new Set(['Control','/']), this, (key) => this.underlined(), true)
		this.#keyboard.setAction(new Set(['Control',';']), this, (key) => this.underlined(), true)

		this.#keyboard.setAction(new Set(['Control','c']), this, (key) => {}, false)
		this.#keyboard.setAction(new Set(['Control','v']), this, (key) => {}, false)
	}

	start (target) {
		if (!target || this.target == target || !this.#enabled) {
			return;
		}

		this.container.componentStartedWork(this.appId, {})
		console.log(`${this.appId} start text editing ${target}`)

		this.target = this.findFirstDivParent(this.container.lookup(target));
		console.log(`${this.appId} Set text edit target to ${target.id}`)
		
		try {
			this.container.isOperationAllowed('container.edit', this.target, this.appId)
		} catch (e) {
			console.log(`${this.appId} - container does not allow editing at all. Aborting`)
			this.stop();
			return;
		}
		
		if (!this.isTargetTextEditable(this.target)) {
			console.log(`${this.appId} - container not suitable for text editing. Aborting`)
			this.stop();
			return;
		}	

		this.cursor.setTarget(this.target)
		let pos = this.container.getPosition(this.target)
		//set interface position
		pos.originX = 0.0
		pos.originY = 1.0
		this.container.setPosition(this.#interface, pos, this.appId)
		this.#interface.style['min-width'] = this.container.getWidth(this.target)
		
		//bring up interface
		this.container.show(this.#interface, this.appId)
		this.container.bringToFront(this.#interface)
		this.container.show(this.#cursorDiv, this.appId)
		this.container.bringToFront(this.#cursorDiv, this.appId)

		//these need to be ephemeral state, not sent to the server and propagated...
		this.container.setMetadata(this.target, 'text-editing', true)
		//this.container.setPermission(this.target, ACTIONS.delete, 'container.create', false, this.appId)
		
		this.#keyboard.enable();
	}

	stop () {
		if (this.target) {
			console.log(`${this.appId} stop text editing`)
			this.container.componentStoppedWork(this.appId)
			this.#keyboard.disable()
			//this.container.removePermission(this.target, ACTIONS.delete, 'container.create', false, this.appId)
			this.container.removeMetadata(this.target, 'text-editing')
			
			this.cursor.setTarget(null);
			this.container.hide(this.#cursorDiv, this.appId)
			this.container.hide(this.#interface, this.appId)
			this.target = null;
		}
	}

	static isPrintableCharacter(key) {
		return key.length === 1;
	}

	findFirstDivParent(elem) {
		if (!elem)
			return null;
		
		if (this.isTextUnit(elem)) {
			return elem.parentNode.parentNode
		}

		if (elem.nodeName == 'DIV') {
			if (this.isLine(elem)) {
				return elem.parentNode
			}
			return elem
		}

		return this.findFirstDivParent(elem.parentNode)
	}

	isTargetTextEditable(target) {
		if (target === this.container.parent) {
			console.log(`${this.appId} - currently not allowing adding text to root container`)
			return false;
		}

		for (const child of target.children) {
			if (this.isLine(child)) {
				console.log(`${this.appId} - found a line. Can text edit`)
				return true;
			}
		}

		if (!target.childNodes || target.childNodes.length == 0) {
			return true;
		}
		
		console.log(`${this.appId} - comprised only of other type of containers. Cannot text edit`)
		return false;
	}

	//doesn't support rich text yet
	paste (event) {
	    if (!this.target) {
	    	return;
	    }
	    
	    let paste = (event.clipboardData || window.clipboardData).getData('text');
	    this.addPrintable(paste)
	    event.preventDefault();
	}

	cut (event) {
		if (!this.target) {
			return;
		}

		this.deleteSelection();
		event.preventDefault();
	}
	
	isLine(elem) {
		return elem && elem.className && elem.className.includes(this.lineDescriptor.className); 
	}

	isNewLine(elem) {
		return this.isLine(elem) && elem.children.length == 0;
	}

	isTextUnit(elem) {
		return elem && elem.className && elem.className.includes(this.textUnitDescriptor.className);
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

	cursorUp () {
		if (!this.target) {
			return;
		}

		let curStat = this.cursor.getPosition()
		console.log("Cursor Up")
		console.log(this.cursor.putAt(curStat.lineNumber - 1, curStat.charNumber))
		this.cursorUpdateVisible(this.#cursorDiv)
	}

	cursorDown () {
		if (!this.target) {
			return;
		}

		let curStat = this.cursor.getPosition()
        console.log("Cursor Down")
        console.log(this.cursor.putAt(curStat.lineNumber + 1, curStat.charNumber))
        this.cursorUpdateVisible(this.#cursorDiv)
	}

	cursorLeft () {
		if (!this.target) {
			return;
		}

		console.log("Cursor Left")
		console.log(this.cursor.move(-1))
		this.cursorUpdateVisible(this.#cursorDiv)
	}

	cursorRight () {
		if (!this.target) {
			return;
		}

		console.log("Cursor Right")
		console.log(this.cursor.move(1))
		this.cursorUpdateVisible(this.#cursorDiv)
	}

	makeNewLine(insertAt) {
		let lineBefore = undefined;
		if (this.target.children && insertAt >= 0 && insertAt < this.target.children.length) {
			lineBefore = this.target.children[insertAt]
		}
		return this.container.createFromSerializable(this.target.id, this.lineDescriptor, lineBefore, this.appId)
	}

	makeNewTextChild (line) {
		this.textUnitDescriptor.computedStyle['color'] = this.state.textColor;
		//this.textUnitDescriptor.computedStyle['background-color'] = this.state.highlightColor;
		this.textUnitDescriptor.computedStyle['font-family'] = this.state.fontFam;
		this.textUnitDescriptor.computedStyle['font-size'] = this.state.fontSize;

		let unit = this.container.createFromSerializable(line.id, this.textUnitDescriptor, null, this.appId)
		return unit
	}

	styleTarget() {
		if ( this.target ) {
			this.container.styleChild(this.target, this.textContainerStyle, this.appId)
		}
	}
	
	findClosestTextUnit(line, direction) {
		let pointer = line
		let skippedLines = new Set([])
		while (this.isNewLine(pointer)) {
			skippedLines.add(pointer)
			if (direction < 0) {
				pointer = pointer.previousSibling
			} else {
				pointer = pointer.nextSibling
			}
		}

		let result = null
		if (pointer && !this.isNewLine(pointer)) {
			if (direction < 0){
				result = pointer.childNodes[pointer.childNodes.length - 1]
			} else {
				result = pointer.childNodes[0]
			}
		}
		return {textUnit: result, skippedLines: skippedLines}
	}

	/*
		Inclusive set of text units from start to end
		//deprecate...
		ToDo: deal with situatoin when start is after end
	*/
	findBetweenTextUnits (start, end, stopAtEOL) {
		if (!start && !end) {
			return {lines:new Set([]), units: new Set([])}
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

	findBetween (start, end, stopAtEOL) {
		if (!start && !end) {
			return {lines:new Set([]), units: new Set([])}
		}

		let currentLine = null
		let currentTextUnit = null
		if (this.isTextUnit(start)) {
			currentTextUnit = start
			currentLine = start.parentNode
		} else if (this.isLine(start)) {
			currentLine = start
			currentTextUnit = start.firstChild
		} else if (start) {
			throw `Find only works using text units and lines, you seem to have provided a different kind of DOM element for start`
		}

		let endTextUnit = null
		let endLine = null
		if (this.isTextUnit(end)) {
			endTextUnit = end
			endLine = end.parentNode
		} else if (this.isLine(end)) {
			endLine = end
			endTextUnit = end.lastChild
		} else if(end) {
			throw `Find only works using text units and lines, you seem to have provided a different kind of DOM element for end`	
		}

		if (!start) {
			currentLine = endLine
			currentTextUnit = currentLine.firstChild
		}
		
		if (!end) {
			endLine = currentLine
			endTextUnit = currentLine.lastChild
		}

		let units = new Set([])
		let lines = new Set([])			
		while (currentLine) {
			if (!currentTextUnit) {
				currentTextUnit = currentLine.firstChild
			}
			lines.add(currentLine)

			while (currentTextUnit) {
				if (this.isTextUnit(currentTextUnit)) {
					units.add(currentTextUnit)
					if (currentTextUnit == endTextUnit) {
						units.add(end)
						return {lines:lines, units:units}
					}
				}
				currentTextUnit = currentTextUnit.nextSibling
			}
			if (stopAtEOL) {
				break;
			}

			if (currentLine == endLine) {
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
					this.cursor.putOn(startSplit[0], startSplit[0].innerHTML.length)
				} else if(endSplit[1]) {
					this.cursor.putOn(endSplit[1], 0)
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

		this.start(e.target.parentNode.parentNode)
		this.cursor.putOn(textUnit, offset)
		this.cursorUpdateVisible(this.#cursorDiv)
	}

	// onLineClick(e) {
	// 	let line = e.target
	// 	this.start(e.target.parentNode)
	// }

	cursorUpdateVisible(blinker) {
		if (!blinker) {
			blinker = this.#cursorDiv
		}

		let curStat = this.cursor.get()
		
		let textUnit = curStat.textUnit
		let offset = curStat.localCharNumber
		if(!textUnit) {
			textUnit = curStat.line
			offset = 0
		}

		let unitPos = this.container.getPosition(textUnit)
		let unitHeight = this.container.getHeight(textUnit)
		let charWidth = this.container.getWidth(textUnit) / textUnit.innerHTML.length
		unitPos.left += Math.ceil(charWidth * offset)

		this.container.setPosition(blinker, {top:unitPos.top,left:unitPos.left}, this.appId)
		this.container.setHeight(blinker, unitHeight, this.appId)
		this.container.show(blinker, this.appId)
		this.container.bringToFront(blinker, this.appId)
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

		this.container.notifyUpdate(unit, this.appId)
		let right = this.container.createFromSerializable(unit.parentNode.id, descriptor, unit.nextSibling, this.appId)	
		
		return [unit, right]
	}

	deleteSelection() {
		let selection = this.getSelected();
		if (selection && selection.units && selection.units.size > 0) {
			this.deleteTextUnits(selection.units, true);
			return true;
		}
		this.clearSelection()
		return false;
	}

	deleteLines(lines) {
		for (const line of lines) {
			this.container.delete(line, this.appId)
		}
	}

	deleteTextUnits(units, andLines) {
		for (const unit of units) {
			let parent = unit.parentNode
			this.container.delete(unit, this.appId)
			if (parent.children.length == 0 && andLines) {
				this.container.delete(parent, this.appId)
			}
		}
	}

	addPrintable(text) {
		if (!this.target) {
			return;
		}

		this.styleTarget()
		
		//if there's a selection delete it first
		this.deleteSelection();
		
		let curStat = this.cursor.get()
		if (!curStat.line) {
			this.makeNewLine(0)
			curStat = this.cursor.get()
		}
		if (!curStat.textUnit) {
			this.makeNewTextChild(curStat.line)
			curStat = this.cursor.get()
		}
	
		let textUnit = curStat.textUnit;
		let existing = textUnit.innerHTML
		let before = existing.substring(0, curStat.localCharNumber)
		let after = existing.substring(curStat.localCharNumber, existing.length)
		textUnit.innerHTML = `${before}${text}${after}`
		
		this.cursor.move(text.length)
		this.cursorUpdateVisible(this.#cursorDiv)
		this.container.notifyUpdate(textUnit.id, this.appId)
	}
	
	newLine() {
		if (!this.target) {
			return;
		}

		this.clearSelection()

		let moveToNewLine = new Set([])
		let curStat = this.cursor.get()
		if (curStat.textUnit) {
			let split = this.splitTextUnit(curStat.textUnit, curStat.localCharNumber)
			if (split[1]) {
				moveToNewLine = this.findBetweenTextUnits(split[1]).units
			}
		}
		//make new line and pull in items
		let line = this.makeNewLine(curStat.lineNumber + 1)
		for (const textUnit of moveToNewLine) {
			this.container.setParent(textUnit, line, this.appId)
		}
		
		//update cursor
		this.cursor.putAt(curStat.lineNumber + 1, 0)
		this.cursorUpdateVisible(this.#cursorDiv)
	}

	//ToDo: remove lines rendered empty	
	//BUG: sometimes removing in between text units creates ghost text units
	//BUG: sometimes this doesn't delete anyting... 
	//BUG: fix forward deletion
	removePrintable(count) {
		if (!this.target) {
			return;
		}

		if (!count) {
			return;
		}

		//ToDo: update cursor in deleteSelection
		if (this.deleteSelection()) {
			return;
		}

		let start = undefined
		let startLine = undefined

		let end = undefined
		let endLine = undefined

		let cursorStart = this.cursor.get()
		let cursorEnd = null
		let currentLine = null
		let carryOver = null
		if (count > 0) {
			//completely untested flow
			if (cursorStart.textUnit) {
				start = this.splitTextUnit(cursorStart.textUnit, cursorStart.localCharNumber)
				carryOver = this.findBetween(null,start[0]).units
			}
			startLine = cursorStart.line

			cursorEnd = this.cursor.move(count)
			endLine = cursorEnd.line
			currentLine = endLine

			if (cursorEnd.textUnit) {
				end = this.splitTextUnit(cursorEnd.textUnit, cursorEnd.localCharNumber)
			}
		
			if(start && end && start[1] && start[1] == end[1]) { //split happened on the same text unit
				start[1] = end[0]
			}
			//todo replicate below case
		} else {
			if (cursorStart.textUnit) {
				end = this.splitTextUnit(cursorStart.textUnit, cursorStart.localCharNumber)
				carryOver = this.findBetween(end[1], null).units		
			}
			endLine = cursorStart.line

			cursorEnd = this.cursor.move(count)
			startLine = cursorEnd.line
			currentLine = startLine

			if (cursorEnd.textUnit) {
				start = this.splitTextUnit(cursorEnd.textUnit, cursorEnd.localCharNumber)	
			}

			if (end && start && cursorEnd.textUnit == end[0]) {
				//this is a special annoying case
				end[0] = start[1]
			}
		}

		//computing delete list
		let startElem = (start) ? (start[1] || start[0]) : startLine
		let endElem = (end) ? (end[0] || end[1]) : endLine

		let delList = this.findBetween( startElem, endElem )

		let toDelete = delList.units
		if (start && !start[1]) {
			toDelete.delete(start[0])
		}
		if (end && !end[0]) {
			toDelete.delete(end[1])
		}

		let linesToDelete = delList.lines
		linesToDelete.delete(currentLine)
		
	
		this.deleteTextUnits(toDelete, false)
		if ( carryOver ) {
			for (const carryOverUnit of carryOver) {
				try { //
					this.container.setParent(carryOverUnit, currentLine, this.appId)
				} catch (e) {
					console.log("PLEASE FIX THIS. THERE WAS AN INVALID ELEMENT IN THE CARRY OVER SET")
				}
			}
		}
		this.deleteLines(linesToDelete) 

		this.cursorUpdateVisible(this.#cursorDiv)
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
				this.container.styleChild(unit, style, this.appId)
			}
		}
	}

	styleLines (style, lines) {
		for (const unit of lines) {
			if (this.isLine(unit)) {
				this.container.styleChild(unit, style, this.appId)
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

	changeFontSize (delta) {
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

		this.cursorUpdateVisible(this.#cursorDiv)
	}

	setFontSize (fontSize) {
		let selection = this.getSelected()
		if (!selection || selection.units.size == 0) {
			selection = {units:this.getAllTextUnits()}
		}
		this.styleTextUnits({"font-size": fontSize}, selection.units)

		this.cursorUpdateVisible(this.#cursorDiv)
	}

	fontUp (e) {
		e.preventDefault();
		this.changeFontSize(1)
	}

	fontDown (e) {
		e.preventDefault();
		this.changeFontSize(-1)
	}

	setFont(fontFam) {
		this.state.fontFam = fontFam

		let selection = this.getSelected()
		if (!selection || selection.units.size == 0) {
			selection = {units:this.getAllTextUnits()}
		}
		this.styleTextUnits({"font-family": fontFam}, selection.units);

		this.cursorUpdateVisible(this.#cursorDiv)
	}

	align (alignment) {
		let selection = this.getSelected()
		if (!selection || selection.lines.size == 0) {
			selection = {lines:this.target.children}
		}
		this.styleLines({"text-align": alignment,  "text-justify": "inter-word"}, selection.lines)
		
		this.cursorUpdateVisible(this.#cursorDiv)
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

		this.clearSelection()
		this.cursorUpdateVisible(this.#cursorDiv)
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

		this.clearSelection()
		this.cursorUpdateVisible(this.#cursorDiv)
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

		this.clearSelection()
		this.cursorUpdateVisible(this.#cursorDiv)
	}

	#setColor(clr) {
		this.state.textColor = clr;
		let selection = this.getSelected()
		if (selection && selection.units.size > 0) {
			this.styleTextUnits({"color": clr}, selection.units)
		}
	}

	setColor(e) {
		this.#setColor(e.target.value)
	}

	#setHighlightColor(clr) {
		this.state.highlightColor = clr;
		let selection = this.getSelected()
		if (selection && selection.units.size > 0) {
			this.styleTextUnits({"background-color": clr}, selection.units)
		}
	}

	setHighlightColor(e) {
		this.#setHighlightColor(e.target.value)
	}

	changeFont(e) {
		console.log(`${this.appId} setting font family to: ${e.target.value}`)
		this.setFont(this.state.fontFam)
	}

	updateInterface() {
		document.getElementById('ns-text-editor-font').value = this.state.fontSize
	}
}

export let texter = new ContainerTextInjector(container, false);
texter.enable()